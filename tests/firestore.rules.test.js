/**
 * Firestore security-rules tests.
 *
 * These protect the multi-tenant guarantees the app depends on. A subtle edit
 * to firestore.rules can silently expose one organization's data to another —
 * that is a breach, not a bug, so it gets automated coverage.
 *
 * Run with the emulator:
 *   npm run test:rules
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ORG_A = 'orgA';
const ORG_B = 'orgB';
const DEPT_A = 'deptA';
const PROJ_A = 'projA';

// user ids
const MASTER = 'master1';
const ADMIN_A = 'adminA';
const ADMIN_B = 'adminB';
const HEAD_A = 'headA';
const MGR_A = 'mgrA';
const STAFF_A = 'staffA';
const STAFF_B = 'staffB';
const STAFF_SCOPED = 'staffScoped'; // in HEAD_A's dept and MGR_A's project

const USERS = {
  [MASTER]: { role: 'master-admin', email: 'master@x.com', status: 'active' },
  [ADMIN_A]: { role: 'org-admin', orgId: ORG_A, email: 'a@x.com', status: 'active' },
  [ADMIN_B]: { role: 'org-admin', orgId: ORG_B, email: 'b@x.com', status: 'active' },
  [HEAD_A]: { role: 'department-head', orgId: ORG_A, departmentIds: [DEPT_A], projectIds: [], email: 'h@x.com', status: 'active' },
  [MGR_A]: { role: 'manager', orgId: ORG_A, departmentIds: [], projectIds: [PROJ_A], email: 'm@x.com', status: 'active' },
  [STAFF_A]: { role: 'staff', orgId: ORG_A, departmentIds: [], projectIds: [], email: 's@x.com', status: 'active' },
  [STAFF_B]: { role: 'staff', orgId: ORG_B, departmentIds: [], projectIds: [], email: 'sb@x.com', status: 'active' },
  [STAFF_SCOPED]: { role: 'staff', orgId: ORG_A, departmentIds: [DEPT_A], projectIds: [PROJ_A], email: 'ss@x.com', status: 'active' },
};

let testEnv;

const asUser = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // Must match the --project passed to emulators:exec. A "demo-" prefix tells
    // the emulator this project doesn't exist, so it runs without any Firebase
    // credentials — which is what lets these tests run in CI.
    projectId: 'demo-magnaflow',
    firestore: {
      rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed baseline data bypassing rules.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, data] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), data);
    }
    await setDoc(doc(db, 'organizations', ORG_A), { name: 'Org A', status: 'active' });
    await setDoc(doc(db, 'organizations', ORG_B), { name: 'Org B', status: 'active' });

    // A task in each org.
    await setDoc(doc(db, 'tasks', 'taskA'), {
      title: 'A task', orgId: ORG_A, departmentId: DEPT_A, projectId: PROJ_A,
      assignedTo: STAFF_A, createdBy: ADMIN_A, status: 'pending',
    });
    await setDoc(doc(db, 'tasks', 'taskB'), {
      title: 'B task', orgId: ORG_B, departmentId: 'deptB', projectId: 'projB',
      assignedTo: STAFF_B, createdBy: ADMIN_B, status: 'pending',
    });

    await setDoc(doc(db, 'error_logs', 'err1'), {
      message: 'Boom', stack: '', userId: STAFF_A,
    });
  });
});

describe('cross-organization isolation', () => {
  test("org-admin cannot read another org's task", async () => {
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'tasks', 'taskB')));
  });

  test("org-admin cannot read another org's user", async () => {
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'users', STAFF_B)));
  });

  test("org-admin cannot update another org's task", async () => {
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'tasks', 'taskB'), { title: 'hijacked' }));
  });

  test("org-admin cannot delete another org's user", async () => {
    await assertFails(deleteDoc(doc(asUser(ADMIN_A), 'users', STAFF_B)));
  });

  test('org-admin CAN read their own org task', async () => {
    await assertSucceeds(getDoc(doc(asUser(ADMIN_A), 'tasks', 'taskA')));
  });
});

describe('task creation is confined to the creator org', () => {
  test('staff cannot plant a task in another organization', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'tasks', 'evil'), {
      title: 'evil', orgId: ORG_B, createdBy: STAFF_A, assignedTo: STAFF_B, status: 'pending',
    }));
  });

  test('staff CAN create a task in their own organization', async () => {
    await assertSucceeds(setDoc(doc(asUser(STAFF_A), 'tasks', 'mine'), {
      title: 'mine', orgId: ORG_A, createdBy: STAFF_A, assignedTo: STAFF_A, status: 'pending',
    }));
  });

  test('a task cannot be moved to another org on update', async () => {
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'tasks', 'taskA'), { orgId: ORG_B }));
  });
});

describe('privilege escalation', () => {
  test('staff cannot promote themselves', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), { role: 'org-admin' }));
  });

  test('staff cannot reactivate themselves', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), { status: 'inactive' }));
  });

  test('staff cannot self-grant department membership', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), { departmentIds: [DEPT_A] }));
  });

  test('staff cannot self-grant project membership', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), { projectIds: [PROJ_A] }));
  });

  test('staff CAN edit their own harmless profile fields', async () => {
    await assertSucceeds(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), { name: 'New Name' }));
  });

  test('org-admin cannot elevate a user to master-admin', async () => {
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'users', STAFF_A), { role: 'master-admin' }));
  });

  test('org-admin cannot elevate a user to org-admin', async () => {
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'users', STAFF_A), { role: 'org-admin' }));
  });

  test('org-admin CAN update a staff member in their org', async () => {
    await assertSucceeds(updateDoc(doc(asUser(ADMIN_A), 'users', STAFF_A), { designation: 'Engineer' }));
  });
});

describe('scoped roles', () => {
  test('department head can read a task in their department', async () => {
    await assertSucceeds(getDoc(doc(asUser(HEAD_A), 'tasks', 'taskA')));
  });

  test('manager can read a task in their project', async () => {
    await assertSucceeds(getDoc(doc(asUser(MGR_A), 'tasks', 'taskA')));
  });

  test('manager can delete a task in their project', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(MGR_A), 'tasks', 'taskA')));
  });

  test('staff can read a task assigned to them', async () => {
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'tasks', 'taskA')));
  });

  test('manager cannot move a task out of their project', async () => {
    await assertFails(updateDoc(doc(asUser(MGR_A), 'tasks', 'taskA'), { projectId: 'someOtherProject' }));
  });
});

describe('organizations & master-admin surfaces', () => {
  test('org-admin cannot create an organization', async () => {
    await assertFails(setDoc(doc(asUser(ADMIN_A), 'organizations', 'newOrg'), { name: 'Nope' }));
  });

  test('master-admin CAN create an organization', async () => {
    await assertSucceeds(setDoc(doc(asUser(MASTER), 'organizations', 'newOrg'), { name: 'Yes' }));
  });

  test('org-admin cannot read audit logs', async () => {
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'audit_logs', 'anything')));
  });

  test('org-admin CAN create a department in their own org', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(ADMIN_A), 'organizations', ORG_A, 'departments', 'd1'), { name: 'Eng' })
    );
  });

  test("org-admin cannot create a department in another org", async () => {
    await assertFails(
      setDoc(doc(asUser(ADMIN_B), 'organizations', ORG_A, 'departments', 'd2'), { name: 'Sneaky' })
    );
  });
});

describe('unauthenticated access', () => {
  test('anonymous cannot read users', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users', STAFF_A)));
  });

  test('anonymous cannot read tasks', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'tasks', 'taskA')));
  });
});

// Crash reports carry stack traces and URLs that can name another org's data,
// so anyone may file one but only a master-admin may read them — and nobody
// may edit or erase a report once written.
describe('error logs', () => {
  test('any signed-in user can report an error', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(STAFF_A), 'error_logs', 'newErr'), { message: 'Crash', userId: STAFF_A })
    );
  });

  test('anonymous cannot report an error', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon, 'error_logs', 'anonErr'), { message: 'Crash' }));
  });

  test('master-admin CAN read error logs', async () => {
    await assertSucceeds(getDoc(doc(asUser(MASTER), 'error_logs', 'err1')));
  });

  test('org-admin cannot read error logs', async () => {
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'error_logs', 'err1')));
  });

  test('staff cannot read even their own error report', async () => {
    await assertFails(getDoc(doc(asUser(STAFF_A), 'error_logs', 'err1')));
  });

  test('nobody can edit an error log, not even master-admin', async () => {
    await assertFails(updateDoc(doc(asUser(MASTER), 'error_logs', 'err1'), { message: 'edited' }));
  });

  test('nobody can delete an error log, not even master-admin', async () => {
    await assertFails(deleteDoc(doc(asUser(MASTER), 'error_logs', 'err1')));
  });
});

// The browser cannot send email; it appends a request here and a scheduled job
// delivers it. That makes this the one collection where a signed-in user can
// cause mail to leave the system, so the shape is pinned down rather than
// trusted.
describe('outgoing email queue', () => {
  const validMail = (uid) => ({
    requestedBy: uid,
    status: 'pending',
    attempts: 0,
    to_email: 'someone@example.com',
    title: 'A task was assigned',
    notification_type: 'Task Assignment',
  });

  test('a signed-in user can queue an email', async () => {
    await assertSucceeds(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm1'), validMail(STAFF_A)));
  });

  test('anonymous cannot queue an email', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon, 'mail_queue', 'm2'), validMail(STAFF_A)));
  });

  test('cannot queue an email attributed to somebody else', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm3'), validMail(ADMIN_A)));
  });

  // Otherwise a request could be pre-marked delivered and skip the record of it.
  test('cannot queue an email that claims to be already sent', async () => {
    await assertFails(
      setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm4'), { ...validMail(STAFF_A), status: 'sent' })
    );
  });

  test('cannot queue an email with no recipient', async () => {
    await assertFails(
      setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm5'), { ...validMail(STAFF_A), to_email: '' })
    );
  });

  test('cannot queue an email with a pre-inflated attempt count', async () => {
    await assertFails(
      setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm6'), { ...validMail(STAFF_A), attempts: 9 })
    );
  });

  // Payloads carry names, task titles and addresses from whoever queued them.
  test('nobody can read the queue, not even a master-admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'mail_queue', 'existing'), validMail(STAFF_A));
    });
    await assertFails(getDoc(doc(asUser(MASTER), 'mail_queue', 'existing')));
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'mail_queue', 'existing')));
  });

  test('nobody can edit or delete a queued email from the client', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'mail_queue', 'existing2'), validMail(STAFF_A));
    });
    await assertFails(updateDoc(doc(asUser(MASTER), 'mail_queue', 'existing2'), { status: 'sent' }));
    await assertFails(deleteDoc(doc(asUser(MASTER), 'mail_queue', 'existing2')));
  });
});

// A list query binds no document id, so a rule that tests the wildcard sees
// null and errors rather than denying. That made departments and projects
// unlistable for exactly the roles that needed them most.
describe('listing departments and projects', () => {
  const deptsOf = (db, org) => collection(db, 'organizations', org, 'departments');
  const projsOf = (db, org) => collection(db, 'organizations', org, 'projects');

  test('a department head CAN list departments in their org', async () => {
    await assertSucceeds(getDocs(deptsOf(asUser(HEAD_A), ORG_A)));
  });

  test('a manager CAN list projects in their org', async () => {
    await assertSucceeds(getDocs(projsOf(asUser(MGR_A), ORG_A)));
  });

  test("staff CAN list their own org's departments", async () => {
    await assertSucceeds(getDocs(deptsOf(asUser(STAFF_A), ORG_A)));
  });

  test('an org-admin CAN list projects in their org', async () => {
    await assertSucceeds(getDocs(projsOf(asUser(ADMIN_A), ORG_A)));
  });

  // The part that must not regress.
  test("a member of another org cannot list this org's departments", async () => {
    await assertFails(getDocs(deptsOf(asUser(STAFF_B), ORG_A)));
  });

  test("a member of another org cannot list this org's projects", async () => {
    await assertFails(getDocs(projsOf(asUser(ADMIN_B), ORG_A)));
  });

  test('anonymous cannot list departments', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(deptsOf(anon, ORG_A)));
  });
});

// Heads and managers run their own scope. The risk in granting that is
// privilege escalation, so every "can" below is paired with a "cannot".
describe('scoped admin powers for heads and managers', () => {
  test('a head CAN edit staff in their department', async () => {
    await assertSucceeds(updateDoc(doc(asUser(HEAD_A), 'users', STAFF_SCOPED), { designation: 'Lead Dev' }));
  });

  test('a manager CAN edit staff on their project', async () => {
    await assertSucceeds(updateDoc(doc(asUser(MGR_A), 'users', STAFF_SCOPED), { designation: 'QA Lead' }));
  });

  test('a head CAN remove staff from their department', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(HEAD_A), 'users', STAFF_SCOPED)));
  });

  // The escalation guards.
  test('a head cannot promote staff to department-head', async () => {
    await assertFails(updateDoc(doc(asUser(HEAD_A), 'users', STAFF_SCOPED), { role: 'department-head' }));
  });

  test('a head cannot promote staff to org-admin', async () => {
    await assertFails(updateDoc(doc(asUser(HEAD_A), 'users', STAFF_SCOPED), { role: 'org-admin' }));
  });

  test('a manager cannot promote themselves', async () => {
    await assertFails(updateDoc(doc(asUser(MGR_A), 'users', MGR_A), { role: 'org-admin' }));
  });

  test('a head cannot edit another org-admin', async () => {
    await assertFails(updateDoc(doc(asUser(HEAD_A), 'users', ADMIN_A), { designation: 'nope' }));
  });

  test('a head cannot delete an org-admin', async () => {
    await assertFails(deleteDoc(doc(asUser(HEAD_A), 'users', ADMIN_A)));
  });

  test("a head cannot edit staff in another org", async () => {
    await assertFails(updateDoc(doc(asUser(HEAD_A), 'users', STAFF_B), { designation: 'nope' }));
  });

  test('a head cannot move staff out of their department', async () => {
    await assertFails(
      updateDoc(doc(asUser(HEAD_A), 'users', STAFF_SCOPED), { departmentIds: ['someOtherDept'] })
    );
  });

  test('a head cannot edit staff who are in no department of theirs', async () => {
    await assertFails(updateDoc(doc(asUser(HEAD_A), 'users', STAFF_A), { designation: 'nope' }));
  });

  test('plain staff cannot edit another staff member', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_B), { designation: 'nope' }));
  });

  test('a head CAN add a designation', async () => {
    await assertSucceeds(setDoc(doc(asUser(HEAD_A), 'designations', 'd-new'), { name: 'Tech Lead' }));
  });

  test('a manager CAN add a designation', async () => {
    await assertSucceeds(setDoc(doc(asUser(MGR_A), 'designations', 'd-new2'), { name: 'Scrum Master' }));
  });

  test('plain staff cannot add a designation', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'designations', 'd-nope'), { name: 'CEO' }));
  });
});
