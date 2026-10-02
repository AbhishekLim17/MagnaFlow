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
import PasswordField from '@/components/shared/PasswordField';
import FieldError from '@/components/shared/FieldError';
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
 * @param {{name?: string, email?: string, password?: string}} [errors]  inline messages, shown beside each field
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
  errors = {},
}) => {
  const isAdd = mode === 'add';
  const set = (patch) => setFormData({ ...formData, ...patch });
  const idFor = (name) => (isAdd ? name : `edit-${name}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Add New Staff Member' : 'Edit Staff Member'}</DialogTitle>
          <DialogDescription>
            {isAdd
              ? 'Create a new staff account. They will be able to log in with these credentials.'
              : 'Update staff member information. Email cannot be changed.'}
          </DialogDescription>
        </DialogHeader>

        {/* A real form, so Enter submits and errors can sit beside the fields. */}
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        >
          <div>
            <Label htmlFor={idFor('name')}>Name *</Label>
            <Input
              id={idFor('name')}
              value={formData.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Enter full name"
              className={FIELD_CLASS}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? idFor('name-error') : undefined}
            />
            <FieldError id={idFor('name-error')}>{errors.name}</FieldError>
          </div>

          <div>
            <Label htmlFor={idFor('email')}>Email {isAdd && '*'}</Label>
            <Input
              id={idFor('email')}
              type="email"
              value={formData.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="name@company.com"
              className={FIELD_CLASS}
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? idFor('email-error') : undefined}
              // The email IS the Firebase Auth identity; changing it here would
              // desync the profile from the sign-in.
              disabled={!isAdd}
            />
            <FieldError id={idFor('email-error')}>{errors.email}</FieldError>
          </div>

          {isAdd && (
            <PasswordField
              id="staff-password"
              value={formData.password}
              onChange={(password) => set({ password })}
              email={formData.email}
              error={errors.password}
              generate
              hint="At least 8 characters. Share it with them securely; they can change it after signing in."
            />
          )}

          <div>
            <Label htmlFor={idFor('designation')}>Designation</Label>
            <Select
              value={formData.designation}
              onValueChange={(value) => set({ designation: value })}
            >
              <SelectTrigger id={idFor('designation')} className={FIELD_CLASS}>
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
                <SelectTrigger id="edit-status" className={FIELD_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={idFor('department')}>Department</Label>
              <Select
                value={formData.departmentId || 'none'}
                onValueChange={(v) => set({ departmentId: v === 'none' ? '' : v })}
              >
                <SelectTrigger id={idFor('department')} className={FIELD_CLASS}>
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

          <p className="text-xs text-muted-foreground">
            Assigning a department or project lets that Department Head / Manager see this person on their dashboard.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">{isAdd ? 'Add Staff' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StaffFormDialog;
