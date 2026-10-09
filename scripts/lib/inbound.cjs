/**
 * Email-to-task. Each project can have an address on the app's own Gmail mailbox, using
 * Gmail's plus addressing: <mailbox>+<key>@gmail.com. The 15-minute job (send-queued-
 * emails.cjs) reads unread mail sent to such an address and turns each message into a task
 * in that project, assigned to whoever sent it, then tells them.
 *
 * Who may: the sender's address must belong to an active member of the project's
 * organization who could create a task there, and Gmail must have authenticated the sender
 * (SPF or DKIM pass), so a forged From line is not enough. The key is a random string an
 * org admin turns on per project (inbound_keys/{key} -> { orgId, projectId }).
 *
 * Off unless INBOUND_EMAIL=on (or, in tests, INBOUND_JSON names a file of messages).
 */
const crypto = require('crypto');

const KEY_RE = /^[a-z0-9]{12,40}$/;
const MAX_PER_RUN = 50;

/** Gmail ignores dots and case in the local part. */
const normalise = (address) => {
  const [local = '', domain = ''] = String(address || '').trim().toLowerCase().split('@');
  const bare = ['gmail.com', 'googlemail.com'].includes(domain) ? local.replace(/\./g, '') : local;
  return { local: bare, domain };
};

/** The project key in the first "mailbox+key@domain" recipient, or null. */
function plusKey(addresses, mailbox) {
  const box = normalise(mailbox);
  for (const raw of addresses || []) {
    const { local, domain } = normalise(raw);
    const plus = local.indexOf('+');
    if (plus < 0 || domain !== box.domain || local.slice(0, plus) !== box.local) continue;
    const key = local.slice(plus + 1);
    if (KEY_RE.test(key)) return key;
  }
  return null;
}

/** Did the receiving server (Gmail) authenticate the sender? */
function authenticated(authResults) {
  const s = (Array.isArray(authResults) ? authResults.join(';') : String(authResults || '')).toLowerCase();
  if (/\bdmarc=fail\b/.test(s)) return false;
  return /\bdkim=pass\b/.test(s) || /\bspf=pass\b/.test(s);
}

