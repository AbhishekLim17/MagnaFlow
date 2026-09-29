import { useState, useEffect } from 'react';
import { createComment } from '../../services/commentService';
import { sendMentionEmail } from '../../services/emailService';
import { resolveMentions, mergePeople, mentionToken } from '../../lib/mentions';
import { createNotificationsForMentions } from '../../services/notificationService';
import { getAllUsers } from '../../services/userService';
import { Send, Users } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * CommentInput Component
 * Textarea for posting new comments with @mention support
 */
const CommentInput = ({ taskId, taskTitle, userId, userName, userEmail, people = [] }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [directory, setDirectory] = useState([]);
  const [showUsers, setShowUsers] = useState(false);

  const maxLength = 5000;
  const remainingChars = maxLength - text.length;

  // Load users once for mention suggestions. What this returns depends on the
  // caller's role (the security rules only let org-admins list everyone), so it
  // is merged with the people already visible on the task - its commenters.
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers();
        setDirectory(allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })));
      } catch {
        // Expected for roles that cannot list users; commenters still work.
      }
    };
    loadUsers();
  }, [userId]);

  const users = mergePeople(directory, people).filter((u) => u.id !== userId && u.name);

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
      // Resolve @mentions against the people the picker offered
      const mentioned = resolveMentions(text, users);
      const mentionedUserIds = mentioned.map((p) => p.id);

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

          // Queue an email for each mentioned person, by uid (delivery is by the
          // scheduled job, which looks the address up and re-checks the org).
          await Promise.all(
            mentioned
              .map((p) => sendMentionEmail({
                toUid: p.id,
                taskTitle,
                commentText: text,
                mentionedBy: userName,
                taskId,
              }))
          );
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
          placeholder="Write a comment... Pick a name below to @mention someone"
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
                  setText(text + atSymbol + mentionToken(user.name) + ' ');
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
