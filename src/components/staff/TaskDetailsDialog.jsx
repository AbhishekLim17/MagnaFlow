// Task Details Dialog - View full task details and update status
// Staff member can see complete task information, change status, edit or delete

import React, { useState } from 'react';
import { Calendar, User, AlertCircle, CheckCircle, Edit, Trash2, ListChecks, Plus } from 'lucide-react';
import SubtaskList from '../SubtaskList';
import AddSubtaskDialog from '../AddSubtaskDialog';
import CommentSection from '../tasks/CommentSection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const TaskDetailsDialog = ({ task, open, onOpenChange, onStatusChange, onEdit, onDelete, currentUser }) => {
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  
  if (!task) return null;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No deadline';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-success-soft text-success border-success/30',
      medium: 'bg-warning-soft text-warning border-warning/30',
      high: 'bg-warning-soft text-warning border-warning/30',
      critical: 'bg-destructive-soft text-destructive border-destructive/30',
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-muted text-muted-foreground border-border',
      'in-progress': 'bg-primary-soft text-primary border-primary/30',
      completed: 'bg-success-soft text-success border-success/30',
    };
    return colors[status] || colors.pending;
  };

  const handleStatusChange = (newStatus) => {
    if (onStatusChange) {
      onStatusChange(task.id, newStatus);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-2xl font-bold text-foreground mb-4">
          Task Details
        </DialogTitle>

        <div className="space-y-6">
          {/* Task Title */}
          <div>
            <h3 className="text-xl font-semibold mb-2">{task.title}</h3>
            <div className="flex items-center space-x-2">
              <Badge className={`${getPriorityColor(task.priority)} border`}>
                {task.priority} priority
              </Badge>
              <Badge className={`${getStatusColor(task.status)} border`}>
                {task.status}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>
              <div className="p-4 bg-muted rounded-xl border border-border">
                <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              </div>
            </div>
          )}

          {/* Task Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deadline */}
            <div className="p-4 bg-muted rounded-xl border border-border">
              <div className="flex items-center space-x-2 text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                <Label className="text-sm">Deadline</Label>
              </div>
              <p className="text-foreground font-medium">{formatDate(task.deadline)}</p>
            </div>

            {/* Created Date */}
            <div className="p-4 bg-muted rounded-xl border border-border">
              <div className="flex items-center space-x-2 text-muted-foreground mb-2">
                <AlertCircle className="w-4 h-4" />
                <Label className="text-sm">Created On</Label>
              </div>
              <p className="text-foreground font-medium">{formatDate(task.createdAt)}</p>
            </div>
          </div>

          {/* Completed Date */}
          {task.completedAt && (
            <div className="p-4 bg-success-soft rounded-xl border border-success/30">
              <div className="flex items-center space-x-2 text-success mb-2">
                <CheckCircle className="w-4 h-4" />
                <Label className="text-sm">Completed On</Label>
              </div>
              <p className="text-foreground font-medium">{formatDate(task.completedAt)}</p>
            </div>
          )}

          {/* Status Update */}
          <div className="space-y-2">
            <Label>Update Status</Label>
            <Select
              value={task.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Change the status to reflect your progress on this task
            </p>
          </div>

          {/* Subtasks Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ListChecks className="w-5 h-5 text-primary" />
                <Label className="text-lg">Subtasks</Label>
              </div>
              <Button
                onClick={() => setShowAddSubtask(true)}
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary-soft"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Subtask
              </Button>
            </div>
            <div className="p-4 bg-muted rounded-xl border border-border">
              <SubtaskList taskId={task.id} currentUser={currentUser} />
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <div className="flex space-x-2">
              {task.status !== 'completed' && (
                <>
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      if (onEdit) onEdit(task);
                    }}
                    variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary-soft"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Task
                  </Button>
                  <Button
                    onClick={() => {
                      if (onDelete) {
                        onOpenChange(false);
                        onDelete(task.id, task.title);
                      }
                    }}
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive-soft"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Task
                  </Button>
                </>
              )}
              {task.status === 'completed' && (
                <Button
                  onClick={() => {
                    if (onDelete) {
                      onOpenChange(false);
                      onDelete(task.id, task.title);
                    }
                  }}
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive-soft"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Task
                </Button>
              )}
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Close
            </Button>
          </div>

          {/* Comments Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <CommentSection taskId={task.id} taskTitle={task.title} />
          </div>
        </div>
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

export default TaskDetailsDialog;
