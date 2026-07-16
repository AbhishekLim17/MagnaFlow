// taskStatusUtils.js
// Shared task status recompute logic — imported by both taskService.js and subtaskService.js
// This avoids the circular import where subtaskService dynamically imported taskService.

import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const TASKS_COLLECTION = 'tasks';

/**
 * Recompute and update task status based on subtask completion counts.
 * - all done → 'completed'
 * - some done → 'in-progress'
 * - none done → no change (leave as-is)
 * @param {string} taskId 
 * @param {number} completedCount 
 * @param {number} totalCount 
 */
export const recomputeTaskStatus = async (taskId, completedCount, totalCount) => {
  if (totalCount === 0) return;

  const taskRef = doc(db, TASKS_COLLECTION, taskId);

  if (completedCount === totalCount) {
    await updateDoc(taskRef, {
      status: 'completed',
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } else if (completedCount > 0) {
    await updateDoc(taskRef, {
      status: 'in-progress',
      updatedAt: Timestamp.now(),
    });
  }
};
