/**
 * Serverless API endpoint for daily critical task reminders
 * Deploy to Vercel/Netlify/Railway (all have free tiers)
 * Then set up cron-job.org to call this URL daily at 8 AM IST
 */

import admin from 'firebase-admin';
import emailjs from '@emailjs/nodejs';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

// EmailJS config
const EMAILJS_CONFIG = {
  serviceId: process.env.EMAILJS_SERVICE_ID || 'service_itwo1ee',
  templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_mwmmgmi',
  publicKey: process.env.EMAILJS_PUBLIC_KEY || 'sLvBE12fOqa4zsra-',
  privateKey: process.env.EMAILJS_PRIVATE_KEY || '69niIwGWTQOzw0jwCVj3L',
};

const ADMIN_EMAILS = 'pankaj@magnetar.in, dhaval@magnetar.in, tejas@magnetar.in';

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
    message: '⚠️ Daily Reminder: You still have an incomplete CRITICAL task',
    
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
    footer_text: '⚠️ Daily reminder for your critical task.'
  };

  return await emailjs.send(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    emailData,
    {
      publicKey: EMAILJS_CONFIG.publicKey,
      privateKey: EMAILJS_CONFIG.privateKey,
    }
  );
}

export default async function handler(req, res) {
  // Security: Check for secret token to prevent unauthorized access
  const authToken = req.headers['authorization'] || req.query.token;
  const SECRET_TOKEN = process.env.CRON_SECRET || 'your-secret-token-here';
  
  if (authToken !== `Bearer ${SECRET_TOKEN}` && authToken !== SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔔 Starting daily critical task reminder check...');

  try {
    // Get all tasks
    const tasksSnapshot = await db.collection('tasks').get();
    const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter critical incomplete tasks (case-insensitive)
    const criticalTasks = allTasks.filter(task => 
      task.priority?.toLowerCase() === 'critical' && 
      task.status?.toLowerCase() !== 'completed'
    );

    console.log(`📊 Found ${criticalTasks.length} critical tasks`);

    if (criticalTasks.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No critical tasks found',
        tasksChecked: allTasks.length,
        remindersSent: 0
      });
    }

    // Send reminders
    const results = [];
    for (const task of criticalTasks) {
      try {
        // Get user
        const userDoc = await db.collection('users').doc(task.assignedTo).get();
        if (!userDoc.exists || !userDoc.data().email) {
          console.warn(`⚠️ No email for user ${task.assignedTo}`);
          continue;
        }

        const userData = userDoc.data();

        // Send email
        await sendCriticalTaskReminder({
          toEmail: userData.email,
          toName: userData.name || userData.email,
          taskTitle: task.title,
          taskDescription: task.description || 'No description',
          dueDate: task.dueDate || 'Not set',
          daysPending: calculateDaysPending(task.createdAt)
        });

        console.log(`✅ Sent to ${userData.email}`);
        results.push({ taskId: task.id, email: userData.email, success: true });

      } catch (error) {
        console.error(`❌ Failed for task ${task.id}:`, error);
        results.push({ taskId: task.id, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return res.status(200).json({
      success: true,
      message: `Reminders sent: ${successCount}/${criticalTasks.length}`,
      tasksChecked: allTasks.length,
      criticalTasks: criticalTasks.length,
      remindersSent: successCount,
      results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
