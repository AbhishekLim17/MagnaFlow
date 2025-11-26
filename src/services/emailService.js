// Email Service using EmailJS
// Handles sending email notifications for task assignments, updates, and alerts

import emailjs from '@emailjs/browser';
import { EMAIL_CONFIG } from '@/config/emailConfig';

/**
 * Initialize EmailJS with public key
 */
export const initializeEmailJS = () => {
  try {
    emailjs.init(EMAIL_CONFIG.PUBLIC_KEY);
    console.log('✅ EmailJS initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize EmailJS:', error);
  }
};

/**
 * Check if EmailJS is properly configured
 */
const isEmailConfigured = () => {
  return EMAIL_CONFIG.SERVICE_ID && EMAIL_CONFIG.TEMPLATE_ID && EMAIL_CONFIG.PUBLIC_KEY;
};

/**
 * Send universal notification email
 * @param {Object} emailData - Email data object
 */
const sendEmail = async (emailData) => {
  if (!isEmailConfigured()) {
    console.warn('⚠️ EmailJS not configured. Skipping email notification.');
    return { success: false, error: 'EmailJS not configured' };
  }

  try {
    console.log('📧 Sending email with data:', {
      to: emailData.to_email,
      cc: emailData.cc_email,
      type: emailData.notification_type,
      title: emailData.title
    });
    
    const response = await emailjs.send(
      EMAIL_CONFIG.SERVICE_ID,
      EMAIL_CONFIG.TEMPLATE_ID,
      emailData,
      EMAIL_CONFIG.PUBLIC_KEY
    );
    console.log('✅ Email sent successfully:', response);
    console.log('📬 Status:', response.status, 'Text:', response.text);
    return { success: true, response };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    console.error('❌ Error details:', error.text || error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send task assigned notification
 * @param {Object} params - Email parameters
 */
export const sendTaskAssignedEmail = async (params) => {
  const getPriorityColor = (priority) => {
    const colors = {
      'Low': '#10b981',
      'Medium': '#3b82f6',
      'High': '#f59e0b',
      'Critical': '#ef4444'
    };
    return colors[priority] || '#6b7280';
  };

  const emailData = {
    to_email: params.toEmail,
    to_name: params.toName,
    cc_email: 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in',
    notification_type: 'Task Assignment',
    notification_icon: '📋',
    notification_color: getPriorityColor(params.taskPriority),
    title: params.taskTitle,
    message: `You have been assigned a new task by ${params.assignedBy}`,
    
    detail_1_label: 'Task',
    detail_1_value: params.taskTitle,
    detail_2_label: 'Description',
    detail_2_value: params.taskDescription,
    detail_3_label: 'Priority',
    detail_3_value: params.taskPriority,
    detail_4_label: 'Due Date',
    detail_4_value: params.dueDate,
    detail_5_label: 'Assigned by',
    detail_5_value: params.assignedBy,
    
    button_text: 'View Task Details',
    button_link: 'https://magnaflow-07sep25.web.app',
    
    footer_text: 'Please log in to MagnaFlow to view complete task details and start working.'
  };

  return await sendEmail(emailData);
};

/**
 * Send task completed notification
 * @param {Object} params - Email parameters
 */
export const sendTaskCompletedEmail = async (params) => {
  const emailData = {
    to_email: params.toEmail,
    to_name: params.toName,
    notification_type: 'Task Completed',
    notification_icon: '✅',
    notification_color: '#10b981',
    title: params.taskTitle,
    message: `Great news! A task has been completed by ${params.completedBy}`,
    
    detail_1_label: 'Task',
    detail_1_value: params.taskTitle,
    detail_2_label: 'Completed by',
    detail_2_value: params.completedBy,
    detail_3_label: 'Completed on',
    detail_3_value: params.completionDate,
    detail_4_label: 'Status',
    detail_4_value: 'Completed',
    detail_5_label: '',
    detail_5_value: '',
    
    button_text: 'View Completed Task',
    button_link: 'https://magnaflow-07sep25.web.app',
    
    footer_text: 'Check the admin panel for more details and analytics.'
  };

  return await sendEmail(emailData);
};

/**
 * Send task status changed notification
 * @param {Object} params - Email parameters
 */
export const sendTaskStatusChangedEmail = async (params) => {
  const emailData = {
    to_email: params.toEmail,
    to_name: params.toName,
    notification_type: 'Task Status Update',
    notification_icon: '📊',
    notification_color: '#10b981',
    title: params.taskTitle,
    message: `${params.changedBy} has updated a task status`,
    
    detail_1_label: 'Task',
    detail_1_value: params.taskTitle,
    detail_2_label: 'Previous Status',
    detail_2_value: params.oldStatus,
    detail_3_label: 'New Status',
    detail_3_value: params.newStatus,
    detail_4_label: 'Updated by',
    detail_4_value: params.changedBy,
    detail_5_label: 'Updated at',
    detail_5_value: new Date().toLocaleString(),
    
    button_text: 'View Task Details',
    button_link: 'https://magnaflow-07sep25.web.app',
    
    footer_text: 'Log in to your admin panel to see the complete task progress.'
  };

  return await sendEmail(emailData);
};

/**
 * Send critical task alert
 * @param {Object} params - Email parameters
 */
export const sendCriticalTaskAlert = async (params) => {
  const emailData = {
    to_email: params.toEmail,
    to_name: params.toName,
    cc_email: 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in',
    notification_type: 'URGENT: Critical Task',
    notification_icon: '🚨',
    notification_color: '#ef4444',
    title: params.taskTitle,
    message: `⚠️ You have been assigned a CRITICAL priority task that requires immediate attention`,
    
    detail_1_label: 'Task',
    detail_1_value: params.taskTitle,
    detail_2_label: 'Description',
    detail_2_value: params.taskDescription,
    detail_3_label: 'Priority',
    detail_3_value: '🔴 CRITICAL',
    detail_4_label: 'Due Date',
    detail_4_value: params.dueDate,
    detail_5_label: 'Assigned by',
    detail_5_value: params.assignedBy,
    
    button_text: 'View Task Immediately',
    button_link: 'https://magnaflow-07sep25.web.app',
    
    footer_text: '⚠️ This task requires immediate attention. Please start working on it as soon as possible.'
  };

  return await sendEmail(emailData);
};

/**
 * Send daily critical task reminder
 * @param {Object} params - Email parameters
 */
export const sendCriticalTaskReminder = async (params) => {
  const emailData = {
    to_email: params.toEmail,
    to_name: params.toName,
    cc_email: 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in',
    notification_type: 'REMINDER: Critical Task',
    notification_icon: '⏰',
    notification_color: '#ef4444',
    title: params.taskTitle,
    message: `⚠️ Daily Reminder: You still have an incomplete CRITICAL task that requires immediate attention`,
    
    detail_1_label: 'Task',
    detail_1_value: params.taskTitle,
    detail_2_label: 'Description',
    detail_2_value: params.taskDescription,
    detail_3_label: 'Priority',
    detail_3_value: '🔴 CRITICAL',
    detail_4_label: 'Due Date',
    detail_4_value: params.dueDate,
    detail_5_label: 'Days Pending',
    detail_5_value: params.daysPending || 'N/A',
    
    button_text: 'View Task Now',
    button_link: 'https://magnaflow-07sep25.web.app',
    
    footer_text: '⚠️ This is a daily reminder for your critical task. Please complete it as soon as possible.'
  };

  return await sendEmail(emailData);
};

/**
 * Get EmailJS configuration status
 * @returns {Object} - Configuration status details
 */
export const getEmailConfigStatus = () => {
  const configured = isEmailConfigured();
  return {
    configured,
    serviceId: configured ? EMAIL_CONFIG.SERVICE_ID : 'Not configured',
    templateId: configured ? EMAIL_CONFIG.TEMPLATE_ID : 'Not configured',
    publicKey: configured ? '***' + EMAIL_CONFIG.PUBLIC_KEY.slice(-4) : 'Not configured',
  };
};

// Initialize EmailJS on module load
initializeEmailJS();
