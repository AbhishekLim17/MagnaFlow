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
  const users = new Map();
  const settings = new Map();

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

  /**
   * Organization settings that only admins may read (billing contact, CC list,
   * seat limit). They live in organizations/{id}/private/settings; organizations
   * not yet migrated still carry them on the organization document itself.
   */
  async function getSettings(orgId) {
    if (!orgId) return null;
    if (!settings.has(orgId)) {
      const snap = await db.collection('organizations').doc(orgId).collection('private').doc('settings').get();
      settings.set(orgId, snap.exists ? snap.data() : null);
    }
    return settings.get(orgId);
  }

  /** CC addresses configured for the organization (private settings first). */
  async function ccFor(orgId) {
    const [priv, org] = await Promise.all([getSettings(orgId), getOrg(orgId)]);
    const list = priv && priv.ccEmails !== undefined ? priv.ccEmails : org && org.ccEmails;
    return cleanEmailList(list).join(', ');
  }

  async function getUser(uid) {
    if (!uid) return null;
    if (!users.has(uid)) {
      const snap = await db.collection('users').doc(String(uid)).get();
      users.set(uid, snap.exists ? snap.data() : null);
    }
    return users.get(uid);
  }

  /**
   * The recipient of a queued email, resolved by uid. Returns { email, name } only
   * when the account exists, has an address, is not deactivated and belongs to the
   * given organization; otherwise null. The address always comes from here, never
   * from the queued document.
   */
  async function resolveRecipient(uid, orgId) {
    const u = await getUser(uid);
    if (!u || !EMAIL_RE.test(String(u.email || ''))) return null;
    if (u.status === 'inactive') return null;
    if ((u.orgId ?? null) !== (orgId ?? null)) return null;
    return { email: u.email, name: u.name || u.email };
  }

  return { getOrg, getSettings, getTask, getUser, ccFor, resolveRecipient };
}

module.exports = { APP_URL, EMAIL_RE, safeButtonLink, cleanEmailList, createTenantLookup };
