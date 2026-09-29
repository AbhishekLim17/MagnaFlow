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
