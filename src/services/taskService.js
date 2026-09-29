// Task Service - Handles all task-related Firebase operations
// CRUD operations for task management

import { 
  collection, 
  doc, 
  getDoc,
  addDoc,
  updateDoc, 
  deleteDoc,
  arrayRemove,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { runBoundedQuery } from '@/lib/firestoreQuery';
import { wouldCreateCycle, unfinishedBlockers } from '@/lib/dependencies';
import { sendCriticalTaskAlert } from './emailService';
import { deleteAllSubtasksForTask } from './subtaskService';
import { isFirestoreInternalAssertion, recoverFromFirestoreFailure } from '@/lib/firestoreRecovery';
import { getCallerProfile } from './userService';

// Collection reference
const TASKS_COLLECTION = 'tasks';

// Upper bound on how many tasks a single query returns. Chosen to comfortably
// cover a real org's active workload while preventing an unbounded scan.
const DEFAULT_TASK_LIMIT = 500;

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
 * @param {Object} filters - Optional filters (assignedTo, status, priority, createdBy,
 *   orgId, departmentId, departmentIds (array, matches any), projectId, projectIds (array, matches any))
 * @returns {Promise<Array>} Array of task objects
 */
export const getAllTasks = async (filters = {}) => {
  try {
    const constraints = [];

    if (filters.assignedTo) constraints.push(where('assignedTo', '==', filters.assignedTo));
    if (filters.status) constraints.push(where('status', '==', filters.status));
    if (filters.priority) constraints.push(where('priority', '==', filters.priority));
    if (filters.createdBy) constraints.push(where('createdBy', '==', filters.createdBy));
    if (filters.orgId) constraints.push(where('orgId', '==', filters.orgId));
    if (filters.departmentId) constraints.push(where('departmentId', '==', filters.departmentId));
    if (filters.projectId) constraints.push(where('projectId', '==', filters.projectId));

    // A list-valued filter (a department head's departments, a manager's
    // projects) may exceed Firestore's 10-value limit; runBoundedQuery splits it
    // into chunks instead of silently dropping everything past the tenth.
    let multi = null;
    if (filters.departmentIds?.length) {
      multi = { values: filters.departmentIds, build: (c) => where('departmentId', 'in', c) };
    }
    if (filters.projectIds?.length) {
      if (multi) constraints.push(where('projectId', 'in', filters.projectIds.slice(0, 10)));
      else multi = { values: filters.projectIds, build: (c) => where('projectId', 'in', c) };
    }

    // Always bound the read. Firestore bills per document returned, and an
    // unbounded collection scan gets slower and more expensive as the data
    // grows. Callers that need more can raise `limit` explicitly.
    const boundedAt = filters.limit ?? DEFAULT_TASK_LIMIT;
    const { docs, truncated } = await runBoundedQuery({
      collectionRef: collection(db, TASKS_COLLECTION),
      constraints,
      multi,
      boundedAt,
    });

    const tasks = docs.map((d) => ({ id: d.id, ...d.data() }));

    // Hitting the bound means there may be more rows this call never saw - the
    // org has outgrown a single unpaginated read. The rows returned are the
    // NEWEST ones (see runBoundedQuery). Flagged on the array itself (not thrown)
    // so a screen that cares can show it and one that doesn't is unaffected.
    tasks.truncated = truncated;

    return tasks;
  } catch (error) {
    console.error('Error getting tasks:', error);
    // Nearly every dashboard's task list passes through here, which makes
    // this (with getAllUsers) one of the two places most likely to actually
    // observe a poisoned Firestore client - see the note in
    // firestoreRecovery for why a global handler alone misses this.
    if (isFirestoreInternalAssertion(error)) recoverFromFirestoreFailure();
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
      startDate,
      deadline,
      createdBy,
      departmentId,
      projectId,
      blockedBy,
    } = taskData;
    let { orgId } = taskData;

    // Auto-stamp orgId from the creating user's own org when not explicitly
    // provided (defense in depth — TasksContext.createTask already sets it).
    if (orgId === undefined) {
      const caller = await getCallerProfile();
      if (caller && caller.role !== 'master-admin') orgId = caller.orgId;
    }

    const taskDoc = {
      title: title || '',
      description: description || '',
      assignedTo: assignedTo || null,
      priority: priority,
      status: status,
      startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
      deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
      createdBy: createdBy,
      ...(orgId !== undefined && { orgId }),
      ...(departmentId !== undefined && { departmentId }),
      ...(projectId !== undefined && { projectId }),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      completedAt: null,
      blockedBy: Array.isArray(blockedBy) ? blockedBy : [],
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
// Statuses that mean work has begun on a task.
const STARTED_STATUSES = new Set(['in-progress', 'review', 'completed']);

const taskError = (code, message) => Object.assign(new Error(message), { code });

// Dependencies are enforced here, in the one place every screen (list, Kanban,
// staff and admin dashboards, edit dialogs) goes through, rather than in each
// component. Previously only the staff dashboard checked, so an admin could
// drag a blocked task straight to Done.
const assertDependenciesAllow = async (taskId, currentTask, updates) => {
  if (Array.isArray(updates.blockedBy)) {
    const hasCycle = await wouldCreateCycle(taskId, updates.blockedBy, async (id) => {
      const t = await getTaskById(id).catch(() => null);
      return t?.blockedBy || [];
    });
    if (hasCycle) {
      throw taskError('dependency-cycle', 'That dependency would create a loop: a task cannot (indirectly) depend on itself.');
    }
  }

  const movingToStarted = updates.status && updates.status !== currentTask.status && STARTED_STATUSES.has(updates.status);
  if (movingToStarted) {
    const blockers = Array.isArray(updates.blockedBy) ? updates.blockedBy : (currentTask.blockedBy || []);
    if (blockers.length > 0) {
      const loaded = new Map();
      await Promise.all(blockers.map(async (id) => {
        loaded.set(id, await getTaskById(id).catch(() => null));
      }));
      const open = unfinishedBlockers(blockers, (id) => loaded.get(id));
      if (open.length > 0) {
        throw taskError('task-blocked', `This task is blocked: ${open.length} prerequisite task${open.length > 1 ? 's' : ''} must be completed first.`);
      }
    }
  }
};

export const updateTask = async (taskId, updates) => {
  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    
    // Get the current task data to check priority changes
    const currentTask = await getTaskById(taskId);
    if (!currentTask) throw taskError('task-not-found', 'This task no longer exists.');

    await assertDependenciesAllow(taskId, currentTask, updates);
    
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    // If status is changed to 'completed', set completedAt timestamp
    if (updates.status === 'completed' && !updates.completedAt) {
      updatedData.completedAt = Timestamp.now();
    } else if (updates.status && updates.status !== 'completed' && currentTask.status === 'completed') {
      // Reopened: it is no longer finished.
      updatedData.completedAt = null;
    }
    
    // Convert deadline to Timestamp if it's a string
    if (updates.deadline && typeof updates.deadline === 'string') {
      updatedData.deadline = Timestamp.fromDate(new Date(updates.deadline));
    }

    // Convert startDate to Timestamp if it's a string
    if (updates.startDate && typeof updates.startDate === 'string') {
      updatedData.startDate = Timestamp.fromDate(new Date(updates.startDate));
    }

    await updateDoc(taskRef, updatedData);
    
    // Return updated task
    const updatedTask = await getTaskById(taskId);
    
    // Send critical task alert if priority changed to critical
    if (updates.priority === 'critical' && currentTask.priority !== 'critical') {
      try {
        // Guard: only fetch if task has an assigned user
        if (updatedTask.assignedTo) {
          const userDoc = await getDoc(doc(db, 'users', updatedTask.assignedTo));
          const userData = userDoc.exists() ? userDoc.data() : null;
          
          if (userData && userData.email) {
            // createdBy is a uid; the email should say who, not a raw id.
            let assignedByName = 'Admin';
            if (currentTask.createdBy) {
              try {
                const creator = await getDoc(doc(db, 'users', currentTask.createdBy));
                assignedByName = creator.exists() ? (creator.data().name || 'Admin') : 'Admin';
              } catch { /* fall back to the generic label */ }
            }
            await sendCriticalTaskAlert({
              taskId,
              toEmail: userData.email,
              toName: userData.name || userData.email,
              taskTitle: updatedTask.title,
              taskDescription: updatedTask.description,
              dueDate: updatedTask.deadline?.toDate().toLocaleDateString() || 'Not set',
              assignedBy: assignedByName
            });
            console.log('Critical task alert sent to:', userData.email);
          }
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
export const deleteTask = async (taskId, { dependentTaskIds = [] } = {}) => {
  try {
    // First, delete all associated subtasks
    await deleteAllSubtasksForTask(taskId);

    // Anything that was waiting on this task must not keep a dangling
    // prerequisite. The caller passes the dependents it can see (a list query
    // for them would be refused by the rules for scoped roles); one that cannot
    // be updated is skipped rather than blocking the delete.
    await Promise.all(dependentTaskIds.map(async (depId) => {
      try {
        await updateDoc(doc(db, TASKS_COLLECTION, depId), {
          blockedBy: arrayRemove(taskId),
          updatedAt: Timestamp.now(),
        });
      } catch (e) {
        console.warn('Could not detach dependent task', depId, e?.code || e?.message);
      }
    }));
    
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
 * @param {Object} filters - Same shape as getAllTasks' filters (assignedTo, orgId,
 *   departmentIds, projectIds, etc). Pass {} for no scoping.
 * @returns {Promise<Object>} Task statistics
 */
export const getTaskStatistics = async (filters = {}) => {
  try {
    const tasks = await getAllTasks(filters);
    
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      review: tasks.filter(t => t.status === 'review').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
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

