import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToComments, getCommentCount } from '../../services/commentService';
import CommentsList from './CommentsList';
import CommentInput from './CommentInput';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CommentSection Component
 * Main container for task comments and attachments
 */
const CommentSection = ({ taskId, taskTitle }) => {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentCount, setCommentCount] = useState(0);

  // Subscribe to comments in real-time
  useEffect(() => {
    if (!taskId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToComments(
      taskId,
      (fetchedComments) => {
        setComments(fetchedComments);
        setCommentCount(fetchedComments.length);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [taskId]);

  if (!currentUser) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please login to view and post comments
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading comments: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with comment count */}
      <div className="flex items-center gap-2 border-b border-gray-700 pb-3">
        <MessageSquare className="w-5 h-5 text-gray-400" />
        <span className="font-semibold text-gray-200">
          Comments ({commentCount})
        </span>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <CommentsList 
            comments={comments} 
            currentUserId={currentUser.uid}
            taskId={taskId}
          />
        )}
      </div>

      {/* Comment Input */}
      <CommentInput
        taskId={taskId}
        taskTitle={taskTitle}
        userId={currentUser.uid}
        userName={currentUser.displayName || currentUser.email}
        userEmail={currentUser.email}
      />
    </div>
  );
};

export default CommentSection;
