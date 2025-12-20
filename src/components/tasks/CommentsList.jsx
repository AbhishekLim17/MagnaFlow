import { motion, AnimatePresence } from 'framer-motion';
import CommentItem from './CommentItem';

/**
 * CommentsList Component
 * Displays list of comments with animations
 */
const CommentsList = ({ comments, currentUserId, taskId }) => {
  if (!comments || comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No comments yet. Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {comments.map((comment, index) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ 
              duration: 0.2,
              delay: index * 0.05 // Stagger animation
            }}
          >
            <CommentItem
              comment={comment}
              currentUserId={currentUserId}
              taskId={taskId}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CommentsList;
