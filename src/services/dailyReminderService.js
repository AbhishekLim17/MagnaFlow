/**
 * Daily Reminder Service - FREE Solution
 * Uses localStorage to track last reminder sent and triggers when admin opens dashboard
 * No Cloud Functions needed - completely free!
 */

import { collection, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { sendCriticalTaskReminder } from './emailService';

const LAST_REMINDER_KEY = 'magnaflow_last_reminder_date';
const REMINDER_LOG_COLLECTION = 'reminder_logs';

/**
 * Calculate days pending since task creation
 */
const calculateDaysPending = (createdAt) => {
  if (!createdAt) return 0;
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Get today's date as YYYY-MM-DD string
 */
const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Check if reminders were already sent today
 */
const wasReminderSentToday = async () => {
  try {
    // Check localStorage first (fast)
    const lastReminderDate = localStorage.getItem(LAST_REMINDER_KEY);
    const today = getTodayDateString();
    
    if (lastReminderDate === today) {
      console.log('✅ Reminders already sent today (localStorage)');
      return true;
    }
    
    // Double-check with Firestore (reliable across devices)
    const logRef = doc(db, REMINDER_LOG_COLLECTION, today);
    const logDoc = await getDoc(logRef);
    
    if (logDoc.exists()) {
      console.log('✅ Reminders already sent today (Firestore)');
      // Update localStorage to match
      localStorage.setItem(LAST_REMINDER_KEY, today);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking reminder status:', error);
    // If error, assume not sent to be safe
    return false;
  }
};

/**
 * Mark today's reminders as sent
 */
const markRemindersSentToday = async (results) => {
  const today = getTodayDateString();
  
  try {
    // Save to localStorage
    localStorage.setItem(LAST_REMINDER_KEY, today);
    
    // Save to Firestore for cross-device sync
    const logRef = doc(db, REMINDER_LOG_COLLECTION, today);
    await setDoc(logRef, {
      date: today,
      timestamp: Timestamp.now(),
      totalTasks: results.total,
      emailsSent: results.sent,
      results: results.details || []
    });
    
    console.log('✅ Reminder status saved');
  } catch (error) {
    console.error('Error saving reminder status:', error);
  }
};

/**
 * Check current time and see if it's within reminder window (8 AM - 9 AM IST)
 */
const isWithinReminderWindow = () => {
  const now = new Date();
  const hour = now.getHours();
  
  // Check if between 8 AM and 9 AM (1 hour window)
  // Adjust this if you want different timing
  return hour >= 8 && hour < 9;
};

/**
 * Send daily reminders for critical incomplete tasks
 * This runs when admin opens dashboard, but only once per day
 */
export const checkAndSendDailyReminders = async (forceRun = false) => {
  try {
    console.log('🔔 Daily reminder check started...');
    
    // Check if already sent today
    if (!forceRun && await wasReminderSentToday()) {
      return {
        success: true,
        skipped: true,
        message: 'Reminders already sent today'
      };
    }
    
    // Optional: Only send during certain hours (comment out if you want it to run anytime)
    // if (!forceRun && !isWithinReminderWindow()) {
    //   console.log('⏰ Not within reminder window (8-9 AM). Skipping.');
    //   return {
    //     success: true,
    //     skipped: true,
    //     message: 'Outside reminder window'
    //   };
    // }
    
    console.log('📋 Querying critical incomplete tasks...');
    
    // Query critical tasks that are not completed
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('priority', '==', 'critical'),
      where('status', '!=', 'completed')
    );
    
    const tasksSnapshot = await getDocs(tasksQuery);
    
    if (tasksSnapshot.empty) {
      console.log('✅ No critical incomplete tasks found');
      
      await markRemindersSentToday({
        total: 0,
        sent: 0,
        details: []
      });
      
      return {
        success: true,
        total: 0,
        sent: 0,
        message: 'No critical tasks to remind'
      };
    }
    
    console.log(`📊 Found ${tasksSnapshot.size} critical incomplete tasks`);
    
    // Send reminders
    const results = [];
    let successCount = 0;
    
    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      
      try {
        // Get user details
        const userDoc = await getDoc(doc(db, 'users', task.assignedTo));
        
        if (!userDoc.exists()) {
          console.warn(`⚠️ User not found: ${task.assignedTo}`);
          results.push({
            taskId: taskDoc.id,
            taskTitle: task.title,
            status: 'failed',
            error: 'User not found'
          });
          continue;
        }
        
        const userData = userDoc.data();
        
        if (!userData.email) {
          console.warn(`⚠️ No email for user: ${task.assignedTo}`);
          results.push({
            taskId: taskDoc.id,
            taskTitle: task.title,
            status: 'failed',
            error: 'No email address'
          });
          continue;
        }
        
        console.log(`📧 Sending reminder to ${userData.email} for: ${task.title}`);
        
        // Send reminder with delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        
        await sendCriticalTaskReminder({
          toEmail: userData.email,
          toName: userData.name || userData.email,
          taskTitle: task.title,
          taskDescription: task.description || 'No description',
          dueDate: task.deadline?.toDate().toLocaleDateString() || 'Not set',
          daysPending: calculateDaysPending(task.createdAt)
        });
        
        console.log(`✅ Reminder sent to ${userData.email}`);
        successCount++;
        
        results.push({
          taskId: taskDoc.id,
          taskTitle: task.title,
          userEmail: userData.email,
          status: 'sent'
        });
        
      } catch (error) {
        console.error(`❌ Error sending reminder for task ${taskDoc.id}:`, error);
        results.push({
          taskId: taskDoc.id,
          taskTitle: task.title,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    // Mark as sent today
    await markRemindersSentToday({
      total: tasksSnapshot.size,
      sent: successCount,
      details: results
    });
    
    console.log(`🎯 Daily reminders complete: ${successCount}/${tasksSnapshot.size} sent`);
    
    return {
      success: true,
      total: tasksSnapshot.size,
      sent: successCount,
      failed: tasksSnapshot.size - successCount,
      results: results
    };
    
  } catch (error) {
    console.error('❌ Error in daily reminder service:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get last reminder log from Firestore
 */
export const getLastReminderLog = async () => {
  try {
    const today = getTodayDateString();
    const logRef = doc(db, REMINDER_LOG_COLLECTION, today);
    const logDoc = await getDoc(logRef);
    
    if (logDoc.exists()) {
      return {
        found: true,
        ...logDoc.data()
      };
    }
    
    return {
      found: false,
      message: 'No reminders sent today yet'
    };
  } catch (error) {
    console.error('Error getting reminder log:', error);
    return {
      found: false,
      error: error.message
    };
  }
};

/**
 * Manual trigger for testing (can be called from admin dashboard button)
 */
export const sendRemindersNow = async () => {
  console.log('🚀 Manual reminder trigger initiated');
  return await checkAndSendDailyReminders(true); // forceRun = true
};
