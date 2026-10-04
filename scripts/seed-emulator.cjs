/**
 * Seed the local Firebase emulators with a full, realistic organisation.
 *
 * Why this exists: production only holds accounts for the roles that happen to
 * be staffed, so four of the five dashboards could not be opened for testing
 * without creating real users in the live project. This builds the same shape
 * of data locally — one org, two departments, two projects, one account per
 * role, and a spread of tasks across every status — so every screen can be
 * driven with something on it rather than an empty state.
 *
 * Emulators only. It refuses to run against a real project.
 *
 *   npm run seed
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'demo-magnaflow';

// Hardcoded to localhost on purpose: the script then has no way to reach a real
// project, even if someone runs it with production credentials in scope.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

const ORG_ID = 'org-magnetar';
const DEPT_ENG = 'dept-engineering';
const DEPT_ACCOUNTS = 'dept-accounts';
const PROJ_APOLLO = 'proj-apollo';
const PROJ_ATLAS = 'proj-atlas';

const PASSWORD = 'Passw0rd!23';

// One account per role. Every dashboard has a way in.
const PEOPLE = [
  {
    uid: 'u-master', email: 'master@demo.test', name: 'Priya Master',
    role: 'master-admin', designation: 'Platform Owner',
    // master-admin deliberately carries no orgId — it sits above every org.
  },
  {
    uid: 'u-orgadmin', email: 'admin@demo.test', name: 'Arjun Admin',
    role: 'org-admin', designation: 'Operations Director', orgId: ORG_ID,
  },
  {
    uid: 'u-head', email: 'head@demo.test', name: 'Neha Head',
    role: 'department-head', designation: 'Engineering Head',
    orgId: ORG_ID, departmentIds: [DEPT_ENG], projectIds: [],
  },
  {
    uid: 'u-manager', email: 'manager@demo.test', name: 'Rohit Manager',
    role: 'manager', designation: 'Project Manager',
    orgId: ORG_ID, departmentIds: [], projectIds: [PROJ_APOLLO],
  },
  {
    uid: 'u-staff1', email: 'staff@demo.test', name: 'Sana Staff',
    role: 'staff', designation: 'Senior Developer',
    orgId: ORG_ID, departmentIds: [DEPT_ENG], projectIds: [PROJ_APOLLO],
  },
  {
    uid: 'u-staff2', email: 'staff2@demo.test', name: 'Vikram Iyer',
    role: 'staff', designation: 'QA Engineer',
    orgId: ORG_ID, departmentIds: [DEPT_ENG], projectIds: [PROJ_APOLLO],
  },
  {
    uid: 'u-client', email: 'client@demo.test', name: 'Acme Corp Client',
    role: 'client', designation: 'External Stakeholder',
    orgId: ORG_ID, departmentIds: [], projectIds: [PROJ_APOLLO],
  },
  {
    uid: 'u-staff3', email: 'staff3@demo.test', name: 'Aisha Khan',
    role: 'staff', designation: 'Accounts Executive',
    orgId: ORG_ID, departmentIds: [DEPT_ACCOUNTS], projectIds: [PROJ_ATLAS],
  },
];

const day = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return admin.firestore.Timestamp.fromDate(d);
};

// Deliberately spread across every status and priority, with some already
// overdue, so status pills, the Gantt bars and the "overdue" counters all have
// something real to render.
const TASKS = [
  ['Ship the billing reconciliation job', 'completed',  'critical', 'u-staff1', DEPT_ENG,      PROJ_APOLLO, -18, -12],
  ['Migrate the reporting warehouse',     'completed',  'high',     'u-staff2', DEPT_ENG,      PROJ_APOLLO, -11, -5],
  ['Rewrite the onboarding emails',       'in-progress','medium',   'u-staff1', DEPT_ENG,      PROJ_APOLLO,  -3,  4],
  ['Instrument the checkout funnel',      'in-progress','high',     'u-staff2', DEPT_ENG,      PROJ_APOLLO,  -3,  7],
  ['Quarterly vendor audit',              'in-progress','critical', 'u-staff3', DEPT_ACCOUNTS, PROJ_ATLAS,   -9,  -1],
  ['Close the Q2 ledger',                 'pending',    'critical', 'u-staff3', DEPT_ACCOUNTS, PROJ_ATLAS,   -2,  -1],
  ['Draft the accessibility statement',   'pending',    'low',      'u-staff1', DEPT_ENG,      PROJ_APOLLO,   5, 12],
  ['Refresh the design tokens',           'pending',    'medium',   'u-staff2', DEPT_ENG,      PROJ_APOLLO,  10, 18],
  ['Renew the payment gateway contract',  'pending',    'high',     'u-staff3', DEPT_ACCOUNTS, PROJ_ATLAS,    3, 20],
  ['Decommission the legacy exporter',    'cancelled',  'low',      'u-staff2', DEPT_ENG,      PROJ_APOLLO, -20, -8],
  // Heads, managers and admins are assigned work too — without these the
  // "Assigned to me" panel on their dashboards has nothing to render.
  ['Approve the Q3 hiring plan',          'pending',    'high',     'u-head',     DEPT_ENG,      PROJ_APOLLO,  -1,  5],
  ['Sign off the platform roadmap',       'in-progress','critical', 'u-head',     DEPT_ENG,      PROJ_APOLLO,  -4,  -2],
  ['Review the Apollo release checklist', 'pending',    'medium',   'u-manager',  DEPT_ENG,      PROJ_APOLLO,   0,  6],
  ['Renew the org-wide software licences','pending',    'high',     'u-orgadmin', DEPT_ACCOUNTS, PROJ_ATLAS,   -1,  9],
];

async function reset() {
  const collections = [
    'users', 'tasks', 'organizations', 'designations',
    'audit_logs', 'error_logs', 'subtasks', 'task_comments',
  ];
  for (const name of collections) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const users = await auth.listUsers(1000);
  await Promise.all(users.users.map((u) => auth.deleteUser(u.uid)));
}

async function seed() {
  console.log('Clearing emulator data…');
  await reset();

  console.log('Creating org, departments and projects…');
  await db.collection('organizations').doc(ORG_ID).set({
    name: 'Magnetar Global Pvt. Ltd.',
    status: 'active',
    plan: 'active',
    createdAt: day(-120),
  });

  const orgRef = db.collection('organizations').doc(ORG_ID);
  await orgRef.collection('departments').doc(DEPT_ENG).set({ name: 'Engineering', orgId: ORG_ID });
  await orgRef.collection('departments').doc(DEPT_ACCOUNTS).set({ name: 'Accounts', orgId: ORG_ID });
  await orgRef.collection('projects').doc(PROJ_APOLLO).set({ name: 'Apollo Platform', orgId: ORG_ID, departmentId: DEPT_ENG });
  await orgRef.collection('projects').doc(PROJ_ATLAS).set({ name: 'Atlas Finance', orgId: ORG_ID, departmentId: DEPT_ACCOUNTS });

  console.log('Creating accounts…');
  for (const p of PEOPLE) {
    await auth.createUser({ uid: p.uid, email: p.email, password: PASSWORD, displayName: p.name });
    await db.collection('users').doc(p.uid).set({
      id: p.uid,
      name: p.name,
      email: p.email,
      role: p.role,
      designation: p.designation,
      status: 'active',
      ...(p.orgId ? { orgId: p.orgId } : {}),
      ...(p.departmentIds ? { departmentIds: p.departmentIds } : {}),
      ...(p.projectIds ? { projectIds: p.projectIds } : {}),
      createdAt: day(-90),
    });
  }

  // Billing details and the seat counter live in subdocuments (see organizationService).
  const seated = (await db.collection('users').where('orgId', '==', ORG_ID).get()).size;
  await orgRef.collection('private').doc('settings').set({
    seatLimit: 25,
    storageQuotaMB: 5000,
    billingEmail: 'billing@demo.test',
    ccEmails: ['boss@demo.test'],
  });
  await orgRef.collection('meta').doc('seats').set({ seatsUsed: seated, seatLimit: 25, lastSeatUid: null });
  await orgRef.collection('projects').doc(PROJ_APOLLO).collection('finance').doc('budget').set({ budget: 50000, currency: 'USD', budgetNotes: '' });

  console.log('Creating designations…');
  for (const name of ['Senior Developer', 'QA Engineer', 'Accounts Executive', 'Project Manager', 'Engineering Head']) {
    await db.collection('designations').add({ name, description: `${name} role`, orgId: ORG_ID, createdAt: day(-80) });
  }

  console.log('Creating tasks…');
  const taskRefs = {};
  for (const [title, status, priority, assignedTo, departmentId, projectId, start, due] of TASKS) {
    const ref = await db.collection('tasks').add({
      title,
      description: `${title} — seeded sample task for local testing.`,
      status,
      priority,
      assignedTo,
      createdBy: 'u-orgadmin',
      orgId: ORG_ID,
      departmentId,
      projectId,
      startDate: day(start),
      deadline: day(due),
      createdAt: day(start),
      ...(status === 'completed' ? { completedAt: day(due) } : {}),
    });
    taskRefs[title] = ref.id;
  }

  // Fix #17: Wire up representative dependencies between Apollo tasks
  // Billing reconciliation -> Migrate warehouse -> (Instrument funnel | Rewrite onboarding emails)
  //   -> Draft accessibility statement -> Refresh design tokens. The schedule follows the chain,
  // except that Refresh starts before Draft ends, so the Gantt chart has one clash to show.
  const depChain = [
    ['Rewrite the onboarding emails', 'Migrate the reporting warehouse'],
    ['Migrate the reporting warehouse', 'Ship the billing reconciliation job'],
    ['Instrument the checkout funnel', 'Migrate the reporting warehouse'],
    ['Draft the accessibility statement', 'Rewrite the onboarding emails'],
    ['Refresh the design tokens', 'Draft the accessibility statement'],
  ];
  for (const [blocked, blocker] of depChain) {
    if (taskRefs[blocked] && taskRefs[blocker]) {
      await db.collection('tasks').doc(taskRefs[blocked]).update({
        blockedBy: [taskRefs[blocker]]
      });
    }
  }

  console.log('Creating audit and error log entries…');
  // The shape the services write (see src/services/auditService.js), so the org admin's
  // Activity log and the master dashboard both have something to show.
  const auditEntries = [
    { action: 'provision_org', actorId: 'u-master', targetOrgId: ORG_ID },
    { action: 'create_department', actorId: 'u-orgadmin', targetName: 'Engineering' },
    { action: 'create_project', actorId: 'u-orgadmin', targetName: 'Apollo Platform' },
    { action: 'create_user', actorId: 'u-orgadmin', targetUserId: 'u-head', targetName: 'Neha Head', targetRole: 'department-head' },
    { action: 'create_user', actorId: 'u-head', targetUserId: 'u-staff3', targetName: 'Aisha Khan', targetRole: 'staff' },
    { action: 'update_user', actorId: 'u-orgadmin', targetUserId: 'u-staff2', targetName: 'Vikram Iyer', changes: { projectIds: [PROJ_ATLAS] } },
    { action: 'update_budget', actorId: 'u-orgadmin', targetName: 'Apollo Platform', changes: { budget: 500000, currency: 'INR' } },
    { action: 'reset_password', actorId: 'u-orgadmin', targetEmail: 'staff@demo.test' },
  ];
  for (const [i, entry] of auditEntries.entries()) {
    await db.collection('audit_logs').add({
      ...entry,
      orgId: ORG_ID,
      timestamp: day(i - auditEntries.length),
    });
  }
  await db.collection('error_logs').add({
    message: 'Cannot read properties of undefined (reading "map")',
    stack: 'TypeError: Cannot read properties of undefined\n    at TaskList (TaskList.jsx:42:19)',
    componentStack: '\n    at TaskList\n    at StaffDashboard',
    url: 'http://localhost:5173/staff',
    userId: 'u-staff1',
    userEmail: 'staff@demo.test',
    createdAt: day(-1),
  });

  console.log('\nSeeded. Every account uses the password: ' + PASSWORD);
  for (const p of PEOPLE) console.log(`  ${p.role.padEnd(16)} ${p.email}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
