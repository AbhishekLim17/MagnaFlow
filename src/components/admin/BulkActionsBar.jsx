// Bulk edit for the task list: change status, priority, assignee or deadline of every
// selected task at once, or delete them. TasksContext does the writes (one toast, Undo).
import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useTasks } from '@/contexts/TasksContext';

const BulkActionsBar = ({ selectedIds, visibleIds, onSelectAll, onClear, people = [] }) => {
  const { bulkUpdateTasks, bulkDeleteTasks } = useTasks();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState('');
  const count = selectedIds.length;
  if (!count) return null;

  const run = async (work) => {
    setBusy(true);
    try {
      await work();
      onClear();
    } finally {
      setBusy(false);
    }
  };
  const apply = (patch) => run(() => bulkUpdateTasks(selectedIds, patch));
  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${count} task${count === 1 ? '' : 's'}?`,
      description: 'This cannot be undone. Their subtasks and comments go with them.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await run(() => bulkDeleteTasks(selectedIds));
  };
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="z-10 flex flex-wrap sm:sticky sm:top-24 items-center gap-2 rounded-xl border border-primary/30 bg-card p-3 shadow-card"
    >
      <p className="mr-1 text-sm font-semibold" aria-live="polite">{count} selected</p>
      {!allVisible && (
        <Button type="button" variant="ghost" size="sm" onClick={onSelectAll} disabled={busy}>
          Select all {visibleIds.length}
        </Button>
      )}
      <Select value="" onValueChange={(status) => apply({ status })} disabled={busy}>
        <SelectTrigger className="h-9 w-[140px]" aria-label="Set status of selected tasks"><SelectValue placeholder="Status…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in-progress">In progress</SelectItem>
          <SelectItem value="review">In review</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value="" onValueChange={(priority) => apply({ priority })} disabled={busy}>
        <SelectTrigger className="h-9 w-[130px]" aria-label="Set priority of selected tasks"><SelectValue placeholder="Priority…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Select value="" onValueChange={(assignedTo) => apply({ assignedTo })} disabled={busy || !people.length}>
        <SelectTrigger className="h-9 w-[160px]" aria-label="Assign selected tasks to"><SelectValue placeholder="Assign to…" /></SelectTrigger>
        <SelectContent>
          {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>)}
        </SelectContent>
      </Select>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => { e.preventDefault(); if (deadline) apply({ deadline }); }}
      >
        <Input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          aria-label="New deadline for selected tasks"
          className="h-9 w-[150px]"
          disabled={busy}
        />
        <Button type="submit" size="sm" variant="outline" disabled={busy || !deadline}>Set deadline</Button>
      </form>
      <div className="ml-auto flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={onClear} aria-label="Clear selection" disabled={busy}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default BulkActionsBar;
