// One dialog for creating and editing a task.
//
// These were two ~130-line blocks inside TaskManagementNew that differed only
// in their title, placeholders and submit handler — every field was duplicated
// verbatim. That is how the start-date and project fields came to be added
// twice when the Gantt chart was introduced.

import React from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { dependsOn } from '@/lib/dependencies';
import { roleLabel } from '@/lib/taskLabels';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { REPEAT_OPTIONS, repeatFromOption, nextOccurrence } from '@/lib/recurrence';
import { formatDate } from '@/lib/format';

const FIELD_CLASS = 'bg-muted border-border';

// What the Repeat field says will happen next.
const repeatHint = (option, deadline) => {
  const repeat = repeatFromOption(option, { deadline });
  if (!repeat) return null;
  if (!deadline) return 'Set a deadline: the schedule counts from it.';
  const next = nextOccurrence(repeat, 0, deadline);
  return `When this task is completed, the next one is created (within the hour), due ${formatDate(next.deadline)}.`;
};

/**
 * @param {'add'|'edit'} mode
 * @param {Object} formData    controlled form state owned by the parent
 * @param {Array} staff        assignable users, already scoped to the caller's role
 * @param {Array} projects     selectable projects, already scoped
 */
const TaskFormDialog = ({
  open,
  onOpenChange,
  mode = 'add',
  formData,
  setFormData,
  staff = [],
  projects = [],
  tasks = [],
  taskId,
  onSubmit,
  onCancel,
}) => {
  const isAdd = mode === 'add';
  const set = (patch) => setFormData({ ...formData, ...patch });
  // Candidate prerequisites: never the task itself, and never a task that already
  // depends on it (directly or transitively) - that would be a loop.
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const idFor = (name) => (isAdd ? name : `edit-${name}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Create New Task' : 'Edit Task'}</DialogTitle>
          <DialogDescription>
            {isAdd ? 'Assign a new task to a team member' : 'Update task information'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor={idFor('title')}>Task Title *</Label>
            <Input
              id={idFor('title')}
              value={formData.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={isAdd ? 'Enter task title' : undefined}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <Label htmlFor={idFor('description')}>Description</Label>
            <Textarea
              id={idFor('description')}
              value={formData.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder={isAdd ? 'Enter task description' : undefined}
              className={`${FIELD_CLASS} min-h-[100px]`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={idFor('assignedTo')}>Assign To *</Label>
              <Select value={formData.assignedTo} onValueChange={(v) => set({ assignedTo: v })}>
                <SelectTrigger id={idFor('assignedTo')} className={FIELD_CLASS}>
                  <SelectValue placeholder={isAdd ? 'Select a person' : undefined} />
                </SelectTrigger>
                <SelectContent>
                  {/* Deactivated people are not offered as new assignees, but an
                      existing assignment to one stays visible so editing does not blank it. */}
                  {staff
                    .filter((member) => member.status !== 'inactive' || member.id === formData.assignedTo)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email} · {member.designation || roleLabel(member.role)}
                        {member.status === 'inactive' ? ' (deactivated)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={idFor('priority')}>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => set({ priority: v })}>
                <SelectTrigger id={idFor('priority')} className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={idFor('status')}>Status</Label>
              <Select value={formData.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger id={idFor('status')} className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={idFor('deadline')}>Deadline</Label>
              <Input
                id={idFor('deadline')}
                type="date"
                value={formData.deadline}
                min={formData.startDate || undefined}
                onChange={(e) => set({ deadline: e.target.value })}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={idFor('startDate')}>Start Date</Label>
              <Input
                id={idFor('startDate')}
                type="date"
                value={formData.milestone ? '' : formData.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
                className={FIELD_CLASS}
                disabled={Boolean(formData.milestone)}
                aria-describedby={formData.milestone ? idFor('milestone-hint') : undefined}
              />
            </div>
            <div>
              <Label htmlFor={idFor('project')}>Project</Label>
              <Select
                value={formData.projectId || 'none'}
                onValueChange={(v) => set({ projectId: v === 'none' ? '' : v })}
              >
                <SelectTrigger id={idFor('project')} className={FIELD_CLASS}>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>


          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              checked={Boolean(formData.milestone)}
              onChange={(e) => set({ milestone: e.target.checked })}
            />
            <span>
              <span className="font-medium text-foreground">This is a milestone</span>
              <span id={idFor('milestone-hint')} className="block text-xs text-muted-foreground">
                A key date, such as a sign-off or a launch. It has one date (the deadline), shows as a
                diamond on the timeline and is listed for clients.
              </span>
            </span>
          </label>

          <div>
            <Label htmlFor={idFor('repeat')}>Repeat</Label>
            <Select value={formData.repeat || 'none'} onValueChange={(v) => set({ repeat: v })}>
              <SelectTrigger id={idFor('repeat')} className={FIELD_CLASS} aria-describedby={idFor('repeat-hint')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p id={idFor('repeat-hint')} className="mt-1 text-xs text-muted-foreground">
              {repeatHint(formData.repeat, formData.deadline) || 'For work that comes round regularly: reports, reviews, payroll.'}
            </p>
          </div>

          {/* Depends On (blockedBy) multi-select */}
          {tasks.length > 0 && (
            <div>
              <Label htmlFor={idFor('blockedBy')}>Depends On <span className="text-muted-foreground text-xs font-normal">(blocked by)</span></Label>
              <Select
                value=""
                onValueChange={(v) => {
                  const current = formData.blockedBy || [];
                  if (!current.includes(v)) set({ blockedBy: [...current, v] });
                }}
              >
                <SelectTrigger id={idFor('blockedBy')} className={FIELD_CLASS}>
                  <SelectValue placeholder="Add a prerequisite task…" />
                </SelectTrigger>
                <SelectContent>
                  {tasks
                    .filter((t) => (!taskId || !dependsOn(t.id, taskId, tasksById)) && !(formData.blockedBy || []).includes(t.id) && (!formData.projectId || !t.projectId || t.projectId === formData.projectId))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {(formData.blockedBy || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(formData.blockedBy || []).map((depId) => {
                    const dep = tasks.find((t) => t.id === depId);
                    if (!dep) return null;
                    return (
                      <span
                        key={depId}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 border border-primary/20"
                      >
                        {dep.title}
                        <button
                          type="button"
                          aria-label={`Remove dependency on ${dep.title}`}
                          onClick={() => set({ blockedBy: (formData.blockedBy || []).filter((id) => id !== depId) })}
                          className="ml-0.5 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSubmit}>{isAdd ? 'Create Task' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskFormDialog;

