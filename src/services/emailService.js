// Email notifications.
//
// The browser does not send email. It appends a document to `mail_queue`, and
// a scheduled GitHub Action drains that queue through Gmail.
//
// Why: a browser cannot speak SMTP, so the previous approach used EmailJS as a
// relay — which meant a sending credential had to be reachable from client
// code. That is how the EmailJS private key ended up compiled into the bundle
// and committed to a public repository. Queueing removes the credential from
// the client entirely: the only thing the browser can do is ask for an email,
// and Firestore rules constrain what it may ask for.
//
// Trade-off: delivery is not instant. Mail goes out on the next run of the
// drain job rather than the moment a task is assigned.

import { EMAIL_CONFIG } from '@/config/emailConfig';
import { db, auth } from '@/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const QUEUE = 'mail_queue';
const APP_URL = 'https://magnaflow-07sep25.web.app';

/**
 * Log the request for quota tracking. Kept separate from the queue so the
 * existing email_logs reporting keeps working unchanged.
 */
const logEmailToFirestore = async (emailDetails) => {
  try {
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await addDoc(collection(db, 'email_logs'), {
      sentAt: serverTimestamp(),
      type: emailDetails.type || 'generic',
      recipient: emailDetails.recipient,
      taskId: emailDetails.taskId || null,
      status: emailDetails.status,
      monthYear,
      source: emailDetails.source || 'manual',
      error: emailDetails.error || null,
      notificationType: emailDetails.notificationType || null,
    });
  } catch (error) {
    console.error('Failed to log email to Firestore:', error);
    // Never throw — logging is not worth failing the caller over.
  }
};

/**
 * Append one email to the queue.
 *
 * @param {Object} emailData payload in the notification-template shape
 * @param {Object} [logDetails] { type, taskId, source }
 */
const queueEmail = async (emailData, logDetails = {}) => {
  if (!emailData.to_email) {
    console.warn('Skipping email with no recipient');
    return { success: false, error: 'No recipient' };
  }

  try {
    await addDoc(collection(db, QUEUE), {
      ...emailData,
      status: 'pending',
      attempts: 0,
      // Rules require these to match the caller, so a queued email is always
      // attributable and cannot be forged on someone else's behalf.
      requestedBy: auth.currentUser?.uid || null,
      requestedAt: serverTimestamp(),
      type: logDetails.type || 'generic',
      taskId: logDetails.taskId || null,
      source: logDetails.source || 'manual',
    });

    await logEmailToFirestore({
      type: logDetails.type || 'generic',
      recipient: emailData.to_email,
      taskId: logDetails.taskId || null,
      status: 'queued',
      source: logDetails.source || 'manual',
      notificationType: emailData.notification_type || null,
    });

    return { success: true, queued: true };
  } catch (error) {
    console.error('Could not queue email:', error?.code || error?.message);

    await logEmailToFirestore({
      type: logDetails.type || 'generic',
      recipient: emailData.to_email,
      taskId: logDetails.taskId || null,
      status: 'failed',
      source: logDetails.source || 'manual',
      error: error?.message || 'Unknown error',
      notificationType: emailData.notification_type || null,
    });

    return { success: false, error: error?.message };
  }
};

const PRIORITY_COLORS = {
  Low: '#51b206',
  Medium: '#3e30d9',
  High: '#f59e0b',
  Critical: '#ef4444',
};

export const sendTaskAssignedEmail = async (params) =>
  queueEmail(
    {
      to_email: params.toEmail,
      to_name: params.toName,
      cc_email: EMAIL_CONFIG.CC_EMAILS || '',
      notification_type: 'Task Assignment',
      notification_icon: '📋',
      notification_color: PRIORITY_COLORS[params.taskPriority] || '#3e30d9',
      title: params.taskTitle,
      message: `You have been assigned a new task by ${params.assignedBy}`,
      detail_1_label: 'Task', detail_1_value: params.taskTitle,
      detail_2_label: 'Description', detail_2_value: params.taskDescription,
      detail_3_label: 'Priority', detail_3_value: params.taskPriority,
      detail_4_label: 'Due Date', detail_4_value: params.dueDate,
      detail_5_label: 'Assigned by', detail_5_value: params.assignedBy,
      button_text: 'View Task Details',
      button_link: APP_URL,
      footer_text: 'Log in to MagnaFlow to view the full task and start working.',
    },
    { type: 'task_assigned', taskId: params.taskId, source: params.source || 'manual' }
  );

