// One dialog for both adding and editing a staff member.
//
// These were previously two near-identical ~110-line blocks inside
// StaffManagementNew, which is how the department/project fields came to be
// added twice. They differ only in a few fields, expressed here as `mode`:
//   add  — password is required, email is editable, status is implicit
//   edit — email is fixed (it is the Firebase Auth identity), status is shown

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FIELD_CLASS = 'bg-muted border-border';

/**
 * @param {'add'|'edit'} mode
 * @param {Object} formData      controlled form state owned by the parent
 * @param {Function} setFormData
 * @param {Array} designations   [{id, name}]
 * @param {Array} departments    [{id, name}]
 * @param {Array} projects       [{id, name}]
 * @param {Function} onSubmit
 */
const StaffFormDialog = ({
  open,
  onOpenChange,
  mode = 'add',
  formData,
  setFormData,
  designations = [],
  departments = [],
  projects = [],
  onSubmit,
  onCancel,
}) => {
  const isAdd = mode === 'add';
  const set = (patch) => setFormData({ ...formData, ...patch });
  const idFor = (name) => (isAdd ? name : `edit-${name}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Add New Staff Member' : 'Edit Staff Member'}</DialogTitle>
          <DialogDescription>
            {isAdd
              ? 'Create a new staff account. They will be able to log in with these credentials.'
              : 'Update staff member information. Email cannot be changed.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor={idFor('name')}>Name *</Label>
            <Input
              id={idFor('name')}
              value={formData.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Enter full name"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <Label htmlFor={idFor('email')}>Email {isAdd && '*'}</Label>
            <Input
              id={idFor('email')}
              type="email"
              value={formData.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="Enter email address"
              className={FIELD_CLASS}
              // The email IS the Firebase Auth identity; changing it here would
              // desync the profile from the sign-in.
              disabled={!isAdd}
            />
          </div>

          {isAdd && (
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => set({ password: e.target.value })}
                placeholder="Enter password"
                className={FIELD_CLASS}
              />
            </div>
          )}

          <div>
            <Label htmlFor={idFor('designation')}>Designation</Label>
            <Select
              value={formData.designation}
              onValueChange={(value) => set({ designation: value })}
            >
              <SelectTrigger className={FIELD_CLASS}>
                <SelectValue placeholder="Select designation" />
              </SelectTrigger>
              <SelectContent>
                {designations.map((d) => (
                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isAdd && (
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => set({ status: value })}>
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={idFor('department')}>Department</Label>
              <Select
                value={formData.departmentId || 'none'}
                onValueChange={(v) => set({ departmentId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={FIELD_CLASS}>
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <p className="text-xs text-muted-foreground">
            Assigning a department or project lets that Department Head / Manager see this person on their dashboard.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSubmit}>{isAdd ? 'Add Staff' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffFormDialog;
