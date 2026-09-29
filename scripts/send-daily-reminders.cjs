/**
 * GitHub Actions Script: Daily Critical Task Reminders
 * Runs via GitHub Actions cron job daily at 8:00 AM IST.
 *
 * NOTE: this file must keep the .cjs extension. package.json sets
 * "type": "module", so a .js file using require() throws
 * "require is not defined" before a single line runs.
 *
 * Multi-tenant: every reminder is CC'd to the ccEmails configured on the task's
 * OWN organization (organizations/{id}.ccEmails). It used to CC one hardcoded
 * list for every task in the database, which would have sent one company's task
 * titles and descriptions to another company's administrators.
 *
 *   node scripts/send-daily-reminders.cjs [--dry-run]
 */

const { initAdmin } = require('./lib/admin.cjs');
const { createTransport, sendNotification } = require('./lib/mailer.cjs');
const { APP_URL, createTenantLookup } = require('./lib/tenant.cjs');

const DRY_RUN = process.argv.includes('--dry-run');
const DONE_STATUSES = new Set(['completed', 'cancelled']);

function formatDeadline(deadline) {
  if (!deadline) return 'Not specified';
  const d = typeof deadline?.toDate === 'function' ? deadline.toDate() : new Date(deadline);
  return isNaN(d.getTime())
    ? 'Not specified'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateDaysPending(createdAt) {
  if (!createdAt || typeof createdAt.toDate !== 'function') return '0';
  const diffDays = Math.ceil((Date.now() - createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24));
  return String(Math.max(0, diffDays));
}

function buildReminder(task, user, cc) {
  return {
    to_email: user.email,
    to_name: user.name || user.email,
    cc_email: cc,
    notification_type: 'REMINDER: Critical Task',
    notification_icon: '⏰',
    notification_color: '#ef4444',
    title: task.title,
    message: '⚠️ Daily Reminder: You still have an incomplete CRITICAL task that requires immediate attention',
    detail_1_label: 'Task',
    detail_1_value: task.title,
    detail_2_label: 'Description',
    detail_2_value: task.description || 'No description provided',
    detail_3_label: 'Priority',
    detail_3_value: '🔴 CRITICAL',
    detail_4_label: 'Due Date',
    // The field on a task is `deadline`, not `dueDate`.
    detail_4_value: formatDeadline(task.deadline),
    detail_5_label: 'Days Pending',
    detail_5_value: calculateDaysPending(task.createdAt),
    button_text: 'View Task Now',
    button_link: APP_URL,
    footer_text: '⚠️ This is a daily reminder for your critical task. Please complete it as soon as possible.',
  };
}

async function main() {
  console.log(`🔔 Starting daily critical task reminder check${DRY_RUN ? ' (dry run)' : ''}...`);
  console.log('Time:', new Date().toISOString());

  const transport = DRY_RUN ? null : createTransport();
  const db = initAdmin().firestore();
  const tenant = createTenantLookup(db);

  // Only critical tasks are read (single-field equality needs no composite
  // index); finished ones are dropped in memory. This used to download the whole
  // tasks collection every morning and print every task title to the CI log.
  const snapshot = await db.collection('tasks').where('priority', '==', 'critical').get();
  const criticalTasks = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => !DONE_STATUSES.has(String(t.status || '').toLowerCase()));

  console.log(`📊 Found ${criticalTasks.length} critical incomplete tasks`);
  if (criticalTasks.length === 0) return;

  const users = new Map();
  const getUser = async (uid) => {
    if (!users.has(uid)) {
      const snap = await db.collection('users').doc(uid).get();
      users.set(uid, snap.exists ? snap.data() : null);
    }
    return users.get(uid);
  };

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const task of criticalTasks) {
    if (!task.assignedTo) { skipped += 1; continue; }

    const user = await getUser(task.assignedTo);
    // A reminder is for someone who can still act on the task: skip deleted,
    // deactivated, address-less users, and anyone now in a different org.
    if (!user || !user.email || user.status === 'inactive' || (user.orgId ?? null) !== (task.orgId ?? null)) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  would remind ${user.email} (task ${task.id})`);
      continue;
    }

    try {
      await sendNotification(transport, buildReminder(task, user, await tenant.ccFor(task.orgId)));
      sent += 1;
      // Small delay to stay clear of Gmail rate limiting.
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      failed += 1;
      console.error(`❌ Failed to send reminder for task ${task.id}:`, error.message);
    }
  }

  console.log(`🎯 Reminder check complete: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  // One bad address should not fail the run; nothing getting through should.
  if (sent === 0 && failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('❌ Error in reminder script:', error);
  process.exit(1);
});
