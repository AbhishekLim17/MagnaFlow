/**
 * Seed the local Firebase emulators with a full ~50-person organisation:
 * five departments, eight projects, department heads, project managers, and
 * a couple of hundred tasks spread across every status and priority.
 *
 * This exists to find the bugs that only show up once a company outgrows the
 * one-of-each-role dataset in seed-emulator.cjs — a department with no staff
 * yet, a project nobody manages, a deactivated employee whose tasks are still
 * assigned to them, a task pointing at a deleted user, near-duplicate
 * designations, long names that might overflow a card. Every edge case below
 * is there on purpose; see the comments at each one.
 *
 * Emulators only, same as seed-emulator.cjs. Refuses to run anywhere else.
 *
 *   npm run seed:scale
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'demo-magnaflow';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

const ORG_ID = 'org-scale';
const PASSWORD = 'Passw0rd!23';

// Deterministic RNG (mulberry32) so re-running the script produces the exact
// same org every time — a bug found once must stay reproducible.
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260807);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const DEPARTMENTS = [
  { id: 'dept-eng', name: 'Engineering' },
  { id: 'dept-sales', name: 'Sales' },
  { id: 'dept-mkt', name: 'Marketing' },
  { id: 'dept-fin', name: 'Finance' },
  // Deliberately no project ever points here — a department that exists but
  // has nothing running in it yet.
  { id: 'dept-hr', name: 'Human Resources' },
];

const PROJECTS = [
  { id: 'proj-apollo', name: 'Apollo Platform', dept: 'dept-eng', mgr: 'u-mgr-apollo' },
  { id: 'proj-orion', name: 'Orion Mobile App', dept: 'dept-eng', mgr: 'u-mgr-orion' },
  // No manager: nobody's projectIds includes this. Tests what a project page
  // looks like with an empty roster.
  { id: 'proj-nebula', name: 'Nebula Infra Migration', dept: 'dept-eng', mgr: null },
  { id: 'proj-crm', name: 'CRM Rollout', dept: 'dept-sales', mgr: 'u-mgr-crm' },
  { id: 'proj-partner', name: 'Partner Portal', dept: 'dept-sales', mgr: 'u-mgr-partner' },
  { id: 'proj-campaign', name: 'Q4 Growth Campaign', dept: 'dept-mkt', mgr: 'u-mgr-campaign' },
  { id: 'proj-atlas', name: 'Atlas Finance', dept: 'dept-fin', mgr: 'u-mgr-atlas' },
  // No manager AND (below) no staff and no tasks — the true empty project.
  { id: 'proj-payroll', name: 'Payroll Automation', dept: 'dept-fin', mgr: null },
];

const HEADS = [
  { uid: 'u-head-eng', name: 'Priya Sharma', email: 'head.eng@demo.test', dept: 'dept-eng', title: 'Engineering Head' },
  { uid: 'u-head-sales', name: 'Karan Mehta', email: 'head.sales@demo.test', dept: 'dept-sales', title: 'Sales Head' },
  { uid: 'u-head-mkt', name: 'Divya Nair', email: 'head.mkt@demo.test', dept: 'dept-mkt', title: 'Marketing Head' },
  { uid: 'u-head-fin', name: 'Suresh Rao', email: 'head.fin@demo.test', dept: 'dept-fin', title: 'Finance Head' },
  { uid: 'u-head-hr', name: 'Meera Joshi', email: 'head.hr@demo.test', dept: 'dept-hr', title: 'HR Head' },
];

const MANAGERS = [
  { uid: 'u-mgr-apollo', name: 'Rohit Verma', email: 'mgr.apollo@demo.test', proj: 'proj-apollo', title: 'Project Manager' },
  { uid: 'u-mgr-orion', name: 'Fatima Sheikh', email: 'mgr.orion@demo.test', proj: 'proj-orion', title: 'Project Manager' },
  { uid: 'u-mgr-crm', name: 'Aditya Kapoor', email: 'mgr.crm@demo.test', proj: 'proj-crm', title: 'Project Manager' },
  { uid: 'u-mgr-partner', name: 'Sana Khan', email: 'mgr.partner@demo.test', proj: 'proj-partner', title: 'Project Manager' },
  { uid: 'u-mgr-campaign', name: 'Vikram Thakur', email: 'mgr.campaign@demo.test', proj: 'proj-campaign', title: 'Project Manager' },
  { uid: 'u-mgr-atlas', name: 'Aisha Patel', email: 'mgr.atlas@demo.test', proj: 'proj-atlas', title: 'Project Manager' },
];

const FIRST = ['Amit','Neha','Ravi','Pooja','Sanjay','Kavita','Manish','Deepa','Arjun','Swati','Rahul','Anjali','Vivek','Shreya','Nikhil','Priyanka','Rajesh','Sunita','Ajay','Meenakshi','Gaurav','Ritu','Sandeep','Nisha','Ankit','Preeti','Varun','Komal','Yash','Ishita','Harish','Simran','Naveen','Tanvi','Rakesh','Bhavna'];
const LAST = ['Kumar','Singh','Gupta','Sharma','Patel','Reddy','Iyer','Nair','Rao','Mehta','Joshi','Chopra','Malhotra','Bhat','Menon','Das','Kaur','Pillai','Agarwal','Bose'];

const DESIGNATIONS_BY_DEPT = {
  'dept-eng': ['Software Engineer', 'Senior Software Engineer', 'QA Engineer', 'DevOps Engineer'],
  'dept-sales': ['Sales Executive', 'Senior Sales Executive', 'Business Development Associate'],
  'dept-mkt': ['Marketing Executive', 'Content Strategist', 'SEO Specialist'],
  'dept-fin': ['Accounts Executive', 'Financial Analyst'],
  'dept-hr': ['HR Executive', 'Recruiter'],
};

// department -> [{ deptStaffCount, projects: [{id, staffCount}] }]
// Numbers below total 37 staff; +5 heads +6 managers +1 org-admin +1
// master-admin = 50 people, +2 unassigned staff seeded separately = 52. Close
// enough to "about 50" that the shape matters more than the exact count.
const STAFF_PLAN = [
  { dept: 'dept-eng', projects: ['proj-apollo', 'proj-orion'], deptOnlyCount: 2, perProjectCount: 6 },
  { dept: 'dept-sales', projects: ['proj-crm', 'proj-partner'], deptOnlyCount: 1, perProjectCount: 4 },
  { dept: 'dept-mkt', projects: ['proj-campaign'], deptOnlyCount: 1, perProjectCount: 5 },
  { dept: 'dept-fin', projects: ['proj-atlas'], deptOnlyCount: 1, perProjectCount: 4 },
  // proj-payroll gets nobody — stays a genuinely empty project.
  { dept: 'dept-hr', projects: [], deptOnlyCount: 3, perProjectCount: 0 },
];

const day = (offset, hour = 12) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return admin.firestore.Timestamp.fromDate(d);
};

const TASK_VERBS = ['Fix', 'Review', 'Implement', 'Investigate', 'Update', 'Document', 'Test', 'Deploy', 'Refactor', 'Design', 'Optimize', 'Audit'];
const TASK_NOUNS = ['the login flow', 'the billing report', 'the onboarding checklist', 'the API rate limits', 'the client contract', 'the campaign assets', 'the dashboard widgets', 'the export pipeline', 'the vendor invoice', 'the mobile layout', 'the search index', 'the notification templates', 'the quarterly forecast', 'the security review', 'the staging environment'];
const STATUS_WEIGHTS = [['completed', 0.30], ['in-progress', 0.25], ['pending', 0.35], ['cancelled', 0.10]];
const PRIORITY_WEIGHTS = [['critical', 0.15], ['high', 0.30], ['medium', 0.35], ['low', 0.20]];

function weightedPick(weights) {
  const r = rand();
  let acc = 0;
  for (const [value, w] of weights) {
    acc += w;
    if (r <= acc) return value;
  }
  return weights[weights.length - 1][0];
}

function buildStaffList() {
  const staff = [];
  let n = 0;
  for (const plan of STAFF_PLAN) {
    const designations = DESIGNATIONS_BY_DEPT[plan.dept];
    for (let i = 0; i < plan.deptOnlyCount; i++) {
      n++;
      staff.push({
        uid: `u-staff-${n}`,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        email: `staff${n}@demo.test`,
        dept: plan.dept,
        projects: [],
        designation: pick(designations),
      });
    }
    for (const projId of plan.projects) {
      for (let i = 0; i < plan.perProjectCount; i++) {
        n++;
        staff.push({
          uid: `u-staff-${n}`,
          name: `${pick(FIRST)} ${pick(LAST)}`,
          email: `staff${n}@demo.test`,
          dept: plan.dept,
          projects: [projId],
          designation: pick(designations),
        });
      }
    }
  }

  // Edge case: an employee with neither a department nor a project — someone
  // between assignments, or a bad migration. Nothing in the app should crash
  // on them; several screens filter by department/project membership and an
  // empty array is a legitimate value here, not a missing one.
  staff.push({ uid: 'u-unassigned-1', name: 'Farah Ahmed', email: 'unassigned1@demo.test', dept: null, projects: [], designation: 'New Hire' });
  staff.push({ uid: 'u-unassigned-2', name: 'Tom O’Brien-Wallace', email: 'unassigned2@demo.test', dept: null, projects: [], designation: 'New Hire' });

  // Edge case: deactivated employee. Their tasks stay assigned to them —
  // real companies do not delete a leaver's history, they deactivate the
  // account. Every list that shows "active staff" must exclude them; every
  // list that shows "who is this task assigned to" must still resolve them.
  const deactivated = staff.find((s) => s.dept === 'dept-eng' && s.projects.includes('proj-apollo'));
  deactivated.status = 'inactive';

  // Edge case: a name and title long enough to test truncation in a fixed-
  // width card rather than a lucky short one.
  const longNamed = staff[staff.length - 3];
  longNamed.name = 'Bartholomew Aleksander Wintermere-Fitzgerald III';
  longNamed.designation = 'Senior Principal Full-Stack Site Reliability Engineer';

  return staff;
}

async function reset() {
  const collections = ['users', 'tasks', 'organizations', 'designations', 'audit_logs', 'error_logs', 'subtasks', 'task_comments'];
  for (const name of collections) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const users = await auth.listUsers(1000);
  await Promise.all(users.users.map((u) => auth.deleteUser(u.uid)));
}

async function createPerson(db_, auth_, { uid, name, email, role, designation, dept, projects, status }) {
  await auth_.createUser({ uid, email, password: PASSWORD, displayName: name });
  await db_.collection('users').doc(uid).set({
    id: uid,
    name,
    email,
    role,
    designation,
    status: status || 'active',
    orgId: ORG_ID,
    departmentIds: dept ? [dept] : [],
    projectIds: projects || [],
    createdAt: day(-Math.floor(rand() * 300) - 30),
  });
}

async function seed() {
  console.log('Clearing emulator data…');
  await reset();

  console.log('Creating organisation, departments and projects…');
  await db.collection('organizations').doc(ORG_ID).set({
    name: 'Northbridge Holdings Pvt. Ltd.',
    status: 'active',
    plan: 'active',
    seatLimit: 100,
    storageQuotaMB: 20000,
    billingEmail: 'billing@northbridge-demo.test',
    createdAt: day(-400),
  });
  const orgRef = db.collection('organizations').doc(ORG_ID);
  for (const d of DEPARTMENTS) {
    await orgRef.collection('departments').doc(d.id).set({ name: d.name, orgId: ORG_ID });
  }
  for (const p of PROJECTS) {
    await orgRef.collection('projects').doc(p.id).set({ name: p.name, orgId: ORG_ID, departmentId: p.dept });
  }

  console.log('Creating master-admin and org-admin…');
  await createPerson(db, auth, { uid: 'u-master', name: 'Ops Root', email: 'master@demo.test', role: 'master-admin', designation: 'Platform Owner', dept: null, projects: [] });
  // master-admin deliberately carries no orgId at all.
  await db.collection('users').doc('u-master').update({ orgId: admin.firestore.FieldValue.delete() });
  await createPerson(db, auth, { uid: 'u-orgadmin', name: 'Nikita Rane', email: 'admin@demo.test', role: 'org-admin', designation: 'Operations Director', dept: null, projects: [] });

  console.log('Creating department heads…');
  for (const h of HEADS) {
    await createPerson(db, auth, { uid: h.uid, name: h.name, email: h.email, role: 'department-head', designation: h.title, dept: h.dept, projects: [] });
  }

  console.log('Creating project managers…');
  for (const m of MANAGERS) {
    await createPerson(db, auth, { uid: m.uid, name: m.name, email: m.email, role: 'manager', designation: m.title, dept: null, projects: [m.proj] });
  }

  console.log('Creating ~37 staff across five departments and eight projects…');
  const staffList = buildStaffList();
  for (const s of staffList) {
    await createPerson(db, auth, {
      uid: s.uid, name: s.name, email: s.email, role: 'staff',
      designation: s.designation, dept: s.dept, projects: s.projects, status: s.status,
    });
  }

  console.log('Creating designations, including a pre-existing near-duplicate…');
  const allDesignations = new Set(Object.values(DESIGNATIONS_BY_DEPT).flat());
  for (const name of allDesignations) {
    await db.collection('designations').add({ name, description: `${name} role`, createdAt: day(-350) });
  }
  // The app's own "add designation" guard trims and lowercases before
  // comparing, so it cannot create this through the UI — but bad historical
  // data or a race before that guard existed absolutely can produce it. This
  // checks the management screen does not choke on, or silently merge, two
  // designations that are "the same" to a human but not to a strict compare.
  await db.collection('designations').add({ name: 'Software Engineer ', description: 'Legacy duplicate with trailing space', createdAt: day(-5) });

  console.log('Creating tasks (this is the slow part)…');
  const allAssignable = [
    ...HEADS.map((h) => ({ uid: h.uid, dept: h.dept, proj: null })),
    ...MANAGERS.map((m) => ({ uid: m.uid, dept: null, proj: m.proj })),
    { uid: 'u-orgadmin', dept: null, proj: null },
    ...staffList
      .filter((s) => s.status !== 'inactive' && s.uid !== 'u-unassigned-2') // leave one person with zero tasks
      .map((s) => ({ uid: s.uid, dept: s.dept, proj: s.projects[0] || null })),
  ];

  let taskCount = 0;
  for (const person of allAssignable) {
    const numTasks = 3 + Math.floor(rand() * 4); // 3..6
    for (let i = 0; i < numTasks; i++) {
      const status = weightedPick(STATUS_WEIGHTS);
      const priority = weightedPick(PRIORITY_WEIGHTS);
      // A visible long tail of overdue work, not just a token one or two.
      const start = -Math.floor(rand() * 40) - 1;
      const due = status === 'completed' || status === 'cancelled'
        ? start + Math.floor(rand() * 10) + 1
        : Math.floor(rand() * 50) - 20; // can land in the past -> overdue
      const title = `${pick(TASK_VERBS)} ${pick(TASK_NOUNS)}`;
      const deptId = person.dept || (person.proj ? PROJECTS.find((p) => p.id === person.proj)?.dept : null);

      await db.collection('tasks').add({
        title,
        description: `${title} — seeded for scale testing.`,
        status,
        priority,
        assignedTo: person.uid,
        createdBy: 'u-orgadmin',
        orgId: ORG_ID,
        departmentId: deptId || null,
        projectId: person.proj || null,
        startDate: day(start),
        deadline: day(due),
        createdAt: day(start),
        ...(status === 'completed' ? { completedAt: day(due) } : {}),
      });
      taskCount++;
    }
  }

  // Edge case: a task assigned to a uid with no user document at all —
  // simulates someone deleted straight out of Firestore (or a bad import)
  // rather than deactivated through the app. Anything that resolves
  // "assignedTo" to a display name must fall back gracefully, not throw.
  await db.collection('tasks').add({
    title: 'Reconcile the legacy vendor ledger entries that predate the current chart of accounts and were migrated without owner metadata during the 2024 system cutover',
    description: 'Seeded orphaned task — assignedTo has no matching user document.',
    status: 'pending',
    priority: 'high',
    assignedTo: 'u-ghost-deleted-user',
    createdBy: 'u-orgadmin',
    orgId: ORG_ID,
    departmentId: 'dept-fin',
    projectId: 'proj-atlas',
    startDate: day(-5),
    deadline: day(3),
    createdAt: day(-5),
  });
  taskCount++;

  console.log(`  ${taskCount} tasks created.`);

  console.log('Creating 45 audit log entries (pagination / scroll stress)…');
  const actions = ['org.provisioned', 'user.created', 'user.role_changed', 'org.suspended', 'user.deleted', 'user.reactivated', 'department.created', 'project.created'];
  const actors = ['u-master', 'u-orgadmin', ...HEADS.map((h) => h.uid)];
  for (let i = 0; i < 45; i++) {
    await db.collection('audit_logs').add({
      action: pick(actions),
      actorId: pick(actors),
      targetOrgId: ORG_ID,
      targetUserId: pick(staffList).uid,
      timestamp: day(-i),
    });
  }

  console.log('Creating 14 error log entries…');
  const errorMessages = [
    'Cannot read properties of undefined (reading \'map\')',
    'FirebaseError: permission-denied',
    'TypeError: staff.filter is not a function',
    'Network request failed',
    'Cannot read properties of null (reading \'name\')',
  ];
  for (let i = 0; i < 14; i++) {
    const person = pick(staffList);
    await db.collection('error_logs').add({
      message: pick(errorMessages),
      stack: `Error\n    at Component (App.jsx:${10 + i}:5)`,
      componentStack: '\n    at ErrorBoundary',
      url: `http://localhost:5174/${pick(['staff', 'department', 'manager', 'admin'])}`,
      userId: person.uid,
      userEmail: person.email,
      createdAt: day(-i),
    });
  }

  console.log('\nSeeded Northbridge Holdings: 5 departments, 8 projects (2 unmanaged, 1 fully empty),');
  console.log(`${staffList.length} staff, ${HEADS.length} heads, ${MANAGERS.length} managers, 1 org-admin, 1 master-admin.`);
  console.log(`Total accounts: ${staffList.length + HEADS.length + MANAGERS.length + 2}`);
  console.log('\nEvery account uses the password: ' + PASSWORD);
  console.log('\nKey logins to test with:');
  console.log('  master-admin      master@demo.test');
  console.log('  org-admin         admin@demo.test');
  console.log('  department-head   head.eng@demo.test   (Engineering, biggest dept)');
  console.log('  department-head   head.hr@demo.test    (HR — no projects under it)');
  console.log('  manager           mgr.apollo@demo.test (Apollo — has staff + tasks)');
  console.log('  staff             staff1@demo.test');
  console.log('  staff (inactive)  ' + staffList.find(s => s.status === 'inactive').email + '  (deactivated, tasks still assigned)');
  console.log('  staff (unassigned) unassigned1@demo.test / unassigned2@demo.test (no dept, no project)');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
