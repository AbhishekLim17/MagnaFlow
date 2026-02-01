// TasksContext - Firebase Integration for Task Management
// Manages tasks across the application with real-time updates

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from './AuthContext';
import {
  getAllTasks,
  getTasksForUser,
  createTask as createTaskService,
  updateTask as updateTaskService,
  deleteTask as deleteTaskService,
  getTaskStatistics,
} from '@/services/taskService';
import { getUserById } from '@/services/userService';
import { sendTaskAssignedEmail, sendCriticalTaskAlert, sendTaskStatusChangedEmail, sendTaskCompletedEmail } from '@/services/emailService';

const TasksContext = createContext();

export const useTasks = () => {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
};

export const TasksProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  // Load tasks when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      loadTasks();
    } else {
      setTasks([]);
      setStatistics(null);
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  // Listen for task status updates (from subtask completion)
  useEffect(() => {
    const handleTaskStatusUpdate = () => {
      console.log('🔄 Task status updated, reloading tasks...');
      loadTasks();
    };
    
    window.addEventListener('taskStatusUpdated', handleTaskStatusUpdate);
    
    return () => {
      window.removeEventListener('taskStatusUpdated', handleTaskStatusUpdate);
    };
  }, [isAuthenticated, user]);

  /**
   * Load tasks based on user role
   * Admin: Load all tasks
   * Staff: Load only assigned tasks
   */
  const loadTasks = async () => {
    try {
      setLoading(true);
      console.log("📥 Loading tasks for user:", user?.email);

      let tasksData;
      if (user.role === 'admin') {
        // Admin sees all tasks
        tasksData = await getAllTasks();
      } else {
        // Staff sees only their assigned tasks
        tasksData = await getTasksForUser(user.id);
      }

      setTasks(tasksData);
      console.log("✅ Tasks loaded:", tasksData.length);

      // Load statistics
      const stats = await getTaskStatistics(
        user.role === 'admin' ? null : user.id
      );
      setStatistics(stats);
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
  };

  /**
   * Create a new task
   */
  const createTask = async (taskData) => {
    try {
      console.log("➕ Creating new task:", taskData.title);
      
      const newTaskData = {
        ...taskData,
        createdBy: user.id,
      };
      
      const newTask = await createTaskService(newTaskData);
      
      setTasks(prev => [newTask, ...prev]);
      
      // Send email notification to assigned staff member
      if (taskData.assignedTo) {
        try {
          console.log("📧 Fetching assigned user data...");
          const assignedUser = await getUserById(taskData.assignedTo);
          
          console.log("📧 Assigned user:", assignedUser);
          
          if (assignedUser && assignedUser.email) {
            const emailParams = {
              toEmail: assignedUser.email,
              toName: assignedUser.name,
              taskTitle: taskData.title,
              taskDescription: taskData.description || 'No description provided',
              taskPriority: taskData.priority?.charAt(0).toUpperCase() + taskData.priority?.slice(1) || 'Medium',
              dueDate: taskData.dueDate ? new Date(taskData.dueDate).toLocaleDateString() : 'Not specified',
              assignedBy: user?.name || 'Admin',
            };

            console.log("📧 Sending email with params:", emailParams);

            // Send critical alert for critical priority tasks
            if (taskData.priority === 'critical') {
              const result = await sendCriticalTaskAlert(emailParams);
              console.log("📧 Critical email result:", result);
            } else {
              const result = await sendTaskAssignedEmail(emailParams);
              console.log("📧 Email result:", result);
            }
          } else {
            console.warn("⚠️ No email address found for assigned user");
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
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Update an existing task
   */
  const updateTask = async (taskId, updates) => {
    try {
      console.log("✏️  Updating task:", taskId);
      
      const updatedTask = await updateTaskService(taskId, updates);
      
      setTasks(prev => 
        prev.map(t => t.id === taskId ? updatedTask : t)
      );
      
      // Refresh statistics
      await refreshStatistics();
      
      toast({
        title: "Task Updated",
        description: "Task has been updated successfully.",
      });
      
      return updatedTask;
    } catch (error) {
      console.error("❌ Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
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
      
      await deleteTaskService(taskId);
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Refresh statistics
      await refreshStatistics();
      
      toast({
        title: "Task Deleted",
        description: "Task has been deleted successfully.",
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Update task status
   */
  const updateTaskStatus = async (taskId, status) => {
    try {
      return await updateTask(taskId, { status });
    } catch (error) {
      console.error("❌ Error updating task status:", error);
      throw error;
    }
  };

  /**
   * Refresh statistics
   */
  const refreshStatistics = async () => {
    try {
      const stats = await getTaskStatistics(
        user.role === 'admin' ? null : user.id
      );
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
        t.description.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  const value = {
    tasks,
    loading,
    statistics,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    refreshTasks: loadTasks,
    refreshStatistics,
    getFilteredTasks,
  };

  return (
    <TasksContext.Provider value={value}>
      {children}
    </TasksContext.Provider>
  );
};
