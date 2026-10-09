import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendMentionEmail } from './emailService';
import { safeListen } from '@/lib/safeUnsubscribe';

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
export const createNotificationsForMentions = async (mentionedUserIds, commentId, taskId, mentionedBy, mentionedByName, extra = {}) => {
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
        // What the notification is about, so the bell can say more than "mentioned you".
        taskTitle: extra.taskTitle ? String(extra.taskTitle).slice(0, 200) : null,
        excerpt: extra.excerpt ? String(extra.excerpt).slice(0, 160) : null,
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

/**
 * Tell a task's watchers (in the bell) that its status changed or someone commented.
 * @param {string[]} recipients uids (see lib/watchers watcherRecipients)
 * @param {{ type: 'watch_status'|'watch_comment', taskId: string, taskTitle?: string,
 *           status?: string, excerpt?: string, actorUid: string, actorName?: string }} what
 */
export const notifyWatchers = async (recipients, what) => {
  if (!recipients.length) return;
  const batch = writeBatch(db);
  recipients.forEach((userId) => {
    batch.set(doc(collection(db, 'comment_notifications')), {
      userId,
      type: what.type,
      taskId: what.taskId,
      taskTitle: what.taskTitle ? String(what.taskTitle).slice(0, 200) : null,
      status: what.status || null,
      excerpt: what.excerpt ? String(what.excerpt).slice(0, 160) : null,
      mentionedBy: what.actorUid,
      mentionedByName: what.actorName || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
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

    const unsubscribe = safeListen(() => onSnapshot(q, (snapshot) => {
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
    }));

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error subscribing to notifications:', error);
    throw new Error(`Failed to subscribe to notifications: ${error.message}`);
  }
};

// Get all notifications for a user (paginated)
export const getNotifications = async (userId, limitCount = 20) => {
  try {
    const q = query(
      collection(db, 'comment_notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map(doc => ({
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

// Send email notification for @mention — routes through emailService.js
export const sendEmailNotification = async (toUid, mentionedByName, taskTitle, commentText, taskId) => {
  try {
    return await sendMentionEmail({
      toUid,
      taskTitle,
      commentText,
      mentionedBy: mentionedByName,
      taskId,
    });
  } catch (error) {
    console.error('❌ Error sending mention email notification:', error);
    return { success: false, error: error.message };
  }
};

const notificationService = {
  createNotification,
  createNotificationsForMentions,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  subscribeToUnreadNotifications,
  getNotifications,
  sendEmailNotification
};

export default notificationService;
