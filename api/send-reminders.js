// Vercel Serverless Function - Daily Critical Task Reminders
// Runs automatically at 8:00 AM IST via Vercel Cron
// 100% FREE - No Firebase Cloud Functions needed!

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import emailjs from '@emailjs/nodejs';

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// EmailJS configuration
const EMAILJS_CONFIG = {
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
};

const ADMIN_EMAILS = 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in';

/**
 * Send email via EmailJS
 */
async function sendReminderEmail(params) {
  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      {
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
      },
      EMAILJS_CONFIG
    );
    
    return { success: true, response };
  } catch (error) {
    console.error('EmailJS Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate days pending since task creation
 */
function calculateDaysPending(createdAt) {
  if (!createdAt) return 'Unknown';
  
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}

/**
 * Main handler function - triggered by Vercel Cron
 */
export default async function handler(req, res) {
  // Security: Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('🔔 Daily Critical Task Reminders - Cron Job Started');
  console.log('⏰ Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

  try {
    // Check if reminders already sent today
    const today = new Date().toISOString().split('T')[0];
    const logDoc = await db.collection('reminder_logs').doc(today).get();
    
    if (logDoc.exists) {
      console.log('✅ Reminders already sent today. Skipping.');
      return res.status(200).json({ 
        message: 'Reminders already sent today',
        skipped: true,
        date: today
      });
    }

    // Query all critical incomplete tasks
    console.log('📋 Querying critical tasks from Firestore...');
    const tasksSnapshot = await db
      .collection('tasks')
      .where('priority', '==', 'critical')
      .get();

    // Filter out completed tasks
    const criticalTasks = [];
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      if (task.status?.toLowerCase() !== 'completed') {
        criticalTasks.push({ id: doc.id, ...task });
      }
    });

    console.log(`📊 Found ${criticalTasks.length} critical incomplete tasks`);

    if (criticalTasks.length === 0) {
      // Log that check was performed
      await db.collection('reminder_logs').doc(today).set({
        date: today,
        timestamp: Timestamp.now(),
        totalTasks: 0,
        remindersSent: 0,
        executionTime: Date.now() - startTime,
        results: []
      });

      console.log('✅ No critical tasks found. Log saved.');
      return res.status(200).json({ 
        success: true,
        message: 'No critical tasks to remind',
        total: 0,
        sent: 0
      });
    }

    // Send reminder emails
    const results = [];
    let successCount = 0;

    for (const task of criticalTasks) {
      try {
        // Get user details
        const userDoc = await db.collection('users').doc(task.assignedTo).get();
        
        if (!userDoc.exists) {
          console.warn(`⚠️ User not found: ${task.assignedTo}`);
          results.push({
            taskId: task.id,
            taskTitle: task.title,
            status: 'failed',
            error: 'User not found'
          });
          continue;
        }

        const user = userDoc.data();

        if (!user.email) {
          console.warn(`⚠️ No email for user: ${task.assignedTo}`);
          results.push({
            taskId: task.id,
            taskTitle: task.title,
            status: 'failed',
            error: 'No email address'
          });
          continue;
        }

        console.log(`📧 Sending reminder to ${user.email} for task: ${task.title}`);

        // Send email
        const emailResult = await sendReminderEmail({
          toEmail: user.email,
          toName: user.name || user.email,
          taskTitle: task.title,
          taskDescription: task.description || 'No description provided',
          dueDate: task.deadline?.toDate?.().toLocaleDateString() || 'Not set',
          daysPending: calculateDaysPending(task.createdAt)
        });

        if (emailResult.success) {
          console.log(`✅ Reminder sent successfully to ${user.email}`);
          successCount++;
          results.push({
            taskId: task.id,
            taskTitle: task.title,
            userEmail: user.email,
            status: 'sent'
          });
        } else {
          console.error(`❌ Failed to send to ${user.email}:`, emailResult.error);
          results.push({
            taskId: task.id,
            taskTitle: task.title,
            userEmail: user.email,
            status: 'failed',
            error: emailResult.error
          });
        }

        // Rate limiting - 500ms delay between emails
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error processing task ${task.id}:`, error);
        results.push({
          taskId: task.id,
          taskTitle: task.title,
          status: 'failed',
          error: error.message
        });
      }
    }

    const executionTime = Date.now() - startTime;

    // Save log to Firestore
    await db.collection('reminder_logs').doc(today).set({
      date: today,
      timestamp: Timestamp.now(),
      totalTasks: criticalTasks.length,
      remindersSent: successCount,
      executionTime: executionTime,
      results: results
    });

    console.log(`🎯 Daily reminders complete: ${successCount}/${criticalTasks.length} sent`);
    console.log(`⏱️  Execution time: ${executionTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'Daily reminders sent',
      total: criticalTasks.length,
      sent: successCount,
      failed: criticalTasks.length - successCount,
      executionTime: executionTime,
      results: results
    });

  } catch (error) {
    console.error('❌ Critical error in cron job:', error);
    
    // Log error to Firestore
    try {
      const today = new Date().toISOString().split('T')[0];
      await db.collection('reminder_logs').doc(today).set({
        date: today,
        timestamp: Timestamp.now(),
        error: error.message,
        status: 'failed'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
