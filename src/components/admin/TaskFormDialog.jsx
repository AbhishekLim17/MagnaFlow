// One dialog for creating and editing a task.
//
// These were two ~130-line blocks inside TaskManagementNew that differed only
// in their title, placeholders and submit handler — every field was duplicated
// verbatim. That is how the start-date and project fields came to be added
// twice when the Gantt chart was introduced.

import React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FIELD_CLASS = 'bg-gray-800/50 border-gray-700';

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
  onSubmit,
  onCancel,
}) => {
  const isAdd = mode === 'add';
  const set = (patch) => setFormData({ ...formData, ...patch });
  const idFor = (name) => (isAdd ? name : `edit-${name}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue placeholder={isAdd ? 'Select staff member' : undefined} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.designation || 'Staff'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={idFor('priority')}>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => set({ priority: v })}>
                <SelectTrigger className={FIELD_CLASS}>
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
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
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
                value={formData.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <Label htmlFor={idFor('project')}>Project</Label>
              <Select
                value={formData.projectId || 'none'}
                onValueChange={(v) => set({ projectId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={FIELD_CLASS}>
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
