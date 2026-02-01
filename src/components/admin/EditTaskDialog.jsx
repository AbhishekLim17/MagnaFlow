import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit, Calendar, User, ListChecks, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SubtaskList from '../SubtaskList';
import AddSubtaskDialog from '../AddSubtaskDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EditTaskDialog = ({ open, onOpenChange, task, onEditTask }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    status: 'pending',
    assignedTo: ''
  });
  const [staff, setStaff] = useState([]);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  
  // Debug logging
  console.log('EditTaskDialog - task:', task);
  console.log('EditTaskDialog - user:', user);
  console.log('EditTaskDialog - showAddSubtask:', showAddSubtask);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        status: task.status || 'pending',
        assignedTo: task.assignedTo?.toString() || ''
      });
    }
  }, [task]);

  useEffect(() => {
    // Load staff from localStorage
    const savedStaff = localStorage.getItem('projectflow_staff');
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    } else {
      // Default staff if none exists
      setStaff([
        { id: 2, name: 'Staff Member', status: 'active' },
        { id: 3, name: 'Sarah Johnson', status: 'active' },
        { id: 4, name: 'Mike Chen', status: 'active' },
        { id: 5, name: 'Emma Davis', status: 'active' }
      ]);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.assignedTo) {
      return;
    }

    const updatedTask = {
      ...task,
      ...formData,
      assignedTo: parseInt(formData.assignedTo),
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : task.dueDate
    };

    onEditTask(updatedTask);
    onOpenChange(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const activeStaff = staff.filter(member => member.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Edit className="w-4 h-4 text-white" />
            </div>
            <span>Edit Task</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-200">Task Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter task title"
              className="glass-effect border-white/20 text-white placeholder-gray-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-200">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the task..."
              className="glass-effect border-white/20 text-white placeholder-gray-400 min-h-[100px]"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">Assign To</Label>
            <Select value={formData.assignedTo} onValueChange={(value) => handleInputChange('assignedTo', value)}>
              <SelectTrigger className="glass-effect border-white/20 text-white">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Select staff member" />
                </div>
              </SelectTrigger>
              <SelectContent className="glass-effect border-white/20">
                {activeStaff.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-200">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger className="glass-effect border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-effect border-white/20">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-gray-200">Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="pl-10 glass-effect border-white/20 text-white"
                />
              </div>
            </div>
          </div>

          {/* Subtasks Section */}
          {task && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ListChecks className="w-5 h-5 text-blue-400" />
                  <Label className="text-lg text-gray-200">Subtasks</Label>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowAddSubtask(true)}
                  variant="outline"
                  size="sm"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Subtask
                </Button>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <SubtaskList taskId={task.id} currentUser={user} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-200">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger className="glass-effect border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-effect border-white/20">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-gray-200">Deadline</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="pl-10 glass-effect border-white/20 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/20 text-gray-300 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Edit className="w-4 h-4 mr-2" />
              Update Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      
      {/* Add Subtask Dialog */}
      <AddSubtaskDialog
        open={showAddSubtask}
        onClose={() => setShowAddSubtask(false)}
        taskId={task.id}
      />
    </Dialog>
  );
};

export default EditTaskDialog;