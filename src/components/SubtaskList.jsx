import React, { useState, useEffect } from 'react';
import { Trash2, Edit, Save, X, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { safeUnsubscribe } from '@/lib/safeUnsubscribe';
import {
  subscribeToSubtasks,
  toggleSubtaskCompletion,
  updateSubtask,
  deleteSubtask,
  calculateSubtaskProgress
} from '../services/subtaskService';

const SubtaskList = ({ taskId, currentUser }) => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (!taskId) return;

    setLoading(true);
    const unsubscribe = subscribeToSubtasks(taskId, (updatedSubtasks) => {
      setSubtasks(updatedSubtasks);
      setLoading(false);
    });

    return () => safeUnsubscribe(unsubscribe);
  }, [taskId]);

  const handleToggleComplete = async (subtaskId, currentStatus) => {
    try {
      // Optimistic update - update UI immediately
      setSubtasks(prevSubtasks => 
        prevSubtasks.map(s => 
          s.id === subtaskId ? { ...s, completed: !currentStatus } : s
        )
      );
      
      // Then update database
      await toggleSubtaskCompletion(subtaskId, !currentStatus, taskId);
    } catch (error) {
      console.error('Error toggling subtask:', error);
      // Revert optimistic update on error
      setSubtasks(prevSubtasks => 
        prevSubtasks.map(s => 
          s.id === subtaskId ? { ...s, completed: currentStatus } : s
        )
      );
      alert('Failed to update subtask');
    }
  };

  const handleStartEdit = (subtask) => {
    setEditingId(subtask.id);
    setEditTitle(subtask.title);
  };

  const handleSaveEdit = async (subtaskId) => {
    try {
      if (!editTitle.trim()) {
        alert('Subtask title cannot be empty');
        return;
      }

      await updateSubtask(subtaskId, { title: editTitle.trim() });
      setEditingId(null);
      setEditTitle('');
    } catch (error) {
      console.error('Error updating subtask:', error);
      alert('Failed to update subtask');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = async (subtaskId) => {
    if (!window.confirm('Are you sure you want to delete this subtask?')) {
      return;
    }

    try {
      await deleteSubtask(subtaskId);
    } catch (error) {
      console.error('Error deleting subtask:', error);
      alert('Failed to delete subtask');
    }
  };

  const progress = calculateSubtaskProgress(subtasks);
  const completedCount = subtasks.filter(s => s.completed).length;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading subtasks...</p>;
  }

  if (subtasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4 text-center">
        No subtasks yet. Click "Add Subtask" to create one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            Progress: {completedCount} / {subtasks.length} completed ({progress}%)
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Subtasks List */}
      <div className="space-y-2">
        {subtasks.map((subtask) => {
          const isEditing = editingId === subtask.id;

          return (
            <div
              key={subtask.id}
              className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-border hover:border-border transition-colors"
            >
              {isEditing ? (
                <>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit(subtask.id);
                      }
                    }}
                    className="flex-1 bg-muted border-border text-foreground"
                    autoFocus
                  />
                  <Button
                    onClick={() => handleSaveEdit(subtask.id)}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-success hover:text-success hover:bg-success-soft"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleToggleComplete(subtask.id, subtask.completed)}
                    className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {subtask.completed ? (
                      <CheckSquare className="w-5 h-5 text-success" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${
                      subtask.completed
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {subtask.title}
                  </span>
                  <Button
                    onClick={() => handleStartEdit(subtask)}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:text-primary hover:bg-primary-soft"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(subtask.id)}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive-soft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubtaskList;
