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
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import AddTaskDialog from '@/components/staff/AddTaskDialog';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddTask, setShowAddTask] = useState(false);

  useEffect(() => {
    const savedTasks = localStorage.getItem('projectflow_tasks');
    if (savedTasks) {
      const allTasks = JSON.parse(savedTasks);
      setTasks(allTasks);
    } else {
      const sampleTasks = [
        {
          id: 1, title: 'Update User Interface', description: 'Redesign the main dashboard interface', status: 'in-progress', priority: 'high', assignedTo: user?.id, assignedBy: 'Admin User', createdAt: new Date().toISOString(), dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), completedBy: null, completedAt: null
        },
        {
          id: 2, title: 'Database Optimization', description: 'Optimize database queries for better performance', status: 'pending', priority: 'medium', assignedTo: user?.id, assignedBy: 'Admin User', createdAt: new Date().toISOString(), dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), completedBy: null, completedAt: null
        }
      ];
      setTasks(sampleTasks);
      localStorage.setItem('projectflow_tasks', JSON.stringify(sampleTasks));
    }
  }, [user?.id]);
  
  useEffect(() => {
    let currentTasks = tasks.filter(task => task.assignedTo === user?.id);

    if (searchTerm) {
      currentTasks = currentTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      currentTasks = currentTasks.filter(task => task.status === filterStatus);
    }

    setFilteredTasks(currentTasks);
  }, [tasks, searchTerm, filterStatus, user?.id]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    });
  };

  const handleCompleteTask = (taskId) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status: 'completed',
          completedBy: user?.name,
          completedAt: new Date().toISOString()
        };
      }
      return task;
    });

    setTasks(updatedTasks);
    localStorage.setItem('projectflow_tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: "Task completed!",
      description: "Great job! The task has been marked as completed.",
    });
  };

  const handleAddTask = (newTask) => {
    const taskWithId = {
      ...newTask,
      id: Date.now(),
      assignedTo: user?.id,
      assignedBy: user?.name,
      createdAt: new Date().toISOString(),
      completedBy: null,
      completedAt: null
    };

    const updatedTasks = [...tasks, taskWithId];
    setTasks(updatedTasks);
    localStorage.setItem('projectflow_tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: "Task created!",
      description: "Your new task has been added successfully.",
    });
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
      case 'high': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'medium': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const myTasks = tasks.filter(task => task.assignedTo === user?.id);
  const completedTasks = myTasks.filter(task => task.status === 'completed');
  const inProgressTasks = myTasks.filter(task => task.status === 'in-progress');
  const pendingTasks = myTasks.filter(task => task.status === 'pending');

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
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {[
          { title: 'Total', value: myTasks.length, icon: CheckSquare, color: 'from-blue-500 to-cyan-500' },
          { title: 'In Progress', value: inProgressTasks.length, icon: PlayCircle, color: 'from-orange-500 to-red-500' },
          { title: 'Completed', value: completedTasks.length, icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
          { title: 'Pending', value: pendingTasks.length, icon: AlertCircle, color: 'from-purple-500 to-pink-500' },
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
                <div className="flex items-center text-xs text-gray-400">
                  <User className="w-3 h-3 mr-1" />
                  Assigned by: {task.assignedBy}
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <Calendar className="w-3 h-3 mr-1" />
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </div>
                {task.completedBy && (
                  <div className="flex items-center text-xs text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed by: {task.completedBy}
                  </div>
                )}
              </div>

              {task.status !== 'completed' && (
                <Button
                  onClick={() => handleCompleteTask(task.id)}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 mt-auto"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
              )}
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
        onAddTask={handleAddTask}
      />
    </div>
  );
};

export default StaffDashboard;