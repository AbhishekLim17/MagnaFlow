/**
 * Run the organisations' automation rules on recorded task events (task_events), every 15
 * minutes from send-queued-emails.cjs. Each event is checked against the task as it is now
 * (src/lib/automations.js ruleMatches), so an event a browser made up does nothing.
 *
 * Actions run with the Admin SDK: post to the org's Slack / Teams / webhook, set the priority,
 * assign someone (only if nobody is, and only a member of the org; they get the usual email),
 * add checklist items. Nothing the job does records a new event, so rules cannot loop.
 * With MAIL_TRANSPORT=json (integration tests) channel posts are printed, not sent.
 */
const crypto = require('crypto');
const { APP_URL } = require('./tenant.cjs');

const MAX_EVENTS_PER_RUN = 200;

async function post(url, body, headers = {}) {
  if (process.env.MAIL_TRANSPORT === 'json') {
    console.log('[channel-json] ' + JSON.stringify({ url, body }));
    return;
  }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
}

/** Post one line to every configured channel; returns notes per channel. */
async function postToChannels(channels, lib, text, extra = {}) {
  const notes = [];
  const tries = [];
  if (channels.slack && !lib.channelProblem('slack', channels.slack)) {
    tries.push(['slack', () => post(channels.slack, { text })]);
  }
  if (channels.teams && !lib.channelProblem('teams', channels.teams)) {
    tries.push(['teams', () => post(channels.teams, {
      type: 'message',
      attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
        body: [{ type: 'TextBlock', text, wrap: true }],
        actions: [{ type: 'Action.OpenUrl', title: 'Open MagnaFlow', url: APP_URL }],
      } }],
    })]);
  }
  if (channels.webhook && !lib.channelProblem('webhook', channels.webhook)) {
    const body = { text, link: APP_URL, ...extra };
    const signature = channels.webhookSecret
      ? `sha256=${crypto.createHmac('sha256', channels.webhookSecret).update(JSON.stringify(body)).digest('hex')}`
      : null;
    tries.push(['webhook', () => post(channels.webhook, body, signature ? { 'X-MagnaFlow-Signature': signature } : {})]);
  }
  for (const [name, run] of tries) {
    try { await run(); notes.push(`${name}: posted`); } catch (e) { notes.push(`${name}: ${e.message}`); }
  }
  return notes.length ? notes : ['no channel set up'];
}

async function runAction(ctx, rule, event, task, taskRef) {
  const { db, admin, lib, channels, projectName } = ctx;
  const a = rule.action || {};
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (a.type === 'notify_channels') {
    const text = lib.channelText(event, task, projectName);
    return (await postToChannels(channels, lib, text, {
      event: event.type, to: event.to || null, task: { id: event.taskId, title: task.title, status: task.status, priority: task.priority },
    })).join(', ');
  }
  if (a.type === 'set_priority') {
    if (task.priority === a.priority) return 'priority already set';
    await taskRef.update({ priority: a.priority, updatedAt: now });
    task.priority = a.priority;
    return `priority set to ${a.priority}`;
  }
  if (a.type === 'assign_to') {
    if (task.assignedTo) return 'already assigned';
    const u = await db.collection('users').doc(a.userId).get();
    if (!u.exists || u.data().orgId !== task.orgId || u.data().status === 'inactive') return 'that person is not an active member';
    await taskRef.update({ assignedTo: a.userId, updatedAt: now });
    task.assignedTo = a.userId;
    await db.collection('mail_queue').add({
      recipientUid: a.userId, taskId: event.taskId, type: 'task_assigned', source: 'automation',
      notification_type: 'Task Assignment', title: `New task: ${task.title}`, message: 'Assigned to you by an automation rule.',
      button_text: 'Open the task', button_link: APP_URL,
      status: 'pending', attempts: 0, requestedBy: 'automation', requestedAt: admin.firestore.Timestamp.now(),
    });
    return `assigned to ${u.data().name || 'someone'}`;
  }
  if (a.type === 'add_checklist') {
    const items = (a.items || []).map((s) => String(s).trim()).filter(Boolean).slice(0, lib.MAX_CHECKLIST);
    const batch = db.batch();
    for (const title of items) {
      batch.set(db.collection('subtasks').doc(), { taskId: event.taskId, title, completed: false, createdBy: 'automation', createdAt: now, updatedAt: now });
    }
    await batch.commit();
    return `${items.length} checklist item${items.length === 1 ? '' : 's'} added`;
  }
  return 'unknown action';
}

/**
 * @param {{ db, admin, lib, dryRun?: boolean }} deps  lib = src/lib/automations.js
 * @returns {Promise<{ events: number, actions: number }>}
 */
async function runAutomations({ db, admin, lib, dryRun = false }) {
  const snap = await db.collection('task_events').where('processed', '==', false).limit(MAX_EVENTS_PER_RUN).get();
  const totals = { events: snap.size, actions: 0 };
  if (snap.empty) return totals;
  console.log(`${snap.size} task event(s) for the automations`);

  const perOrg = new Map();
  const orgData = async (orgId) => {
    if (!perOrg.has(orgId)) {
      const org = db.collection('organizations').doc(orgId);
      const [orgSnap, rules, ch] = await Promise.all([org.get(), org.collection('automations').get(), org.collection('integrations').doc('channels').get()]);
      perOrg.set(orgId, {
        suspended: !orgSnap.exists || orgSnap.data().status === 'suspended',
        rules: rules.docs.map((d) => ({ id: d.id, ...d.data() })),
        channels: ch.exists ? ch.data() : {},
        projects: new Map(),
      });
    }
    return perOrg.get(orgId);
  };

  for (const doc of snap.docs) {
    const event = doc.data();
    const results = [];
    const o = event.orgId ? await orgData(event.orgId) : null;
    if (!o || o.suspended) {
      results.push('organisation not active');
    } else if (event.type === 'channel_test') {
      const notes = dryRun ? ['dry run'] : await postToChannels(o.channels, lib, 'Test message from MagnaFlow: your automations can post here.');
      results.push(`test: ${notes.join(', ')}`);
    } else {
      const taskRef = db.collection('tasks').doc(String(event.taskId || '_'));
      const t = await taskRef.get();
      const task = t.exists ? t.data() : null;
      if (!task || task.orgId !== event.orgId) {
        results.push('task not found');
      } else {
        for (const rule of o.rules.filter((r) => lib.ruleMatches(r, event, task))) {
          let projectName = '';
          if (task.projectId) {
            if (!o.projects.has(task.projectId)) {
              const p = await db.collection('organizations').doc(event.orgId).collection('projects').doc(task.projectId).get();
              o.projects.set(task.projectId, p.exists ? p.data().name || '' : '');
            }
            projectName = o.projects.get(task.projectId);
          }
          try {
            const note = dryRun ? 'dry run' : await runAction({ db, admin, lib, channels: o.channels, projectName }, rule, event, task, taskRef);
            results.push(`${rule.name}: ${note}`);
            totals.actions += 1;
          } catch (error) {
            results.push(`${rule.name}: failed (${error.message})`);
          }
        }
        if (results.length === 0) results.push('no rule applied');
      }
    }
    if (!dryRun) {
      await doc.ref.update({ processed: true, processedAt: admin.firestore.FieldValue.serverTimestamp(), results: results.slice(0, 20) });
    }
  }
  return totals;
}

module.exports = { runAutomations, postToChannels };
