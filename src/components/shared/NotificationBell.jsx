import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUnreadNotifications, markAsRead, markAllAsRead } from '../../services/notificationService';
import { AlertTriangle, Bell, CheckCircle2, Mail, MessageSquare, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { safeUnsubscribe } from '@/lib/safeUnsubscribe';
import { formatRelative } from '@/lib/format';
import { taskLink } from '@/lib/taskLink';
import NotificationSettingsDialog from './NotificationSettingsDialog';
import { clientNotificationText } from '@/lib/clientThread';

// What a client did (see lib/clientThread); anything else is an @mention.
const ICON_FOR = { client_message: Users, client_approved: CheckCircle2, client_changes_requested: AlertTriangle };

/**
 * NotificationBell Component
 * Displays unread @mention notifications with dropdown. Clicking one opens the task
 * it is about (see TaskDeepLink); it used to navigate to routes that do not exist.
 */
const NotificationBell = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Subscribe to notifications. Keyed on the uid (a stable string) rather than
  // the currentUser object so the listener isn't torn down and recreated on
  // every parent re-render.
  const userId = currentUser?.uid;
  useEffect(() => {
    if (!userId) return undefined;

    const unsubscribe = subscribeToUnreadNotifications(
      userId,
      (fetchedNotifications) => {
        setNotifications(fetchedNotifications);
        setUnreadCount(fetchedNotifications.length);
      }
    );

    return () => {
      if (unsubscribe) {
        safeUnsubscribe(unsubscribe);
      }
    };
  }, [userId]);

  // Close dropdown when clicking outside, or on Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Open the task the notification is about, and mark it read.
  const handleNotificationClick = async (notification) => {
    setShowDropdown(false);
    if (notification.taskId) navigate(taskLink(location.pathname, notification.taskId));
    try {
      await markAsRead(notification.id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    setLoading(true);
    try {
      await markAllAsRead(currentUser.uid);
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Couldn't mark them as read",
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  const label = unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={showDropdown}
        title="Notifications"
      >
        <Bell className="w-6 h-6" aria-hidden="true" />

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              aria-hidden="true"
              className="absolute top-0 right-0 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center"
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
            className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-overlay"
          >
            {/* Header */}
            <div className="p-4 bg-background border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">Notifications</h3>
                <button
                  type="button"
                  onClick={() => setShowDropdown(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  className="text-sm text-primary hover:text-primary font-medium disabled:text-muted-foreground"
                >
                  {loading ? 'Marking…' : 'Mark all as read'}
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
                  <p>You're all caught up</p>
                  <p className="text-xs mt-1">New @mentions and messages from clients will show up here.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full p-4 text-left hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center">
                          {React.createElement(ICON_FOR[notification.type] || MessageSquare, { className: 'w-5 h-5 text-primary', 'aria-hidden': true })}
                        </div>

                        <div className="flex-1 min-w-0">
                          {clientNotificationText(notification) ? (
                            <p className="text-sm text-foreground">{clientNotificationText(notification)}</p>
                          ) : (
                            <p className="text-sm text-foreground">
                              <span className="font-semibold">{notification.mentionedByName || 'Someone'}</span>
                              {' '}mentioned you
                              {notification.taskTitle ? (
                                <>
                                  {' '}on <span className="font-medium">“{notification.taskTitle}”</span>
                                </>
                              ) : ' in a comment'}
                            </p>
                          )}
                          {notification.excerpt && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {notification.excerpt}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatRelative(notification.createdAt)}
                          </p>
                        </div>

                        <div className="flex-shrink-0" aria-label="Unread">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-background p-2">
              <button
                type="button"
                onClick={() => { setShowDropdown(false); setSettingsOpen(true); }}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Email settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default NotificationBell;
