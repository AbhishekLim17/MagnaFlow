// Reminder Service - Daily Critical Task Checker
// Checks and sends reminders for incomplete critical tasks
// FREE Solution: Triggers on admin login after 8 AM, sends once per day

import { collection, doc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getUserById } from './userService';
import { sendCriticalTaskReminder } from './emailService';

/**
 * Calculate days since task was created
 */
const calculateDaysPending = (createdAt) => {
  if (!createdAt) return 'Unknown';
  
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
};

/**
 * Group tasks by assigned user to send ONE email per user
 */
const groupTasksByUser = (tasks) => {
  const userTasks = {};
  
  tasks.forEach(task => {
    if (!task.assignedTo) return;
    
    if (!userTasks[task.assignedTo]) {
      userTasks[task.assignedTo] = [];
    }
    
    userTasks[task.assignedTo].push(task);
  });
  
  return userTasks;
};

/**
 * Check if reminders were already sent today
 */
const wasReminderSentToday = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const reminderDoc = await getDoc(doc(db, 'reminder_logs', today));
    return reminderDoc.exists();
  } catch (error) {
    console.error('Error checking reminder log:', error);
    return false;
  }
};

/**
 * Mark that reminders were sent today
 */
const markReminderSentToday = async (results) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await setDoc(doc(db, 'reminder_logs', today), {
      date: today,
      timestamp: new Date(),
      totalTasks: results.total,
      remindersSent: results.sent,
      results: results.results
    });
    console.log('✅ Reminder log saved to Firestore');
  } catch (error) {
    console.error('Error saving reminder log:', error);
  }
};

/**
 * Check if current time is after 8 AM today
 */
const isAfter8AM = () => {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 8; // After 8:00 AM
};

/**
 * Check all critical tasks and send reminders for incomplete ones
 */
export const checkAndSendCriticalReminders = async () => {
  try {
    console.log('🔔 Starting daily critical task reminder check...');
    
    // Get all critical incomplete tasks from Firestore
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('priority', '==', 'critical')
    );
    
    const tasksSnapshot = await getDocs(tasksQuery);
    const criticalIncompleteTasks = [];
    
    tasksSnapshot.forEach(taskDoc => {
      const task = taskDoc.data();
      // Filter out completed tasks
      if (task.status?.toLowerCase() !== 'completed') {
        criticalIncompleteTasks.push({ id: taskDoc.id, ...task });
      }
    });
    
    console.log(`📊 Found ${criticalIncompleteTasks.length} critical incomplete tasks`);
    
    if (criticalIncompleteTasks.length === 0) {
      console.log('✅ No critical incomplete tasks found. No reminders to send.');
      return { success: true, sent: 0, total: 0 };
    }
    
    // Group tasks by user to send ONE email per user (saves EmailJS credits!)
    const tasksByUser = groupTasksByUser(criticalIncompleteTasks);
    const userIds = Object.keys(tasksByUser);
    
    console.log(`👥 Sending reminders to ${userIds.length} users for ${criticalIncompleteTasks.length} total tasks`);
    
    const reminderResults = [];
    let totalEmailsSent = 0;
    
    // Send ONE email per user with ALL their critical tasks
    for (const userId of userIds) {
      try {
        const userTasks = tasksByUser[userId];
        const assignedUser = await getUserById(userId);
        
        if (!assignedUser || !assignedUser.email) {
          console.warn(`⚠️ No email found for user ${userId}. Skipping ${userTasks.length} task(s)`);
          reminderResults.push({
            userId,
            taskCount: userTasks.length,
            success: false,
            error: 'No user email found'
          });
          continue;
        }
        
        console.log(`📧 Sending 1 email to ${assignedUser.email} for ${userTasks.length} task(s)`);
        
        // Format tasks as a list string for email
        let taskListText = '';
        userTasks.forEach((task, index) => {
          const dueDate = task.deadline?.toDate?.().toLocaleDateString() || task.dueDate || 'Not set';
          const daysPending = calculateDaysPending(task.createdAt);
          
          taskListText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          taskListText += `📋 Task ${index + 1}: ${task.title}\n`;
          taskListText += `📝 Description: ${task.description || 'No description'}\n`;
          taskListText += `📊 Status: ${task.status || 'Pending'}\n`;
          taskListText += `📅 Due Date: ${dueDate}\n`;
          taskListText += `⏰ Days Pending: ${daysPending}\n`;
        });
        
        // Send ONE email with ALL tasks
        const emailResult = await sendCriticalTaskReminder({
          toEmail: assignedUser.email,
          toName: assignedUser.name || assignedUser.email,
          taskTitle: `${userTasks.length} Critical Task${userTasks.length !== 1 ? 's' : ''}`,
          taskDescription: `You have ${userTasks.length} critical task${userTasks.length !== 1 ? 's' : ''} that require immediate attention:${taskListText}`,
          dueDate: 'See individual tasks above',
          daysPending: `${userTasks.length} task${userTasks.length !== 1 ? 's' : ''} pending`
        });
        
        if (emailResult.success) {
          totalEmailsSent++;
          console.log(`✅ Sent 1 email covering ${userTasks.length} task(s) to ${assignedUser.email}`);
        } else {
          console.error(`❌ Failed to send email to ${assignedUser.email}`, emailResult.error);
        }
        
        reminderResults.push({
          userId,
          userEmail: assignedUser.email,
          taskCount: userTasks.length,
          taskTitles: userTasks.map(t => t.title),
          success: emailResult.success
        });
        
        // Delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        reminderResults.push({
          userId,
          taskCount: tasksByUser[userId].length,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`🎯 Reminder check complete: ${totalEmailsSent} email(s) sent for ${criticalIncompleteTasks.length} total task(s)`);
    
    return {
      success: true,
      total: criticalIncompleteTasks.length,
      sent: totalEmailsSent,
      users: userIds.length,
      results: reminderResults
    };
    
  } catch (error) {
    console.error('❌ Error in critical task reminder service:', error);
    return {
      success: false,
      error: error.message,
      sent: 0,
      total: 0
    };
  }
};

/**
 * ✨ SMART AUTO-CHECK: Sends reminders automatically on first admin login after 8 AM
 * 
 * How it works:
 * 1. Admin logs in at any time (e.g., 9 AM, 10 AM, 2 PM)
 * 2. Function checks: "Did we send reminders today?"
 * 3. If NO and it's after 8 AM → Send reminders automatically
 * 4. If YES → Skip (already sent today)
 * 
 * This guarantees reminders are sent once per day, completely FREE!
 */
export const autoCheckAndSendReminders = async () => {
  try {
    // Check if it's after 8 AM
    if (!isAfter8AM()) {
      console.log('⏰ Not yet 8 AM. Skipping reminder check.');
      return { skipped: true, reason: 'Before 8 AM' };
    }
    
    // Check if reminders were already sent today
    const alreadySent = await wasReminderSentToday();
    
    if (alreadySent) {
      console.log('✅ Reminders already sent today. Skipping.');
      return { skipped: true, reason: 'Already sent today' };
    }
    
    // Send reminders
    console.log('🚀 Sending daily reminders (first login after 8 AM)...');
    const results = await checkAndSendCriticalReminders();
    
    // Mark as sent today
    if (results.success) {
      await markReminderSentToday(results);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Error in auto reminder check:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Manual trigger for testing - bypasses "already sent today" check
 */
export const manualTriggerReminders = async () => {
  console.log('🔧 Manual reminder trigger activated...');
  const results = await checkAndSendCriticalReminders();
  
  if (results.success) {
    await markReminderSentToday(results);
  }
  
  return results;
};
