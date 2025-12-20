import { useState } from 'react';
import { createComment, extractMentions, getUserIdsByUsernames } from '../../services/commentService';
import { createNotificationsForMentions, sendEmailNotification } from '../../services/notificationService';
import { Send } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * CommentInput Component
 * Textarea for posting new comments with @mention support
 */
const CommentInput = ({ taskId, taskTitle, userId, userName, userEmail }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const maxLength = 5000;
  const remainingChars = maxLength - text.length;

  // Handle comment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Extract @mentions from text
      const mentionedUsernames = extractMentions(text);
      
      // Get user IDs for mentioned usernames
      const mentionedUserIds = mentionedUsernames.length > 0 
        ? await getUserIdsByUsernames(mentionedUsernames)
        : [];

      // Create comment
      const newComment = await createComment(
        taskId,
        userId,
        userName,
        userEmail,
        text,
        mentionedUserIds
      );

      console.log('✅ Comment created:', newComment.id);

      // Create notifications for @mentioned users
      if (mentionedUserIds.length > 0) {
        try {
          await createNotificationsForMentions(
            mentionedUserIds,
            newComment.id,
            taskId,
            userId,
            userName
          );

          console.log(`✅ Created notifications for ${mentionedUserIds.length} users`);

          // Send email notifications (don't wait for completion)
          mentionedUserIds.forEach(async (mentionedUserId) => {
            // TODO: Get user email from Firestore users collection
            // For now, we'll skip email notification or implement in next iteration
            console.log(`📧 Would send email to user ${mentionedUserId}`);
          });
        } catch (notifError) {
          console.error('⚠️ Failed to create notifications:', notifError);
          // Don't fail the whole operation if notifications fail
        }
      }

      // Clear input
      setText('');
    } catch (err) {
      console.error('❌ Error creating comment:', err);
      setError('Failed to post comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment... Use @username to mention someone"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          rows="3"
          maxLength={maxLength}
          disabled={loading}
        />
        
        {/* Character counter */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {remainingChars} characters remaining
        </div>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          💡 Tip: Use <span className="font-mono bg-gray-100 px-1 rounded">@username</span> to mention someone
        </div>
        
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </form>
  );
};

export default CommentInput;
