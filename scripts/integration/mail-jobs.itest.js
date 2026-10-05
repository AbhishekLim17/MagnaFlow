/**
 * End-to-end tests of the two scheduled mail jobs, run as the real scripts
 * against the Firestore emulator with MAIL_TRANSPORT=json (messages are built and
 * printed, never delivered).
 *
 *   npm run test:integration
 *
 * These cover what the unit tests cannot: that the queue is actually drained, that
 * untrusted queue entries are rejected, that the recipient address and CC list come
 * from the server, and that reminders never cross organizations.
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const admin = require('firebase-admin');
const APP_URL = 'https://magnaflow-07sep25.web.app';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-magnaflow';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run via `npm run test:integration` (needs the Firestore emulator).');
}
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const runScript = (script) => {
  const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)], {
    cwd: ROOT,
    env: { ...process.env, MAIL_TRANSPORT: 'json' },
    encoding: 'utf8',
  });
  const mails = (res.stdout || '')
    .split('\n')
    .filter((l) => l.startsWith('[mail-json] '))
    .map((l) => JSON.parse(l.slice('[mail-json] '.length)));
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, mails };
};

const addressesOf = (field) => JSON.stringify(field ?? '');

const clearAll = async () => {
  for (const name of ['mail_queue', 'email_logs', 'tasks', 'users', 'organizations']) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
  }
};

const seedBase = async () => {
  await db.collection('organizations').doc('orgA').set({ name: 'Org A', status: 'active' });
  await db.collection('organizations').doc('orgA').collection('private').doc('settings')
    .set({ ccEmails: ['boss@a.test'], seatLimit: 10 });
  await db.collection('organizations').doc('orgB').set({ name: 'Org B', status: 'active', ccEmails: ['boss@b.test'] });

  const users = {
    uA1: { name: 'Ann A', email: 'ann@a.test', orgId: 'orgA', status: 'active', role: 'staff' },
    uA2: { name: 'Al A', email: 'al@a.test', orgId: 'orgA', status: 'active', role: 'staff' },
    uAgone: { name: 'Gone A', email: 'gone@a.test', orgId: 'orgA', status: 'inactive', role: 'staff' },
    uB1: { name: 'Bea B', email: 'bea@b.test', orgId: 'orgB', status: 'active', role: 'staff' },
  };
  for (const [id, u] of Object.entries(users)) await db.collection('users').doc(id).set(u);

  await db.collection('tasks').doc('tA').set({ title: 'Task A', orgId: 'orgA', assignedTo: 'uA1', priority: 'medium', status: 'pending' });
  await db.collection('tasks').doc('tB').set({ title: 'Task B', orgId: 'orgB', assignedTo: 'uB1', priority: 'medium', status: 'pending' });
};

const queued = (extra) => ({
  status: 'pending',
  attempts: 0,
  requestedBy: 'uA2',
  requestedAt: admin.firestore.Timestamp.now(),
  type: 'task_assigned',
  source: 'manual',
  notification_type: 'Task Assignment',
  title: 'Hello',
  message: 'A message',
  taskId: 'tA',
  recipientUid: 'uA1',
  ...extra,
});

describe('send-queued-emails', () => {
  let run;
  const status = {};

  beforeAll(async () => {
    await clearAll();
    await seedBase();
    const put = async (key, data) => {
      const ref = await db.collection('mail_queue').add(data);
      status[key] = ref.id;
    };
    await put('good', queued({}));
    await put('crossOrg', queued({ recipientUid: 'uB1' }));
    await put('inactive', queued({ recipientUid: 'uAgone' }));
    await put('noTask', queued({ taskId: undefined }));
    await put('unknownRecipient', queued({ recipientUid: 'ghost' }));
    await put('legacy', { ...queued({}), recipientUid: undefined, to_email: 'victim@evil.test' });
    // Fields a browser could never write (rules forbid them) but must still be ignored
    // if they ever reach the queue by another route.
    await put('injected', queued({ to_email: 'victim@evil.test', cc_email: 'victim@evil.test', button_link: 'https://evil.example/phish' }));

    run = runScript('send-queued-emails.cjs');
  });

  test('the job succeeds', () => {
    expect(run.status, run.stderr + run.stdout).toBe(0);
  });

  test('only the two legitimate messages are delivered', () => {
    expect(run.mails).toHaveLength(2);
  });

  test('the address comes from the user record and the CC from the task organization', () => {
    for (const m of run.mails) {
      expect(addressesOf(m.to)).toContain('ann@a.test');
      expect(addressesOf(m.cc)).toContain('boss@a.test');
      expect(addressesOf(m.cc)).not.toContain('boss@b.test');
    }
  });

  test('nothing is ever sent to an address supplied by the browser', () => {
    const everything = JSON.stringify(run.mails);
    expect(everything).not.toContain('victim@evil.test');
  });

  test('button links are forced back to the app', () => {
    for (const m of run.mails) {
      expect(m.html).not.toContain('evil.example');
      expect(m.html).toContain(APP_URL);
    }
  });

  test('queue entries end up sent or rejected, with a reason', async () => {
    const get = async (k) => (await db.collection('mail_queue').doc(status[k]).get()).data();
    expect((await get('good')).status).toBe('sent');
    expect((await get('injected')).status).toBe('sent');
    for (const k of ['crossOrg', 'inactive', 'noTask', 'unknownRecipient', 'legacy']) {
      const d = await get(k);
      expect(d.status, k).toBe('rejected');
      expect(d.error, k).toBeTruthy();
    }
  });

  test('an org-stamped delivery log is written for each sent message', async () => {
    const logs = (await db.collection('email_logs').get()).docs.map((d) => d.data());
    expect(logs).toHaveLength(2);
    for (const l of logs) {
      expect(l.orgId).toBe('orgA');
      expect(l.status).toBe('sent');
      expect(l.recipient).toBe('ann@a.test');
    }
  });

  test('a second run has nothing left to do', () => {
    const again = runScript('send-queued-emails.cjs');
    expect(again.status).toBe(0);
    expect(again.mails).toHaveLength(0);
  });
});

describe('send-daily-reminders', () => {
  let run;

  beforeAll(async () => {
    await clearAll();
    await seedBase();
    const critical = (id, data) => db.collection('tasks').doc(id).set({ priority: 'critical', status: 'in-progress', ...data });
    await critical('cA', { title: 'Critical A', orgId: 'orgA', assignedTo: 'uA1' });
    await critical('cB', { title: 'Critical B', orgId: 'orgB', assignedTo: 'uB1' });
    await critical('cDone', { title: 'Done', orgId: 'orgA', assignedTo: 'uA1', status: 'completed' });
    await critical('cCancelled', { title: 'Cancelled', orgId: 'orgA', assignedTo: 'uA1', status: 'cancelled' });
    await critical('cInactive', { title: 'Inactive owner', orgId: 'orgA', assignedTo: 'uAgone' });
    await critical('cUnassigned', { title: 'Nobody', orgId: 'orgA' });
    await critical('cWrongOrg', { title: 'Wrong org', orgId: 'orgB', assignedTo: 'uA1' });
    run = runScript('send-daily-reminders.cjs');
  });

  test('the job succeeds', () => {
    expect(run.status, run.stderr + run.stdout).toBe(0);
  });

  test('exactly one reminder per live critical task, and no others', () => {
    expect(run.mails).toHaveLength(2);
    const to = run.mails.map((m) => addressesOf(m.to)).join(' ');
    expect(to).toContain('ann@a.test');
    expect(to).toContain('bea@b.test');
    expect(to).not.toContain('gone@a.test');
  });

  test('each organization is copied only on its own reminders', () => {
    for (const m of run.mails) {
      const forA = addressesOf(m.to).includes('ann@a.test');
      expect(addressesOf(m.cc)).toContain(forA ? 'boss@a.test' : 'boss@b.test');
      expect(addressesOf(m.cc)).not.toContain(forA ? 'boss@b.test' : 'boss@a.test');
    }
  });

  test('no task titles or descriptions are echoed to the job log', () => {
    // (the printed [mail-json] lines ARE the messages, so only the job's own log is checked)
    const log = run.stdout.split('\n').filter((l) => !l.startsWith('[mail-json] ')).join('\n');
    expect(log).not.toContain('Critical A');
    expect(log).not.toContain('Critical B');
  });
});

describe('email preferences', () => {
  test('a turned-off kind of email is skipped (and recorded), other kinds still arrive', async () => {
    await clearAll();
    await seedBase();
    await db.collection('users').doc('uA1').update({ notificationPrefs: { assignments: false } });
    const off = await db.collection('mail_queue').add(queued({ type: 'task_assigned' }));
    const on = await db.collection('mail_queue').add(queued({ type: 'mention', notification_type: 'Mention' }));

    const run = runScript('send-queued-emails.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.mails).toHaveLength(1);
    expect((await db.collection('mail_queue').doc(off.id).get()).data()).toMatchObject({ status: 'skipped' });
    expect((await db.collection('mail_queue').doc(on.id).get()).data()).toMatchObject({ status: 'sent' });
  });

  test('someone who turned off the morning reminder does not get it', async () => {
    await clearAll();
    await seedBase();
    await db.collection('users').doc('uA1').update({ notificationPrefs: { dailyReminder: false } });
    await db.collection('tasks').doc('cA').set({ title: 'Critical A', priority: 'critical', status: 'pending', orgId: 'orgA', assignedTo: 'uA1' });
    await db.collection('tasks').doc('cB').set({ title: 'Critical B', priority: 'critical', status: 'pending', orgId: 'orgB', assignedTo: 'uB1' });

    const run = runScript('send-daily-reminders.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.mails).toHaveLength(1);
    expect(addressesOf(run.mails[0].to)).toContain('bea@b.test');
  });
});

describe('client conversation emails', () => {
  const seedConversation = async () => {
    await clearAll();
    for (const d of (await db.collection('client_messages').get()).docs) await d.ref.delete();
    await seedBase();
    await db.collection('organizations').doc('orgA').collection('projects').doc('pA').set({ name: 'Apollo' });
    const people = {
      uM: { name: 'Mo Manager', email: 'mo@a.test', orgId: 'orgA', status: 'active', role: 'manager', projectIds: ['pA'] },
      uC: { name: 'Cleo Client', email: 'cleo@client.test', orgId: 'orgA', status: 'active', role: 'client', projectIds: ['pA'] },
      uCgone: { name: 'Old Client', email: 'old@client.test', orgId: 'orgA', status: 'inactive', role: 'client', projectIds: ['pA'] },
      // same project id in another organization: never told
      uX: { name: 'Other Org', email: 'x@b.test', orgId: 'orgB', status: 'active', role: 'client', projectIds: ['pA'] },
    };
    for (const [id, u] of Object.entries(people)) await db.collection('users').doc(id).set(u);
    await db.collection('tasks').doc('tM').set({
      title: 'Design sign-off', orgId: 'orgA', projectId: 'pA', milestone: true, status: 'review',
      createdBy: 'uM', assignedTo: 'uA1', clientApproval: { decision: 'approved', by: 'uC' },
    });
  };
  const message = (extra) => ({
    orgId: 'orgA', projectId: 'pA', taskId: 'tM', kind: 'message', text: 'Looks great', notified: false,
    createdAt: admin.firestore.Timestamp.now(), ...extra,
  });

  test("a client's sign-off reaches the task's author and assignee; a team reply reaches the project's clients", async () => {
    await seedConversation();
    const fromClient = await db.collection('client_messages').add(message({ authorId: 'uC', authorName: 'Cleo Client', fromClient: true, kind: 'approved', text: '' }));
    const fromTeam = await db.collection('client_messages').add(message({ authorId: 'uM', authorName: 'Mo Manager', fromClient: false, text: 'Thanks!' }));

    const run = runScript('send-queued-emails.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    const to = run.mails.map((m) => addressesOf(m.to)).join(' ');
    expect(run.mails).toHaveLength(3);
    expect(to).toContain('mo@a.test');
    expect(to).toContain('ann@a.test');
    expect(to).toContain('cleo@client.test');
    expect(to).not.toContain('old@client.test');
    expect(to).not.toContain('x@b.test');
    // no CC on a client conversation
    for (const m of run.mails) expect(addressesOf(m.cc)).toBe('""');

    const approval = run.mails.find((m) => addressesOf(m.to).includes('mo@a.test'));
    expect(approval.subject).toContain('Cleo Client approved “Design sign-off”');
    const reply = run.mails.find((m) => addressesOf(m.to).includes('cleo@client.test'));
    expect(reply.subject).toContain('Mo Manager wrote about “Design sign-off”');
    expect(reply.text).toContain('Apollo');

    for (const ref of [fromClient, fromTeam]) {
      expect((await ref.get()).data()).toMatchObject({ notified: true });
    }
    // told once: the next run sends nothing more
    expect(runScript('send-queued-emails.cjs').mails).toHaveLength(0);
  });

  test('a team member who turned client emails off is not told', async () => {
    await seedConversation();
    await db.collection('users').doc('uA1').update({ notificationPrefs: { clientMessages: false } });
    await db.collection('client_messages').add(message({ authorId: 'uC', authorName: 'Cleo Client', fromClient: true }));
    const run = runScript('send-queued-emails.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.mails).toHaveLength(1);
    expect(addressesOf(run.mails[0].to)).toContain('mo@a.test');
  });

  test('a message that no longer matches its task is not mailed', async () => {
    await seedConversation();
    const stray = await db.collection('client_messages').add(message({ authorId: 'uC', fromClient: true, projectId: 'pOther' }));
    const run = runScript('send-queued-emails.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.mails).toHaveLength(0);
    expect((await stray.get()).data()).toMatchObject({ notified: true, notifyResult: 'task no longer matches' });
  });
});

describe('client request emails', () => {
  const seedRequests = async () => {
    await clearAll();
    for (const name of ['client_messages', 'client_requests']) {
      for (const d of (await db.collection(name).get()).docs) await d.ref.delete();
    }
    await seedBase();
    const orgA = db.collection('organizations').doc('orgA');
    await orgA.collection('projects').doc('pA').set({ name: 'Apollo', departmentId: 'dA' });
    await orgA.collection('projects').doc('pLone').set({ name: 'Lonely', departmentId: 'dNone' });
    const people = {
      uM: { name: 'Mo Manager', email: 'mo@a.test', orgId: 'orgA', status: 'active', role: 'manager', projectIds: ['pA'] },
      uH: { name: 'Hana Head', email: 'hana@a.test', orgId: 'orgA', status: 'active', role: 'department-head', departmentIds: ['dA'] },
      uAdm: { name: 'Ada Admin', email: 'ada@a.test', orgId: 'orgA', status: 'active', role: 'org-admin' },
      uC: { name: 'Cleo Client', email: 'cleo@client.test', orgId: 'orgA', status: 'active', role: 'client', projectIds: ['pA', 'pLone'] },
      // a staff member on the project is not told about requests
      uS: { name: 'Sam Staff', email: 'sam@a.test', orgId: 'orgA', status: 'active', role: 'staff', projectIds: ['pA'] },
    };
    for (const [id, u] of Object.entries(people)) await db.collection('users').doc(id).set(u);
  };
  const request = (extra) => ({
    orgId: 'orgA', projectId: 'pA', title: 'Add a dark mode', details: 'For the dashboard', urgency: 'urgent',
    neededBy: '2026-11-01', requestedBy: 'uC', requestedByName: 'Cleo Client', status: 'new', notified: false,
    createdAt: admin.firestore.Timestamp.now(), ...extra,
  });

  test("a new request reaches the project's manager and department head, not its staff", async () => {
    await seedRequests();
    const ref = await db.collection('client_requests').add(request());
    const run = runScript('send-queued-emails.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    const to = run.mails.map((m) => addressesOf(m.to)).join(' ');
    expect(run.mails).toHaveLength(2);
    expect(to).toContain('mo@a.test');
    expect(to).toContain('hana@a.test');
    expect(to).not.toContain('sam@a.test');
    expect(run.mails[0].subject).toContain('Cleo Client asked for “Add a dark mode”');
    expect(run.mails[0].text).toContain('Urgent');
    expect((await ref.get()).data()).toMatchObject({ notified: true });
  });

  test('a project nobody runs falls back to the org admins', async () => {
    await seedRequests();
    await db.collection('client_requests').add(request({ projectId: 'pLone' }));
    const run = runScript('send-queued-emails.cjs');
    expect(run.mails).toHaveLength(1);
    expect(addressesOf(run.mails[0].to)).toContain('ada@a.test');
  });

  test('the client hears the answer, with the reason', async () => {
    await seedRequests();
    await db.collection('client_requests').add(request({
      status: 'declined', decidedBy: 'uM', decidedByName: 'Mo Manager', response: 'Out of scope for this phase',
    }));
    const run = runScript('send-queued-emails.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.mails).toHaveLength(1);
    expect(addressesOf(run.mails[0].to)).toContain('cleo@client.test');
    expect(run.mails[0].subject).toContain('was declined');
    expect(run.mails[0].text).toContain('Out of scope for this phase');
  });
});

describe('weekly project summary', () => {
  test('org admins get every project, department heads their departments, worst first', async () => {
    await clearAll();
    const orgA = db.collection('organizations').doc('orgA');
    await orgA.set({ name: 'Org A', status: 'active' });
    await orgA.collection('projects').doc('pA').set({ name: 'Apollo', departmentId: 'dA' });
    await orgA.collection('projects').doc('pB').set({ name: 'Borealis', departmentId: 'dB' });
    await orgA.collection('projects').doc('pB').collection('updates').add({
      health: 'on_track', summary: 'Shipped the beta\nmore detail', createdBy: 'uAdm', createdByName: 'Ada', createdAt: admin.firestore.Timestamp.now(),
    });
    const orgS = db.collection('organizations').doc('orgS');
    await orgS.set({ name: 'Suspended', status: 'suspended' });
    await orgS.collection('projects').doc('pS').set({ name: 'Hidden' });

    const people = {
      uAdm: { name: 'Ada Admin', email: 'ada@a.test', orgId: 'orgA', status: 'active', role: 'org-admin' },
      uOff: { name: 'Off Admin', email: 'off@a.test', orgId: 'orgA', status: 'active', role: 'org-admin', notificationPrefs: { weeklyDigest: false } },
      uGone: { name: 'Gone Admin', email: 'gone@a.test', orgId: 'orgA', status: 'inactive', role: 'org-admin' },
      uH: { name: 'Hana Head', email: 'hana@a.test', orgId: 'orgA', status: 'active', role: 'department-head', departmentIds: ['dA'] },
      uS: { name: 'Sam Staff', email: 'sam@a.test', orgId: 'orgA', status: 'active', role: 'staff' },
      uSus: { name: 'Sus Admin', email: 'sus@s.test', orgId: 'orgS', status: 'active', role: 'org-admin' },
    };
    for (const [id, u] of Object.entries(people)) await db.collection('users').doc(id).set(u);
    const day = (offset) => admin.firestore.Timestamp.fromDate(new Date(Date.now() + offset * 86400000));
    await db.collection('tasks').add({ title: 'Late', orgId: 'orgA', projectId: 'pA', status: 'pending', deadline: day(-3) });
    await db.collection('tasks').add({ title: 'Fine', orgId: 'orgA', projectId: 'pA', status: 'pending', deadline: day(10) });
    await db.collection('tasks').add({ title: 'Done', orgId: 'orgA', projectId: 'pB', status: 'completed', deadline: day(-1) });
    await db.collection('tasks').add({ title: 'Hidden', orgId: 'orgS', projectId: 'pS', status: 'pending', deadline: day(-5) });

    const run = runScript('send-weekly-digest.cjs');
    expect(run.status, run.stderr + run.stdout).toBe(0);
    const to = run.mails.map((m) => addressesOf(m.to)).join(' ');
    expect(run.mails).toHaveLength(2);
    expect(to).toContain('ada@a.test');
    expect(to).toContain('hana@a.test');
    for (const nobody of ['off@a.test', 'gone@a.test', 'sam@a.test', 'sus@s.test']) expect(to).not.toContain(nobody);

    const forAdmin = run.mails.find((m) => addressesOf(m.to).includes('ada@a.test'));
    expect(forAdmin.subject).toContain('Your projects this week');
    // Apollo (1 of 2 open tasks overdue: off track) comes before Borealis (declared on track)
    expect(forAdmin.text.indexOf('Apollo')).toBeLessThan(forAdmin.text.indexOf('Borealis'));
    expect(forAdmin.text).toContain('Off track (suggested)');
    expect(forAdmin.text).toContain('“Shipped the beta”');
    expect(forAdmin.text).toContain('2 projects: 1 off track, 1 on track. 1 task overdue.');

    const forHead = run.mails.find((m) => addressesOf(m.to).includes('hana@a.test'));
    expect(forHead.text).toContain('Apollo');
    expect(forHead.text).not.toContain('Borealis');
  });
});
