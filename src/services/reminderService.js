// Reminder Service - Daily Critical Task Checker
// Checks and sends reminders for incomplete critical tasks

import { getAllTasks } from './taskService';
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
 * Check all critical tasks and send reminders for incomplete ones
 */
export const checkAndSendCriticalReminders = async () => {
  try {
    console.log('🔔 Starting daily critical task reminder check...');
    
    // Get all tasks
    const allTasks = await getAllTasks();
    console.log(`📋 Total tasks loaded: ${allTasks.length}`);
    
    // Debug: Show all tasks with their priority
    allTasks.forEach(task => {
      console.log(`Task: "${task.title}" | Priority: "${task.priority}" | Status: "${task.status}"`);
    });
    
    // Filter for critical tasks that are not completed (case-insensitive)
    const criticalIncompleteTasks = allTasks.filter(task => 
      task.priority?.toLowerCase() === 'critical' && 
      task.status?.toLowerCase() !== 'completed'
    );
    
    console.log(`📊 Found ${criticalIncompleteTasks.length} critical incomplete tasks`);
    
    if (criticalIncompleteTasks.length === 0) {
      console.log('✅ No critical incomplete tasks found. No reminders to send.');
      return { success: true, sent: 0, total: 0 };
    }
    
    // Send reminder for each critical task
    const reminderResults = [];
    
    for (const task of criticalIncompleteTasks) {
      try {
        // Get assigned user details
        const assignedUser = await getUserById(task.assignedTo);
        
        if (!assignedUser || !assignedUser.email) {
          console.warn(`⚠️ No email found for user ${task.assignedTo}. Skipping task: ${task.title}`);
          continue;
        }
        
        console.log(`📧 Sending reminder to ${assignedUser.email} for task: ${task.title}`);
        
        // Send reminder email
        const emailResult = await sendCriticalTaskReminder({
          toEmail: assignedUser.email,
          toName: assignedUser.name || assignedUser.email,
          taskTitle: task.title,
          taskDescription: task.description || 'No description provided',
          dueDate: task.dueDate || 'Not specified',
          daysPending: calculateDaysPending(task.createdAt)
        });
        
        reminderResults.push({
          taskId: task.id,
          taskTitle: task.title,
          userEmail: assignedUser.email,
          success: emailResult.success
        });
        
        if (emailResult.success) {
          console.log(`✅ Reminder sent successfully for task: ${task.title}`);
        } else {
          console.error(`❌ Failed to send reminder for task: ${task.title}`, emailResult.error);
        }
        
      } catch (error) {
        console.error(`❌ Error processing task ${task.id}:`, error);
        reminderResults.push({
          taskId: task.id,
          taskTitle: task.title,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = reminderResults.filter(r => r.success).length;
    console.log(`🎯 Reminder check complete: ${successCount}/${reminderResults.length} reminders sent successfully`);
    
    return {
      success: true,
      totalCriticalTasks: criticalIncompleteTasks.length,
      remindersSent: successCount,
      sent: successCount,
      total: criticalIncompleteTasks.length,
      results: reminderResults
    };
    
  } catch (error) {
    console.error('❌ Error in critical task reminder service:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Set up automatic daily reminders
 * Runs every 24 hours starting from current time
 */
export const setupDailyReminders = () => {
  // Run check immediately on setup
  checkAndSendCriticalReminders();
  
  // Set up interval for daily checks (24 hours = 86400000 milliseconds)
  const reminderInterval = setInterval(() => {
    checkAndSendCriticalReminders();
  }, 86400000); // 24 hours
  
  console.log('✅ Daily critical task reminders scheduled (every 24 hours)');
  
  // Return cleanup function
  return () => {
    clearInterval(reminderInterval);
    console.log('🛑 Daily reminders stopped');
  };
};

/**
 * Set up reminders to run at specific time daily (e.g., 9 AM)
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @param {number} minute - Minute (0-59)
 */
export const setupDailyRemindersAtTime = (hour = 9, minute = 0) => {
  const scheduleNextRun = () => {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);
    
    // If scheduled time already passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeUntilRun = scheduledTime - now;
    
    console.log(`⏰ Next critical task reminder check scheduled for: ${scheduledTime.toLocaleString()}`);
    
    return setTimeout(() => {
      checkAndSendCriticalReminders();
      // Schedule next run
      scheduleNextRun();
    }, timeUntilRun);
  };
  
  // Schedule first run
  const timeoutId = scheduleNextRun();
  
  // Return cleanup function
  return () => {
    clearTimeout(timeoutId);
    console.log('🛑 Scheduled daily reminders stopped');
  };
};
