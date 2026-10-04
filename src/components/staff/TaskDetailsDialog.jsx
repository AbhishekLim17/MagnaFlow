// Task Details Dialog - everything about one task, in one place: who has it, when it is
// due, what it is waiting on, its subtasks and its conversation. Status can be changed
// by whoever is allowed to (the caller passes onStatusChange only for them); editing and
// deleting are for the task's creator.

import React, { useState } from 'react';
import { Calendar, User, Clock, CheckCircle, Edit, Trash2, ListChecks, Plus, Lock, Repeat } from 'lucide-react';
import SubtaskList from '../SubtaskList';
import AddSubtaskDialog from '../AddSubtaskDialog';
import CommentSection from '../tasks/CommentSection';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/contexts/TasksContext';
import { formatDate, formatDateLong } from '@/lib/format';
import { statusLabel, priorityLabel } from '@/lib/taskLabels';
import { describeDeadline, isOverdueTask } from '@/lib/taskState';
import { isResolved } from '@/lib/dependencies';
import { describeRepeat } from '@/lib/recurrence';

const PRIORITY_STYLES = {
  low: 'bg-success-soft text-success border-success/30',
  medium: 'bg-info-soft text-info border-info/30',
  high: 'bg-warning-soft text-warning border-warning/40',
  critical: 'bg-destructive-soft text-destructive border-destructive/30',
};

const STATUS_STYLES = {
  pending: 'bg-muted text-muted-foreground border-border',
  'in-progress': 'bg-primary-soft text-primary border-primary/30',
  review: 'bg-warning-soft text-warning border-warning/40',
  completed: 'bg-success-soft text-success border-success/30',
  cancelled: 'bg-muted text-muted-foreground border-border line-through',
};

const TONE_CLASSES = {
  danger: 'text-destructive font-semibold',
  warning: 'text-warning font-medium',
  muted: 'text-muted-foreground',
};

const Fact = ({ icon: Icon, label, children, sub }) => (
  <div className="p-4 bg-muted rounded-xl border border-border">
    <div className="flex items-center space-x-2 text-muted-foreground mb-2">
      <Icon className="w-4 h-4" aria-hidden="true" />
      <Label className="text-sm">{label}</Label>
    </div>
    <p className="text-foreground font-medium">{children}</p>
    {sub}
  </div>
);

/**
 * @param {Object}   task
 * @param {Function} [onStatusChange]  (taskId, status) => void; the status control is only shown when given
 * @param {Function} [onEdit]          shown to the task's creator
 * @param {Function} [onDelete]        shown to the task's creator
 * @param {Function} [getUserName]     (uid) => name, to show who a task is assigned to
 * @param {Object}   currentUser
 */
