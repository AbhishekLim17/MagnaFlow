import { useState, useEffect } from 'react';
import { createComment, extractMentions, getUserIdsByUsernames } from '../../services/commentService';
import { createNotificationsForMentions, sendEmailNotification } from '../../services/notificationService';
import { getAllUsers } from '../../services/userService';
import { Send, Users } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * CommentInput Component
 * Textarea for posting new comments with @mention support
 */
const CommentInput = ({ taskId, taskTitle, userId, userName, userEmail }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);

  const maxLength = 5000;
  const remainingChars = maxLength - text.length;

  // Load users once for mention suggestions
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers.filter(u => u.id !== userId)); // Exclude current user
      } catch (err) {
        console.error('Error loading users:', err);
      }
    };
    loadUsers();
  }, [userId]);

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
          className="w-full px-4 py-3 bg-muted border border-border text-foreground rounded-xl focus:ring-2 ring-primary focus:border-transparent resize-none"
          rows="3"
          maxLength={maxLength}
          disabled={loading}
        />
        
        {/* Character counter */}
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {remainingChars} characters remaining
        </div>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-destructive text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            💡 Tip: Use <span className="font-mono bg-muted text-primary px-1 rounded">@username</span> to mention
          </div>
          <button
            type="button"
            onClick={() => setShowUsers(!showUsers)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Users className="w-3 h-3" />
            {showUsers ? 'Hide' : 'Show'} users
          </button>
        </div>
        
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </div>

      {/* Available users list */}
      {showUsers && users.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 p-3 bg-muted border border-border rounded-xl"
        >
          <div className="text-xs text-muted-foreground mb-2 font-semibold">Available to mention:</div>
          <div className="flex flex-wrap gap-2">
            {users.map(user => (
              <span
                key={user.id}
                onClick={() => {
                  const atSymbol = text.endsWith('@') ? '' : '@';
                  setText(text + atSymbol + user.name);
                }}
                className="text-xs px-2 py-1 bg-muted text-primary rounded cursor-pointer hover:bg-muted transition-colors"
              >
                @{user.name}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </form>
  );
};

export default CommentInput;
