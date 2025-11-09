// Task Details Dialog - View full task details and update status
// Staff member can see complete task information, change status, edit or delete

import React from 'react';
import { Calendar, User, AlertCircle, CheckCircle, Edit, Trash2 } from 'lucide-react';
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

const TaskDetailsDialog = ({ task, open, onOpenChange, onStatusChange, onEdit, onDelete }) => {
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
      low: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'in-progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
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
      <DialogContent className="glass-effect border-white/20 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold gradient-text">
            Task Details
          </DialogTitle>
        </DialogHeader>

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
              <Label className="text-gray-300">Description</Label>
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-gray-300 whitespace-pre-wrap">{task.description}</p>
              </div>
            </div>
          )}

          {/* Task Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deadline */}
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-2 text-gray-400 mb-2">
                <Calendar className="w-4 h-4" />
                <Label className="text-sm">Deadline</Label>
              </div>
              <p className="text-white font-medium">{formatDate(task.deadline)}</p>
            </div>

            {/* Created Date */}
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-2 text-gray-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <Label className="text-sm">Created On</Label>
              </div>
              <p className="text-white font-medium">{formatDate(task.createdAt)}</p>
            </div>
          </div>

          {/* Completed Date */}
          {task.completedAt && (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex items-center space-x-2 text-green-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                <Label className="text-sm">Completed On</Label>
              </div>
              <p className="text-white font-medium">{formatDate(task.completedAt)}</p>
            </div>
          )}

          {/* Status Update */}
          <div className="space-y-2">
            <Label>Update Status</Label>
            <Select
              value={task.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              Change the status to reflect your progress on this task
            </p>
          </div>

          {/* Close Button */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-800">
            <div className="flex space-x-2">
              {task.status !== 'completed' && (
                <>
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      if (onEdit) onEdit(task);
                    }}
                    variant="outline"
                    className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
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
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
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
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Task
                </Button>
              )}
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800/50"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailsDialog;
