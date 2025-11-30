import React, { useState } from 'react';
import { ListChecks, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import SubtaskList from '../SubtaskList';
import AddSubtaskDialog from '../AddSubtaskDialog';

const TaskSubtasksDialog = ({ open, onOpenChange, task }) => {
  const { user } = useAuth();
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  if (!task) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-effect border-white/20 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ListChecks className="w-6 h-6 text-blue-400" />
                <div>
                  <h2 className="text-xl gradient-text">Subtasks</h2>
                  <p className="text-sm text-gray-400 font-normal">{task.title}</p>
                </div>
              </div>
              <Button
                onClick={() => setShowAddSubtask(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Subtask
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <SubtaskList taskId={task.id} currentUser={user} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Subtask Dialog */}
      {user && (
        <AddSubtaskDialog
          open={showAddSubtask}
          onClose={() => setShowAddSubtask(false)}
          taskId={task.id}
          currentUser={user}
        />
      )}
    </>
  );
};

export default TaskSubtasksDialog;
