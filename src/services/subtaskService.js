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
  getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';

const SUBTASKS_COLLECTION = 'subtasks';

/**
 * Add a new subtask to a task
 * @param {string} taskId - Parent task ID
 * @param {string} title - Subtask title
 * @param {string} createdBy - User ID who created the subtask
 * @returns {Promise<string>} - Created subtask ID
 */
export const addSubtask = async (taskId, title, createdBy) => {
  try {
    if (!taskId || !title || !createdBy) {
      throw new Error('Missing required fields: taskId, title, or createdBy');
    }

    const subtaskData = {
      taskId,
      title: title.trim(),
      completed: false,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, SUBTASKS_COLLECTION), subtaskData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding subtask:', error);
    throw error;
  }
};

/**
 * Update a subtask
 * @param {string} subtaskId - Subtask ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateSubtask = async (subtaskId, updates) => {
  try {
    if (!subtaskId) {
      throw new Error('Subtask ID is required');
    }

    const subtaskRef = doc(db, SUBTASKS_COLLECTION, subtaskId);
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    await updateDoc(subtaskRef, updateData);
  } catch (error) {
    console.error('Error updating subtask:', error);
    throw error;
  }
};

/**
 * Toggle subtask completion status
 * Auto-completes parent task when all subtasks are done
 * @param {string} subtaskId - Subtask ID
 * @param {boolean} completed - New completion status
 * @param {string} taskId - Parent task ID (optional, for auto-completion)
 * @returns {Promise<void>}
 */
export const toggleSubtaskCompletion = async (subtaskId, completed, taskId = null) => {
  try {
    // Update the subtask first
    await updateSubtask(subtaskId, { completed });
    
    // Auto-complete parent task if all subtasks are now completed
    if (completed && taskId) {
      // Get fresh subtasks data after update
      const subtasks = await getSubtasks(taskId);
      const allCompleted = subtasks.every(s => s.completed);
      
      if (allCompleted && subtasks.length > 0) {
        // Import updateTask dynamically to avoid circular dependency
        const { updateTask } = await import('./taskService');
        await updateTask(taskId, { 
          status: 'completed',
          completedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error toggling subtask completion:', error);
    throw error;
  }
};

/**
 * Delete a subtask
 * @param {string} subtaskId - Subtask ID to delete
 * @returns {Promise<void>}
 */
export const deleteSubtask = async (subtaskId) => {
  try {
    if (!subtaskId) {
      throw new Error('Subtask ID is required');
    }

    const subtaskRef = doc(db, SUBTASKS_COLLECTION, subtaskId);
    await deleteDoc(subtaskRef);
  } catch (error) {
    console.error('Error deleting subtask:', error);
    throw error;
  }
};

/**
 * Get all subtasks for a task (one-time fetch)
 * @param {string} taskId - Parent task ID
 * @returns {Promise<Array>} - Array of subtasks
 */
export const getSubtasks = async (taskId) => {
  try {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const q = query(
      collection(db, SUBTASKS_COLLECTION),
      where('taskId', '==', taskId),
      orderBy('createdAt', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const subtasks = [];
    
    querySnapshot.forEach((doc) => {
      subtasks.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return subtasks;
  } catch (error) {
    console.error('Error getting subtasks:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time subtask updates for a task
 * @param {string} taskId - Parent task ID
 * @param {Function} callback - Callback function to receive subtasks
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToSubtasks = (taskId, callback) => {
  try {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const q = query(
      collection(db, SUBTASKS_COLLECTION),
      where('taskId', '==', taskId)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const subtasks = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Filter out deleted subtasks
          if (!data.deleted) {
            subtasks.push({
              id: doc.id,
              ...data
            });
          }
        });
        // Sort by createdAt in JavaScript instead of Firestore
        subtasks.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return a.createdAt.seconds - b.createdAt.seconds;
        });
        callback(subtasks);
      },
      (error) => {
        console.error('Error in subtasks subscription:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to subtasks:', error);
    throw error;
  }
};

/**
 * Calculate subtask completion percentage
 * @param {Array} subtasks - Array of subtasks
 * @returns {number} - Completion percentage (0-100)
 */
export const calculateSubtaskProgress = (subtasks) => {
  if (!subtasks || subtasks.length === 0) {
    return 0;
  }

  const completedCount = subtasks.filter(subtask => subtask.completed).length;
  return Math.round((completedCount / subtasks.length) * 100);
};

/**
 * Delete all subtasks for a task (cleanup when task is deleted)
 * @param {string} taskId - Parent task ID
 * @returns {Promise<void>}
 */
export const deleteAllSubtasksForTask = async (taskId) => {
  try {
    if (!taskId) {
      throw new Error('Task ID is required');
    }

    const q = query(
      collection(db, SUBTASKS_COLLECTION),
      where('taskId', '==', taskId)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = [];

    querySnapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, SUBTASKS_COLLECTION, docSnapshot.id)));
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting all subtasks for task:', error);
    throw error;
  }
};
