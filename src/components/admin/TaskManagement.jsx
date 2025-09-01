import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  User, 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import AddTaskDialog from './AddTaskDialog';
import EditTaskDialog from './EditTaskDialog';

const TaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const savedTasks = localStorage.getItem('projectflow_tasks');
    if (savedTasks) {
      const tasksData = JSON.parse(savedTasks);
      setTasks(tasksData);
      setFilteredTasks(tasksData);
    } else {
      // Initialize with sample tasks
      const sampleTasks = [
        {
          id: 1,
          title: 'Update User Interface',
          description: 'Redesign the main dashboard interface',
          status: 'in-progress',
          priority: 'high',
          assignedTo: 2,
          assignedBy: 'Admin User',
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          completedBy: null,
          completedAt: null
        },
        {
          id: 2,
          title: 'Database Optimization',
          description: 'Optimize database queries for better performance',
          status: 'pending',
          priority: 'medium',
          assignedTo: 2,
          assignedBy: 'Admin User',
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          completedBy: null,
          completedAt: null
        }
      ];
      setTasks(sampleTasks);
      setFilteredTasks(sampleTasks);
      localStorage.setItem('projectflow_tasks', JSON.stringify(sampleTasks));
    }
  }, []);

  useEffect(() => {
    let filtered = tasks;

    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    setFilteredTasks(filtered);
  }, [tasks, searchTerm, filterStatus]);

  const handleAddTask = (newTask) => {
    const taskWithId = {
      ...newTask,
      id: Date.now(),
      assignedBy: 'Admin User',
      createdAt: new Date().toISOString(),
      completedBy: null,
      completedAt: null
    };

    const updatedTasks = [...tasks, taskWithId];
    setTasks(updatedTasks);
    localStorage.setItem('projectflow_tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: "Task created!",
      description: "New task has been assigned successfully.",
    });
  };

  const handleEditTask = (updatedTask) => {
    const updatedTasks = tasks.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    );

    setTasks(updatedTasks);
    localStorage.setItem('projectflow_tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: "Task updated!",
      description: "Task has been updated successfully.",
    });
  };

  const handleDeleteTask = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    
    setTasks(updatedTasks);
    localStorage.setItem('projectflow_tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: "Task deleted",
      description: `"${task.title}" has been removed.`,
      variant: "destructive",
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'in-progress':
        return <PlayCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'in-progress':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'medium':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getAssigneeName = (assignedTo) => {
    // Mock staff data - in real app, this would come from staff management
    const staff = {
      1: 'Admin User',
      2: 'Staff Member',
      3: 'Sarah Johnson',
      4: 'Mike Chen',
      5: 'Emma Davis'
    };
    return staff[assignedTo] || 'Unknown';
  };

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const pendingTasks = tasks.filter(task => task.status === 'pending');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Task Management</h2>
          <p className="text-gray-300">Assign, track, and manage project tasks</p>
        </div>
        <Button
          onClick={() => setShowAddTask(true)}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Tasks', value: tasks.length, icon: CheckSquare, color: 'from-blue-500 to-cyan-500' },
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
            <Card className="glass-effect p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 glass-effect border-white/20 text-white placeholder-gray-400"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            className="border-white/20"
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('pending')}
            className="border-white/20"
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === 'in-progress' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('in-progress')}
            className="border-white/20"
          >
            In Progress
          </Button>
          <Button
            variant={filterStatus === 'completed' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('completed')}
            className="border-white/20"
          >
            Completed
          </Button>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-effect p-6 card-hover h-full">
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
              <p className="text-gray-300 text-sm mb-4 line-clamp-2">{task.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-xs text-gray-400">
                  <User className="w-3 h-3 mr-1" />
                  Assigned to: {getAssigneeName(task.assignedTo)}
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <Calendar className="w-3 h-3 mr-1" />
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  Created: {new Date(task.createdAt).toLocaleDateString()}
                </div>
                {task.completedBy && (
                  <div className="flex items-center text-xs text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completed by: {task.completedBy}
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingTask(task)}
                  className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteTask(task.id)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

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

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={() => setEditingTask(null)}
          task={editingTask}
          onEditTask={handleEditTask}
        />
      )}
    </motion.div>
  );
};

export default TaskManagement;