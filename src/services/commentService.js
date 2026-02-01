import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Comment Service
 * Handles all comment-related operations for tasks
 */

// Create a new comment
export const createComment = async (taskId, userId, userName, userEmail, text, mentions = []) => {
  try {
    const commentData = {
      taskId,
      userId,
      userName,
      userEmail,
      text,
      mentions, // Array of user IDs who were @mentioned
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      edited: false,
      deleted: false
    };

    const docRef = await addDoc(collection(db, 'task_comments'), commentData);
    
    console.log('✅ Comment created successfully:', docRef.id);
    return { id: docRef.id, ...commentData };
  } catch (error) {
    console.error('❌ Error creating comment:', error);
    throw new Error(`Failed to create comment: ${error.message}`);
  }
};

// Update an existing comment
export const updateComment = async (commentId, text, mentions = []) => {
  try {
    const commentRef = doc(db, 'task_comments', commentId);
    
    await updateDoc(commentRef, {
      text,
      mentions,
      updatedAt: serverTimestamp(),
      edited: true
    });

    console.log('✅ Comment updated successfully:', commentId);
    return { id: commentId, text, mentions, edited: true };
  } catch (error) {
    console.error('❌ Error updating comment:', error);
    throw new Error(`Failed to update comment: ${error.message}`);
  }
};

// Soft delete a comment (mark as deleted instead of removing)
export const deleteComment = async (commentId) => {
  try {
    const commentRef = doc(db, 'task_comments', commentId);
    
    await updateDoc(commentRef, {
      deleted: true,
      text: '[Comment deleted]',
      updatedAt: serverTimestamp()
    });

    console.log('✅ Comment deleted successfully:', commentId);
    return { id: commentId, deleted: true };
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
};

// Get all comments for a task (real-time listener)
export const subscribeToComments = (taskId, callback) => {
  try {
    const q = query(
      collection(db, 'task_comments'),
      where('taskId', '==', taskId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        }))
        .filter(comment => !comment.deleted) // Filter deleted in JS
        .sort((a, b) => { // Sort in JS instead of Firestore
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return a.createdAt - b.createdAt;
        });

      console.log(`✅ Fetched ${comments.length} comments for task ${taskId}`);
      callback(comments);
    }, (error) => {
      console.error('❌ Error fetching comments:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error subscribing to comments:', error);
    throw new Error(`Failed to subscribe to comments: ${error.message}`);
  }
};

// Get comment count for a task
export const getCommentCount = async (taskId) => {
  try {
    const q = query(
      collection(db, 'task_comments'),
      where('taskId', '==', taskId),
      where('deleted', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('❌ Error getting comment count:', error);
    return 0;
  }
};

// Get a single comment by ID
export const getCommentById = async (commentId) => {
  try {
    const commentRef = doc(db, 'task_comments', commentId);
    const commentSnap = await getDoc(commentRef);

    if (commentSnap.exists()) {
      return {
        id: commentSnap.id,
        ...commentSnap.data(),
        createdAt: commentSnap.data().createdAt?.toDate(),
        updatedAt: commentSnap.data().updatedAt?.toDate()
      };
    } else {
      throw new Error('Comment not found');
    }
  } catch (error) {
    console.error('❌ Error getting comment:', error);
    throw new Error(`Failed to get comment: ${error.message}`);
  }
};

// Extract @mentions from text
export const extractMentions = (text) => {
  // Match @username pattern (alphanumeric + underscore)
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];
  return matches.map(match => match[1]); // Return array of usernames without @
};

// Get user IDs from usernames (for @mentions)
export const getUserIdsByUsernames = async (usernames) => {
  try {
    if (usernames.length === 0) return [];

    const usersRef = collection(db, 'users');
    const userIds = [];

    // Firestore doesn't support case-insensitive queries, so we fetch all users
    // and filter in-memory (for small user base this is acceptable)
    const snapshot = await getDocs(usersRef);
    
    snapshot.forEach(doc => {
      const userData = doc.data();
      const userName = userData.name?.toLowerCase() || '';
      
      // Check if any username matches (case-insensitive)
      if (usernames.some(username => userName.includes(username.toLowerCase()))) {
        userIds.push(doc.id);
      }
    });

    return userIds;
  } catch (error) {
    console.error('❌ Error getting user IDs:', error);
    return [];
  }
};

export default {
  createComment,
  updateComment,
  deleteComment,
  subscribeToComments,
  getCommentCount,
  getCommentById,
  extractMentions,
  getUserIdsByUsernames
};
