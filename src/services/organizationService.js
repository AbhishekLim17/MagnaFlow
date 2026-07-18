// Organization Service - Organizations, Departments, Projects
// Org-level CRUD (departments/projects) is direct Firestore; org-level
// provisioning/suspension/impersonation runs through Cloud Functions since
// those require elevated Admin SDK privileges the client doesn't have.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/config/firebase';

const ORGS_COLLECTION = 'organizations';

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
 * Provision a new organization (master-admin only — enforced server-side).
 * @param {Object} orgData - {name, plan, seatLimit, storageQuotaMB, billingEmail, ccEmails}
 * @returns {Promise<{orgId: string}>}
 */
export const provisionOrganization = async (orgData) => {
  const functions = getFunctions();
  const provisionOrg = httpsCallable(functions, 'provisionOrg');
  const { data } = await provisionOrg(orgData);
  return data;
};

/**
 * Suspend an organization (master-admin only — enforced server-side).
 * @param {string} orgId
 */
export const suspendOrganization = async (orgId) => {
  const functions = getFunctions();
  const suspendOrg = httpsCallable(functions, 'suspendOrg');
  return (await suspendOrg({ orgId })).data;
};

/**
 * Mint a custom auth token to sign in as another user (master-admin only —
 * enforced server-side). Caller is responsible for calling
 * signInWithCustomToken(auth, token) and for restoring the master-admin's
 * own session afterwards.
 * @param {string} targetUid
 * @returns {Promise<{token: string}>}
 */
export const impersonateUser = async (targetUid) => {
  const functions = getFunctions();
  const impersonate = httpsCallable(functions, 'impersonateUser');
  return (await impersonate({ targetUid })).data;
};

export const getOrgUsageStats = async (orgId) => {
  const statsDoc = await getDoc(doc(db, 'org_usage_stats', orgId));
  return statsDoc.exists() ? statsDoc.data() : null;
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
