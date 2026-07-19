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
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

const ORGS_COLLECTION = 'organizations';

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
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getOrganizationById = async (orgId) => {
  const orgDoc = await getDoc(doc(db, ORGS_COLLECTION, orgId));
  return orgDoc.exists() ? { id: orgDoc.id, ...orgDoc.data() } : null;
};

/**
 * Provision a new organization. Security rules restrict organizations writes
 * to master-admin, so this can only succeed for a master-admin.
 * @param {Object} orgData - {name, plan, seatLimit, storageQuotaMB, billingEmail, ccEmails}
 * @returns {Promise<{orgId: string}>}
 */
export const provisionOrganization = async (orgData) => {
  const orgRef = doc(collection(db, ORGS_COLLECTION));
  await setDoc(orgRef, {
    name: orgData.name,
    plan: orgData.plan ?? 'trial',
    status: orgData.plan === 'active' ? 'active' : 'trial',
    seatLimit: orgData.seatLimit ?? 10,
    storageQuotaMB: orgData.storageQuotaMB ?? 1000,
    billingEmail: orgData.billingEmail ?? '',
    ccEmails: orgData.ccEmails ?? [],
    createdAt: Timestamp.now(),
    createdByMasterAdminId: auth.currentUser?.uid || null,
  });
  await writeAuditLog({ action: 'provision_org', targetOrgId: orgRef.id });
  return { orgId: orgRef.id };
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
  return { activeUserCount: usersSnap.size, taskCount: tasksSnap.size };
};

export const getAuditLogs = async () => {
  const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
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

export const createProject = async (orgId, { name, departmentId, memberUserIds = [] }) => {
  const projRef = doc(collection(db, ORGS_COLLECTION, orgId, 'projects'));
  const projDoc = {
    name,
    departmentId,
    memberUserIds,
    status: 'active',
    createdAt: Timestamp.now(),
  };
  await setDoc(projRef, projDoc);
  return { id: projRef.id, ...projDoc };
};

export const updateProject = async (orgId, projId, updates) => {
  await updateDoc(doc(db, ORGS_COLLECTION, orgId, 'projects', projId), updates);
};

export const deleteProject = async (orgId, projId) => {
  await deleteDoc(doc(db, ORGS_COLLECTION, orgId, 'projects', projId));
};
