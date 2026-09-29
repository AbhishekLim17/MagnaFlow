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
      requestedBy: CLIENT_A, status: 'pending', attempts: 0,
      to_email: 'target@evil.com', title: 'Hi', notification_type: 'test',
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
