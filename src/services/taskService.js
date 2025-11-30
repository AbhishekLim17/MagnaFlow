// Task Service - Handles all task-related Firebase operations
// CRUD operations for task management

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { sendCriticalTaskAlert } from './emailService';
import { deleteAllSubtasksForTask } from './subtaskService';

// Collection reference
const TASKS_COLLECTION = 'tasks';

/**
 * Get task by ID
 * @param {string} taskId - Task ID
 * @returns {Promise<Object|null>} Task data or null
 */
export const getTaskById = async (taskId) => {
  try {
    const taskDoc = await getDoc(doc(db, TASKS_COLLECTION, taskId));
    if (taskDoc.exists()) {
      return { id: taskDoc.id, ...taskDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting task:', error);
    throw error;
  }
};

/**
 * Get all tasks with optional filters
 * @param {Object} filters - Optional filters (assignedTo, status, priority, createdBy)
 * @returns {Promise<Array>} Array of task objects
 */
export const getAllTasks = async (filters = {}) => {
  try {
    const constraints = [];
    
    // Apply filters
    if (filters.assignedTo) {
      constraints.push(where('assignedTo', '==', filters.assignedTo));
    }
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }
    if (filters.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }
    
    // Only use orderBy when there are no filters to avoid composite index requirement
    // When filters are present, sort in memory instead
    if (constraints.length === 0) {
      constraints.push(orderBy('createdAt', 'desc'));
    }
    
    const q = query(collection(db, TASKS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);
    
    const tasks = [];
    snapshot.forEach((doc) => {
      tasks.push({ id: doc.id, ...doc.data() });
    });
    
    // If we have filters, sort in memory by createdAt (newest first)
    if (constraints.length > 0 && !constraints.some(c => c.type === 'orderBy')) {
      tasks.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime; // desc order
      });
    }
    
    return tasks;
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }
};

/**
 * Get tasks assigned to a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of assigned tasks
 */
export const getTasksForUser = async (userId) => {
  try {
    return await getAllTasks({ assignedTo: userId });
  } catch (error) {
    console.error('Error getting tasks for user:', error);
    throw error;
  }
};

/**
 * Create a new task
 * @param {Object} taskData - Task data (title, description, assignedTo, priority, status, deadline, createdBy)
 * @returns {Promise<Object>} Created task data
 */
export const createTask = async (taskData) => {
  try {
    const {
      title,
      description,
      assignedTo,
      priority = 'medium',
      status = 'pending',
      deadline,
      createdBy,
    } = taskData;
    
    const taskDoc = {
      title: title || '',
      description: description || '',
      assignedTo: assignedTo || null,
      priority: priority,
      status: status,
      deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
      createdBy: createdBy,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      completedAt: null,
    };
    
    const docRef = await addDoc(collection(db, TASKS_COLLECTION), taskDoc);
    
    return { id: docRef.id, ...taskDoc };
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

/**
 * Update task information
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated task data
 */
export const updateTask = async (taskId, updates) => {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    
    // Get the current task data to check priority changes
    const currentTask = await getTaskById(taskId);
    
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    // If status is changed to 'completed', set completedAt timestamp
    if (updates.status === 'completed' && !updates.completedAt) {
      updatedData.completedAt = Timestamp.now();
    }
    
    // Convert deadline to Timestamp if it's a string
    if (updates.deadline && typeof updates.deadline === 'string') {
      updatedData.deadline = Timestamp.fromDate(new Date(updates.deadline));
    }
    
    await updateDoc(taskRef, updatedData);
    
    // Return updated task
    const updatedTask = await getTaskById(taskId);
    
    // Send critical task alert if priority changed to critical
    if (updates.priority === 'critical' && currentTask.priority !== 'critical') {
      try {
        // Get assigned user details from Firestore users collection
        const userDoc = await getDoc(doc(db, 'users', updatedTask.assignedTo));
        const userData = userDoc.data();
        
        if (userData && userData.email) {
          await sendCriticalTaskAlert({
            toEmail: userData.email,
            toName: userData.name || userData.email,
            taskTitle: updatedTask.title,
            taskDescription: updatedTask.description,
            dueDate: updatedTask.deadline?.toDate().toLocaleDateString() || 'Not set',
            assignedBy: currentTask.createdBy || 'Admin'
          });
          console.log('Critical task alert sent to:', userData.email);
        }
      } catch (emailError) {
        console.error('Error sending critical task alert:', emailError);
        // Don't throw error - task update should succeed even if email fails
      }
    }
    
    return updatedTask;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

/**
 * Delete a task
 * @param {string} taskId - Task ID
 * @returns {Promise<void>}
 */
export const deleteTask = async (taskId) => {
  try {
    // First, delete all associated subtasks
    await deleteAllSubtasksForTask(taskId);
    
    // Then delete the task itself
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    console.log('Task deleted:', taskId);
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

/**
 * Update task status
 * @param {string} taskId - Task ID
 * @param {string} status - New status (pending, in-progress, completed)
 * @returns {Promise<Object>} Updated task data
 */
export const updateTaskStatus = async (taskId, status) => {
  try {
    return await updateTask(taskId, { status });
  } catch (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
};

/**
 * Get task statistics
 * @param {string} userId - Optional user ID to filter by
 * @returns {Promise<Object>} Task statistics
 */
export const getTaskStatistics = async (userId = null) => {
  try {
    const filters = userId ? { assignedTo: userId } : {};
    const tasks = await getAllTasks(filters);
    
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      byPriority: {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length,
        critical: tasks.filter(t => t.priority === 'critical').length,
      },
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting task statistics:', error);
    throw error;
  }
};

/**
 * Get tasks created by a specific user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of tasks
 */
export const getTasksCreatedBy = async (userId) => {
  try {
    return await getAllTasks({ createdBy: userId });
  } catch (error) {
    console.error('Error getting tasks created by user:', error);
    throw error;
  }
};
