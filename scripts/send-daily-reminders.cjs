/**
 * GitHub Actions Script: Daily Critical Task Reminders
 * Runs via GitHub Actions cron job daily at 8:00 AM IST.
 *
 * NOTE: this file must keep the .cjs extension. package.json sets
 * "type": "module", so a .js file using require() throws
 * "require is not defined" before a single line runs.
 */

const admin = require('firebase-admin');
const { createTransport, sendNotification } = require('./lib/mailer.cjs');

/**
 * Accepts either a whole service-account JSON (FIREBASE_SERVICE_ACCOUNT_JSON —
 * the same secret the hosting deploy uses, so it's known to exist) or the three
 * separate values. Missing credentials fail loudly and specifically rather than
 * producing a confusing Firebase error later.
 */
function buildCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.');
      process.exit(2);
    }
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }

  console.error(
    'No Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred), or\n' +
    'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
  process.exit(2);
}

// Fail fast on missing email config, naming exactly what's absent — otherwise
// the job "succeeds" having sent nothing, which is how this went unnoticed.
// createTransport() performs that check and exits 2 naming the variable.
const transport = createTransport();

admin.initializeApp({ credential: buildCredential() });

const db = admin.firestore();

const ADMIN_EMAILS = 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in';

function formatDeadline(deadline) {
  if (!deadline) return 'Not specified';
  const d = typeof deadline?.toDate === 'function' ? deadline.toDate() : new Date(deadline);
  return isNaN(d.getTime())
    ? 'Not specified'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateDaysPending(createdAt) {
  if (!createdAt) return '0';
  const now = new Date();
  const created = createdAt.toDate();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays.toString();
}

async function sendCriticalTaskReminder(params) {
  const emailData = {
    to_email: params.toEmail,
    to_name: params.toName,
    cc_email: ADMIN_EMAILS,
    notification_type: 'REMINDER: Critical Task',
    notification_icon: '⏰',
    notification_color: '#ef4444',
    title: params.taskTitle,
    message: '⚠️ Daily Reminder: You still have an incomplete CRITICAL task that requires immediate attention',
    
    detail_1_label: 'Task',
    detail_1_value: params.taskTitle,
    detail_2_label: 'Description',
    detail_2_value: params.taskDescription,
    detail_3_label: 'Priority',
    detail_3_value: '🔴 CRITICAL',
    detail_4_label: 'Due Date',
    detail_4_value: params.dueDate,
    detail_5_label: 'Days Pending',
    detail_5_value: params.daysPending,
    
    button_text: 'View Task Now',
    button_link: 'https://magnaflow-07sep25.web.app',
    footer_text: '⚠️ This is a daily reminder for your critical task. Please complete it as soon as possible.'
  };

  return await sendNotification(transport, emailData);
}

async function main() {
  console.log('🔔 Starting daily critical task reminder check...');
  console.log('Time:', new Date().toISOString());

  try {
    // Get all tasks
    const tasksSnapshot = await db.collection('tasks').get();
    const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📋 Total tasks: ${allTasks.length}`);
    
    // Filter critical incomplete tasks (case-insensitive)
    const criticalTasks = allTasks.filter(task => {
      const isCritical = task.priority?.toLowerCase() === 'critical';
      const isNotCompleted = task.status?.toLowerCase() !== 'completed';
      console.log(`Task: "${task.title}" | Priority: "${task.priority}" | Status: "${task.status}" | Is Critical: ${isCritical} | Not Completed: ${isNotCompleted}`);
      return isCritical && isNotCompleted;
    });

    console.log(`📊 Found ${criticalTasks.length} critical incomplete tasks`);

    if (criticalTasks.length === 0) {
      console.log('✅ No critical tasks to remind about');
      process.exit(0);
    }

    // Send reminders
    let successCount = 0;
    for (const task of criticalTasks) {
      try {
        // Get user
        const userDoc = await db.collection('users').doc(task.assignedTo).get();
        if (!userDoc.exists) {
          console.warn(`⚠️ User not found: ${task.assignedTo}`);
          continue;
        }

        const userData = userDoc.data();
        if (!userData.email) {
          console.warn(`⚠️ No email for user ${task.assignedTo}`);
          continue;
        }

        console.log(`📧 Sending reminder to ${userData.email} for task: ${task.title}`);

        // Send email
        await sendCriticalTaskReminder({
          toEmail: userData.email,
          toName: userData.name || userData.email,
          taskTitle: task.title,
          taskDescription: task.description || 'No description provided',
          // The field on a task is `deadline`, not `dueDate`. Reading the wrong
          // one made every reminder say "Not specified".
          dueDate: formatDeadline(task.deadline),
          daysPending: calculateDaysPending(task.createdAt)
        });

        console.log(`✅ Reminder sent successfully to ${userData.email}`);
        successCount++;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Failed to send reminder for task ${task.id}:`, error.message);
      }
    }

    console.log(`🎯 Reminder check complete: ${successCount}/${criticalTasks.length} reminders sent successfully`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error in reminder script:', error);
    process.exit(1);
  }
}

main();
