// Organization Service - Organizations, Departments, Projects
// This app runs on the Firebase Spark (free) plan, which has no Cloud
// Functions. All org operations are therefore direct Firestore writes, gated
// entirely by the security rules (organizations write => master-admin only;
// departments/projects write => that org's org-admin or master-admin). Actions
// that genuinely require the Admin SDK (user impersonation, seat-limit
// triggers, scheduled usage stats) are unavailable on this plan.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { DEFAULT_CURRENCY } from '@/lib/money';

const ORGS_COLLECTION = 'organizations';

// Billing contact, CC list, storage and seat limit are NOT kept on the
// organization document: every member (clients included) can read that one.
// They live in organizations/{id}/private/settings (org-admin + master-admin).
// The seat counter lives in organizations/{id}/meta/seats, where the rules only
// let it move together with a user being added or removed.
const PRIVATE_FIELDS = ['seatLimit', 'storageQuotaMB', 'billingEmail', 'ccEmails'];
const settingsRef = (orgId) => doc(db, ORGS_COLLECTION, orgId, 'private', 'settings');
const seatsRef = (orgId) => doc(db, ORGS_COLLECTION, orgId, 'meta', 'seats');

// Best-effort audit trail. Rules allow only master-admin to write audit_logs,
// so this silently no-ops for other callers rather than failing their action.
const writeAuditLog = async (entry) => {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorId: auth.currentUser?.uid || null,
      timestamp: Timestamp.now(),
      ...entry,
    });
  } catch (err) {
    console.warn('Audit log write skipped:', err?.code || err?.message);
  }
};

// ─── Organizations (master-admin) ──────────────────────────────────────────

export const getAllOrganizations = async () => {
  const snapshot = await getDocs(collection(db, ORGS_COLLECTION));
  const orgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Master-admin view: fold each organization's private settings back in, so the
  // caller still sees one flat object. Organizations not yet migrated keep the
  // legacy fields on the document itself, which stay as the fallback.
  return Promise.all(
    orgs.map(async (org) => {
      try {
        const s = await getDoc(settingsRef(org.id));
        return s.exists() ? { ...org, ...s.data() } : org;
      } catch {
        return org;
      }
    })
  );
};

/** Private settings (billing contact, CC list, ...). Org-admin and master-admin only. */
export const getOrganizationSettings = async (orgId) => {
  const s = await getDoc(settingsRef(orgId));
  return s.exists() ? s.data() : null;
};

export const getOrganizationById = async (orgId) => {
  const orgDoc = await getDoc(doc(db, ORGS_COLLECTION, orgId));
  return orgDoc.exists() ? { id: orgDoc.id, ...orgDoc.data() } : null;
};

/**
 * Reserve an organization ID without writing anything yet. Provisioning
 * creates the first org-admin's Auth account BEFORE writing the organization
 * doc (see MasterAdminDashboard) — if account creation fails (e.g. email
 * already in use), nothing should be left behind. Generating the ID up front
 * lets both writes share it without creating the org doc prematurely.
 * @returns {string}
 */
export const generateOrgId = () => doc(collection(db, ORGS_COLLECTION)).id;

/**
 * Provision a new organization under a given ID (see generateOrgId). Security
 * rules restrict organizations writes to master-admin, so this can only
 * succeed for a master-admin.
 * @param {string} orgId - from generateOrgId()
 * @param {Object} orgData - {name, plan, seatLimit, storageQuotaMB, billingEmail, ccEmails}
 * @returns {Promise<{orgId: string}>}
 */
