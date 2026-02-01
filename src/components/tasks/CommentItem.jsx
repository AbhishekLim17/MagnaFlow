import { useState } from 'react';
import { updateComment, deleteComment } from '../../services/commentService';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * CommentItem Component
 * Individual comment with edit/delete functionality
 */
const CommentItem = ({ comment, currentUserId, taskId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAuthor = comment.userId === currentUserId;
  const isAdmin = false; // TODO: Get from AuthContext or user data

  const canEdit = isAuthor || isAdmin;
  const canDelete = isAuthor || isAdmin;

  // Format timestamp
  const formatTime = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const commentDate = new Date(date);
    const diffMs = now - commentDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return commentDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: commentDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Handle edit submit
  const handleEditSubmit = async () => {
    if (!editText.trim() || editText === comment.text) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      await updateComment(comment.id, editText);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteComment(comment.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get user avatar (first letter of name)
  const getAvatar = (name) => {
    return (name || 'U').charAt(0).toUpperCase();
  };

  // Highlight @mentions in text
  const renderTextWithMentions = (text) => {
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(
          <span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>
        );
      }
      
      // Add highlighted mention
      parts.push(
        <span 
          key={match.index} 
          className="text-blue-600 font-semibold bg-blue-50 px-1 rounded"
        >
          {match[0]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="flex gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
          {getAvatar(comment.userName)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              {comment.userName || 'Anonymous'}
            </span>
            <span className="text-sm text-gray-500">
              {formatTime(comment.createdAt)}
            </span>
            {comment.edited && (
              <span className="text-xs text-gray-400 italic">
                (edited)
              </span>
            )}
          </div>

          {/* Action buttons */}
          {!isEditing && (
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit comment"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete comment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comment text or edit input */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="3"
              maxLength={5000}
              disabled={loading}
            />
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditSubmit}
                disabled={loading || !editText.trim()}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
              
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditText(comment.text);
                }}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-100 transition-colors text-sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-700 whitespace-pre-wrap break-words">
            {renderTextWithMentions(comment.text)}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Delete Comment?</h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. The comment will be permanently removed.
            </p>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 transition-colors"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default CommentItem;