export const sendTaskCompletedEmail = async (params) =>
  queueEmail(
    {
      to_email: params.toEmail,
      to_name: params.toName,
      notification_type: 'Task Completed',
      notification_icon: '✅',
      notification_color: '#51b206',
      title: params.taskTitle,
      message: `A task has been completed by ${params.completedBy}`,
      detail_1_label: 'Task', detail_1_value: params.taskTitle,
      detail_2_label: 'Completed by', detail_2_value: params.completedBy,
      detail_3_label: 'Completed on', detail_3_value: params.completionDate,
      detail_4_label: 'Status', detail_4_value: 'Completed',
      button_text: 'View Completed Task',
      button_link: APP_URL,
      footer_text: 'Open the admin panel for details and analytics.',
    },
    { type: 'task_completed', taskId: params.taskId, source: params.source || 'manual' }
  );

export const sendTaskStatusChangedEmail = async (params) =>
  queueEmail(
    {
      to_email: params.toEmail,
      to_name: params.toName,
      notification_type: 'Task Status Update',
      notification_icon: '📊',
      notification_color: '#3e30d9',
      title: params.taskTitle,
      message: `${params.changedBy} updated a task's status`,
      detail_1_label: 'Task', detail_1_value: params.taskTitle,
      detail_2_label: 'Previous Status', detail_2_value: params.oldStatus,
      detail_3_label: 'New Status', detail_3_value: params.newStatus,
      detail_4_label: 'Updated by', detail_4_value: params.changedBy,
      detail_5_label: 'Updated at', detail_5_value: new Date().toLocaleString(),
      button_text: 'View Task Details',
      button_link: APP_URL,
      footer_text: 'Log in to see the complete task progress.',
    },
    { type: 'task_status_changed', taskId: params.taskId, source: params.source || 'manual' }
  );

export const sendCriticalTaskAlert = async (params) =>
  queueEmail(
    {
      to_email: params.toEmail,
      to_name: params.toName,
      cc_email: EMAIL_CONFIG.CC_EMAILS || '',
      notification_type: 'URGENT: Critical Task',
      notification_icon: '🚨',
      notification_color: '#ef4444',
      title: params.taskTitle,
      message: 'You have been assigned a CRITICAL priority task that needs immediate attention',
      detail_1_label: 'Task', detail_1_value: params.taskTitle,
      detail_2_label: 'Description', detail_2_value: params.taskDescription,
      detail_3_label: 'Priority', detail_3_value: 'CRITICAL',
      detail_4_label: 'Due Date', detail_4_value: params.dueDate,
      detail_5_label: 'Assigned by', detail_5_value: params.assignedBy,
      button_text: 'View Task Immediately',
      button_link: APP_URL,
      footer_text: 'This task needs immediate attention. Please start on it as soon as you can.',
    },
    { type: 'critical_task_alert', taskId: params.taskId, source: params.source || 'manual' }
  );

export const sendCriticalTaskReminder = async (params) =>
  queueEmail(
    {
      to_email: params.toEmail,
      to_name: params.toName,
      cc_email: EMAIL_CONFIG.CC_EMAILS || '',
      notification_type: 'REMINDER: Critical Task',
      notification_icon: '⏰',
      notification_color: '#ef4444',
      title: params.taskTitle,
      message: 'Daily reminder: this CRITICAL task is still incomplete',
      detail_1_label: 'Task', detail_1_value: params.taskTitle,
      detail_2_label: 'Description', detail_2_value: params.taskDescription,
      detail_3_label: 'Priority', detail_3_value: 'CRITICAL',
      detail_4_label: 'Due Date', detail_4_value: params.dueDate,
      detail_5_label: 'Days Pending', detail_5_value: params.daysPending || 'N/A',
      button_text: 'View Task Now',
      button_link: APP_URL,
      footer_text: 'This reminder repeats daily until the task is complete.',
    },
    { type: 'critical_task_reminder', taskId: params.taskId, source: params.source || 'cron_job' }
  );

/**
 * Kept for the admin diagnostics panel. There is no client-side credential to
 * report on any more, so this describes the queue instead.
 */
export const getEmailConfigStatus = () => ({
  configured: true,
  transport: 'Firestore queue → Gmail (GitHub Actions)',
  queue: QUEUE,
});
