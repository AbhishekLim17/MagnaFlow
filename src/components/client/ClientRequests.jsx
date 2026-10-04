// The client's requests for one project: ask the team for something, and see what became of
// earlier requests (waiting, accepted, declined and why). A new request can be withdrawn.
import React, { useEffect, useId, useState } from 'react';
import { Inbox, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldError from '@/components/shared/FieldError';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { createRequest, listProjectRequests, withdrawRequest } from '@/services/clientRequestService';
import { MAX_DETAILS, MAX_TITLE, REQUEST_STATUS, URGENCY, requestProblems, sortRequests } from '@/lib/clientRequests';
import { formatDate, toInputDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const EMPTY = { title: '', details: '', urgency: 'normal', neededBy: '' };
const STATUS_STYLE = {
  new: 'bg-muted text-muted-foreground',
  accepted: 'bg-success/10 text-success border-success/30',
  declined: 'bg-warning-soft text-warning border-warning/40',
};

const ClientRequests = ({ orgId, projectId, author }) => {
  const id = useId();
  const confirm = useConfirm();
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!orgId || !projectId) return undefined;
    let cancelled = false;
    listProjectRequests(orgId, projectId)
      .then((list) => { if (!cancelled) setRequests(list); })
      .catch((error) => reportError(error, { title: "Couldn't load your requests", silent: true }));
    return () => { cancelled = true; };
  }, [orgId, projectId]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };

  const submit = async (e) => {
    e.preventDefault();
    const problems = requestProblems(form);
    if (Object.keys(problems).length) { setErrors(problems); return; }
    setSending(true);
    try {
      const created = await createRequest({ orgId, projectId, author, ...form });
      setRequests((list) => sortRequests([created, ...list]));
      setForm(EMPTY);
      setOpen(false);
      setSent(true);
    } catch (error) {
      reportError(error, { title: "Couldn't send your request" });
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (r) => {
    const ok = await confirm({ title: `Withdraw “${r.title}”?`, description: 'The team will no longer see it.', confirmLabel: 'Withdraw', destructive: true });
    if (!ok) return;
    try {
      await withdrawRequest(r.id);
      setRequests((list) => list.filter((x) => x.id !== r.id));
    } catch (error) {
      reportError(error, { title: "Couldn't withdraw the request" });
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Requests</h2>
          <p className="text-xs text-muted-foreground">Ask the team for a change or something new. They accept it as a task or tell you why not.</p>
        </div>
        {!open && (
          <Button type="button" size="sm" onClick={() => { setOpen(true); setSent(false); }}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New request
          </Button>
        )}
      </div>

      {sent && !open && <p className="mb-3 text-sm text-success" role="status">Sent. The team has been told.</p>}

      {open && (
        <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl border border-border p-4" noValidate>
          <div>
            <Label htmlFor={`${id}-title`}>What do you need?</Label>
            <Input
              id={`${id}-title`}
              className="mt-1"
              maxLength={MAX_TITLE}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? `${id}-title-error` : undefined}
              autoFocus
            />
            <FieldError id={`${id}-title-error`}>{errors.title}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${id}-details`}>Details (optional)</Label>
            <Textarea
              id={`${id}-details`}
              className="mt-1"
              rows={3}
              maxLength={MAX_DETAILS}
              value={form.details}
              onChange={(e) => set({ details: e.target.value })}
              aria-invalid={errors.details ? true : undefined}
              aria-describedby={errors.details ? `${id}-details-error` : undefined}
            />
            <FieldError id={`${id}-details-error`}>{errors.details}</FieldError>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-urgency`}>How urgent?</Label>
              <Select value={form.urgency} onValueChange={(v) => set({ urgency: v })}>
                <SelectTrigger id={`${id}-urgency`} className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {URGENCY.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-needed`}>Needed by (optional)</Label>
              <Input
                id={`${id}-needed`}
                type="date"
                className="mt-1"
                min={toInputDate()}
                value={form.neededBy}
                onChange={(e) => set({ neededBy: e.target.value })}
                aria-invalid={errors.neededBy ? true : undefined}
                aria-describedby={errors.neededBy ? `${id}-needed-error` : undefined}
              />
              <FieldError id={`${id}-needed-error`}>{errors.neededBy}</FieldError>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => { setOpen(false); setErrors({}); }}>Cancel</Button>
            <Button type="submit" size="sm" disabled={sending}>{sending ? 'Sending…' : 'Send request'}</Button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        !open && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="h-4 w-4" aria-hidden="true" />
            No requests yet.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg border border-border px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{r.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {r.requestedByName} · {formatDate(r.createdAt)}
                    {r.urgency === 'urgent' && ' · Urgent'}
                    {r.neededBy && ` · needed by ${formatDate(r.neededBy)}`}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs ${STATUS_STYLE[r.status] || ''}`}>
                  {REQUEST_STATUS[r.status]?.label || r.status}
                </Badge>
              </div>
              {r.details && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{r.details}</p>}
              {r.status !== 'new' && (r.response || r.decidedByName) && (
                <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <span className="font-medium">{r.decidedByName || 'The team'}:</span>{' '}
                  {r.response || (r.status === 'accepted' ? 'Accepted. It is now on the task list.' : 'Declined.')}
                </p>
              )}
              {r.status === 'new' && r.requestedBy === author?.uid && (
                <Button type="button" variant="ghost" size="sm" className="mt-1 h-9 px-2" onClick={() => withdraw(r)}>
                  Withdraw
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default ClientRequests;
