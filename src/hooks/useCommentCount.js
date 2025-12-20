import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Hook to get real-time comment count for a task
 * @param {string} taskId - The task ID to get comment count for
 * @returns {number} commentCount - Number of comments (excluding deleted)
 */
export const useCommentCount = (taskId) => {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (!taskId) {
      setCommentCount(0);
      return;
    }

    const q = query(
      collection(db, 'task_comments'),
      where('taskId', '==', taskId),
      where('deleted', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommentCount(snapshot.size);
    }, (error) => {
      console.error('Error fetching comment count:', error);
      setCommentCount(0);
    });

    return () => unsubscribe();
  }, [taskId]);

  return commentCount;
};
