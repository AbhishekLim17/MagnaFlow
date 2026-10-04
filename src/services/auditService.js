// The audit trail: who changed people, departments, projects, budgets and organizations.
// The services that make those changes write it; the org admin's Activity log and the
// platform owner's dashboard read it. Wording lives in lib/auditLog.
import {
  addDoc,
  collection,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

const AUDIT = 'audit_logs';

/**
 * Record a change. Best-effort on purpose: an audit write must never block or undo the
 * change it describes, and the rules refuse it for anyone who does not manage people.
 * The rules also insist on the caller's own uid and the server's clock.
 *
 * @param {Object} entry  { action, orgId, targetUserId?, targetName?, targetEmail?, changes?, ... }
 */
export const writeAuditLog = async (entry) => {
  try {
    await addDoc(collection(db, AUDIT), {
      ...entry,
      actorId: auth.currentUser?.uid || null,
      actorEmail: auth.currentUser?.email || null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write skipped:', err?.code || err?.message);
  }
};

const millis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/**
 * Most recent entries across the platform (master admin). Bounded: this collection only grows.
 * @param {number} max
 */
export const getAuditLogs = async (max = 200) => {
  const snap = await getDocs(query(collection(db, AUDIT), orderBy('timestamp', 'desc'), firestoreLimit(max)));
  return rows(snap);
};

/**
 * Most recent entries for one organization (its org admins), newest first.
 * Until the (orgId, timestamp) index is deployed the server answers failed-precondition;
 * then a plain read is sorted here instead of breaking the page.
 *
 * @param {string} orgId
 * @param {number} max
 */
export const getOrgAuditLogs = async (orgId, max = 200) => {
  const base = collection(db, AUDIT);
  try {
    const snap = await getDocs(query(base, where('orgId', '==', orgId), orderBy('timestamp', 'desc'), firestoreLimit(max)));
    return rows(snap);
  } catch (error) {
    if (error?.code !== 'failed-precondition') throw error;
    console.warn('Missing audit_logs index; sorting an unordered read instead.');
    const snap = await getDocs(query(base, where('orgId', '==', orgId), firestoreLimit(max * 3)));
    return rows(snap)
      .sort((a, b) => millis(b.timestamp) - millis(a.timestamp))
      .slice(0, max);
  }
};
