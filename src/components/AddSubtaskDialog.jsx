import React, { useState } from 'react';
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
import { addSubtask } from '../services/subtaskService';
import { useAuth } from '@/contexts/AuthContext';

const AddSubtaskDialog = ({ open, onClose, taskId }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Subtask title is required');
      return;
    }

    if (title.trim().length > 200) {
      setError('Subtask title must be less than 200 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Adding subtask with:', {
        taskId: taskId,
        title: title.trim(),
        currentUser: currentUser,
        userId: currentUser?.uid
      });
      
      if (!currentUser || !currentUser.uid) {
        throw new Error('User not authenticated. Please refresh and try again.');
      }
      
      if (!taskId) {
        throw new Error('Task ID is missing. Please close and reopen this dialog.');
      }
      
      await addSubtask(taskId, title.trim(), currentUser.uid);
      setTitle('');
      onClose();
    } catch (error) {
      console.error('Error adding subtask:', error);
      setError(error.message || 'Failed to add subtask. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="surface border-border text-foreground">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Subtask</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subtask-title">Subtask Title</Label>
              <Textarea
                id="subtask-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError('');
                }}
                placeholder="Enter subtask description"
                className="bg-muted border-border text-foreground min-h-[80px]"
                disabled={loading}
                required
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {title.length}/200 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              disabled={loading}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? 'Adding...' : 'Add Subtask'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSubtaskDialog;
