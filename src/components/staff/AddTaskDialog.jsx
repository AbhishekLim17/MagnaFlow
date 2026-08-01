// Add Task Dialog - Staff member can create personal tasks
// Firebase integrated version

import React, { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { reportError } from '@/lib/reportError';

const AddTaskDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { createTask } = useTasks();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a task title.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a task description.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.dueDate) {
      toast({
        title: "Validation Error",
        description: "Please select a deadline for the task.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Creating task with data:', {
        title: formData.title,
        description: formData.description,
        assignedTo: user.id,
        priority: formData.priority,
        status: 'pending',
        deadline: formData.dueDate,
      });
      
      await createTask({
        title: formData.title,
        description: formData.description,
        assignedTo: user.id, // Assign to self
        priority: formData.priority,
        status: 'pending',
        deadline: formData.dueDate, // Changed from deadline to dueDate
      });

      toast({
        title: "Task Created",
        description: "Your personal task has been created successfully.",
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: ''
      });
      
      onOpenChange(false);
    } catch (error) {
      reportError(error, { title: "Error", fallback: "Failed to create task. Please try again." });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-success rounded-xl flex items-center justify-center">
              <Plus className="w-4 h-4 text-foreground" />
            </div>
            <span>Create Personal Task</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">Task Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter task title"
              className="surface border-border text-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the task..."
              className="surface border-border text-foreground min-h-[100px]"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger className="surface border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="surface border-border">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-foreground">Deadline *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="pl-10 surface border-border text-foreground"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted/60"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-success hover:bg-success/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskDialog;