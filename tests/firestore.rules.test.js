/**
 * Firestore security-rules tests.
 *
 * These protect the multi-tenant guarantees the app depends on. A subtle edit
 * to firestore.rules can silently expose one organization's data to another â€”
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
import { doc, getDoc, getDocs, collection, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
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
const CLIENT_A = 'clientA'; // external stakeholder linked to PROJ_A only
const PROJ_A2 = 'projA2'; // second project in org A, not linked to the client

const USERS = {
  [MASTER]: { role: 'master-admin', email: 'master@x.com', status: 'active' },
  [ADMIN_A]: { role: 'org-admin', orgId: ORG_A, email: 'a@x.com', status: 'active' },
  [ADMIN_B]: { role: 'org-admin', orgId: ORG_B, email: 'b@x.com', status: 'active' },
  [HEAD_A]: { role: 'department-head', orgId: ORG_A, departmentIds: [DEPT_A], projectIds: [], email: 'h@x.com', status: 'active' },
  [MGR_A]: { role: 'manager', orgId: ORG_A, departmentIds: [], projectIds: [PROJ_A], email: 'm@x.com', status: 'active' },
  [STAFF_A]: { role: 'staff', orgId: ORG_A, departmentIds: [], projectIds: [], email: 's@x.com', status: 'active' },
  [STAFF_B]: { role: 'staff', orgId: ORG_B, departmentIds: [], projectIds: [], email: 'sb@x.com', status: 'active' },
  [CLIENT_A]: { role: 'client', orgId: ORG_A, departmentIds: [], projectIds: [PROJ_A], email: 'c@x.com', status: 'active' },
  [STAFF_SCOPED]: { role: 'staff', orgId: ORG_A, departmentIds: [DEPT_A], projectIds: [PROJ_A], email: 'ss@x.com', status: 'active' },
};

let testEnv;

const asUser = (uid) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // Must match the --project passed to emulators:exec. A "demo-" prefix tells
    // the emulator this project doesn't exist, so it runs without any Firebase
    // credentials â€” which is what lets these tests run in CI.
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

    await setDoc(doc(db, 'organizations', ORG_A, 'projects', PROJ_A), { name: 'P1', departmentId: DEPT_A, budget: 1000 });
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', PROJ_A2), { name: 'P2', departmentId: 'deptOther', budget: 5000 });
    await setDoc(doc(db, 'organizations', ORG_A, 'projects', PROJ_A, 'expenses', 'exp1'), { amount: 10, description: 'x', addedBy: ADMIN_A });
    await setDoc(doc(db, 'subtasks', 'subA'), { taskId: 'taskA', title: 's', completed: false });
    await setDoc(doc(db, 'subtasks', 'subB'), { taskId: 'taskB', title: 's', completed: false });
    await setDoc(doc(db, 'task_comments', 'comA'), { taskId: 'taskA', userId: STAFF_A, text: 'hi', deleted: false });
    await setDoc(doc(db, 'task_comments', 'comB'), { taskId: 'taskB', userId: STAFF_B, text: 'hi', deleted: false });
    await setDoc(doc(db, 'designations', 'desA'), { name: 'Dev', orgId: ORG_A });
    await setDoc(doc(db, 'designations', 'desB'), { name: 'Dev', orgId: ORG_B });
    await setDoc(doc(db, 'comment_notifications', 'notifA'), { userId: STAFF_A, taskId: 'taskA', mentionedBy: ADMIN_A, read: false });

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
// so anyone may file one but only a master-admin may read them â€” and nobody
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
    recipientUid: ADMIN_A,
    title: 'A task was assigned',
    notification_type: 'Task Assignment',
    taskId: 'taskA',
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
      setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm5'), { ...validMail(STAFF_A), recipientUid: '' })
    );
  });

  test('cannot queue an email with a pre-inflated attempt count', async () => {
    await assertFails(
      setDoc(doc(asUser(STAFF_A), 'mail_queue', 'm6'), { ...validMail(STAFF_A), attempts: 9 })
    );
  });

  // Otherwise the queue is an open relay: any employee could send mail to anyone.
  test('cannot queue mail without a task reference', async () => {
    const { taskId, ...rest } = validMail(STAFF_A);
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'n1'), rest));
  });

  test('cannot queue mail about a task in another organization', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'n2'), { ...validMail(STAFF_A), taskId: 'taskB' }));
  });

  test('cannot queue mail about a task the caller cannot see', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_SCOPED), 'mail_queue', 'n3'), { ...validMail(STAFF_SCOPED), taskId: 'taskB' }));
  });

  test('cannot address mail to a raw email address', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'r1'), { ...validMail(STAFF_A), to_email: 'victim@example.com' }));
    const { recipientUid, ...rest } = validMail(STAFF_A);
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'r2'), { ...rest, to_email: 'victim@example.com' }));
  });

  test('cannot address mail to someone in another organization', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'r3'), { ...validMail(STAFF_A), recipientUid: STAFF_B }));
  });

  test('cannot address mail to a user that does not exist', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'r4'), { ...validMail(STAFF_A), recipientUid: 'ghost' }));
  });

  test('cannot choose the CC list', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'n4'), { ...validMail(STAFF_A), cc_email: 'victim@example.com' }));
  });

  test('cannot smuggle extra fields into a queued email', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'n5'), { ...validMail(STAFF_A), bcc: 'victim@example.com' }));
  });

  test('cannot queue an oversized message', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'mail_queue', 'n6'), { ...validMail(STAFF_A), message: 'x'.repeat(1001) }));
  });

  test('a client cannot queue an email', async () => {
    await assertFails(setDoc(doc(asUser(CLIENT_A), 'mail_queue', 'n7'), validMail(CLIENT_A)));
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
    await assertSucceeds(setDoc(doc(asUser(HEAD_A), 'designations', 'd-new'), { name: 'Tech Lead', orgId: ORG_A }));
  });

  test('a manager CAN add a designation', async () => {
    await assertSucceeds(setDoc(doc(asUser(MGR_A), 'designations', 'd-new2'), { name: 'Scrum Master', orgId: ORG_A }));
  });

  test('plain staff cannot add a designation', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'designations', 'd-nope'), { name: 'CEO' }));
  });
});


// ─── Client Portal ───────────────────────────────────────────────────────────
// These tests verify the rules added for the client/guest role.
// A client should be able to read tasks in their assigned projects within their
// org, but have zero write access anywhere, and no access to other collections.

describe('client portal access', () => {
  const CLIENT_A = 'clientA';        // in org A, project A
  const CLIENT_OTHER = 'clientOther'; // in org B

  beforeEach(async () => {
    // Seed client accounts and a project-less task in org A.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', CLIENT_A), {
        role: 'client',
        orgId: ORG_A,
        projectIds: [PROJ_A],
        email: 'client@a.com',
        status: 'active',
      });
      await setDoc(doc(db, 'users', CLIENT_OTHER), {
        role: 'client',
        orgId: ORG_B,
        projectIds: ['projB'],
        email: 'client@b.com',
        status: 'active',
      });
      // A task in org A with NO projectId (should be invisible to client)
      await setDoc(doc(db, 'tasks', 'taskNoProject'), {
        title: 'No project task', orgId: ORG_A,
        createdBy: ADMIN_A, status: 'pending',
      });
    });
  });

  // ── reads allowed ─────────────────────────────────────────────────────────

  test('client CAN read a task in their org and assigned project', async () => {
    // taskA has projectId: PROJ_A, orgId: ORG_A — client is linked to PROJ_A in ORG_A
    await assertSucceeds(getDoc(doc(asUser(CLIENT_A), 'tasks', 'taskA')));
  });

  test('client CAN read their own user document', async () => {
    await assertSucceeds(getDoc(doc(asUser(CLIENT_A), 'users', CLIENT_A)));
  });

  test('client CAN read their org document', async () => {
    await assertSucceeds(getDoc(doc(asUser(CLIENT_A), 'organizations', ORG_A)));
  });

  test('client CAN read project name for their assigned project', async () => {
    // The project sub-doc (proj name) is needed to render the portal header.
    await assertSucceeds(getDoc(doc(asUser(CLIENT_A), 'organizations', ORG_A, 'projects', PROJ_A)));
  });

  // ── reads denied ──────────────────────────────────────────────────────────

  test('client CANNOT read a task in their org but a different project', async () => {
    // taskNoProject has no projectId so it won't be in myProjectIds()
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'tasks', 'taskNoProject')));
  });

  test('client CANNOT read a task in another org', async () => {
    // taskB is in ORG_B; CLIENT_A is in ORG_A
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'tasks', 'taskB')));
  });

  test('client CANNOT read another user document (staff roster)', async () => {
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'users', STAFF_A)));
  });

  test('client CANNOT read task comments', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'task_comments', 'c1'), {
        taskId: 'taskA', userId: STAFF_A, text: 'internal note',
      });
    });
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'task_comments', 'c1')));
  });

  test('client CANNOT read task attachments', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'task_attachments', 'att1'), {
        taskId: 'taskA', uploadedBy: STAFF_A, url: 'https://example.com/file.pdf',
      });
    });
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'task_attachments', 'att1')));
  });

  test('client CANNOT read audit logs', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_logs', 'log1'), {
        orgId: ORG_A, actorId: ADMIN_A, action: 'created_user',
      });
    });
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'audit_logs', 'log1')));
  });

  // ── writes denied ─────────────────────────────────────────────────────────

  test('client CANNOT create a task', async () => {
    await assertFails(setDoc(doc(asUser(CLIENT_A), 'tasks', 'evil-task'), {
      title: 'sneaky', orgId: ORG_A, projectId: PROJ_A,
      createdBy: CLIENT_A, status: 'pending',
    }));
  });

  test('client CANNOT update a task', async () => {
    await assertFails(updateDoc(doc(asUser(CLIENT_A), 'tasks', 'taskA'), { status: 'completed' }));
  });

  test('client CANNOT delete a task', async () => {
    await assertFails(deleteDoc(doc(asUser(CLIENT_A), 'tasks', 'taskA')));
  });

  test('org-admin CAN create a client account in their org', async () => {
    await assertSucceeds(setDoc(doc(asUser(ADMIN_A), 'users', 'new-client-id'), {
      name: 'New Client', email: 'newclient@example.com',
      role: 'client', orgId: ORG_A, projectIds: [PROJ_A], status: 'active',
    }));
  });

  test('org-admin CAN update a client account in their org', async () => {
    await assertSucceeds(updateDoc(doc(asUser(ADMIN_A), 'users', CLIENT_A), {
      name: 'Updated Client Name', projectIds: [PROJ_A],
    }));
  });

  test('client CANNOT queue an email', async () => {
    await assertFails(setDoc(doc(asUser(CLIENT_A), 'mail_queue', 'mail1'), {
      requestedBy: CLIENT_A, status: 'pending', attempts: 0, taskId: 'taskA',
      recipientUid: ADMIN_A, title: 'Hi', notification_type: 'test',
    }));
  });
});



describe('client role is confined to its linked projects', () => {
  test('client CAN read a linked project by id', async () => {
    await assertSucceeds(getDoc(doc(asUser(CLIENT_A), 'organizations', ORG_A, 'projects', PROJ_A)));
  });
  test('client cannot read a project they are not linked to (budget leak)', async () => {
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'organizations', ORG_A, 'projects', PROJ_A2)));
  });
  test('client cannot list all projects', async () => {
    await assertFails(getDocs(collection(asUser(CLIENT_A), 'organizations', ORG_A, 'projects')));
  });
  test('client cannot list departments', async () => {
    await assertFails(getDocs(collection(asUser(CLIENT_A), 'organizations', ORG_A, 'departments')));
  });
  test('client cannot read expenses', async () => {
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'organizations', ORG_A, 'projects', PROJ_A, 'expenses', 'exp1')));
  });
  test('client cannot read subtasks or comments', async () => {
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'subtasks', 'subA')));
    await assertFails(getDoc(doc(asUser(CLIENT_A), 'task_comments', 'comA')));
  });
  test('org member (staff) can still list projects for dropdowns', async () => {
    await assertSucceeds(getDocs(collection(asUser(STAFF_A), 'organizations', ORG_A, 'projects')));
  });
});

describe('subtasks, comments and attachments inherit task visibility', () => {
  test('assignee can read and add a subtask on their task', async () => {
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'subtasks', 'subA')));
    await assertSucceeds(setDoc(doc(asUser(STAFF_A), 'subtasks', 'new'), { taskId: 'taskA', title: 'n', completed: false }));
  });
  test('other org cannot read or write a subtask', async () => {
    await assertFails(getDoc(doc(asUser(STAFF_B), 'subtasks', 'subA')));
    await assertFails(updateDoc(doc(asUser(ADMIN_B), 'subtasks', 'subA'), { completed: true }));
    await assertFails(deleteDoc(doc(asUser(ADMIN_B), 'subtasks', 'subA')));
    await assertFails(setDoc(doc(asUser(STAFF_B), 'subtasks', 'plant'), { taskId: 'taskA', title: 'x', completed: false }));
  });
  test('same-org staff who cannot see the task cannot read its subtasks', async () => {
    await assertFails(getDoc(doc(asUser(STAFF_SCOPED), 'subtasks', 'subB')));
  });
  test('subtask cannot be re-parented to a task the caller cannot see', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'subtasks', 'subA'), { taskId: 'taskB' }));
  });
  test('cross-org comment read/create denied', async () => {
    await assertFails(getDoc(doc(asUser(STAFF_B), 'task_comments', 'comA')));
    await assertFails(setDoc(doc(asUser(STAFF_B), 'task_comments', 'x'), { taskId: 'taskA', userId: STAFF_B, text: 'x' }));
  });
  test('comment must be authored as the caller', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'task_comments', 'forge'), { taskId: 'taskA', userId: ADMIN_A, text: 'x' }));
    await assertSucceeds(setDoc(doc(asUser(STAFF_A), 'task_comments', 'ok'), { taskId: 'taskA', userId: STAFF_A, text: 'x' }));
  });
  test('cannot edit someone elses comment', async () => {
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'task_comments', 'comA'), { text: 'edited' }));
  });
  test('cross-org attachment metadata denied', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_B), 'task_attachments', 'a1'), { taskId: 'taskA', uploadedBy: STAFF_B }));
  });
});

describe('notifications', () => {
  test('recipient can read and mark their notification read', async () => {
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'comment_notifications', 'notifA')));
    await assertSucceeds(updateDoc(doc(asUser(STAFF_A), 'comment_notifications', 'notifA'), { read: true }));
  });
  test('recipient cannot rewrite other notification fields', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'comment_notifications', 'notifA'), { userId: ADMIN_A }));
  });
  test('cannot notify a user in another org', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'comment_notifications', 'n2'), { userId: STAFF_B, mentionedBy: STAFF_A, read: false }));
  });
  test('cannot send a notification attributed to someone else', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'comment_notifications', 'n3'), { userId: ADMIN_A, mentionedBy: STAFF_B, read: false }));
  });
  test('can notify a colleague in the same org', async () => {
    await assertSucceeds(setDoc(doc(asUser(STAFF_A), 'comment_notifications', 'n4'), { userId: ADMIN_A, mentionedBy: STAFF_A, read: false }));
  });
});

describe('designations are per organization', () => {
  test('manager can read their own org designations but not another org', async () => {
    await assertSucceeds(getDoc(doc(asUser(MGR_A), 'designations', 'desA')));
    await assertFails(getDoc(doc(asUser(MGR_A), 'designations', 'desB')));
  });
  test("manager cannot edit or delete another org's designation", async () => {
    await assertFails(updateDoc(doc(asUser(MGR_A), 'designations', 'desB'), { name: 'hacked' }));
    await assertFails(deleteDoc(doc(asUser(MGR_A), 'designations', 'desB')));
  });
  test('manager cannot create a designation in another org', async () => {
    await assertFails(setDoc(doc(asUser(MGR_A), 'designations', 'x'), { name: 'x', orgId: ORG_B }));
  });
  test('manager CAN create a designation in their own org', async () => {
    await assertSucceeds(setDoc(doc(asUser(MGR_A), 'designations', 'x'), { name: 'x', orgId: ORG_A }));
  });
  test('staff cannot write designations', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'designations', 'x'), { name: 'x', orgId: ORG_A }));
  });
});

describe('task scope enforcement', () => {
  test('assignee cannot move their task to another project', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'tasks', 'taskA'), { projectId: PROJ_A2 }));
  });
  test('assignee cannot reassign or re-author their task', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'tasks', 'taskA'), { assignedTo: ADMIN_A }));
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'tasks', 'taskA'), { createdBy: STAFF_A }));
  });
  test('assignee CAN update status', async () => {
    await assertSucceeds(updateDoc(doc(asUser(STAFF_A), 'tasks', 'taskA'), { status: 'in-progress' }));
  });
  test('staff without scope cannot create a task inside a project', async () => {
    await assertFails(setDoc(doc(asUser(STAFF_A), 'tasks', 'p'), {
      title: 'p', orgId: ORG_A, projectId: PROJ_A, departmentId: DEPT_A, createdBy: STAFF_A, assignedTo: STAFF_A, status: 'pending',
    }));
  });
  test('manager can create a task in their project, not in another', async () => {
    await assertSucceeds(setDoc(doc(asUser(MGR_A), 'tasks', 'mp'), {
      title: 'm', orgId: ORG_A, projectId: PROJ_A, departmentId: DEPT_A, createdBy: MGR_A, assignedTo: STAFF_SCOPED, status: 'pending',
    }));
    await assertFails(setDoc(doc(asUser(MGR_A), 'tasks', 'mp2'), {
      title: 'm', orgId: ORG_A, projectId: PROJ_A2, departmentId: 'deptOther', createdBy: MGR_A, assignedTo: STAFF_SCOPED, status: 'pending',
    }));
  });
  test('department head can create a task in a project inside their department', async () => {
    await assertSucceeds(setDoc(doc(asUser(HEAD_A), 'tasks', 'hp'), {
      title: 'h', orgId: ORG_A, projectId: PROJ_A, departmentId: DEPT_A, createdBy: HEAD_A, assignedTo: STAFF_SCOPED, status: 'pending',
    }));
    await assertFails(setDoc(doc(asUser(HEAD_A), 'tasks', 'hp2'), {
      title: 'h', orgId: ORG_A, projectId: PROJ_A2, departmentId: 'deptOther', createdBy: HEAD_A, assignedTo: STAFF_SCOPED, status: 'pending',
    }));
  });
  test('org-admin can place a task in any project of the org', async () => {
    await assertSucceeds(setDoc(doc(asUser(ADMIN_A), 'tasks', 'ap'), {
      title: 'a', orgId: ORG_A, projectId: PROJ_A2, departmentId: 'deptOther', createdBy: ADMIN_A, assignedTo: STAFF_A, status: 'pending',
    }));
  });
});

describe('project expenses are financial data', () => {
  const EXP = (uid) => ({ amount: 5, description: 'd', addedBy: uid });
  const expPath = (db, id, proj = PROJ_A) => doc(db, 'organizations', ORG_A, 'projects', proj, 'expenses', id);
  test('staff cannot read or create expenses', async () => {
    await assertFails(getDoc(expPath(asUser(STAFF_A), 'exp1')));
    await assertFails(setDoc(expPath(asUser(STAFF_A), 'e'), EXP(STAFF_A)));
  });
  test('org-admin and project manager can read; manager of another project cannot', async () => {
    await assertSucceeds(getDoc(expPath(asUser(ADMIN_A), 'exp1')));
    await assertSucceeds(getDoc(expPath(asUser(MGR_A), 'exp1')));
    await assertFails(getDoc(expPath(asUser(MGR_A), 'x', PROJ_A2)));
  });
  test('department head can read expenses of a project in their department', async () => {
    await assertSucceeds(getDoc(expPath(asUser(HEAD_A), 'exp1')));
  });
  test('expense must be recorded under the caller', async () => {
    await assertFails(setDoc(expPath(asUser(MGR_A), 'e'), EXP(ADMIN_A)));
    await assertSucceeds(setDoc(expPath(asUser(MGR_A), 'e'), EXP(MGR_A)));
  });
  test('other org cannot read expenses', async () => {
    await assertFails(getDoc(expPath(asUser(ADMIN_B), 'exp1')));
  });
});

describe('email logs are org-scoped and server-written', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'email_logs', 'logA'), { orgId: ORG_A, recipient: 'x@x.com' });
    });
  });
  test('org-admin can read their org email log', async () => {
    await assertSucceeds(getDoc(doc(asUser(ADMIN_A), 'email_logs', 'logA')));
  });
  test('another org admin cannot read it', async () => {
    await assertFails(getDoc(doc(asUser(ADMIN_B), 'email_logs', 'logA')));
  });
  test('the browser cannot write email logs', async () => {
    await assertFails(setDoc(doc(asUser(ADMIN_A), 'email_logs', 'forged'), { orgId: ORG_A }));
  });
});

describe('deactivated accounts lose data access', () => {
  const INACTIVE = 'staffInactive';
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', INACTIVE), { role: 'staff', orgId: ORG_A, departmentIds: [], projectIds: [], email: 'i@x.com', status: 'inactive' });
      await setDoc(doc(db, 'tasks', 'inactiveTask'), { title: 't', orgId: ORG_A, assignedTo: INACTIVE, createdBy: ADMIN_A, status: 'pending' });
    });
  });
  test('can still read their own profile (so the app can explain why)', async () => {
    await assertSucceeds(getDoc(doc(asUser(INACTIVE), 'users', INACTIVE)));
  });
  test('cannot read tasks assigned to them', async () => {
    await assertFails(getDoc(doc(asUser(INACTIVE), 'tasks', 'inactiveTask')));
  });
  test('cannot create tasks, comments or mail', async () => {
    await assertFails(setDoc(doc(asUser(INACTIVE), 'tasks', 'x'), { title: 'x', orgId: ORG_A, createdBy: INACTIVE, assignedTo: INACTIVE }));
    await assertFails(setDoc(doc(asUser(INACTIVE), 'task_comments', 'x'), { taskId: 'inactiveTask', userId: INACTIVE, text: 'x' }));
  });
  test('cannot edit their own profile', async () => {
    await assertFails(updateDoc(doc(asUser(INACTIVE), 'users', INACTIVE), { name: 'still here' }));
  });
  test('an active colleague is unaffected', async () => {
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'tasks', 'taskA')));
  });
});

describe('suspended organizations are cut off by the rules', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'organizations', ORG_A), { status: 'suspended' });
    });
  });
  test('members of a suspended org cannot read their tasks or other data', async () => {
    await assertFails(getDoc(doc(asUser(STAFF_A), 'tasks', 'taskA')));
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'tasks', 'taskA')));
    await assertFails(getDoc(doc(asUser(ADMIN_A), 'users', STAFF_A)));
    await assertFails(getDocs(collection(asUser(ADMIN_A), 'organizations', ORG_A, 'projects')));
  });
  test('they cannot write either', async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'tasks', 'taskA'), { status: 'in-progress' }));
    await assertFails(setDoc(doc(asUser(ADMIN_A), 'tasks', 'new'), { title: 'x', orgId: ORG_A, createdBy: ADMIN_A, assignedTo: STAFF_A }));
  });
  test('but can still read their own profile and org doc, so the app can explain why', async () => {
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'users', STAFF_A)));
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'organizations', ORG_A)));
  });
  test('other organizations are unaffected', async () => {
    await assertSucceeds(getDoc(doc(asUser(STAFF_B), 'tasks', 'taskB')));
  });
  test('master-admin can still manage a suspended org and reactivate it', async () => {
    await assertSucceeds(getDoc(doc(asUser(MASTER), 'tasks', 'taskA')));
    await assertSucceeds(updateDoc(doc(asUser(MASTER), 'organizations', ORG_A), { status: 'active' }));
    await assertSucceeds(getDoc(doc(asUser(STAFF_A), 'tasks', 'taskA')));
  });
});

describe('organization private settings and finance are admin-only', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organizations', ORG_A, 'private', 'settings'), { billingEmail: 'bill@a.test', ccEmails: ['boss@a.test'] });
      await setDoc(doc(db, 'organizations', ORG_A, 'projects', PROJ_A, 'finance', 'budget'), { budget: 1000, currency: 'USD' });
    });
  });
  const settings = (db) => doc(db, 'organizations', ORG_A, 'private', 'settings');
  const budget = (db) => doc(db, 'organizations', ORG_A, 'projects', PROJ_A, 'finance', 'budget');

  test('org-admin and master-admin can read the settings', async () => {
    await assertSucceeds(getDoc(settings(asUser(ADMIN_A))));
    await assertSucceeds(getDoc(settings(asUser(MASTER))));
  });
  test('managers, heads, staff, clients and other orgs cannot', async () => {
    for (const uid of [MGR_A, HEAD_A, STAFF_A, CLIENT_A, ADMIN_B]) {
      await assertFails(getDoc(settings(asUser(uid))));
    }
  });
  test('only master-admin can change the settings', async () => {
    await assertFails(updateDoc(settings(asUser(ADMIN_A)), { billingEmail: 'x@x.test' }));
    await assertSucceeds(updateDoc(settings(asUser(MASTER)), { billingEmail: 'x@x.test' }));
  });

  test('the project budget is readable by org-admin, the project manager and department head', async () => {
    for (const uid of [ADMIN_A, MGR_A, HEAD_A, MASTER]) await assertSucceeds(getDoc(budget(asUser(uid))));
  });
  test('staff, clients and other orgs cannot read the project budget', async () => {
    for (const uid of [STAFF_A, STAFF_SCOPED, CLIENT_A, ADMIN_B]) await assertFails(getDoc(budget(asUser(uid))));
  });
  test('only org-admin can set the budget', async () => {
    await assertSucceeds(updateDoc(budget(asUser(ADMIN_A)), { budget: 2000 }));
    await assertFails(updateDoc(budget(asUser(MGR_A)), { budget: 9999 }));
    await assertFails(updateDoc(budget(asUser(ADMIN_B)), { budget: 9999 }));
  });
});

describe('seat limits are enforced by the rules', () => {
  const seats = (db) => doc(db, 'organizations', ORG_A, 'meta', 'seats');
  const newStaff = (id) => ({ role: 'staff', orgId: ORG_A, departmentIds: [], projectIds: [], email: `${id}@x.com`, status: 'active' });

  const setSeats = async (data) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'meta', 'seats'), { lastSeatUid: null, ...data });
    });
  };

  // What the app does: add the user and bump the counter together.
  const addUser = async (who, id, bumpTo) => {
    const db = asUser(who);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', id), newStaff(id));
    batch.update(seats(db), { seatsUsed: bumpTo, lastSeatUid: id });
    return batch.commit();
  };

  test('adding a user within the limit works, with the counter moved by one', async () => {
    await setSeats({ seatsUsed: 3, seatLimit: 5 });
    await assertSucceeds(addUser(ADMIN_A, 'n1', 4));
  });
  test('a department head can add staff the same way', async () => {
    await setSeats({ seatsUsed: 3, seatLimit: 5 });
    const db = asUser(HEAD_A);
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', 'n2'), { ...newStaff('n2'), departmentIds: [DEPT_A] });
    batch.update(seats(db), { seatsUsed: 4, lastSeatUid: 'n2' });
    await assertSucceeds(batch.commit());
  });
  test('adding a user beyond the limit is refused', async () => {
    await setSeats({ seatsUsed: 5, seatLimit: 5 });
    await assertFails(addUser(ADMIN_A, 'n3', 6));
  });
  test('adding a user without moving the counter is refused', async () => {
    await setSeats({ seatsUsed: 3, seatLimit: 5 });
    await assertFails(setDoc(doc(asUser(ADMIN_A), 'users', 'n4'), newStaff('n4')));
  });
  test('the counter cannot be moved by more than one', async () => {
    await setSeats({ seatsUsed: 3, seatLimit: 5 });
    await assertFails(addUser(ADMIN_A, 'n5', 5));
  });
  test('the counter cannot be lowered or raised on its own', async () => {
    await setSeats({ seatsUsed: 5, seatLimit: 5 });
    await assertFails(updateDoc(seats(asUser(ADMIN_A)), { seatsUsed: 4, lastSeatUid: STAFF_A }));
    await assertFails(updateDoc(seats(asUser(ADMIN_A)), { seatsUsed: 6, lastSeatUid: 'ghost' }));
  });
  test('the limit itself cannot be changed by an org-admin', async () => {
    await setSeats({ seatsUsed: 3, seatLimit: 5 });
    await assertFails(updateDoc(seats(asUser(ADMIN_A)), { seatLimit: 500 }));
    await assertSucceeds(updateDoc(seats(asUser(MASTER)), { seatLimit: 500 }));
  });
  test('removing a user frees a seat, and only together', async () => {
    await setSeats({ seatsUsed: 5, seatLimit: 5 });
    await assertFails(deleteDoc(doc(asUser(ADMIN_A), 'users', STAFF_A)));
    const db = asUser(ADMIN_A);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', STAFF_A));
    batch.update(seats(db), { seatsUsed: 4, lastSeatUid: STAFF_A });
    await assertSucceeds(batch.commit());
  });
  test('a freed seat cannot be claimed without deleting the user', async () => {
    await setSeats({ seatsUsed: 5, seatLimit: 5 });
    await assertFails(updateDoc(seats(asUser(ADMIN_A)), { seatsUsed: 4, lastSeatUid: STAFF_A }));
  });
  test('an organization without a seat counter is not affected', async () => {
    await assertSucceeds(setDoc(doc(asUser(ADMIN_B), 'users', 'nb'), { ...newStaff('nb'), orgId: ORG_B }));
  });
  test('staff and clients cannot touch the counter', async () => {
    await setSeats({ seatsUsed: 3, seatLimit: 5 });
    await assertFails(updateDoc(seats(asUser(STAFF_A)), { seatsUsed: 4, lastSeatUid: 'x' }));
    await assertFails(getDoc(seats(asUser(CLIENT_A))));
    await assertSucceeds(getDoc(seats(asUser(MGR_A))));
  });
});

describe('deleting a task can clear its conversation', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'task_attachments', 'attA'), { taskId: 'taskA', uploadedBy: STAFF_A });
    });
  });
  test('the project manager can delete comments on tasks in their project', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(MGR_A), 'task_comments', 'comA')));
  });
  test('org-admin can', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN_A), 'task_comments', 'comA')));
  });
  test('department head can', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(HEAD_A), 'task_comments', 'comA')));
  });
  test('ordinary staff cannot delete someone elses comment', async () => {
    await assertFails(deleteDoc(doc(asUser(STAFF_SCOPED), 'task_comments', 'comA')));
  });
  test('another organization cannot', async () => {
    await assertFails(deleteDoc(doc(asUser(ADMIN_B), 'task_comments', 'comA')));
  });
  test('the author can still delete their own comment', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(STAFF_A), 'task_comments', 'comA')));
  });
  test('moderators can clear attachments and notifications for the task', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(MGR_A), 'task_attachments', 'attA')));
    await assertSucceeds(getDoc(doc(asUser(MGR_A), 'comment_notifications', 'notifA')));
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN_A), 'comment_notifications', 'notifA')));
  });
  test('but they still cannot read notifications for tasks outside their scope', async () => {
    await assertFails(getDoc(doc(asUser(ADMIN_B), 'comment_notifications', 'notifA')));
    await assertFails(getDoc(doc(asUser(STAFF_SCOPED), 'comment_notifications', 'notifA')));
  });
  test('a recipient can still read their own notifications by query', async () => {
    await assertSucceeds(getDocs(query(collection(asUser(STAFF_A), 'comment_notifications'), where('userId', '==', STAFF_A))));
  });
  test('a moderator can list the notifications of a task by taskId', async () => {
    await assertSucceeds(getDocs(query(collection(asUser(MGR_A), 'comment_notifications'), where('taskId', '==', 'taskA'))));
  });
});

// Membership in a department or project lets someone SEE its tasks. It does not let
// them edit, reassign or delete each other's work - that is what the dept head,
// manager and admin are for. (Regression: the rules used to treat any member, staff
// included, as an owner, so one staff member could delete a task assigned to the
// department head.)
describe('ordinary members cannot touch each others tasks', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tasks', 'personalA'), {
        title: 'My own errand', orgId: ORG_A, createdBy: STAFF_A, assignedTo: STAFF_A, status: 'pending', priority: 'low',
      });
    });
  });
  const t = (db, id = 'taskA') => doc(db, 'tasks', id);

  test('a teammate in the same project can still SEE the task', async () => {
    await assertSucceeds(getDoc(t(asUser(STAFF_SCOPED))));
  });
  test('but cannot edit it (title, priority, status, assignee)', async () => {
    const db = asUser(STAFF_SCOPED);
    await assertFails(updateDoc(t(db), { title: 'EDITED BY A COLLEAGUE' }));
    await assertFails(updateDoc(t(db), { priority: 'low' }));
    await assertFails(updateDoc(t(db), { status: 'completed' }));
    await assertFails(updateDoc(t(db), { assignedTo: STAFF_SCOPED }));
  });
  test('and cannot delete it', async () => {
    await assertFails(deleteDoc(t(asUser(STAFF_SCOPED))));
  });

  test('the assignee can report progress: status and its timestamps', async () => {
    const db = asUser(STAFF_A);
    await assertSucceeds(updateDoc(t(db), { status: 'in-progress', updatedAt: 1 }));
    await assertSucceeds(updateDoc(t(db), { status: 'completed', completedAt: 2, updatedAt: 3 }));
    await assertSucceeds(updateDoc(t(db), { status: 'in-progress', completedAt: null, updatedAt: 4 }));
  });
  test('but not retitle, reprioritize, re-date, re-describe or re-wire work given to them', async () => {
    const db = asUser(STAFF_A);
    await assertFails(updateDoc(t(db), { title: 'renamed' }));
    await assertFails(updateDoc(t(db), { priority: 'low' }));
    await assertFails(updateDoc(t(db), { deadline: 9999999999 }));
    await assertFails(updateDoc(t(db), { description: 'changed' }));
    await assertFails(updateDoc(t(db), { blockedBy: [] }));
    await assertFails(updateDoc(t(db), { status: 'completed', title: 'sneaky' }));
  });
  test('and cannot delete a task someone else created', async () => {
    await assertFails(deleteDoc(t(asUser(STAFF_A))));
  });

  test('the creator of a task (a personal errand) can fully edit and delete it', async () => {
    const db = asUser(STAFF_A);
    await assertSucceeds(updateDoc(t(db, 'personalA'), { title: 'Renamed', priority: 'high', deadline: 5 }));
    await assertSucceeds(deleteDoc(t(db, 'personalA')));
  });
  test('but the creator cannot re-author it or move it into a project they are not in', async () => {
    const db = asUser(STAFF_A);
    await assertFails(updateDoc(t(db, 'personalA'), { createdBy: ADMIN_A }));
    await assertFails(updateDoc(t(db, 'personalA'), { projectId: PROJ_A, departmentId: DEPT_A }));
  });

  test('the manager and department head of the scope can edit and delete', async () => {
    await assertSucceeds(updateDoc(t(asUser(MGR_A)), { title: 'Edited by the manager', priority: 'high' }));
    await assertSucceeds(updateDoc(t(asUser(HEAD_A)), { title: 'Edited by the head' }));
    await assertSucceeds(deleteDoc(t(asUser(MGR_A))));
  });
  test('the department head can delete too', async () => {
    await assertSucceeds(deleteDoc(t(asUser(HEAD_A))));
  });
  test('a manager of a different project cannot touch it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'mgrOther'), { role: 'manager', orgId: ORG_A, departmentIds: [], projectIds: [PROJ_A2], status: 'active', email: 'mo@x.com' });
    });
    await assertFails(updateDoc(t(asUser('mgrOther')), { title: 'nope' }));
    await assertFails(deleteDoc(t(asUser('mgrOther'))));
  });
  test('the org-admin can still do anything within the org', async () => {
    await assertSucceeds(updateDoc(t(asUser(ADMIN_A)), { title: 'Admin edit', assignedTo: STAFF_SCOPED }));
    await assertSucceeds(deleteDoc(t(asUser(ADMIN_A))));
  });
});

describe('task templates', () => {
  const tpl = (createdBy, extra = {}) => ({ name: 'Website launch', description: '', items: [{ key: 't1', title: 'Kick-off' }], createdBy, ...extra });
  const tplRef = (db, id = 'tpl1', org = ORG_A) => doc(db, 'organizations', org, 'templates', id);

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(tplRef(ctx.firestore(), 'byHead'), tpl(HEAD_A));
      await setDoc(tplRef(ctx.firestore(), 'inB', ORG_B), tpl(ADMIN_B));
    });
  });

  test('admins, department heads and managers can save one in their own organisation', async () => {
    await assertSucceeds(setDoc(tplRef(asUser(ADMIN_A), 'n1'), tpl(ADMIN_A)));
    await assertSucceeds(setDoc(tplRef(asUser(HEAD_A), 'n2'), tpl(HEAD_A)));
    await assertSucceeds(setDoc(tplRef(asUser(MGR_A), 'n3'), tpl(MGR_A)));
  });

  test('staff and clients cannot save one; nobody can save into another organisation or as someone else', async () => {
    await assertFails(setDoc(tplRef(asUser(STAFF_A), 'n1'), tpl(STAFF_A)));
    await assertFails(setDoc(tplRef(asUser(CLIENT_A), 'n2'), tpl(CLIENT_A)));
    await assertFails(setDoc(tplRef(asUser(ADMIN_A), 'n3', ORG_B), tpl(ADMIN_A)));
    await assertFails(setDoc(tplRef(asUser(HEAD_A), 'n4'), tpl(MGR_A)));
  });

  test('a template must have a name and a bounded list of tasks', async () => {
    await assertFails(setDoc(tplRef(asUser(ADMIN_A), 'n1'), tpl(ADMIN_A, { name: '' })));
    await assertFails(setDoc(tplRef(asUser(ADMIN_A), 'n2'), tpl(ADMIN_A, { items: 'lots' })));
    const tooMany = Array.from({ length: 301 }, (_, i) => ({ key: `t${i}`, title: 'x' }));
    await assertFails(setDoc(tplRef(asUser(ADMIN_A), 'n3'), tpl(ADMIN_A, { items: tooMany })));
  });

  test('members read their own organisation’s templates; clients and other organisations cannot', async () => {
    await assertSucceeds(getDoc(tplRef(asUser(STAFF_A), 'byHead')));
    await assertSucceeds(getDocs(collection(asUser(MGR_A), 'organizations', ORG_A, 'templates')));
    await assertFails(getDoc(tplRef(asUser(CLIENT_A), 'byHead')));
    await assertFails(getDoc(tplRef(asUser(ADMIN_A), 'inB', ORG_B)));
  });

  test('the author or an org admin may change or delete one; another manager may not', async () => {
    await assertFails(updateDoc(tplRef(asUser(MGR_A), 'byHead'), { name: 'Mine now' }));
    await assertFails(deleteDoc(tplRef(asUser(MGR_A), 'byHead')));
    await assertSucceeds(updateDoc(tplRef(asUser(HEAD_A), 'byHead'), { name: 'Renamed' }));
    await assertFails(updateDoc(tplRef(asUser(HEAD_A), 'byHead'), { createdBy: MGR_A }));
    await assertSucceeds(deleteDoc(tplRef(asUser(ADMIN_A), 'byHead')));
  });
});

describe('activity log (audit_logs)', () => {
  const entry = (actorId, orgId, extra = {}) => ({
    action: 'create_user', actorId, orgId, timestamp: serverTimestamp(), ...extra,
  });

  test('an org admin records and reads their own organization', async () => {
    const db = asUser(ADMIN_A);
    await assertSucceeds(addDoc(collection(db, 'audit_logs'), entry(ADMIN_A, ORG_A)));
    await assertSucceeds(getDocs(query(collection(db, 'audit_logs'), where('orgId', '==', ORG_A))));
  });

  test("an org admin cannot read or write another organization's log", async () => {
    const db = asUser(ADMIN_B);
    await assertFails(getDocs(query(collection(db, 'audit_logs'), where('orgId', '==', ORG_A))));
    await assertFails(addDoc(collection(db, 'audit_logs'), entry(ADMIN_B, ORG_A)));
  });

  test('heads and managers record what they do, but cannot read the log', async () => {
    await assertSucceeds(addDoc(collection(asUser(HEAD_A), 'audit_logs'), entry(HEAD_A, ORG_A)));
    await assertSucceeds(addDoc(collection(asUser(MGR_A), 'audit_logs'), entry(MGR_A, ORG_A)));
    await assertFails(getDocs(query(collection(asUser(HEAD_A), 'audit_logs'), where('orgId', '==', ORG_A))));
  });

  test('nobody signs for someone else, backdates, or writes as staff or client', async () => {
    await assertFails(addDoc(collection(asUser(HEAD_A), 'audit_logs'), entry(ADMIN_A, ORG_A)));
    await assertFails(addDoc(collection(asUser(ADMIN_A), 'audit_logs'),
      { ...entry(ADMIN_A, ORG_A), timestamp: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(addDoc(collection(asUser(HEAD_A), 'audit_logs'), entry(HEAD_A, ORG_B)));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'audit_logs'), entry(STAFF_A, ORG_A)));
    await assertFails(addDoc(collection(asUser(CLIENT_A), 'audit_logs'), entry(CLIENT_A, ORG_A)));
  });

  test('history cannot be edited or deleted, even by its author', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_logs', 'kept'), { orgId: ORG_A, actorId: ADMIN_A, action: 'delete_user' });
    });
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'audit_logs', 'kept'), { action: 'nothing' }));
    await assertFails(deleteDoc(doc(asUser(ADMIN_A), 'audit_logs', 'kept')));
  });
});

describe('email settings (notificationPrefs)', () => {
  test('anyone may change their own email settings', async () => {
    await assertSucceeds(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), {
      notificationPrefs: { assignments: true, mentions: false, critical: true, statusChanges: false, dailyReminder: false },
    }));
    await assertSucceeds(updateDoc(doc(asUser(CLIENT_A), 'users', CLIENT_A), { notificationPrefs: { statusChanges: false } }));
  });

  test("but not someone else's, and not their own status while at it", async () => {
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_SCOPED), { notificationPrefs: { mentions: false } }));
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'users', STAFF_A), { notificationPrefs: {}, status: 'inactive' }));
  });

  test('a profile saved before status existed can still change its settings', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'legacy'), { role: 'staff', orgId: ORG_A, email: 'old@x.com' });
    });
    await assertSucceeds(updateDoc(doc(asUser('legacy'), 'users', 'legacy'), { notificationPrefs: { mentions: false } }));
  });
});

describe('client portal branding', () => {
  const brandDoc = (db, org = ORG_A) => doc(db, 'organizations', org, 'branding', 'portal');
  const good = { accent: '#0f766e', logo: 'data:image/png;base64,iVBORw0KGgo=', welcome: 'Hello', updatedBy: ADMIN_A };

  test('an org admin sets it; every member, clients included, reads it', async () => {
    await assertSucceeds(setDoc(brandDoc(asUser(ADMIN_A)), good));
    await assertSucceeds(getDoc(brandDoc(asUser(CLIENT_A))));
    await assertSucceeds(getDoc(brandDoc(asUser(STAFF_A))));
    await assertFails(getDoc(brandDoc(asUser(STAFF_B))));
  });

  test('nobody else sets it, and not for another organization', async () => {
    await assertFails(setDoc(brandDoc(asUser(MGR_A)), good));
    await assertFails(setDoc(brandDoc(asUser(CLIENT_A)), good));
    await assertFails(setDoc(brandDoc(asUser(ADMIN_B)), good));
  });

  test('only a raster data URL, a hex colour and a short note get in', async () => {
    const db = asUser(ADMIN_A);
    await assertFails(setDoc(brandDoc(db), { ...good, logo: 'https://evil.example/x.png' }));
    await assertFails(setDoc(brandDoc(db), { ...good, logo: 'data:image/svg+xml;base64,PHN2Zz4=' }));
    await assertFails(setDoc(brandDoc(db), { ...good, accent: 'red' }));
    await assertFails(setDoc(brandDoc(db), { ...good, welcome: 'x'.repeat(501) }));
    await assertFails(setDoc(brandDoc(db), { ...good, script: '<b>' }));
    await assertFails(setDoc(doc(db, 'organizations', ORG_A, 'branding', 'other'), good));
    await assertSucceeds(setDoc(brandDoc(db), { accent: null, logo: null, welcome: '' }));
  });
});

describe('client conversation and milestone sign-off', () => {
  const msg = (taskId, projectId, extra = {}) => ({
    orgId: ORG_A, projectId, taskId, authorId: CLIENT_A, authorName: 'Acme', fromClient: true,
    kind: 'message', text: 'Hello', notified: false, createdAt: serverTimestamp(), ...extra,
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'tasks', 'mileA'), {
        title: 'Design sign-off', orgId: ORG_A, departmentId: DEPT_A, projectId: PROJ_A, milestone: true,
        assignedTo: STAFF_SCOPED, createdBy: MGR_A, status: 'review',
      });
      await setDoc(doc(db, 'tasks', 'mileA2'), {
        title: 'Other project', orgId: ORG_A, departmentId: 'deptOther', projectId: PROJ_A2, milestone: true,
        assignedTo: STAFF_A, createdBy: ADMIN_A, status: 'review',
      });
      await setDoc(doc(db, 'client_messages', 'm1'), { ...msg('mileA', PROJ_A), createdAt: new Date() });
      await setDoc(doc(db, 'client_messages', 'm2'), { ...msg('mileA2', PROJ_A2), createdAt: new Date() });
    });
  });

  test("a client reads their project's conversation, not another project's", async () => {
    const db = asUser(CLIENT_A);
    await assertSucceeds(getDocs(query(collection(db, 'client_messages'), where('orgId', '==', ORG_A), where('projectId', '==', PROJ_A))));
    await assertFails(getDocs(query(collection(db, 'client_messages'), where('orgId', '==', ORG_A), where('projectId', '==', PROJ_A2))));
    await assertFails(getDoc(doc(db, 'client_messages', 'm2')));
  });

  test('the team reads it through the task; outsiders do not', async () => {
    await assertSucceeds(getDocs(query(collection(asUser(MGR_A), 'client_messages'), where('taskId', '==', 'mileA'))));
    await assertSucceeds(getDocs(query(collection(asUser(STAFF_SCOPED), 'client_messages'), where('taskId', '==', 'mileA'))));
    await assertFails(getDocs(query(collection(asUser(STAFF_B), 'client_messages'), where('taskId', '==', 'mileA'))));
  });

  test('a client writes on their own project, as themselves', async () => {
    const db = asUser(CLIENT_A);
    await assertSucceeds(addDoc(collection(db, 'client_messages'), msg('mileA', PROJ_A)));
    await assertFails(addDoc(collection(db, 'client_messages'), msg('mileA2', PROJ_A2)));
    await assertFails(addDoc(collection(db, 'client_messages'), msg('mileA', PROJ_A, { authorId: MGR_A })));
    await assertFails(addDoc(collection(db, 'client_messages'), msg('mileA', PROJ_A, { fromClient: false })));
    await assertFails(addDoc(collection(db, 'client_messages'), msg('mileA', PROJ_A, { text: '' })));
    await assertFails(addDoc(collection(db, 'client_messages'), msg('mileA', PROJ_A, { notified: true })));
    // claiming a sign-off without making it on the task
    await assertFails(addDoc(collection(db, 'client_messages'), msg('mileA', PROJ_A, { kind: 'approved' })));
  });

  test('the team replies on tasks they can see, never posing as the client', async () => {
    const team = (uid, extra = {}) => msg('mileA', PROJ_A, { authorId: uid, fromClient: false, ...extra });
    await assertSucceeds(addDoc(collection(asUser(MGR_A), 'client_messages'), team(MGR_A)));
    await assertSucceeds(addDoc(collection(asUser(STAFF_SCOPED), 'client_messages'), team(STAFF_SCOPED)));
    await assertFails(addDoc(collection(asUser(MGR_A), 'client_messages'), team(MGR_A, { fromClient: true })));
    await assertFails(addDoc(collection(asUser(STAFF_B), 'client_messages'), team(STAFF_B)));
    await assertFails(addDoc(collection(asUser(MGR_A), 'client_messages'), team(MGR_A, { projectId: PROJ_A2 })));
  });

  test('messages are a record: nobody edits them; only an org admin removes one', async () => {
    await assertFails(updateDoc(doc(asUser(CLIENT_A), 'client_messages', 'm1'), { text: 'changed' }));
    await assertFails(updateDoc(doc(asUser(MGR_A), 'client_messages', 'm1'), { notified: true }));
    await assertFails(deleteDoc(doc(asUser(CLIENT_A), 'client_messages', 'm1')));
    await assertFails(deleteDoc(doc(asUser(MGR_A), 'client_messages', 'm1')));
    await assertSucceeds(deleteDoc(doc(asUser(ADMIN_A), 'client_messages', 'm1')));
  });

  const decide = (db, taskId, projectId, decision, approvalExtra = {}) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tasks', taskId), {
      clientApproval: { decision, by: CLIENT_A, byName: 'Acme', at: serverTimestamp(), note: 'ok', ...approvalExtra },
    });
    batch.set(doc(collection(db, 'client_messages')), msg(taskId, projectId, { kind: decision, text: 'ok' }));
    return batch.commit();
  };

  test('a client approves a milestone in review, or asks for changes, recorded in one write', async () => {
    const db = asUser(CLIENT_A);
    await assertSucceeds(decide(db, 'mileA', PROJ_A, 'approved'));
    await assertSucceeds(decide(db, 'mileA', PROJ_A, 'changes_requested'));
  });

  test('but not on another project, not before review, not for someone else, and nothing else on the task', async () => {
    const db = asUser(CLIENT_A);
    await assertFails(decide(db, 'mileA2', PROJ_A2, 'approved'));
    await assertFails(decide(db, 'mileA', PROJ_A, 'approved', { by: MGR_A }));
    await assertFails(decide(db, 'mileA', PROJ_A, 'approved', { at: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(decide(db, 'mileA', PROJ_A, 'shipped'));
    await assertFails(updateDoc(doc(db, 'tasks', 'mileA'), { status: 'completed' }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'tasks', 'mileA'), { status: 'in-progress' });
    });
    await assertFails(decide(db, 'mileA', PROJ_A, 'approved'));
    await assertFails(decide(db, 'taskA', PROJ_A, 'approved'));
  });

  test("a client's bell notification reaches only the task's author and assignee", async () => {
    const db = asUser(CLIENT_A);
    const note = (userId, extra = {}) => ({
      userId, taskId: 'mileA', mentionedBy: CLIENT_A, mentionedByName: 'Acme', type: 'client_message',
      taskTitle: 'Design sign-off', excerpt: 'Hello', read: false, createdAt: serverTimestamp(), ...extra,
    });
    await assertSucceeds(addDoc(collection(db, 'comment_notifications'), note(MGR_A)));
    await assertSucceeds(addDoc(collection(db, 'comment_notifications'), note(STAFF_SCOPED, { type: 'client_approved' })));
    await assertFails(addDoc(collection(db, 'comment_notifications'), note(ADMIN_A)));
    await assertFails(addDoc(collection(db, 'comment_notifications'), note(MGR_A, { type: 'mention' })));
    await assertFails(addDoc(collection(db, 'comment_notifications'), note(MGR_A, { taskId: 'mileA2' })));
    await assertFails(addDoc(collection(db, 'comment_notifications'), note(MGR_A, { mentionedBy: MGR_A })));
  });
});

describe('client requests', () => {
  const req = (extra = {}) => ({
    orgId: ORG_A, projectId: PROJ_A, title: 'Add a dark mode', details: 'For the dashboard', urgency: 'normal',
    neededBy: '2026-11-01', requestedBy: CLIENT_A, requestedByName: 'Acme', status: 'new', notified: false,
    createdAt: serverTimestamp(), ...extra,
  });
  const answer = (uid, extra = {}) => ({
    status: 'declined', decidedBy: uid, decidedByName: 'Someone', decidedAt: serverTimestamp(),
    response: 'Not in scope', notified: false, ...extra,
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'client_requests', 'r1'), { ...req(), createdAt: new Date() });
      await setDoc(doc(db, 'client_requests', 'r2'), { ...req({ projectId: PROJ_A2 }), createdAt: new Date() });
      await setDoc(doc(db, 'tasks', 'fromRequest'), {
        title: 'Add a dark mode', orgId: ORG_A, departmentId: DEPT_A, projectId: PROJ_A, createdBy: MGR_A, status: 'pending',
      });
    });
  });

  test('a client sends one about their own project, as themselves', async () => {
    const db = asUser(CLIENT_A);
    await assertSucceeds(addDoc(collection(db, 'client_requests'), req()));
    await assertSucceeds(addDoc(collection(db, 'client_requests'), req({ neededBy: null, details: '' })));
    await assertFails(addDoc(collection(db, 'client_requests'), req({ projectId: PROJ_A2 })));
    await assertFails(addDoc(collection(db, 'client_requests'), req({ requestedBy: MGR_A })));
    await assertFails(addDoc(collection(db, 'client_requests'), req({ status: 'accepted' })));
    await assertFails(addDoc(collection(db, 'client_requests'), req({ title: '' })));
    await assertFails(addDoc(collection(db, 'client_requests'), req({ neededBy: 'soon' })));
    await assertFails(addDoc(collection(db, 'client_requests'), req({ taskId: 'fromRequest' })));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'client_requests'), req({ requestedBy: STAFF_A })));
  });

  test('who reads them: the client of the project, and the people who run it', async () => {
    const q = (uid, projectId) => getDocs(query(collection(asUser(uid), 'client_requests'),
      where('orgId', '==', ORG_A), where('projectId', '==', projectId)));
    await assertSucceeds(q(CLIENT_A, PROJ_A));
    await assertFails(q(CLIENT_A, PROJ_A2));
    await assertSucceeds(q(MGR_A, PROJ_A));
    await assertSucceeds(q(HEAD_A, PROJ_A));
    await assertFails(q(HEAD_A, PROJ_A2));
    await assertFails(q(STAFF_SCOPED, PROJ_A));
    await assertSucceeds(getDocs(query(collection(asUser(ADMIN_A), 'client_requests'), where('orgId', '==', ORG_A))));
    await assertFails(getDocs(query(collection(asUser(ADMIN_B), 'client_requests'), where('orgId', '==', ORG_A))));
  });

  test('the project manager declines with a reason, or accepts with a task in the same project', async () => {
    await assertSucceeds(updateDoc(doc(asUser(MGR_A), 'client_requests', 'r1'), answer(MGR_A)));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'client_requests', 'r1'), { status: 'new' });
    });
    await assertSucceeds(updateDoc(doc(asUser(HEAD_A), 'client_requests', 'r1'),
      answer(HEAD_A, { status: 'accepted', taskId: 'fromRequest', response: '' })));
  });

  test('answers are checked: once, as yourself, in scope, with a real task', async () => {
    await assertFails(updateDoc(doc(asUser(MGR_A), 'client_requests', 'r1'), answer(ADMIN_A)));
    await assertFails(updateDoc(doc(asUser(MGR_A), 'client_requests', 'r1'), answer(MGR_A, { status: 'accepted' })));
    await assertFails(updateDoc(doc(asUser(MGR_A), 'client_requests', 'r1'), answer(MGR_A, { status: 'accepted', taskId: 'taskB' })));
    await assertFails(updateDoc(doc(asUser(MGR_A), 'client_requests', 'r1'), answer(MGR_A, { title: 'Rewritten' })));
    await assertFails(updateDoc(doc(asUser(MGR_A), 'client_requests', 'r2'), answer(MGR_A)));
    await assertFails(updateDoc(doc(asUser(STAFF_SCOPED), 'client_requests', 'r1'), answer(STAFF_SCOPED)));
    await assertFails(updateDoc(doc(asUser(CLIENT_A), 'client_requests', 'r1'), answer(CLIENT_A)));
    await assertSucceeds(updateDoc(doc(asUser(ADMIN_A), 'client_requests', 'r1'), answer(ADMIN_A)));
    await assertFails(updateDoc(doc(asUser(ADMIN_A), 'client_requests', 'r1'), answer(ADMIN_A, { response: 'again' })));
  });

  test('a client withdraws their own request only while it is new', async () => {
    await assertFails(deleteDoc(doc(asUser(MGR_A), 'client_requests', 'r1')));
    await assertSucceeds(deleteDoc(doc(asUser(CLIENT_A), 'client_requests', 'r1')));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'client_requests', 'r2'), { status: 'declined', projectId: PROJ_A });
    });
    await assertFails(deleteDoc(doc(asUser(CLIENT_A), 'client_requests', 'r2')));
  });
});

describe('project baselines', () => {
  const col = (db, proj = PROJ_A) => collection(db, 'organizations', ORG_A, 'projects', proj, 'baselines');
  const plan = (uid, extra = {}) => ({
    name: 'Plan as of 5 Oct', tasks: { taskA: { s: '2026-10-01', e: '2026-10-05' } },
    createdBy: uid, createdByName: 'Someone', createdAt: serverTimestamp(), ...extra,
  });

  test('whoever runs the project saves one; the team reads them; clients do not', async () => {
    await assertSucceeds(addDoc(col(asUser(MGR_A)), plan(MGR_A)));
    await assertSucceeds(addDoc(col(asUser(HEAD_A)), plan(HEAD_A)));
    await assertSucceeds(addDoc(col(asUser(ADMIN_A)), plan(ADMIN_A)));
    await assertSucceeds(getDocs(col(asUser(STAFF_A))));
    await assertFails(getDocs(col(asUser(CLIENT_A))));
    await assertFails(getDocs(col(asUser(STAFF_B))));
  });

  test('nobody else saves one, nor as someone else, nor edits one', async () => {
    await assertFails(addDoc(col(asUser(STAFF_SCOPED)), plan(STAFF_SCOPED)));
    await assertFails(addDoc(col(asUser(MGR_A), PROJ_A2), plan(MGR_A)));
    await assertFails(addDoc(col(asUser(MGR_A)), plan(ADMIN_A)));
    await assertFails(addDoc(col(asUser(MGR_A)), plan(MGR_A, { name: '' })));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'projects', PROJ_A, 'baselines', 'b1'), { ...plan(MGR_A), createdAt: new Date() });
    });
    await assertFails(updateDoc(doc(col(asUser(MGR_A)), 'b1'), { name: 'Changed' }));
    await assertFails(deleteDoc(doc(col(asUser(STAFF_SCOPED)), 'b1')));
    await assertSucceeds(deleteDoc(doc(col(asUser(MGR_A)), 'b1')));
  });
});

describe('project status updates', () => {
  const col = (db, proj = PROJ_A) => collection(db, 'organizations', ORG_A, 'projects', proj, 'updates');
  const update = (uid, extra = {}) => ({
    health: 'at_risk', summary: 'Vendor is late', createdBy: uid, createdByName: 'Someone', createdAt: serverTimestamp(), ...extra,
  });

  test('whoever runs the project posts one; the team reads them; clients do not', async () => {
    await assertSucceeds(addDoc(col(asUser(MGR_A)), update(MGR_A)));
    await assertSucceeds(addDoc(col(asUser(HEAD_A)), update(HEAD_A, { health: 'on_track' })));
    await assertSucceeds(getDocs(col(asUser(STAFF_A))));
    await assertFails(getDocs(col(asUser(CLIENT_A))));
    await assertFails(getDocs(col(asUser(STAFF_B))));
  });

  test('checked: who, as whom, which health, how long; never edited', async () => {
    await assertFails(addDoc(col(asUser(STAFF_SCOPED)), update(STAFF_SCOPED)));
    await assertFails(addDoc(col(asUser(MGR_A), PROJ_A2), update(MGR_A)));
    await assertFails(addDoc(col(asUser(MGR_A)), update(ADMIN_A)));
    await assertFails(addDoc(col(asUser(MGR_A)), update(MGR_A, { health: 'great' })));
    await assertFails(addDoc(col(asUser(MGR_A)), update(MGR_A, { summary: 'x'.repeat(2001) })));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'projects', PROJ_A, 'updates', 'u1'), { ...update(MGR_A), createdAt: new Date() });
    });
    await assertFails(updateDoc(doc(col(asUser(MGR_A)), 'u1'), { health: 'on_track' }));
    await assertFails(deleteDoc(doc(col(asUser(HEAD_A)), 'u1')));
    await assertSucceeds(deleteDoc(doc(col(asUser(MGR_A)), 'u1')));
  });
});

describe('time tracking and cost rates', () => {
  const entry = (uid, extra = {}) => ({
    orgId: ORG_A, projectId: PROJ_A, taskId: 'taskA', userId: uid, userName: 'Someone',
    minutes: 90, date: '2026-10-05', note: '', createdAt: serverTimestamp(), ...extra,
  });

  test('anyone who can see the task logs their own time on it', async () => {
    await assertSucceeds(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(STAFF_A)));
    await assertSucceeds(addDoc(collection(asUser(MGR_A), 'time_entries'), entry(MGR_A)));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(MGR_A)));
    await assertFails(addDoc(collection(asUser(STAFF_B), 'time_entries'), entry(STAFF_B)));
    await assertFails(addDoc(collection(asUser(CLIENT_A), 'time_entries'), entry(CLIENT_A)));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(STAFF_A, { minutes: 0 })));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(STAFF_A, { minutes: 1.5 })));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(STAFF_A, { minutes: 1441 })));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(STAFF_A, { projectId: PROJ_A2 })));
    await assertFails(addDoc(collection(asUser(STAFF_A), 'time_entries'), entry(STAFF_A, { date: 'today' })));
  });

  test("reading: the task's viewers by task, whoever runs the project by project, nobody else", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'time_entries', 'e1'), { ...entry(STAFF_A), createdAt: new Date() });
    });
    await assertSucceeds(getDocs(query(collection(asUser(STAFF_SCOPED), 'time_entries'), where('taskId', '==', 'taskA'))));
    await assertSucceeds(getDocs(query(collection(asUser(MGR_A), 'time_entries'), where('orgId', '==', ORG_A), where('projectId', '==', PROJ_A))));
    await assertSucceeds(getDocs(query(collection(asUser(STAFF_A), 'time_entries'), where('userId', '==', STAFF_A))));
    await assertFails(getDocs(query(collection(asUser(STAFF_SCOPED), 'time_entries'), where('orgId', '==', ORG_A), where('projectId', '==', PROJ_A))));
    await assertFails(getDocs(query(collection(asUser(STAFF_B), 'time_entries'), where('taskId', '==', 'taskA'))));
    await assertFails(getDocs(query(collection(asUser(CLIENT_A), 'time_entries'), where('taskId', '==', 'taskA'))));
  });

  test('only the author (or an org admin) removes an entry; nobody edits one', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'time_entries', 'e2'), { ...entry(STAFF_A), createdAt: new Date() });
    });
    await assertFails(updateDoc(doc(asUser(STAFF_A), 'time_entries', 'e2'), { minutes: 600 }));
    await assertFails(deleteDoc(doc(asUser(MGR_A), 'time_entries', 'e2')));
    await assertSucceeds(deleteDoc(doc(asUser(STAFF_A), 'time_entries', 'e2')));
  });

  test('cost rates: org admins set them; money roles read them; staff and clients do not', async () => {
    const rates = (db) => doc(db, 'organizations', ORG_A, 'finance', 'rates');
    await assertSucceeds(setDoc(rates(asUser(ADMIN_A)), { defaultRate: 500, people: { [STAFF_A]: 800 } }));
    await assertFails(setDoc(rates(asUser(MGR_A)), { defaultRate: 1, people: {} }));
    await assertFails(setDoc(rates(asUser(ADMIN_A)), { defaultRate: -1, people: {} }));
    await assertSucceeds(getDoc(rates(asUser(MGR_A))));
    await assertSucceeds(getDoc(rates(asUser(HEAD_A))));
    await assertFails(getDoc(rates(asUser(STAFF_A))));
    await assertFails(getDoc(rates(asUser(CLIENT_A))));
    await assertFails(getDoc(rates(asUser(ADMIN_B))));
  });
});
