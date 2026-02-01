import { useState, useEffect } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Hook to get static comment count for a task (no real-time updates)
 * @param {string} taskId - The task ID to get comment count for
 * @returns {number} commentCount - Number of comments (excluding deleted)
 */
export const useCommentCountStatic = (taskId) => {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (!taskId) {
      setCommentCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const q = query(
          collection(db, 'task_comments'),
          where('taskId', '==', taskId),
          where('deleted', '==', false)
        );
        const snapshot = await getCountFromServer(q);
        setCommentCount(snapshot.data().count);
      } catch (error) {
        console.error('Error fetching comment count:', error);
        setCommentCount(0);
      }
    };

    fetchCount();
  }, [taskId]);

  return commentCount;
};
