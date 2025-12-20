import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUnreadNotifications, markAsRead, markAllAsRead } from '../../services/notificationService';
import { Bell, Check, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/**
 * NotificationBell Component
 * Displays unread @mention notifications with dropdown
 */
const NotificationBell = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Subscribe to notifications
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToUnreadNotifications(
      currentUser.uid,
      (fetchedNotifications) => {
        setNotifications(fetchedNotifications);
        setUnreadCount(fetchedNotifications.length);
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      await markAsRead(notification.id);
      
      // Navigate to task
      navigate(`/tasks/${notification.taskId}`);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    setLoading(true);
    try {
      await markAllAsRead(currentUser.uid);
      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      alert('Failed to mark all as read. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format time
  const formatTime = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return notifDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (!currentUser) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
        title="Notifications"
      >
        <Bell className="w-6 h-6" />
        
        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 bg-gray-900 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Notifications</h3>
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium disabled:text-gray-600"
                >
                  {loading ? 'Marking...' : 'Mark all as read'}
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                  <p>No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full p-4 text-left hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-blue-400" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200">
                            <span className="font-semibold">{notification.mentionedByName}</span>
                            {' '}mentioned you in a comment
                          </p>
                          
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>

                        {/* Unread indicator */}
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-gray-900 border-t border-gray-700 text-center">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    setShowDropdown(false);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