const TaskDetailsDialog = ({ task, open, onOpenChange, onStatusChange, onEdit, onDelete, getUserName, currentUser }) => {
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const { tasks } = useTasks();

  if (!task) return null;

  // Editing and deleting are for whoever created the task (an errand of your own, or
  // work you handed out). An assignee reports progress; they cannot retitle, re-date
  // or delete work someone else gave them - the security rules refuse it too.
  const canEditOrDelete = Boolean(currentUser?.uid) && task.createdBy === currentUser.uid;
  const isMine = Boolean(currentUser?.uid) && task.assignedTo === currentUser.uid;

  const assignee = (() => {
    if (!task.assignedTo) return 'Unassigned';
    if (isMine) return 'You';
    return getUserName?.(task.assignedTo) || 'Someone else';
  })();

  const deadline = describeDeadline(task);
  const overdue = isOverdueTask(task);

  // What this task is waiting for. Looked up in the tasks this person can see; a
  // prerequisite they cannot see is still listed, just without a name.
  const prerequisites = (Array.isArray(task.blockedBy) ? task.blockedBy : []).map((id) => {
    const found = (tasks || []).find((t) => t.id === id);
    return { id, title: found?.title, status: found?.status, known: Boolean(found) };
  });
  const waitingOn = prerequisites.filter((p) => !p.known || !isResolved(p.status));

  const handleStatusChange = (newStatus) => {
    if (onStatusChange) onStatusChange(task.id, newStatus);
  };

  const hasActions = canEditOrDelete && (onEdit || onDelete);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <DialogTitle className="text-xl font-semibold mb-2 pr-8">{task.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Details, subtasks and comments for this task.
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-2">
              {task.milestone && (
                <Badge className="bg-primary-soft text-primary border border-primary/30">◆ Milestone</Badge>
              )}
              <Badge className={`${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium} border`}>
                {priorityLabel(task.priority)} priority
              </Badge>
              <Badge className={`${STATUS_STYLES[task.status] || STATUS_STYLES.pending} border`}>
                {statusLabel(task.status)}
              </Badge>
              {overdue && (
                <Badge className="bg-destructive-soft text-destructive border border-destructive/30">Overdue</Badge>
              )}
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

          {/* Waiting on */}
          {waitingOn.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning-soft p-4" role="note">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Lock className="w-4 h-4" aria-hidden="true" />
                Waiting on {waitingOn.length === 1 ? 'one task' : `${waitingOn.length} tasks`}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {waitingOn.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{p.known ? p.title || 'Untitled task' : 'A task you cannot see'}</span>
                    {p.known && <span className="text-muted-foreground">· {statusLabel(p.status)}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">This task cannot be started until these are completed.</p>
            </div>
          )}

          {/* Facts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Fact icon={User} label="Assigned to">{assignee}</Fact>
            <Fact
              icon={Calendar}
              label="Deadline"
              sub={(
                <p className={`text-sm mt-1 ${TONE_CLASSES[deadline.tone]}`}>{deadline.label}</p>
              )}
            >
              {task.deadline ? formatDateLong(task.deadline) : 'No deadline set'}
            </Fact>
            <Fact icon={Clock} label="Created">
              {formatDate(task.createdAt)}
              {task.createdBy && currentUser?.uid === task.createdBy ? ' · by you' : ''}
            </Fact>
            {task.completedAt && (
              <Fact icon={CheckCircle} label="Completed">{formatDate(task.completedAt)}</Fact>
            )}
            {task.repeat && (
              <Fact icon={Repeat} label="Repeats">
                {describeRepeat(task.repeat).replace(/^./, (c) => c.toUpperCase())}
                {task.repeating === false && task.nextId ? ' · next one created' : ''}
              </Fact>
            )}
          </div>

          {/* Status */}
          {onStatusChange && (
            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger id="task-status" className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In progress</SelectItem>
                  <SelectItem value="review">In review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Update this to show how the work is going.
              </p>
            </div>
          )}

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ListChecks className="w-5 h-5 text-primary" aria-hidden="true" />
                <Label className="text-lg">Subtasks</Label>
              </div>
              <Button
                onClick={() => setShowAddSubtask(true)}
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary-soft"
              >
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                Add subtask
              </Button>
            </div>
            <div className="p-4 bg-muted rounded-xl border border-border">
              <SubtaskList taskId={task.id} currentUser={currentUser} />
            </div>
          </div>

          {/* Actions (the dialog's own close button handles closing) */}
          {hasActions && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
              {onEdit && task.status !== 'completed' && (
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(task);
                  }}
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary-soft"
                >
                  <Edit className="w-4 h-4 mr-2" aria-hidden="true" />
                  Edit task
                </Button>
              )}
              {onDelete && (
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(task.id, task.title);
                  }}
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive-soft"
                >
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Delete task
                </Button>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="pt-6 border-t border-border">
            <CommentSection taskId={task.id} taskTitle={task.title} />
          </div>
        </div>
      </DialogContent>

      <AddSubtaskDialog
        open={showAddSubtask}
        onClose={() => setShowAddSubtask(false)}
        taskId={task.id}
      />
    </Dialog>
  );
};

export default TaskDetailsDialog;