export const provisionOrganization = async (orgId, orgData) => {
  const seatLimit = Number(orgData.seatLimit ?? 10) || 10;
  // The first org-admin's account is created before this runs (see
  // MasterAdminDashboard), so start the seat counter from what already exists.
  const existing = await getDocs(query(collection(db, 'users'), where('orgId', '==', orgId)));

  const batch = writeBatch(db);
  batch.set(doc(db, ORGS_COLLECTION, orgId), {
    name: orgData.name,
    plan: orgData.plan ?? 'trial',
    status: orgData.plan === 'active' ? 'active' : 'trial',
    createdAt: Timestamp.now(),
    createdByMasterAdminId: auth.currentUser?.uid || null,
  });
  batch.set(settingsRef(orgId), {
    seatLimit,
    storageQuotaMB: orgData.storageQuotaMB ?? 1000,
    billingEmail: orgData.billingEmail ?? '',
    ccEmails: orgData.ccEmails ?? [],
  });
  batch.set(seatsRef(orgId), { seatsUsed: existing.size, seatLimit, lastSeatUid: null });
  await batch.commit();
  await writeAuditLog({ action: 'provision_org', targetOrgId: orgId });
  return { orgId };
};

/**
 * Update an organization's editable fields (master-admin only, enforced by
 * rules). Accepts any of: name, plan, seatLimit, storageQuotaMB, billingEmail,
 * ccEmails. Keeps status in step with plan (never lifts a suspension); createdAt is untouched.
 * @param {string} orgId
 * @param {Object} updates
 */
export const updateOrganization = async (orgId, updates) => {
  const allowed = ['name', 'plan', ...PRIVATE_FIELDS];
  const pub = {};
  const priv = {};
  for (const k of allowed) {
    if (updates[k] === undefined) continue;
    (PRIVATE_FIELDS.includes(k) ? priv : pub)[k] = updates[k];
  }
  // Plan and status were conflated: changing a trial org to Active updated the
  // label but left it showing as a trial. Keep them in step, except that a
  // suspension must never be lifted as a side effect of editing the plan.
  if (pub.plan !== undefined) {
    const current = await getOrganizationById(orgId);
    if (current && current.status !== 'suspended') {
      pub.status = pub.plan === 'active' ? 'active' : 'trial';
    }
  }

  const batch = writeBatch(db);
  if (Object.keys(pub).length > 0) batch.update(doc(db, ORGS_COLLECTION, orgId), pub);
  if (Object.keys(priv).length > 0) batch.set(settingsRef(orgId), priv, { merge: true });
  // The limit is enforced against the seat counter, so keep them in step.
  if (priv.seatLimit !== undefined) batch.set(seatsRef(orgId), { seatLimit: priv.seatLimit }, { merge: true });
  await batch.commit();
  await writeAuditLog({ action: 'update_org', targetOrgId: orgId });
  return { success: true };
};

/**
 * Permanently delete an organization document (master-admin only, enforced by
 * rules). Does NOT delete member users/tasks — callers must ensure the org has
 * no members first (see getOrgMemberCount).
 * @param {string} orgId
 */
export const deleteOrganization = async (orgId) => {
  await deleteDoc(doc(db, ORGS_COLLECTION, orgId));
  await writeAuditLog({ action: 'delete_org', targetOrgId: orgId });
  return { success: true };
};

/**
 * Count users belonging to an org — used to guard deletion.
 * @param {string} orgId
 */
export const getOrgMemberCount = async (orgId) => {
  const snap = await getDocs(query(collection(db, 'users'), where('orgId', '==', orgId)));
  return snap.size;
};

/**
 * Suspend an organization (master-admin only, enforced by rules).
 * @param {string} orgId
 */
export const suspendOrganization = async (orgId) => {
  await updateDoc(doc(db, ORGS_COLLECTION, orgId), { status: 'suspended' });
  await writeAuditLog({ action: 'suspend_org', targetOrgId: orgId });
  return { success: true };
};

/**
 * Reactivate a suspended organization.
 * @param {string} orgId
 */
export const reactivateOrganization = async (orgId) => {
  await updateDoc(doc(db, ORGS_COLLECTION, orgId), { status: 'active' });
  await writeAuditLog({ action: 'reactivate_org', targetOrgId: orgId });
  return { success: true };
};

/**
 * Compute live usage for an org (user + task counts). Replaces the scheduled
 * computeUsageStats Cloud Function, which isn't available on the Spark plan.
 * Master-admin can read all users/tasks per the security rules.
 * @param {string} orgId
 */
