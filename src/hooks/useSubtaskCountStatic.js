import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Hook to get static subtask counts for a task (no real-time updates)
 * @param {string} taskId - The task ID to get subtask counts for
 * @returns {Object} { total, completed } - Subtask counts
 */
export const useSubtaskCountStatic = (taskId) => {
  const [counts, setCounts] = useState({ total: 0, completed: 0 });

  useEffect(() => {
    if (!taskId) {
      setCounts({ total: 0, completed: 0 });
      return;
    }

    const fetchCounts = async () => {
      try {
        // Note: Subtasks use hard deletion (deleteDoc), not soft deletion with a 'deleted' field
        const q = query(
          collection(db, 'subtasks'),
          where('taskId', '==', taskId)
        );
        const snapshot = await getDocs(q);
        
        let total = 0;
        let completed = 0;
        
        snapshot.forEach((doc) => {
          total++;
          if (doc.data().completed === true) {
            completed++;
          }
        });
        
        setCounts({ total, completed });
      } catch (error) {
        console.error('Error fetching subtask counts:', error);
        setCounts({ total: 0, completed: 0 });
      }
    };

    fetchCounts();
  }, [taskId]);

  return counts;
};
