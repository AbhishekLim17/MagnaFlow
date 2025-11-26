// Enhanced Staff Dashboard with CRUD operations and progress tracking
// Staff can view, add, edit, delete their own tasks and see progress rate

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckSquare, 
  Plus, 
  Clock, 
  Calendar, 
  User, 
  LogOut,
  Search,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Edit,
  Trash2,
  TrendingUp,
  Target,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { sendTaskCompletedEmail, sendTaskStatusChangedEmail } from '@/services/emailService';
import AddTaskDialog from '@/components/staff/AddTaskDialog';
import EditTaskDialog from '@/components/staff/EditTaskDialog';
import ChangePasswordDialog from '@/components/staff/ChangePasswordDialog';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const { tasks: allTasks, updateTask, deleteTask, loading } = useTasks();
  const { toast } = useToast();
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Filter tasks for current user
  const myTasks = allTasks.filter(task => task.assignedTo === user?.id);

  useEffect(() => {
    let currentTasks = [...myTasks];

    if (searchTerm) {
      currentTasks = currentTasks.filter(task =>
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      currentTasks = currentTasks.filter(task => task.status === filterStatus);
    }

    setFilteredTasks(currentTasks);
  }, [allTasks, searchTerm, filterStatus, user?.id]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    });
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const task = myTasks.find(t => t.id === taskId);
      
      await updateTask(taskId, {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      
      toast({
        title: "Task completed!",
        description: "Great job! The task has been marked as completed.",
      });

      // Send completion email to admin/task creator
      if (task && task.assignedByEmail) {
        try {
          await sendTaskCompletedEmail({
            toEmail: task.assignedByEmail,
            toName: task.assignedBy || 'Admin',
            taskTitle: task.title,
            completedBy: user?.name || 'Staff',
            completionDate: new Date().toLocaleDateString(),
          });
        } catch (emailError) {
          console.error('Failed to send completion email:', emailError);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${taskTitle}"?`)) {
      return;
    }

    try {
      await deleteTask(taskId);
      toast({
        title: "Task deleted",
        description: "The task has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'in-progress': return <PlayCircle className="w-4 h-4 text-blue-400" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'in-progress': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-600/20 text-red-300 border-red-600/30';
      case 'high': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'medium': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // Calculate statistics
  const completedTasks = myTasks.filter(task => task.status === 'completed');
  const inProgressTasks = myTasks.filter(task => task.status === 'in-progress');
  const pendingTasks = myTasks.filter(task => task.status === 'pending');
  const progressRate = myTasks.length > 0 
    ? Math.round((completedTasks.length / myTasks.length) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4 sm:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4"
      >
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Welcome, {user?.name}! 👋
          </h1>
          <p className="text-gray-300 text-sm sm:text-base">Manage your tasks and track your progress</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex glass-effect p-3 rounded-lg items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <p className="text-white font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.designation || user?.role}</p>
            </div>
          </div>
          <Button
            onClick={() => setShowChangePassword(true)}
            variant="outline"
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
          >
            <KeyRound className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Change Password</span>
          </Button>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/20"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 mb-8">
        {[
          { title: 'Total Tasks', value: myTasks.length, icon: CheckSquare, color: 'from-blue-500 to-cyan-500' },
          { title: 'In Progress', value: inProgressTasks.length, icon: PlayCircle, color: 'from-orange-500 to-red-500' },
          { title: 'Completed', value: completedTasks.length, icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
          { title: 'Pending', value: pendingTasks.length, icon: AlertCircle, color: 'from-purple-500 to-pink-500' },
          { 
            title: 'Progress Rate', 
            value: `${progressRate}%`, 
            icon: TrendingUp, 
            color: progressRate >= 75 ? 'from-green-500 to-emerald-500' : progressRate >= 50 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-pink-500'
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-effect p-4 sm:p-6 card-hover">
              <div className="flex flex-col sm:flex-row items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs sm:text-sm mb-1">{stat.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 mt-2 sm:mt-0 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-4 mb-8"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 glass-effect border-white/20 text-white placeholder-gray-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'in-progress', 'completed'].map(status => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              onClick={() => setFilterStatus(status)}
              className="border-white/20 capitalize text-xs sm:text-sm px-3 py-1 h-auto"
            >
              {status.replace('-', ' ')}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => setShowAddTask(true)}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </motion.div>

      {/* Tasks Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filteredTasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-effect p-6 card-hover h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(task.status)}
                  <Badge className={`${getStatusColor(task.status)} border`}>
                    {task.status.replace('-', ' ')}
                  </Badge>
                </div>
                <Badge className={`${getPriorityColor(task.priority)} border`}>
                  {task.priority}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">{task.title}</h3>
              <p className="text-gray-300 text-sm mb-4 line-clamp-2 flex-grow">{task.description}</p>

              <div className="space-y-2 mb-4">
                {task.assignedBy && (
                  <div className="flex items-center text-xs text-gray-400">
                    <User className="w-3 h-3 mr-1" />
                    Assigned by: {task.assignedBy}
                  </div>
                )}
                {task.deadline && (
                  <div className="flex items-center text-xs text-gray-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    Due: {new Date(task.deadline).toLocaleDateString()}
                  </div>
                )}
                {task.completedAt && (
                  <div className="flex items-center text-xs text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed: {new Date(task.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                {task.status !== 'completed' && (
                  <>
                    <Button
                      onClick={() => handleEditTask(task)}
                      variant="outline"
                      className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleCompleteTask(task.id)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => handleDeleteTask(task.id, task.title)}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {filteredTasks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <CheckSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No tasks found</h3>
          <p className="text-gray-400">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first task to get started'
            }
          </p>
        </motion.div>
      )}

      <AddTaskDialog
        open={showAddTask}
        onOpenChange={setShowAddTask}
      />

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
        />
      )}

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </div>
  );
};

export default StaffDashboard;
