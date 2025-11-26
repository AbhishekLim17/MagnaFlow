import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, User } from 'lucide-react';
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
import { sendTaskAssignedEmail, sendCriticalTaskAlert } from '@/services/emailService';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers } from '@/services/userService';

const AddTaskDialog = ({ open, onOpenChange, onAddTask }) => {
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
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // Load staff from Firebase
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const staffData = await getAllUsers({ role: 'staff' });
      setStaff(staffData.filter(s => s.status === 'active'));
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🚀 handleSubmit called!');
    console.log('📝 Form data:', formData);
    console.log('👥 Staff list:', staff);
    
    if (!formData.title.trim() || !formData.assignedTo) {
      console.warn('⚠️ Validation failed - missing title or assignedTo');
      return;
    }

    setIsSending(true);

    try {
      // Add the task
      onAddTask({
        ...formData,
        assignedTo: formData.assignedTo // Keep as string (Firebase ID)
      });
      
      console.log('✅ Task added, now finding staff member...');
      
      // Send email notification to assigned staff member
      const assignedStaffMember = staff.find(s => s.id === formData.assignedTo);
      
      console.log('📧 Sending email to:', assignedStaffMember);
      
      if (assignedStaffMember && assignedStaffMember.email) {
        const emailParams = {
          toEmail: assignedStaffMember.email,
          toName: assignedStaffMember.name,
          taskTitle: formData.title,
          taskDescription: formData.description || 'No description provided',
          taskPriority: formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1),
          dueDate: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString() : 'Not specified',
          assignedBy: user?.name || 'Admin',
        };

        console.log('📧 Email params:', emailParams);

        // Send critical alert for high priority tasks, otherwise regular notification
        if (formData.priority === 'critical') {
          const result = await sendCriticalTaskAlert(emailParams);
          console.log('📧 Critical email result:', result);
        } else {
          const result = await sendTaskAssignedEmail(emailParams);
          console.log('📧 Email result:', result);
        }
      } else {
        console.warn('⚠️ No email address found for staff member:', assignedStaffMember);
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
      // Continue even if email fails - task is already created
    } finally {
      setIsSending(false);
    }
    
    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      status: 'pending',
      assignedTo: ''
    });
    
    onOpenChange(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const activeStaff = staff;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span>Create New Task</span>
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
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} ({member.email})
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
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

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

          <DialogFooter className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/20 text-gray-300 hover:bg-white/10"
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  Sending...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskDialog;