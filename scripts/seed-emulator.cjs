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
  {
    uid: 'u-finance', email: 'finance@demo.test', name: 'Farah Finance',
    role: 'finance', designation: 'Finance',
    orgId: ORG_ID, departmentIds: [], projectIds: [],
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
    'client_messages', 'client_requests', 'comment_notifications',
    'time_entries', 'task_events', 'mail_queue', 'inbound_keys',
  ];
  for (const name of collections) {
    const snap = await db.collection(name).get();
    // recursively: an organisation's projects, sprints, goals… go with it
    await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref)));
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

  // A milestone the team has put up for the client's sign-off, with the team's note to the
  // client, so the portal's Approve / Request changes and the conversation have something to show.
  const signOff = await db.collection('tasks').add({
    title: 'Design review sign-off',
    description: 'The client approves the final designs before build starts.',
    status: 'review', priority: 'high', milestone: true,
    assignedTo: 'u-staff1', createdBy: 'u-manager',
    orgId: ORG_ID, departmentId: DEPT_ENG, projectId: PROJ_APOLLO,
    startDate: day(2), deadline: day(2), createdAt: day(-6),
  });
  // Time logged on the milestone over the last week, for Timesheets and Invoices.
  const ymd = (offset) => day(offset).toDate().toISOString().slice(0, 10);
  for (const [userId, userName, offset, minutes] of [
    ['u-staff1', 'Sana Staff', 0, 240], ['u-staff1', 'Sana Staff', -1, 360], ['u-staff1', 'Sana Staff', -8, 300],
    ['u-staff2', 'Vikram Iyer', 0, 120], ['u-staff2', 'Vikram Iyer', -2, 480],
  ]) {
    await db.collection('time_entries').add({
      orgId: ORG_ID, projectId: PROJ_APOLLO, taskId: signOff.id, userId, userName, minutes,
      date: ymd(offset), note: 'Design review prep', createdAt: day(offset),
    });
  }
  await db.collection('client_messages').add({
    orgId: ORG_ID, projectId: PROJ_APOLLO, taskId: signOff.id,
    authorId: 'u-manager', authorName: 'Rohit Manager', fromClient: false, kind: 'message',
    text: 'The final designs are attached to this milestone. Please approve, or tell us what to change.',
    notified: true, createdAt: day(-1),
  });

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

  console.log('Creating the showcase (every optional feature, with content)…');
  // The demo organisation has every feature switched on (a real one starts with essentials),
  // and enough in each to look alive: the Features page screenshots are taken from this.
  const apollo = orgRef.collection('projects').doc(PROJ_APOLLO);
  const atlas = orgRef.collection('projects').doc(PROJ_ATLAS);
  const ymdOf = (offset) => day(offset).toDate().toISOString().slice(0, 10);
  const now = admin.firestore.Timestamp.now();
  const { OPTIONAL } = await import('../src/lib/features.js');
  await orgRef.collection('features').doc('settings').set({ enabled: OPTIONAL, updatedBy: 'u-orgadmin', updatedAt: now });
  await orgRef.collection('workflow').doc('stages').set({ stages: [
    { id: 'qa', name: 'QA', category: 'review' },
    { id: 'client-check', name: 'Client check', category: 'review' },
  ] });
  await orgRef.collection('customFields').doc('cf-client-ref').set({ name: 'Client reference', type: 'text', options: [], createdAt: now });
  await orgRef.collection('finance').doc('rates').set({ defaultRate: 1200, people: { 'u-staff1': 1400 } });
  await orgRef.collection('holidays').doc('list').set({ days: [
    { date: ymdOf(5), name: 'Founders’ Day' }, { date: ymdOf(26), name: 'Diwali holiday' }, { date: ymdOf(70), name: 'Christmas' },
  ] });
  await orgRef.collection('leave').doc('lv1').set({ userId: 'u-staff2', userName: 'Vikram Iyer', from: ymdOf(8), to: ymdOf(10), note: 'Family function', createdBy: 'u-staff2', createdAt: now });
  await orgRef.collection('leave').doc('lv2').set({ userId: 'u-staff1', userName: 'Sana Staff', from: ymdOf(20), to: ymdOf(21), note: 'Conference', createdBy: 'u-staff1', createdAt: now });

  // Sprints on Apollo: two finished, one running; story points on its open tasks.
  const sprintRef = (id) => apollo.collection('sprints').doc(id);
  await sprintRef('s1').set({ name: 'Sprint 1 – Foundations', goal: 'Billing and data in place', startDate: ymdOf(-30), endDate: ymdOf(-17), status: 'closed', completedPoints: 13, createdBy: 'u-manager', createdAt: now });
  await sprintRef('s2').set({ name: 'Sprint 2 – Onboarding', goal: 'New onboarding live', startDate: ymdOf(-16), endDate: ymdOf(-3), status: 'closed', completedPoints: 11, createdBy: 'u-manager', createdAt: now });
  await sprintRef('s3').set({ name: 'Sprint 3 – Launch prep', goal: 'Checkout insights and launch checklist', startDate: ymdOf(-2), endDate: ymdOf(11), status: 'active', completedPoints: null, createdBy: 'u-manager', createdAt: now });
  const points = {
    'Rewrite the onboarding emails': [5, 's3'], 'Instrument the checkout funnel': [8, 's3'], 'Review the Apollo release checklist': [3, 's3'],
    'Draft the accessibility statement': [3, null], 'Refresh the design tokens': [5, null], 'Approve the Q3 hiring plan': [2, 's3'],
  };
  for (const [title, [storyPoints, sprintId]] of Object.entries(points)) {
    if (taskRefs[title]) await db.collection('tasks').doc(taskRefs[title]).update({ storyPoints, ...(sprintId ? { sprintId } : {}) });
  }
  const quick = await db.collection('tasks').add({
    title: 'Launch banner copy', description: 'Short banner announcing the new checkout.', status: 'completed', priority: 'low',
    assignedTo: 'u-staff1', createdBy: 'u-manager', orgId: ORG_ID, departmentId: DEPT_ENG, projectId: PROJ_APOLLO,
    startDate: day(-2), deadline: day(-1), createdAt: day(-3), completedAt: day(-1), updatedAt: day(-1), storyPoints: 3, sprintId: 's3',
  });
  if (taskRefs['Instrument the checkout funnel']) {
    await db.collection('tasks').doc(taskRefs['Instrument the checkout funnel']).update({ watchers: ['u-orgadmin'], estimateHours: 20 });
  }
  await db.collection('tasks').doc(signOff.id).update({ stage: 'client-check' });

  // Goals
  await orgRef.collection('goals').doc('g1').set({
    title: 'Launch Apollo to every customer', description: 'New checkout and onboarding for all accounts.', ownerId: 'u-head', ownerName: 'Neha Head',
    startDate: ymdOf(-30), dueDate: ymdOf(60), projectIds: [PROJ_APOLLO],
    keyResults: [{ title: 'Accounts on the new checkout', start: 0, target: 120, current: 48, unit: 'accounts' }, { title: 'Checkout conversion', start: 2, target: 4, current: 2.9, unit: '%' }],
    createdBy: 'u-orgadmin', createdAt: now, updatedAt: now,
  });
  await orgRef.collection('goals').doc('g2').set({
    title: 'Close the books faster', description: 'Month-end close in three days.', ownerId: 'u-staff3', ownerName: 'Aisha Khan',
    startDate: ymdOf(-30), dueDate: ymdOf(60), projectIds: [PROJ_ATLAS],
    keyResults: [{ title: 'Days to close the month', start: 8, target: 3, current: 6, unit: 'days' }],
    createdBy: 'u-orgadmin', createdAt: now, updatedAt: now,
  });

  // Weekly status updates, risks and a project page
  await apollo.collection('updates').doc('u1').set({ health: 'on_track', summary: 'Sprint 3 under way: onboarding emails nearly done, funnel tracking in review. Launch checklist next week.', createdBy: 'u-manager', createdByName: 'Rohit Manager', createdAt: now });
  await atlas.collection('updates').doc('u1').set({ health: 'at_risk', summary: 'Vendor audit is a day late and the Q2 ledger close depends on it. Extra reviewer added.', createdBy: 'u-head', createdByName: 'Neha Head', createdAt: now });
  const raid = [
    [apollo, 'risk', 'Payment provider changes its API before launch', 'Mitigation: pin the API version; test against the sandbox weekly.', 'high', 'u-staff2', 'Vikram Iyer', ymdOf(7)],
    [apollo, 'decision', 'Launch to 10% of accounts first', 'Roll out gradually to watch conversion before everyone moves.', 'medium', 'u-manager', 'Rohit Manager', null],
    [apollo, 'assumption', 'Design tokens are final by mid-month', 'The accessibility statement depends on them.', 'medium', 'u-staff1', 'Sana Staff', ymdOf(10)],
    [atlas, 'issue', 'Vendor audit evidence incomplete', 'Two vendors have not sent their certificates.', 'high', 'u-staff3', 'Aisha Khan', ymdOf(2)],
  ];
  for (const [i, [proj, type, title, detail, impact, ownerId, ownerName, dueDate]] of raid.entries()) {
    await proj.collection('raid').doc(`r${i + 1}`).set({ type, title, detail, impact, ownerId, ownerName, dueDate, status: 'open', createdBy: 'u-manager', createdByName: 'Rohit Manager', createdAt: now, updatedAt: now });
  }
  await apollo.collection('pages').doc('p1').set({
    title: 'Launch plan',
    body: '# Launch plan\n## Goals\n- New checkout for every account\n- Measure conversion before and after\n## Decisions\n- Roll out to 10% first, then everyone\n## Action items\n- [x] Funnel tracking in staging\n- [ ] Write the launch banner copy\n- [ ] Book the go/no-go meeting',
    createdBy: 'u-manager', createdAt: now, updatedBy: 'u-manager', updatedByName: 'Rohit Manager', updatedAt: now,
  });
  await atlas.collection('pages').doc('p1').set({
    title: 'Month-end close checklist',
    body: '# Close checklist\n- [x] Bank reconciliation\n- [ ] Vendor audit sign-off\n- [ ] Accruals review',
    createdBy: 'u-head', createdAt: now, updatedBy: 'u-head', updatedByName: 'Neha Head', updatedAt: now,
  });

  // Money: expenses, an approved week and two invoices
  const expenses = [[apollo, 18000, 'Load testing service', 'tools', -12], [apollo, 42000, 'Contract designer', 'labor', -8], [apollo, 6500, 'Team travel to client', 'travel', -4], [atlas, 9000, 'Audit software licence', 'tools', -10]];
  for (const [i, [proj, amount, description, category, offset]] of expenses.entries()) {
    await proj.collection('expenses').doc(`e${i + 1}`).set({ amount, description, category, date: ymdOf(offset), addedBy: 'u-orgadmin', addedByName: 'Arjun Admin', createdAt: day(offset) });
  }
  const monday = (() => { const d = day(-7).toDate(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  await apollo.collection('timesheets').doc(`u-staff1_${monday}`).set({ userId: 'u-staff1', userName: 'Sana Staff', weekStart: monday, minutes: 300, status: 'approved', note: '', decidedBy: 'u-manager', decidedByName: 'Rohit Manager', decidedAt: now });
  const invoice = (number, status, lines) => {
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const tax = Math.round(subtotal * 18) / 100;
    return { number, projectId: PROJ_APOLLO, projectName: 'Apollo Platform', clientName: 'Acme Corp', from: ymdOf(-45), to: ymdOf(-16), currency: 'USD', lines, taxPercent: 18, subtotal, tax, total: subtotal + tax, status, notes: 'Payment due within 15 days.', createdBy: 'u-orgadmin', createdByName: 'Arjun Admin', createdAt: now, paidAt: status === 'paid' ? now : null };
  };
  const line = (description, hours, rate) => ({ userId: null, description, hours, rate, amount: hours * rate });
  await orgRef.collection('invoices').doc('i1').set(invoice('INV-2026-0001', 'paid', [line('Sana Staff', 32, 60), line('Vikram Iyer', 28, 60)]));
  await orgRef.collection('invoices').doc('i2').set(invoice('INV-2026-0002', 'issued', [line('Sana Staff', 24, 60)]));

  // Automations, a client request and an email-in address
  await orgRef.collection('integrations').doc('channels').set({ slack: 'https://hooks.slack.com/services/T000/B000/demo', teams: '', webhook: '', webhookSecret: '' });
  await orgRef.collection('automations').doc('a1').set({
    name: 'Tell #apollo when work is ready for review', enabled: true, trigger: 'status_changed', toStatus: 'review', projectId: PROJ_APOLLO, priority: '',
    action: { type: 'notify_channels' }, updatedBy: 'u-orgadmin', updatedAt: now,
  });
  await db.collection('client_requests').add({
    orgId: ORG_ID, projectId: PROJ_APOLLO, title: 'Add an export of monthly orders', details: 'Our finance team needs a CSV of orders each month.',
    urgency: 'normal', neededBy: null, requestedBy: 'u-client', requestedByName: 'Acme Corp Client', status: 'new', notified: true, createdAt: day(-1),
  });
  await apollo.update({ inboxKey: 'apollodemokey001' });
  await db.collection('inbound_keys').doc('apollodemokey001').set({ orgId: ORG_ID, projectId: PROJ_APOLLO, createdBy: 'u-orgadmin', createdAt: now });
  void quick;

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