export const computeOrgUsage = async (orgId) => {
  const [usersSnap, tasksSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('orgId', '==', orgId))),
    getDocs(query(collection(db, 'tasks'), where('orgId', '==', orgId))),
  ]);

  // Seat accounting is kept by the rules, but users can also be created or moved
  // outside the app (Firebase console, master-admin moving accounts between orgs).
  // Master-admin opening this screen is the moment to notice and correct drift, or
  // to start counting for an organization that has no counter yet.
  try {
    const seats = await getDoc(seatsRef(orgId));
    if (!seats.exists() || seats.data().seatsUsed !== usersSnap.size) {
      let seatLimit = seats.exists() ? seats.data().seatLimit : undefined;
      if (seatLimit === undefined) {
        const [priv, org] = await Promise.all([getDoc(settingsRef(orgId)), getDoc(doc(db, ORGS_COLLECTION, orgId))]);
        seatLimit = priv.data()?.seatLimit ?? org.data()?.seatLimit ?? 10;
      }
      await setDoc(seatsRef(orgId), { seatsUsed: usersSnap.size, seatLimit, lastSeatUid: seats.data()?.lastSeatUid ?? null });
    }
  } catch (error) {
    console.warn('Could not reconcile seat count:', error?.code || error?.message);
  }

  return { activeUserCount: usersSnap.size, taskCount: tasksSnap.size };
};

/**
 * Most recent audit entries. Bounded — this collection only grows.
 * @param {number} max
 */
export const getAuditLogs = async (max = 200) => {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), firestoreLimit(max));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ─── Departments (org-admin, within their own org) ─────────────────────────

export const getDepartments = async (orgId) => {
  const snapshot = await getDocs(collection(db, ORGS_COLLECTION, orgId, 'departments'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createDepartment = async (orgId, name) => {
  const deptRef = doc(collection(db, ORGS_COLLECTION, orgId, 'departments'));
  const deptDoc = { name, createdAt: Timestamp.now() };
  await setDoc(deptRef, deptDoc);
  return { id: deptRef.id, ...deptDoc };
};

export const updateDepartment = async (orgId, deptId, updates) => {
  await updateDoc(doc(db, ORGS_COLLECTION, orgId, 'departments', deptId), updates);
};

export const deleteDepartment = async (orgId, deptId) => {
  await deleteDoc(doc(db, ORGS_COLLECTION, orgId, 'departments', deptId));
};

// ─── Projects (org-admin, within their own org) ────────────────────────────

export const getProjects = async (orgId) => {
  const snapshot = await getDocs(collection(db, ORGS_COLLECTION, orgId, 'projects'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Fetch specific projects by id. Clients may only read the projects they are
// linked to, and a list query cannot prove that to the security rules, so they
// must be read one document at a time.
export const getProjectsByIds = async (orgId, projectIds = []) => {
  const snaps = await Promise.all(
    [...new Set(projectIds)].map((id) => getDoc(doc(db, ORGS_COLLECTION, orgId, 'projects', id)))
  );
  return snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
};

export const createProject = async (
  orgId,
  { name, departmentId, memberUserIds = [], budget = 0, currency = DEFAULT_CURRENCY, budgetNotes = '' }
) => {
  const projRef = doc(collection(db, ORGS_COLLECTION, orgId, 'projects'));
  const projDoc = {
    name,
    departmentId,
    memberUserIds,
    status: 'active',
    createdAt: Timestamp.now(),
  };
  // Budget figures go in the finance subdocument, not on the project itself,
  // which every member of the organization can read.
  const finance = {
    budget: Number(budget) || 0,
    currency: currency || DEFAULT_CURRENCY,
    budgetNotes: budgetNotes || '',
  };
  const batch = writeBatch(db);
  batch.set(projRef, projDoc);
  batch.set(doc(projRef, 'finance', 'budget'), finance);
  await batch.commit();
  return { id: projRef.id, ...projDoc, ...finance };
};

export const updateProject = async (orgId, projId, updates) => {
  await updateDoc(doc(db, ORGS_COLLECTION, orgId, 'projects', projId), updates);
};

export const deleteProject = async (orgId, projId) => {
  await deleteDoc(doc(db, ORGS_COLLECTION, orgId, 'projects', projId));
};
