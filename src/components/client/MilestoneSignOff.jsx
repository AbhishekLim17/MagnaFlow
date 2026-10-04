// The client's sign-off on a milestone the team has put up for review or finished:
// approve it, or ask for changes (saying what). A decision can be changed later.
import React, { useId, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import FieldError from '@/components/shared/FieldError';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { approvalSummary, canDecide, MAX_NOTE } from '@/lib/clientThread';
import { formatDate } from '@/lib/format';

const MilestoneSignOff = ({ task, onDecide }) => {
  const id = useId();
  const confirm = useConfirm();
  const [mode, setMode] = useState('idle'); // idle | changes | choosing
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const decided = approvalSummary(task);
  const open = canDecide(task);

  const run = async (decision, text) => {
    setBusy(true);
    try {
      await onDecide(task, decision, text);
      setMode('idle');
      setNote('');
      setError('');
    } catch {
      setError("Couldn't send your decision. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    const ok = await confirm({
      title: `Approve “${task.title}”?`,
      description: 'Your project team will be told straight away.',
      confirmLabel: 'Approve',
    });
    if (ok) await run('approved', '');
  };

  const requestChanges = async (e) => {
    e.preventDefault();
    if (!note.trim()) { setError('Say what needs to change, so the team can act on it.'); return; }
    await run('changes_requested', note);
  };

  const summary = decided && (
    <p className={`flex items-center gap-1.5 text-xs font-medium ${decided.decision === 'approved' ? 'text-success' : 'text-warning'}`}>
      {decided.decision === 'approved'
        ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
      {decided.decision === 'approved' ? `Approved by ${decided.by}` : `Changes requested by ${decided.by}`}
      {decided.at && <span className="font-normal text-muted-foreground">· {formatDate(decided.at)}</span>}
    </p>
  );

  if (!open) return summary || null;

  if (mode === 'changes') {
    return (
      <form onSubmit={requestChanges} className="space-y-2" noValidate>
        {summary}
        <label htmlFor={`${id}-note`} className="text-sm font-medium text-foreground">What needs to change?</label>
        <Textarea
          id={`${id}-note`}
          rows={3}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => { setNote(e.target.value); if (error) setError(''); }}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus
        />
        <FieldError id={`${id}-error`}>{error}</FieldError>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setMode('idle'); setError(''); }}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      {summary}
      {decided && mode !== 'choosing' ? (
        <Button type="button" size="sm" variant="ghost" className="h-9 px-2" onClick={() => setMode('choosing')}>
          Change your decision
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!decided && <span className="text-xs text-muted-foreground">Ready for your sign-off:</span>}
          <Button type="button" size="sm" disabled={busy} onClick={approve}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Approve
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setMode('changes')}>
            Request changes
          </Button>
        </div>
      )}
      <FieldError id={`${id}-error`}>{mode !== 'changes' ? error : ''}</FieldError>
    </div>
  );
};

export default MilestoneSignOff;
