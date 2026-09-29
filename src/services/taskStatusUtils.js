// taskStatusUtils.js
// Shared task status recompute logic — imported by both taskService.js and subtaskService.js
// This avoids the circular import where subtaskService dynamically imported taskService.

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { unfinishedBlockers } from '../lib/dependencies';

const TASKS_COLLECTION = 'tasks';

/**
 * Decide the parent task's status from its subtask counts. Pure, so it can be
 * tested without Firestore. Returns the new status, or null for "no change".
 *
 *  - all subtasks done  -> 'completed' (unless the task is still blocked by an
 *    unfinished prerequisite, in which case it is at most 'in-progress')
 *  - some done          -> 'in-progress' (from pending), and a completed task
 *    that has regained open work is reopened
 *  - none done          -> a completed task drops back to 'pending'
 *  - cancelled tasks are never touched
 *
 * The old version only ever moved forward: unticking a subtask of a completed
 * task, or adding a new one, left the task marked Done.
 */
export const nextStatusFromSubtasks = (currentStatus, completedCount, totalCount, { blocked = false } = {}) => {
  if (totalCount === 0 || currentStatus === 'cancelled') return null;

  if (completedCount === totalCount) {
    if (currentStatus === 'completed') return null;
    if (blocked) return currentStatus === 'pending' ? 'in-progress' : null;
    return 'completed';
  }

  if (currentStatus === 'completed') return completedCount > 0 ? 'in-progress' : 'pending';
  if (completedCount > 0 && currentStatus === 'pending') return 'in-progress';
  return null;
};

/**
 * Recompute and persist a task's status from its subtask completion counts.
 * @param {string} taskId
 * @param {number} completedCount
 * @param {number} totalCount
 */
export const recomputeTaskStatus = async (taskId, completedCount, totalCount) => {
  if (totalCount === 0) return;

  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const task = snap.data();

  // Finishing every subtask must not bypass the task's own prerequisites.
  let blocked = false;
  if (completedCount === totalCount && Array.isArray(task.blockedBy) && task.blockedBy.length > 0) {
    const deps = new Map();
    await Promise.all(task.blockedBy.map(async (id) => {
      try {
        const dep = await getDoc(doc(db, TASKS_COLLECTION, id));
        deps.set(id, dep.exists() ? dep.data() : null);
      } catch {
        deps.set(id, null);
      }
    }));
    blocked = unfinishedBlockers(task.blockedBy, (id) => deps.get(id)).length > 0;
  }

  const next = nextStatusFromSubtasks(task.status, completedCount, totalCount, { blocked });
  if (!next) return;

  const patch = { status: next, updatedAt: Timestamp.now() };
  if (next === 'completed') patch.completedAt = Timestamp.now();
  else if (task.status === 'completed') patch.completedAt = null;
  await updateDoc(taskRef, patch);
};
