import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Hook to get real-time subtask counts for a task
 * @param {string} taskId - The task ID to get subtask counts for
 * @returns {Object} { total, completed } - Total and completed subtask counts
 */
export const useSubtaskCount = (taskId) => {
  const [counts, setCounts] = useState({ total: 0, completed: 0 });

  useEffect(() => {
    if (!taskId) {
      setCounts({ total: 0, completed: 0 });
      return;
    }

    const q = query(
      collection(db, 'subtasks'),
      where('taskId', '==', taskId),
      where('deleted', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      let completed = 0;

      snapshot.forEach((doc) => {
        const subtask = doc.data();
        total++;
        if (subtask.completed) {
          completed++;
        }
      });

      setCounts({ total, completed });
    }, (error) => {
      console.error('Error fetching subtask count:', error);
      setCounts({ total: 0, completed: 0 });
    });

    return () => unsubscribe();
  }, [taskId]);

  return counts;
};
