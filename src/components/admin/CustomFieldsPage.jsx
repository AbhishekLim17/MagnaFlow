// Custom fields (org admins): the organisation's own task fields. They show in the task form
// and task details, and as extra columns in the CSV export.
import React, { useId, useState } from 'react';
import { ListPlus, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FieldError from '@/components/shared/FieldError';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { saveCustomField, deleteCustomField } from '@/services/customFieldService';
import { FIELD_TYPES, MAX_FIELDS, fieldProblem } from '@/lib/customFields';
import { reportError } from '@/lib/reportError';

const FieldDialog = ({ initial, onClose }) => {
  const id = useId();
  const { currentUser } = useAuth();
  const [field, setField] = useState({ ...initial, optionsText: (initial.options || []).join('\n') });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = { ...field, options: field.optionsText.split('\n').map((s) => s.trim()).filter(Boolean) };
    const problem = fieldProblem(next);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      await saveCustomField(currentUser.orgId, next);
      onClose();
    } catch (err) {
      reportError(err, { title: "Couldn't save the field" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.id ? 'Edit field' : 'New field'}</DialogTitle>
          <DialogDescription>It appears on every task in the organisation.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} className="mt-1" maxLength={60} value={field.name} onChange={(e) => { setField((f) => ({ ...f, name: e.target.value })); setError(''); }} />
          </div>
          <div>
            <Label htmlFor={`${id}-type`}>Type</Label>
            <select id={`${id}-type`} className="mt-1 h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm" value={field.type}
              onChange={(e) => { setField((f) => ({ ...f, type: e.target.value })); setError(''); }} disabled={Boolean(initial.id)}>
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {initial.id && <p className="mt-1 text-xs text-muted-foreground">The type cannot change once tasks may hold values.</p>}
          </div>
          {field.type === 'select' && (
            <div>
              <Label htmlFor={`${id}-options`}>Choices (one per line)</Label>
              <Textarea id={`${id}-options`} className="mt-1" rows={4} value={field.optionsText} onChange={(e) => { setField((f) => ({ ...f, optionsText: e.target.value })); setError(''); }} />
            </div>
          )}
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} disabled={saving}>{saving ? 'Saving…' : 'Save field'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CustomFieldsPage = () => {
  const { currentUser } = useAuth();
  const { customFields } = useTasks();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);

  const remove = async (f) => {
    const ok = await confirm({ title: `Delete “${f.name}”?`, description: 'Its values stay on the tasks but are no longer shown.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await deleteCustomField(currentUser.orgId, f.id);
    } catch (error) {
      reportError(error, { title: "Couldn't delete the field" });
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" aria-hidden="true" />
            Task fields
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Your own fields on every task: a client reference, a cost centre, a size… They show in the task form and details, and in the CSV export.</p>
        </div>
        <Button type="button" onClick={() => setEditing({ name: '', type: 'text', options: [] })} disabled={customFields.length >= MAX_FIELDS}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New field
        </Button>
      </CardHeader>
      <CardContent>
        {customFields.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No custom fields yet.</p>
        ) : (
          <ul className="space-y-2">
            {customFields.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground">{f.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label}
                    {f.type === 'select' ? `: ${(f.options || []).join(', ')}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${f.name}`} onClick={() => remove(f)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && <FieldDialog initial={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
};

export default CustomFieldsPage;