/** The new part of an email: quoted replies and the signature cut off. */
function cleanBody(text, max = 5000) {
  let body = String(text || '').replace(/\r\n/g, '\n');
  const cut = [/^On .{0,200}wrote:\s*$/m, /^-{2,}\s*Original Message/im, /^_{5,}\s*$/m, /^From: .+$/m, /^-- $/m]
    .map((re) => body.search(re)).filter((i) => i >= 0);
  if (cut.length) body = body.slice(0, Math.min(...cut));
  body = body.split('\n').filter((l) => !l.startsWith('>')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return body.length > max ? `${body.slice(0, max - 1)}…` : body;
}

/** Could this person create a task in this project? (mirrors the tasks create rule) */
function mayCreateIn(user, project, orgId) {
  if (!user || user.orgId !== orgId || user.status === 'inactive') return false;
  if (['client', 'finance', 'master-admin'].includes(user.role)) return false;
  if (['org-admin', 'admin'].includes(user.role)) return true;
  if ((user.projectIds || []).includes(project.id)) return true;
  return user.role === 'department-head' && Boolean(project.departmentId) && (user.departmentIds || []).includes(project.departmentId);
}

/** The task a message becomes. */
function taskFrom(mail, user, project, orgId, now) {
  return {
    title: String(mail.subject || '').replace(/^\s*(fwd?|fw|re):\s*/i, '').trim().slice(0, 200) || '(no subject)',
    description: cleanBody(mail.text),
    assignedTo: user.id,
    createdBy: user.id,
    orgId,
    projectId: project.id,
    departmentId: project.departmentId || null,
    priority: 'medium',
    status: 'pending',
    source: 'email',
    createdAt: now,
    updatedAt: now,
  };
}

/** A stable task id per message, so a message read twice makes one task. */
const taskIdFor = (mail) => `email_${crypto.createHash('sha1').update(String(mail.messageId || mail.id)).digest('hex').slice(0, 24)}`;

/**
 * Turn unread messages into tasks.
 * @param {{ db, admin, messages: Object[], markSeen: (msg) => Promise, confirm: (mail, user, task, project) => Promise,
 *           mailbox: string, dryRun?: boolean, log?: Function }} deps
 */
async function runInbound({ db, admin, messages, markSeen, confirm, mailbox, dryRun = false, log = console.log }) {
  const counts = { messages: messages.length, created: 0, rejected: 0, duplicates: 0 };
  for (const mail of messages.slice(0, MAX_PER_RUN)) {
    const reject = async (why) => {
      counts.rejected += 1;
      log(`  inbound: rejected (${why}) from ${mail.from || '(unknown)'}`);
      if (!dryRun) await markSeen(mail);
    };
    const key = plusKey(mail.to, mailbox);
    if (!key) { await reject('no project key'); continue; }
    const keyDoc = await db.collection('inbound_keys').doc(key).get();
    if (!keyDoc.exists) { await reject('unknown or retired key'); continue; }
    const { orgId, projectId } = keyDoc.data();
    const org = await db.collection('organizations').doc(orgId).get();
    if (!org.exists || org.data().status === 'suspended') { await reject('organization unavailable'); continue; }
    const projectSnap = await db.collection('organizations').doc(orgId).collection('projects').doc(projectId).get();
    if (!projectSnap.exists) { await reject('project gone'); continue; }
    const project = { id: projectSnap.id, ...projectSnap.data() };
    if (!authenticated(mail.authResults)) { await reject('sender not authenticated'); continue; }
    const from = String(mail.from || '').trim().toLowerCase();
    const users = await db.collection('users').where('orgId', '==', orgId).where('email', 'in', [...new Set([from, mail.from].filter(Boolean))]).get();
    const user = users.docs.map((d) => ({ id: d.id, ...d.data() })).find((u) => mayCreateIn(u, project, orgId));
    if (!user) { await reject('sender may not add tasks to this project'); continue; }

    const task = taskFrom(mail, user, project, orgId, admin.firestore.Timestamp.now());
    if (dryRun) { log(`  inbound: would create “${task.title}” in ${project.name || projectId} for ${user.email}`); continue; }
    try {
      await db.collection('tasks').doc(taskIdFor(mail)).create(task);
      counts.created += 1;
      await confirm(mail, user, { id: taskIdFor(mail), ...task }, project).catch((e) => log(`  inbound: could not confirm: ${e.message}`));
    } catch (error) {
      if (error.code !== 6) throw error; // 6 = ALREADY_EXISTS: made on an earlier run
      counts.duplicates += 1;
    }
    await markSeen(mail);
  }
  return counts;
}

/** Unread plus-addressed messages from Gmail over IMAP (imapflow + mailparser, installed by the workflow). */
async function openImap(mailbox, password) {
  const { ImapFlow } = require('imapflow');
  const { simpleParser } = require('mailparser');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: mailbox, pass: password }, logger: false });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  const local = mailbox.split('@')[0];
  const uids = (await client.search({ seen: false, to: `${local}+`, smaller: 2_000_000 }, { uid: true })) || [];
  const messages = [];
  for (const uid of uids.slice(0, MAX_PER_RUN)) {
    const { source } = await client.fetchOne(uid, { source: true }, { uid: true });
    const parsed = await simpleParser(source);
    const list = (field) => (parsed[field]?.value || []).map((a) => a.address);
    messages.push({
      id: uid,
      messageId: parsed.messageId,
      to: [...list('to'), ...list('cc'), ...[].concat(parsed.headers.get('delivered-to') || []).map(String)],
      from: parsed.from?.value?.[0]?.address || '',
      subject: parsed.subject || '',
      text: parsed.text || '',
      authResults: parsed.headers.get('authentication-results'),
    });
  }
  return {
    messages,
    markSeen: (mail) => client.messageFlagsAdd(mail.id, ['\\Seen'], { uid: true }),
    close: async () => { lock.release(); await client.logout(); },
  };
}

module.exports = { plusKey, authenticated, cleanBody, mayCreateIn, taskFrom, taskIdFor, runInbound, openImap };
