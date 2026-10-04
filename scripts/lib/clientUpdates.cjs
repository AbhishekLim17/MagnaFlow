/**
 * Email the other side of a client conversation (client_messages).
 *
 * Browsers only write a message with `notified: false`; who hears about it is decided
 * here, from server-side data, and every address comes from a user record:
 *  - a client wrote, approved or asked for changes -> the task's author and assignee
 *  - the team wrote                                  -> every active client of the project
 * Then the message is marked `notified: true` (only the Admin SDK may change it).
 */
const { APP_URL, EMAIL_RE } = require('./tenant.cjs');

const MAX_MESSAGES_PER_RUN = 100;
const MAX_ATTEMPTS = 3;

const KIND = {
  message: { type: 'client_message', heading: 'Message from your client', verb: 'wrote' },
  approved: { type: 'client_approved', heading: 'Milestone approved', verb: 'approved' },
  changes_requested: { type: 'client_changes_requested', heading: 'Changes requested', verb: 'asked for changes on' },
};

const excerpt = (text, max = 600) => {
  const t = String(text || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** The project's clients who can receive mail: active, in the same organization. */
async function projectClients(db, orgId, projectId) {
  // One single-field query (no composite index to deploy); the organization is checked here.
  const snap = await db.collection('users').where('projectIds', 'array-contains', projectId).get();
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => u.role === 'client' && (u.orgId ?? null) === (orgId ?? null)
      && u.status !== 'inactive' && EMAIL_RE.test(String(u.email || '')))
    .map((u) => ({ uid: u.uid, email: u.email, name: u.name || u.email, prefs: u.notificationPrefs || null }));
}

/** Who should hear about this message, and the mail type that governs their preference. */
async function recipientsFor(db, tenant, message, task) {
  if (message.fromClient) {
    const uids = [...new Set([task.createdBy, task.assignedTo])].filter((u) => u && u !== message.authorId);
    const found = [];
    for (const uid of uids) {
      const r = await tenant.resolveRecipient(uid, task.orgId);
      if (r) found.push({ uid, ...r });
    }
    return found;
  }
  return projectClients(db, task.orgId, task.projectId);
}

function buildMail(message, task, projectName, recipient) {
  const fromClient = Boolean(message.fromClient);
  const kind = KIND[message.kind] || KIND.message;
  const who = message.authorName || (fromClient ? 'Your client' : 'Your project team');
  return {
    type: fromClient ? kind.type : 'client_reply',
    to_email: recipient.email,
    to_name: recipient.name,
    cc_email: '',
    notification_type: fromClient ? kind.heading : 'Reply from your project team',
    notification_icon: fromClient ? (message.kind === 'approved' ? '✅' : message.kind === 'changes_requested' ? '✏️' : '💬') : '💬',
    title: fromClient ? `${who} ${kind.verb} “${task.title}”` : `${who} wrote about “${task.title}”`,
    message: excerpt(message.text) || (message.kind === 'approved' ? 'No note was added.' : ''),
    detail_1_label: 'Project',
    detail_1_value: projectName || '—',
    detail_2_label: fromClient ? 'Task' : 'About',
    detail_2_value: task.title || '—',
    button_text: fromClient ? 'Open the task' : 'Open your portal',
    button_link: APP_URL,
    footer_text: fromClient
      ? 'You get this because you created or are assigned this task. Reply from the task in MagnaFlow.'
      : 'Reply from your client portal in MagnaFlow.',
  };
}

/**
 * @param {{ db, admin, tenant, transport, send, wantsEmail, dryRun?: boolean, log?: Function }} deps
 * @returns {Promise<{ messages: number, sent: number, skipped: number, failed: number }>}
 */
async function sendClientUpdates({ db, admin, tenant, transport, send, wantsEmail, dryRun = false, log = () => {} }) {
  const snap = await db.collection('client_messages').where('notified', '==', false).limit(MAX_MESSAGES_PER_RUN).get();
  const totals = { messages: snap.size, sent: 0, skipped: 0, failed: 0 };
  if (snap.empty) return totals;
  console.log(`${snap.size} client conversation message(s) to tell the other side about`);

  const projectNames = new Map();
  const projectName = async (orgId, projectId) => {
    const key = `${orgId}/${projectId}`;
    if (!projectNames.has(key)) {
      const p = await db.collection('organizations').doc(orgId).collection('projects').doc(projectId).get();
      projectNames.set(key, p.exists ? p.data().name || '' : '');
    }
    return projectNames.get(key);
  };

  for (const doc of snap.docs) {
    const m = doc.data();
    const task = await tenant.getTask(m.taskId);
    // The message must still match its task (the rules checked this when it was written).
    if (!task || task.orgId !== m.orgId || task.projectId !== m.projectId) {
      totals.skipped += 1;
      if (!dryRun) await doc.ref.update({ notified: true, notifyResult: 'task no longer matches', notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
      continue;
    }

    const recipients = await recipientsFor(db, tenant, m, task);
    const name = await projectName(task.orgId, task.projectId);
    let sentHere = 0;
    let failedHere = 0;
    for (const r of recipients) {
      const mail = buildMail(m, task, name, r);
      if (!wantsEmail(r.prefs, mail.type)) { totals.skipped += 1; continue; }
      if (dryRun) { console.log(`  would send to ${r.email} — ${mail.title}`); continue; }
      try {
        await send(transport, mail);
        sentHere += 1;
        await log(mail, task.orgId, 'sent');
      } catch (error) {
        failedHere += 1;
        console.error(`  FAILED for ${r.email}: ${error?.message}`);
      }
    }
    totals.sent += sentHere;
    totals.failed += failedHere;
    if (dryRun) continue;

    const attempts = (m.notifyAttempts || 0) + 1;
    if (failedHere === 0 || attempts >= MAX_ATTEMPTS) {
      await doc.ref.update({
        notified: true,
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        notifyResult: failedHere ? `gave up after ${attempts} attempts` : `${sentHere} sent`,
      });
    } else {
      // Try again next run (those already told may hear twice; better than not at all).
      await doc.ref.update({ notifyAttempts: attempts });
    }
  }
  return totals;
}

module.exports = { sendClientUpdates, buildMail, projectClients };
