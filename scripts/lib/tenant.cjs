/**
 * Tenant checks shared by the mail jobs.
 *
 * These run with the Admin SDK, which bypasses security rules, so anything a
 * job does on behalf of a queued request has to be re-checked here: the queue
 * is written by browsers, and the browser is not trusted.
 */

const APP_URL = 'https://magnaflow-07sep25.web.app';
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** Buttons in notification mail may only point back at the app itself. */
function safeButtonLink(link) {
  return typeof link === 'string' && link.startsWith(APP_URL) ? link : APP_URL;
}

/** Accepts an array or a comma-separated string; returns only valid addresses. */
function cleanEmailList(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(',');
  return parts.map((e) => String(e || '').trim()).filter((e) => EMAIL_RE.test(e));
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 */
function createTenantLookup(db) {
  const orgs = new Map();
  const tasks = new Map();

  async function getOrg(orgId) {
    if (!orgId) return null;
    if (!orgs.has(orgId)) {
      const snap = await db.collection('organizations').doc(orgId).get();
      orgs.set(orgId, snap.exists ? snap.data() : null);
    }
    return orgs.get(orgId);
  }

  async function getTask(taskId) {
    if (!taskId) return null;
    if (!tasks.has(taskId)) {
      const snap = await db.collection('tasks').doc(taskId).get();
      tasks.set(taskId, snap.exists ? { id: snap.id, ...snap.data() } : null);
    }
    return tasks.get(taskId);
  }

  /** CC addresses configured on the organization (organizations/{id}.ccEmails). */
  async function ccFor(orgId) {
    const org = await getOrg(orgId);
    return cleanEmailList(org && org.ccEmails).join(', ');
  }

  /** True when `email` belongs to an active user of the given organization. */
  async function isActiveMemberOf(email, orgId) {
    const candidates = [...new Set([email, String(email || '').toLowerCase()])].filter(Boolean);
    for (const candidate of candidates) {
      const snap = await db.collection('users').where('email', '==', candidate).limit(5).get();
      const match = snap.docs.some((d) => {
        const u = d.data();
        return u.status !== 'inactive' && (u.orgId ?? null) === (orgId ?? null);
      });
      if (match) return true;
    }
    return false;
  }

  return { getOrg, getTask, ccFor, isActiveMemberOf };
}

module.exports = { APP_URL, EMAIL_RE, safeButtonLink, cleanEmailList, createTenantLookup };
