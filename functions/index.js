/**
 * Cloud Functions for MagnaFlow
 * Scheduled daily reminder for critical tasks at 8 AM IST
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { EmailJSResponseStatus } = require('@emailjs/nodejs');

// Initialize Firebase Admin
admin.initializeApp();

// EmailJS Configuration
// IMPORTANT: Set these via Firebase CLI:
// firebase functions:config:set emailjs.service_id="service_itwo1ee"
// firebase functions:config:set emailjs.template_id="template_mwmmgmi"
// firebase functions:config:set emailjs.public_key="sLvBE12fOqa4zsra-"
// firebase functions:config:set emailjs.private_key="YOUR_PRIVATE_KEY"

const ADMIN_EMAILS = 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in';

/**
 * Send email via EmailJS
 * @param {Object} emailData - Email parameters
 * @returns {Promise} EmailJS response
 */
async function sendEmail(emailData) {
  const emailjs = require('@emailjs/nodejs');
  
  const config = functions.config().emailjs;
  if (!config || !config.service_id || !config.public_key || !config.private_key) {
    throw new Error('EmailJS configuration not set. Run: firebase functions:config:set emailjs.service_id="..." emailjs.public_key="..." emailjs.private_key="..."');
  }

  try {
    const response = await emailjs.send(
      config.service_id,
      config.template_id,
      emailData,
      {
        publicKey: config.public_key,
        privateKey: config.private_key,
      }
    );
    
    console.log('Email sent successfully:', response.status, response.text);
    return response;
  } catch (error) {
    if (error instanceof EmailJSResponseStatus) {
      console.error('EmailJS Error:', error.status, error.text);
    } else {
      console.error('Email Error:', error);
    }
    throw error;
  }
}

/**
 * Calculate days pending since task creation
 * @param {FirebaseFirestore.Timestamp} createdAt - Task creation timestamp
 * @returns {number} Days pending
 */
function calculateDaysPending(createdAt) {
  if (!createdAt) return 0;
  const now = new Date();
  const created = createdAt.toDate();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Send daily critical task reminder
 * Scheduled to run every day at 8:00 AM IST (Asia/Kolkata)
 */
exports.sendDailyCriticalTaskReminders = functions
  .region('asia-south1') // Mumbai region for better latency in India
  .pubsub
  .schedule('0 8 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    console.log('Starting daily critical task reminders at', new Date().toISOString());

    try {
      const db = admin.firestore();
      
      // Get all tasks (can't use case-insensitive query with Firestore)
      const allTasksSnapshot = await db.collection('tasks').get();
      
      // Filter for critical tasks that are not completed (case-insensitive)
      const criticalTasks = allTasksSnapshot.docs.filter(doc => {
        const task = doc.data();
        const isCritical = task.priority?.toLowerCase() === 'critical';
        const isNotCompleted = task.status?.toLowerCase() !== 'completed';
        return isCritical && isNotCompleted;
      });

      if (criticalTasks.length === 0) {
        console.log('No critical incomplete tasks found');
        return null;
      }

      console.log(`Found ${criticalTasks.length} critical tasks`);

      // Process each task
      const emailPromises = [];
      
      for (const taskDoc of criticalTasks) {
        const task = taskDoc.data();
        
        try {
          // Get assigned user details
          const userDoc = await db.collection('users').doc(task.assignedTo).get();
          
          if (!userDoc.exists) {
            console.warn(`User not found for task ${taskDoc.id}, assignedTo: ${task.assignedTo}`);
            continue;
          }

          const userData = userDoc.data();
          
          if (!userData.email) {
            console.warn(`No email found for user ${task.assignedTo}`);
            continue;
          }

          // Prepare email data
          const emailData = {
            to_email: userData.email,
            to_name: userData.name || userData.email,
            cc_email: ADMIN_EMAILS,
            notification_type: 'REMINDER: Critical Task',
            notification_icon: '⏰',
            notification_color: '#ef4444',
            title: task.title,
            message: '⚠️ Daily Reminder: You still have an incomplete CRITICAL task that requires immediate attention',
            
            detail_1_label: 'Task',
            detail_1_value: task.title,
            detail_2_label: 'Description',
            detail_2_value: task.description || 'No description',
            detail_3_label: 'Priority',
            detail_3_value: '🔴 CRITICAL',
            detail_4_label: 'Due Date',
            detail_4_value: task.deadline ? task.deadline.toDate().toLocaleDateString() : 'Not set',
            detail_5_label: 'Days Pending',
            detail_5_value: `${calculateDaysPending(task.createdAt)} days`,
            
            button_text: 'View Task Now',
            button_link: 'https://magnaflow-07sep25.web.app',
            
            footer_text: '⚠️ This is a daily reminder for your critical task. Please complete it as soon as possible.'
          };

          // Add to promises array with delay to avoid rate limiting
          emailPromises.push(
            new Promise((resolve) => {
              setTimeout(async () => {
                try {
                  await sendEmail(emailData);
                  console.log(`Reminder sent to ${userData.email} for task: ${task.title}`);
                  
                  // Log to Firestore
                  await db.collection('email_logs').add({
                    type: 'critical_reminder',
                    taskId: taskDoc.id,
                    recipientEmail: userData.email,
                    status: 'sent',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    error: null
                  });
                  
                  resolve(true);
                } catch (error) {
                  console.error(`Failed to send reminder to ${userData.email}:`, error);
                  
                  // Log error to Firestore
                  await db.collection('email_logs').add({
                    type: 'critical_reminder',
                    taskId: taskDoc.id,
                    recipientEmail: userData.email,
                    status: 'failed',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    error: error.message
                  });
                  
                  resolve(false);
                }
              }, emailPromises.length * 500); // 500ms delay between emails to avoid rate limiting
            })
          );

        } catch (error) {
          console.error(`Error processing task ${taskDoc.id}:`, error);
        }
      }

      // Wait for all emails to be sent
      const results = await Promise.all(emailPromises);
      const successCount = results.filter(r => r === true).length;
      
      console.log(`Daily reminder complete: ${successCount}/${criticalTasks.length} emails sent successfully`);
      
      return {
        totalTasks: criticalTasks.length,
        emailsSent: successCount,
        emailsFailed: criticalTasks.length - successCount
      };

    } catch (error) {
      console.error('Error in daily critical task reminders:', error);
      throw error;
    }
  });

/**
 * Manual trigger for testing (optional)
 * Call this via Firebase Console or CLI to test without waiting for scheduled time
 */
exports.testDailyCriticalTaskReminders = functions
  .region('asia-south1')
  .https
  .onRequest(async (req, res) => {
    try {
      console.log('Manual test trigger started');
      
      // Call the scheduled function logic
      const result = await exports.sendDailyCriticalTaskReminders.run();
      
      res.status(200).json({
        success: true,
        message: 'Test reminders sent',
        result: result
      });
    } catch (error) {
      console.error('Test trigger error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
