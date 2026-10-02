// TasksContext - Firebase Integration for Task Management
// Manages tasks across the application with real-time updates

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { toUserMessage } from '@/lib/errorMessages';
import { statusLabel } from '@/lib/taskLabels';
import { useAuth } from './AuthContext';
import { getAllTasks, createTask as createTaskService, updateTask as updateTaskService, deleteTask as deleteTaskService, getTaskStatistics } from '@/services/taskService';
import { sendTaskAssignedEmail, sendCriticalTaskAlert } from '@/services/emailService';

const TasksContext = createContext();

export const useTasks = () => {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
};

// How long a loaded task list is considered fresh. Screens call refreshTasks()
// on mount, but the provider has usually just loaded the same data at login —
// without this, navigating to Task Management or the staff dashboard refetched
// the whole list every time, doubling Firestore reads (which are billed per
// document) for no new information.
const TASKS_STALE_AFTER_MS = 30_000;

export const TasksProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  // Set when getAllTasks hit its read bound, meaning the org may have more
  // tasks than this list shows. See the comment on that flag in taskService.
  const [tasksTruncated, setTasksTruncated] = useState(false);
  const lastLoadedAt = useRef(0);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  // Task visibility filters, by role:
  // - master-admin: no task list at all — they operate via the Master Admin
  //   dashboard's org list / usage stats, not a task view.
  // - org-admin/admin (legacy alias): every task in their org.
  // - department-head: tasks in any of their departments.
  // - manager: tasks in any of their projects.
  // - staff: only tasks assigned to them.
  const getTaskFiltersForUser = (u) => {
    if (!u) return null;
    switch (u.role) {
      case 'master-admin':
        return null;
      case 'org-admin':
      case 'admin':
        return { orgId: u.orgId };
      case 'department-head':
        return { orgId: u.orgId, departmentIds: u.departmentIds || [] };
      case 'manager':
        return { orgId: u.orgId, projectIds: u.projectIds || [] };
      case 'staff':
      default:
        return { assignedTo: u.id };
    }
  };

  // Load tasks based on user role
  // NOTE: must be defined before the effects below that list it as a dependency,
  // otherwise the dependency array reads it in the temporal dead zone (ReferenceError).
  /**
   * @param {Object} [opts]
   * @param {boolean} [opts.force] refetch even if the current data is still fresh
   */
  const loadTasks = useCallback(async ({ force = false } = {}) => {
    // Skip a redundant round-trip when a screen remounts and asks for data the
    // provider already holds. Any actual change (create/update/delete, subtask
    // completion, a different user) forces a reload, so this can't serve stale
    // data after a mutation.
    if (!force && Date.now() - lastLoadedAt.current < TASKS_STALE_AFTER_MS) {
      return;
    }

    try {
      setLoading(true);
      console.log("📥 Loading tasks for user:", user?.email);

      const filters = getTaskFiltersForUser(user);
      if (!filters) {
        // master-admin: no org-scoped task list.
        setTasks([]);
        setStatistics(null);
        setTasksTruncated(false);
        setLoading(false);
        lastLoadedAt.current = Date.now();
        return;
      }

      const tasksData = await getAllTasks(filters);
      setTasks(tasksData);
      setTasksTruncated(Boolean(tasksData.truncated));
      console.log("✅ Tasks loaded:", tasksData.length);

      const stats = await getTaskStatistics(filters);
      setStatistics(stats);
      lastLoadedAt.current = Date.now();
    } catch (error) {
      console.error("❌ Error loading tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Load tasks when the signed-in user changes. Always forced: a different user
  // has a different scope, so freshness of the previous user's data is
  // irrelevant — and serving it would be a data leak between accounts.
  useEffect(() => {
    if (isAuthenticated && user) {
      lastLoadedAt.current = 0;
      loadTasks({ force: true });
    } else {
      setTasks([]);
      setStatistics(null);
      setTasksTruncated(false);
      setLoading(false);
      lastLoadedAt.current = 0;
    }
  }, [isAuthenticated, user, loadTasks]);

  // Listen for task status updates (from subtask completion)
  useEffect(() => {
    const handler = () => {
      console.log('🔄 Task status updated, reloading tasks...');
      loadTasks({ force: true });
    };
    window.addEventListener('taskStatusUpdated', handler);
    return () => window.removeEventListener('taskStatusUpdated', handler);
  }, [loadTasks]);

  /**
   * Create a new task
   */
  const createTask = async (taskData) => {
    try {
      console.log("➕ Creating new task:", taskData.title);
      
      const newTaskData = {
        ...taskData,
        createdBy: user.id,
        ...(user.orgId !== undefined && { orgId: user.orgId }),
      };
      // Default department-head/manager-created tasks to their own scope
      // unless the caller already specified one explicitly.
      if (newTaskData.departmentId === undefined && user.role === 'department-head') {
        newTaskData.departmentId = user.departmentIds?.[0];
      }
      if (newTaskData.projectId === undefined && user.role === 'manager') {
        newTaskData.projectId = user.projectIds?.[0];
      }

      const newTask = await createTaskService(newTaskData);
      
      setTasks(prev => [newTask, ...prev]);
      
      // Send email notification to assigned staff member
      if (taskData.assignedTo) {
        try {
          // The recipient is named by uid: the mail job looks the address up itself
          // (and checks the account is active), so the browser never handles it.
          const emailParams = {
            toUid: taskData.assignedTo,
            taskTitle: taskData.title,
            taskDescription: taskData.description || 'No description provided',
            taskPriority: taskData.priority?.charAt(0).toUpperCase() + taskData.priority?.slice(1) || 'Medium',
            dueDate: (taskData.deadline || taskData.dueDate) ? new Date(taskData.deadline || taskData.dueDate).toLocaleDateString() : 'Not specified',
            assignedBy: user?.name || 'Admin',
            taskId: newTask.id,
          };

          // Send critical alert for critical priority tasks
          if (taskData.priority === 'critical') {
            await sendCriticalTaskAlert(emailParams);
          } else {
            await sendTaskAssignedEmail(emailParams);
          }
        } catch (emailError) {
          console.error("❌ Error sending email notification:", emailError);
          // Don't fail task creation if email fails
        }
      }
      
      // Refresh statistics
      await refreshStatistics();
      
      toast({
        title: "Task Created",
        description: `Task "${taskData.title}" has been created successfully.`,
      });
      
      return newTask;
    } catch (error) {
      console.error("❌ Error creating task:", error);
      toast({
        title: "Couldn't create the task",
        description: toUserMessage(error, 'Please try again.'),
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Update an existing task. This context is the ONLY place that toasts for task
   * writes: callers must not add a second success or error toast (every status change
   * used to show two, and a blocked move showed a generic "Error" next to the real
   * reason). Pass { successTitle, successDescription } to word the success toast, or
   * { quiet: true } to suppress it.
   */
  const updateTask = async (taskId, updates, options = {}) => {
    try {
      const updatedTask = await updateTaskService(taskId, updates);

      setTasks(prev =>
        prev.map(t => t.id === taskId ? updatedTask : t)
      );

      // Refresh statistics
      await refreshStatistics();

      if (!options.quiet) {
        toast({
          title: options.successTitle || "Task updated",
          description: options.successDescription || "Your changes were saved.",
        });
      }

      return updatedTask;
    } catch (error) {
      console.error("❌ Error updating task:", error);
      toast({
        title: error?.code === 'task-blocked' ? "Task is blocked" : "Couldn't update the task",
        description: toUserMessage(error, 'Please try again.'),
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Delete a task
   */
  const deleteTask = async (taskId) => {
    try {
      console.log("🗑️  Deleting task:", taskId);
      
      // Tasks that were waiting on this one are detached from it. Use the list
      // already in memory: it is scoped to what this user may touch, which a fresh
      // query for dependents could not prove to the security rules.
      const dependentTaskIds = tasks
        .filter((t) => Array.isArray(t.blockedBy) && t.blockedBy.includes(taskId))
        .map((t) => t.id);

      await deleteTaskService(taskId, { dependentTaskIds });
      
      setTasks(prev => prev
        .filter(t => t.id !== taskId)
        .map(t => (Array.isArray(t.blockedBy) && t.blockedBy.includes(taskId)
          ? { ...t, blockedBy: t.blockedBy.filter((id) => id !== taskId) }
          : t)));
      
      // Refresh statistics
      await refreshStatistics();
      
      toast({
        title: "Task deleted",
        description: "It has been removed.",
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error deleting task:", error);
      toast({
        title: "Couldn't delete the task",
        description: toUserMessage(error, 'Please try again.'),
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Update task status
   */
  const updateTaskStatus = async (taskId, status) => {
    const title = tasks.find((t) => t.id === taskId)?.title;
    return updateTask(taskId, { status }, {
      successTitle: 'Status updated',
      successDescription: title
        ? `“${title}” is now ${statusLabel(status).toLowerCase()}.`
        : `Status changed to ${statusLabel(status).toLowerCase()}.`,
    });
  };

  /**
   * Refresh statistics
   */
  const refreshStatistics = async () => {
    try {
      const filters = getTaskFiltersForUser(user);
      if (!filters) return;
      const stats = await getTaskStatistics(filters);
      setStatistics(stats);
    } catch (error) {
      console.error("❌ Error refreshing statistics:", error);
    }
  };

  /**
   * Get tasks by filter
   */
  const getFilteredTasks = (filters = {}) => {
    let filtered = [...tasks];

    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters.priority) {
      filtered = filtered.filter(t => t.priority === filters.priority);
    }

    if (filters.assignedTo) {
      filtered = filtered.filter(t => t.assignedTo === filters.assignedTo);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchLower) ||
        (t.description || '').toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  const value = {
    tasks,
    tasksTruncated,
    loading,
    statistics,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    // Cheap no-op when the data is still fresh — safe to call on every mount.
    refreshTasks: loadTasks,
    // Bypasses the freshness window; use after an external change.
    forceRefreshTasks: () => loadTasks({ force: true }),
    refreshStatistics,
    getFilteredTasks,
  };

  return (
    <TasksContext.Provider value={value}>
      {children}
    </TasksContext.Provider>
  );
};
