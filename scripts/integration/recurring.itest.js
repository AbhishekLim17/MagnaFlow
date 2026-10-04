/**
 * End-to-end test of the repeating-tasks job, run as the real script against the Firestore
 * emulator (npm run test:integration).
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const admin = require('firebase-admin');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-magnaflow';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run via `npm run test:integration` (needs the Firestore emulator).');
}
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const run = (...args) => {
  const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'roll-recurring-tasks.cjs'), ...args], {
    cwd: ROOT, env: { ...process.env }, encoding: 'utf8',
  });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
};

const day = (iso) => admin.firestore.Timestamp.fromDate(new Date(`${iso}T00:00:00Z`));
const iso = (ts) => (ts ? ts.toDate().toISOString().slice(0, 10) : '');
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (isoDay, n) => new Date(Date.parse(`${isoDay}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const clear = async () => {
  for (const name of ['tasks', 'subtasks', 'mail_queue']) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
};

const weeklyTask = (overrides = {}) => {
  // anchored on a recent week so the next occurrence is in the future
  const deadline = addDays(todayIso(), -2);
  const start = addDays(deadline, -4);
  return {
    title: 'Weekly report',
    description: 'Numbers for the Monday meeting',
    assignedTo: 'u1',
    priority: 'high',
    status: 'completed',
    orgId: 'org1',
    projectId: 'p1',
    departmentId: 'd1',
    createdBy: 'boss',
    startDate: day(start),
    deadline: day(deadline),
    repeat: { every: 1, unit: 'week', anchorStart: start, anchorDeadline: deadline },
    repeating: true,
    occurrence: 0,
    blockedBy: ['someOtherTask'],
    ...overrides,
  };
};

beforeEach(clear);

describe('roll-recurring-tasks', () => {
  test('a completed weekly task comes back a week later, with its checklist unticked and the assignee told', async () => {
    await db.collection('tasks').doc('w1').set(weeklyTask());
    await db.collection('subtasks').add({ taskId: 'w1', title: 'Pull the numbers', completed: true, createdBy: 'boss' });
    const t = (await db.collection('tasks').doc('w1').get()).data();

    const res = run();
    expect(res.status).toBe(0);

    const nextId = `w1_${addDays(iso(t.deadline), 7)}`;
    const next = await db.collection('tasks').doc(nextId).get();
    expect(next.exists).toBe(true);
    const n = next.data();
    expect(n).toMatchObject({
      title: 'Weekly report', assignedTo: 'u1', priority: 'high', status: 'pending', orgId: 'org1',
      projectId: 'p1', departmentId: 'd1', createdBy: 'boss', repeating: true, seriesId: 'w1', occurrence: 1,
      previousId: 'w1', blockedBy: [],
    });
    expect(iso(n.deadline)).toBe(addDays(iso(t.deadline), 7));
    expect(iso(n.startDate)).toBe(addDays(iso(t.startDate), 7));

    const old = (await db.collection('tasks').doc('w1').get()).data();
    expect(old).toMatchObject({ repeating: false, nextId, status: 'completed' });

    const subs = await db.collection('subtasks').where('taskId', '==', nextId).get();
    expect(subs.docs.map((d) => d.data())).toEqual([expect.objectContaining({ title: 'Pull the numbers', completed: false })]);

    const mail = await db.collection('mail_queue').where('taskId', '==', nextId).get();
    expect(mail.size).toBe(1);
    expect(mail.docs[0].data()).toMatchObject({ recipientUid: 'u1', status: 'pending', attempts: 0, type: 'task_assigned', source: 'recurring' });
  });

  test('running again creates nothing new', async () => {
    await db.collection('tasks').doc('w1').set(weeklyTask());
    run();
    run();
    const all = await db.collection('tasks').get();
    expect(all.size).toBe(2);
  });

  test('the next occurrence rolls in turn, numbered from the series', async () => {
    await db.collection('tasks').doc('w1').set(weeklyTask());
    run();
    const second = (await db.collection('tasks').where('previousId', '==', 'w1').get()).docs[0];
    await second.ref.update({ status: 'completed' });
    run();
    const third = (await db.collection('tasks').where('previousId', '==', second.id).get()).docs[0];
    expect(third.data()).toMatchObject({ seriesId: 'w1', occurrence: 2 });
    expect(iso(third.data().deadline)).toBe(addDays(iso(second.data().deadline), 7));
  });

  test('finished weeks late, the missed weeks are skipped', async () => {
    const deadline = addDays(todayIso(), -30);
    const start = addDays(deadline, -4);
    await db.collection('tasks').doc('late').set(weeklyTask({
      startDate: day(start), deadline: day(deadline),
      repeat: { every: 1, unit: 'week', anchorStart: start, anchorDeadline: deadline },
    }));
    run();
    const next = (await db.collection('tasks').where('seriesId', '==', 'late').get()).docs[0].data();
    expect(iso(next.deadline) >= todayIso()).toBe(true);
    expect(iso(next.deadline) <= addDays(todayIso(), 6)).toBe(true);
  });

  test('a cancelled occurrence ("skip this one") still brings the next one', async () => {
    await db.collection('tasks').doc('c1').set(weeklyTask({ status: 'cancelled' }));
    run();
    expect((await db.collection('tasks').where('previousId', '==', 'c1').get()).size).toBe(1);
  });

  test('unfinished repeating tasks and ordinary tasks are left alone', async () => {
    await db.collection('tasks').doc('open').set(weeklyTask({ status: 'in-progress' }));
    await db.collection('tasks').doc('plain').set({ title: 'One-off', status: 'completed', orgId: 'org1' });
    run();
    const ids = (await db.collection('tasks').get()).docs.map((d) => d.id).sort();
    expect(ids).toEqual(['open', 'plain']);
  });

  test('a repeating task with no deadline to count from stops repeating instead of failing every hour', async () => {
    await db.collection('tasks').doc('nodate').set(weeklyTask({
      deadline: null, startDate: null, repeat: { every: 1, unit: 'week', anchorStart: '', anchorDeadline: '' },
    }));
    const res = run();
    expect(res.status).toBe(0);
    expect((await db.collection('tasks').doc('nodate').get()).data().repeating).toBe(false);
  });

  test('a task reopened and finished again does not produce a second copy of the next one', async () => {
    await db.collection('tasks').doc('w1').set(weeklyTask());
    run();
    // reopened, then finished again; the flag comes back on as if the schedule were edited
    await db.collection('tasks').doc('w1').update({ status: 'completed', repeating: true });
    run();
    expect((await db.collection('tasks').where('previousId', '==', 'w1').get()).size).toBe(1);
  });

  test('a dry run changes nothing', async () => {
    await db.collection('tasks').doc('w1').set(weeklyTask());
    const res = run('--dry-run');
    expect(res.out).toMatch(/would create "Weekly report" #1/);
    expect((await db.collection('tasks').get()).size).toBe(1);
    expect((await db.collection('tasks').doc('w1').get()).data().repeating).toBe(true);
  });
});
