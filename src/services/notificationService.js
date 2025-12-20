import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Notification Service
 * Handles @mention notifications for task comments
 */

// Create notification for mentioned user
export const createNotification = async (userId, commentId, taskId, mentionedBy, mentionedByName) => {
  try {
    const notificationData = {
      userId, // User who was @mentioned
      commentId, // Comment that mentioned them
      taskId, // Task where comment was posted
      mentionedBy, // User ID who posted the comment
      mentionedByName, // Display name of user who mentioned
      read: false,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'comment_notifications'), notificationData);
    
    console.log('✅ Notification created successfully:', docRef.id);
    return { id: docRef.id, ...notificationData };
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

// Create notifications for multiple users (batch)
export const createNotificationsForMentions = async (mentionedUserIds, commentId, taskId, mentionedBy, mentionedByName) => {
  try {
    if (mentionedUserIds.length === 0) {
      console.log('No users to notify');
      return [];
    }

    // Filter out self-mentions (user mentioning themselves)
    const filteredUserIds = mentionedUserIds.filter(userId => userId !== mentionedBy);

    if (filteredUserIds.length === 0) {
      console.log('No valid users to notify (self-mentions filtered)');
      return [];
    }

    const batch = writeBatch(db);
    const notificationRefs = [];

    filteredUserIds.forEach(userId => {
      const notificationRef = doc(collection(db, 'comment_notifications'));
      batch.set(notificationRef, {
        userId,
        commentId,
        taskId,
        mentionedBy,
        mentionedByName,
        read: false,
        createdAt: serverTimestamp()
      });
      notificationRefs.push(notificationRef);
    });

    await batch.commit();
    console.log(`✅ Created ${filteredUserIds.length} notifications successfully`);
    
    return notificationRefs.map(ref => ({ id: ref.id }));
  } catch (error) {
    console.error('❌ Error creating batch notifications:', error);
    throw new Error(`Failed to create notifications: ${error.message}`);
  }
};

// Mark notification as read
export const markAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'comment_notifications', notificationId);
    
    await updateDoc(notificationRef, {
      read: true
    });

    console.log('✅ Notification marked as read:', notificationId);
    return { id: notificationId, read: true };
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
};

// Mark all notifications as read for a user
export const markAllAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, 'comment_notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, { read: true });
    });

    await batch.commit();
    console.log(`✅ Marked ${snapshot.size} notifications as read`);
    
    return { count: snapshot.size };
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    throw new Error(`Failed to mark all as read: ${error.message}`);
  }
};

// Get unread notification count for a user
export const getUnreadCount = async (userId) => {
  try {
    const q = query(
      collection(db, 'comment_notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
};

// Subscribe to unread notifications (real-time)
export const subscribeToUnreadNotifications = (userId, callback) => {
  try {
    const q = query(
      collection(db, 'comment_notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      console.log(`✅ Fetched ${notifications.length} unread notifications for user ${userId}`);
      callback(notifications);
    }, (error) => {
      console.error('❌ Error fetching notifications:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error subscribing to notifications:', error);
    throw new Error(`Failed to subscribe to notifications: ${error.message}`);
  }
};

// Get all notifications for a user (paginated)
export const getNotifications = async (userId, limit = 20) => {
  try {
    const q = query(
      collection(db, 'comment_notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const notifications = snapshot.docs
      .slice(0, limit)
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

    console.log(`✅ Fetched ${notifications.length} notifications for user ${userId}`);
    return notifications;
  } catch (error) {
    console.error('❌ Error getting notifications:', error);
    return [];
  }
};

// Send email notification via EmailJS
export const sendEmailNotification = async (toEmail, toName, mentionedByName, taskTitle, commentText, taskId) => {
  try {
    const emailData = {
      service_id: 'service_itwo1ee',
      template_id: 'template_mention', // You'll need to create this template
      user_id: 'hQcLVOWsSrnSqnRWY', // Your EmailJS user ID
      template_params: {
        to_email: toEmail,
        to_name: toName,
        mentioned_by: mentionedByName,
        task_title: taskTitle,
        comment_text: commentText,
        task_link: `https://magnaflow-07sep25.web.app/tasks/${taskId}`,
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      console.log('✅ Email notification sent successfully');
      return { success: true };
    } else {
      const error = await response.text();
      console.error('❌ EmailJS error:', error);
      throw new Error(`EmailJS error: ${error}`);
    }
  } catch (error) {
    console.error('❌ Error sending email notification:', error);
    // Don't throw error - email failure shouldn't break notification creation
    return { success: false, error: error.message };
  }
};

export default {
  createNotification,
  createNotificationsForMentions,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  subscribeToUnreadNotifications,
  getNotifications,
  sendEmailNotification
};
