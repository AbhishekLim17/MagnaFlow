/**
 * Email the other side of the client portal's two-way features.
 *
 * Browsers only write `notified: false`; who hears about it is decided here, from
 * server-side data, and every address comes from a user record:
 *
 *  client_messages (conversation on a task)
 *  - a client wrote, approved or asked for changes -> the task's author and assignee
 *  - the team wrote                                  -> every active client of the project
 *
 *  client_requests (a client asks for something)
 *  - a new request      -> the project's managers and its department's heads (or, if the
 *                          project has neither, the organization's admins)
 *  - accepted/declined  -> the client who asked
 *
 * Then the document is marked `notified: true` (only the Admin SDK may change it).
 */
const { APP_URL, EMAIL_RE } = require('./tenant.cjs');
const { sendPush } = require('./push.cjs');

const MAX_DOCS_PER_RUN = 100;
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

const asRecipient = (u) => ({ uid: u.uid, email: u.email, name: u.name || u.email, prefs: u.notificationPrefs || null });
const mailable = (u, orgId) => (u.orgId ?? null) === (orgId ?? null)
  && u.status !== 'inactive' && EMAIL_RE.test(String(u.email || ''));

// Single-field queries only (no composite index to deploy); everything else is checked here.
async function usersWhere(db, field, value) {
  const snap = await db.collection('users').where(field, 'array-contains', value).get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** The project's clients who can receive mail: active, in the same organization. */
async function projectClients(db, orgId, projectId) {
  return (await usersWhere(db, 'projectIds', projectId))
    .filter((u) => u.role === 'client' && mailable(u, orgId))
    .map(asRecipient);
}

/** Who runs a project: its managers and its department's heads; failing that, the org admins. */
async function projectLeads(db, orgId, project, projectId) {
  const managers = (await usersWhere(db, 'projectIds', projectId)).filter((u) => u.role === 'manager');
  const heads = project?.departmentId
    ? (await usersWhere(db, 'departmentIds', project.departmentId)).filter((u) => u.role === 'department-head')
    : [];
  let leads = [...managers, ...heads].filter((u) => mailable(u, orgId));
  if (leads.length === 0) {
    const snap = await db.collection('users').where('orgId', '==', orgId).get();
    leads = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .filter((u) => ['org-admin', 'admin'].includes(u.role) && mailable(u, orgId));
  }
  const seen = new Set();
  return leads.filter((u) => !seen.has(u.uid) && seen.add(u.uid)).map(asRecipient);
}

/** Who should hear about a conversation message. */
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

function buildRequestMail(request, projectName, recipient) {
  const base = {
    to_email: recipient.email,
    to_name: recipient.name,
    cc_email: '',
    detail_1_label: 'Project',
    detail_1_value: projectName || '—',
    button_link: APP_URL,
  };
  if (request.status === 'new') {
    return {
      ...base,
      type: 'client_request',
      notification_type: 'New client request',
      notification_icon: '📥',
      title: `${request.requestedByName || 'Your client'} asked for “${request.title}”`,
      message: excerpt(request.details),
      detail_2_label: 'Urgency',
      detail_2_value: request.urgency === 'urgent' ? 'Urgent' : 'Normal',
      detail_3_label: 'Needed by',
      detail_3_value: request.neededBy || '—',
      button_text: 'Open client requests',
      footer_text: 'You get this because you run this project. Accept it as a task or decline it in MagnaFlow.',
    };
  }
  const accepted = request.status === 'accepted';
  return {
    ...base,
    type: 'client_request_answered',
    notification_type: accepted ? 'Request accepted' : 'Request declined',
    notification_icon: accepted ? '✅' : '↩️',
    title: accepted ? `Your request “${request.title}” was accepted` : `Your request “${request.title}” was declined`,
    message: excerpt(request.response) || (accepted ? 'The team has added it to the project.' : ''),
    detail_2_label: 'Answered by',
    detail_2_value: request.decidedByName || 'Your project team',
    button_text: 'Open your portal',
    footer_text: 'See all your requests in your client portal in MagnaFlow.',
  };
}

const projectLoader = (db) => {
  const cache = new Map();
  return async (orgId, projectId) => {
    const key = `${orgId}/${projectId}`;
    if (!cache.has(key)) {
      const p = await db.collection('organizations').doc(orgId).collection('projects').doc(projectId).get();
      cache.set(key, p.exists ? p.data() : null);
    }
    return cache.get(key);
  };
};

/**
 * Send one document's mails, then record the outcome on it. A send that fails is retried on
 * the next run (those already told may hear twice; better than not at all), up to MAX_ATTEMPTS.
 */
async function deliver({ db, doc, data, mails, orgId, admin, transport, send, wantsEmail, dryRun, log, totals }) {
  let sentHere = 0;
  let failedHere = 0;
  for (const { mail, prefs, uid } of mails) {
    if (!wantsEmail(prefs, mail.type)) { totals.skipped += 1; continue; }
    if (dryRun) { console.log(`  would send to ${mail.to_email} — ${mail.title}`); continue; }
    try {
      await send(transport, mail);
      sentHere += 1;
      await sendPush({ db, admin }, uid, { title: mail.title, body: mail.message, link: mail.button_link });
      await log(mail, orgId, 'sent');
    } catch (error) {
      failedHere += 1;
      console.error(`  FAILED for ${mail.to_email}: ${error?.message}`);
    }
  }
  totals.sent += sentHere;
  totals.failed += failedHere;
  if (dryRun) return;

  const attempts = (data.notifyAttempts || 0) + 1;
  if (failedHere === 0 || attempts >= MAX_ATTEMPTS) {
    await doc.ref.update({
      notified: true,
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      notifyResult: failedHere ? `gave up after ${attempts} attempts` : `${sentHere} sent`,
    });
  } else {
    await doc.ref.update({ notifyAttempts: attempts });
  }
}

const skip = async (doc, admin, dryRun, reason) => {
  if (!dryRun) await doc.ref.update({ notified: true, notifyResult: reason, notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
};

/**
 * Conversation messages.
 * @param {{ db, admin, tenant, transport, send, wantsEmail, dryRun?: boolean, log?: Function }} deps
 * @returns {Promise<{ messages: number, sent: number, skipped: number, failed: number }>}
 */
async function sendClientUpdates(deps) {
  const { db, admin, tenant, dryRun = false, log = () => {} } = deps;
  const snap = await db.collection('client_messages').where('notified', '==', false).limit(MAX_DOCS_PER_RUN).get();
  const totals = { messages: snap.size, sent: 0, skipped: 0, failed: 0 };
  if (snap.empty) return totals;
  console.log(`${snap.size} client conversation message(s) to tell the other side about`);
  const project = projectLoader(db);

  for (const doc of snap.docs) {
    const m = doc.data();
    const task = await tenant.getTask(m.taskId);
    // The message must still match its task (the rules checked this when it was written).
    if (!task || task.orgId !== m.orgId || task.projectId !== m.projectId) {
      totals.skipped += 1;
      await skip(doc, admin, dryRun, 'task no longer matches');
      continue;
    }
    const name = (await project(task.orgId, task.projectId))?.name || '';
    const mails = (await recipientsFor(db, tenant, m, task)).map((r) => ({ mail: buildMail(m, task, name, r), prefs: r.prefs, uid: r.uid }));
    await deliver({ ...deps, doc, data: m, mails, orgId: task.orgId, dryRun, log, totals });
  }
  return totals;
}

/**
 * Client requests: new ones to the people who run the project, answers to the client.
 * @returns {Promise<{ requests: number, sent: number, skipped: number, failed: number }>}
 */
async function sendRequestUpdates(deps) {
  const { db, admin, tenant, dryRun = false, log = () => {} } = deps;
  const snap = await db.collection('client_requests').where('notified', '==', false).limit(MAX_DOCS_PER_RUN).get();
  const totals = { requests: snap.size, sent: 0, skipped: 0, failed: 0 };
  if (snap.empty) return totals;
  console.log(`${snap.size} client request update(s) to send`);
  const project = projectLoader(db);

  for (const doc of snap.docs) {
    const r = doc.data();
    const p = await project(r.orgId, r.projectId);
    if (!p) {
      totals.skipped += 1;
      await skip(doc, admin, dryRun, 'project no longer exists');
      continue;
    }
    let recipients;
    if (r.status === 'new') {
      recipients = await projectLeads(db, r.orgId, p, r.projectId);
    } else {
      const client = await tenant.resolveRecipient(r.requestedBy, r.orgId);
      recipients = client ? [{ uid: r.requestedBy, ...client }] : [];
    }
    const mails = recipients.map((x) => ({ mail: buildRequestMail(r, p.name, x), prefs: x.prefs, uid: x.uid }));
    await deliver({ ...deps, doc, data: r, mails, orgId: r.orgId, dryRun, log, totals });
  }
  return totals;
}

module.exports = { sendClientUpdates, sendRequestUpdates, buildMail, buildRequestMail, projectClients, projectLeads };
