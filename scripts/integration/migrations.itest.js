/**
 * The two production data migrations, run as the real scripts against the
 * Firestore emulator. They touch live data, so they are proven here first:
 * dry runs write nothing, copies are idempotent and never clobber, and the clean-up
 * phase only removes a legacy field once its replacement exists.
 *
 *   npm run test:integration
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
db.settings({ ignoreUndefinedProperties: true });

const run = (script, ...args) =>
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'admin', script), ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  });

const clearAll = async () => {
  for (const name of ['designations', 'users', 'organizations']) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
  }
};

describe('migrate-private-fields', () => {
  const org = () => db.collection('organizations').doc('orgA');
  const settings = () => org().collection('private').doc('settings');
  const seats = () => org().collection('meta').doc('seats');
  const finance = (p) => org().collection('projects').doc(p).collection('finance').doc('budget');

  beforeEach(async () => {
    await clearAll();
    await org().set({
      name: 'Org A', status: 'active', plan: 'active',
      billingEmail: 'bill@a.test', ccEmails: ['boss@a.test'], seatLimit: 7, storageQuotaMB: 500,
    });
    await org().collection('projects').doc('p1').set({ name: 'P1', departmentId: 'd1', budget: 1200, currency: 'INR', budgetNotes: 'n' });
    await org().collection('projects').doc('p2').set({ name: 'P2', departmentId: 'd1' });
    for (const id of ['u1', 'u2', 'u3']) await db.collection('users').doc(id).set({ orgId: 'orgA', email: `${id}@a.test` });
    await db.collection('users').doc('other').set({ orgId: 'orgB', email: 'o@b.test' });
  });

  test('a dry run reports the plan and writes nothing', async () => {
    const r = run('migrate-private-fields.cjs');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('DRY RUN');
    expect(r.stdout).toContain('private/settings');
    expect((await settings().get()).exists).toBe(false);
    expect((await seats().get()).exists).toBe(false);
    expect((await finance('p1').get()).exists).toBe(false);
  });

  test('--apply copies settings, starts the seat counter and moves budgets, keeping the legacy fields', async () => {
    const r = run('migrate-private-fields.cjs', '--apply');
    expect(r.status, r.stderr).toBe(0);
    expect((await settings().get()).data()).toEqual({
      seatLimit: 7, storageQuotaMB: 500, billingEmail: 'bill@a.test', ccEmails: ['boss@a.test'],
    });
    expect((await seats().get()).data()).toEqual({ seatsUsed: 3, seatLimit: 7, lastSeatUid: null });
    expect((await finance('p1').get()).data()).toEqual({ budget: 1200, currency: 'INR', budgetNotes: 'n' });
    // a project that never had a budget gets no finance document
    expect((await finance('p2').get()).exists).toBe(false);
    // the old app still works: legacy fields untouched
    expect((await org().get()).data().billingEmail).toBe('bill@a.test');
    expect((await org().collection('projects').doc('p1').get()).data().budget).toBe(1200);
  });

  test('--apply is idempotent and never overwrites a document that already exists', async () => {
    run('migrate-private-fields.cjs', '--apply');
    await settings().update({ ccEmails: ['changed@a.test'] });
    await seats().update({ seatsUsed: 2 });
    const again = run('migrate-private-fields.cjs', '--apply');
    expect(again.status, again.stderr).toBe(0);
    expect(again.stdout).toContain('0 change(s)');
    expect((await settings().get()).data().ccEmails).toEqual(['changed@a.test']);
    expect((await seats().get()).data().seatsUsed).toBe(2);
  });

  test('--remove-old strips the legacy fields once the new documents exist', async () => {
    run('migrate-private-fields.cjs', '--apply');
    const r = run('migrate-private-fields.cjs', '--remove-old');
    expect(r.status, r.stderr).toBe(0);
    const o = (await org().get()).data();
    for (const k of ['billingEmail', 'ccEmails', 'seatLimit', 'storageQuotaMB']) expect(o, k).not.toHaveProperty(k);
    expect(o.name).toBe('Org A');
    expect(o.status).toBe('active');
    const p1 = (await org().collection('projects').doc('p1').get()).data();
    for (const k of ['budget', 'currency', 'budgetNotes']) expect(p1, k).not.toHaveProperty(k);
    expect(p1.name).toBe('P1');
    // and the new homes are intact
    expect((await settings().get()).data().billingEmail).toBe('bill@a.test');
    expect((await finance('p1').get()).data().budget).toBe(1200);
  });

  test('--remove-old refuses to strip a legacy field whose replacement does not exist', async () => {
    const r = run('migrate-private-fields.cjs', '--remove-old');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('legacy fields kept');
    expect((await org().get()).data().billingEmail).toBe('bill@a.test');
    expect((await org().collection('projects').doc('p1').get()).data().budget).toBe(1200);
  });
});

describe('backfill-designation-org', () => {
  beforeEach(async () => {
    await clearAll();
    await db.collection('organizations').doc('only').set({ name: 'Only Org' });
    await db.collection('designations').doc('legacy1').set({ name: 'Engineer' });
    await db.collection('designations').doc('legacy2').set({ name: 'Analyst', orgId: null });
    await db.collection('designations').doc('owned').set({ name: 'Manager', orgId: 'only' });
  });

  test('a dry run changes nothing', async () => {
    const r = run('backfill-designation-org.cjs');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('Dry run');
    expect((await db.collection('designations').doc('legacy1').get()).data()).not.toHaveProperty('orgId');
  });

  test('--apply gives every legacy designation the only organization', async () => {
    const r = run('backfill-designation-org.cjs', '--apply');
    expect(r.status, r.stderr).toBe(0);
    for (const id of ['legacy1', 'legacy2', 'owned']) {
      expect((await db.collection('designations').doc(id).get()).data().orgId, id).toBe('only');
    }
  });

  test('it refuses to guess when there is more than one organization', async () => {
    await db.collection('organizations').doc('second').set({ name: 'Second' });
    const r = run('backfill-designation-org.cjs', '--apply');
    expect(r.status).toBe(1);
    expect((await db.collection('designations').doc('legacy1').get()).data()).not.toHaveProperty('orgId');
  });
});
