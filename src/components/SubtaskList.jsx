import React, { useState, useEffect } from 'react';
import { Trash2, Edit, Save, X, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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

    return () => unsubscribe();
  }, [taskId]);

  const handleToggleComplete = async (subtaskId, currentStatus) => {
    try {
      await toggleSubtaskCompletion(subtaskId, !currentStatus);
    } catch (error) {
      console.error('Error toggling subtask:', error);
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
    return <p className="text-sm text-gray-400">Loading subtasks...</p>;
  }

  if (subtasks.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic py-4 text-center">
        No subtasks yet. Click "Add Subtask" to create one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-300">
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
              className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
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
                    className="flex-1 bg-gray-800/50 border-gray-700 text-white"
                    autoFocus
                  />
                  <Button
                    onClick={() => handleSaveEdit(subtask.id)}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-gray-300 hover:bg-gray-500/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleToggleComplete(subtask.id, subtask.completed)}
                    className="flex-shrink-0 text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    {subtask.completed ? (
                      <CheckSquare className="w-5 h-5 text-green-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${
                      subtask.completed
                        ? 'line-through text-gray-500'
                        : 'text-gray-200'
                    }`}
                  >
                    {subtask.title}
                  </span>
                  <Button
                    onClick={() => handleStartEdit(subtask)}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(subtask.id)}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
