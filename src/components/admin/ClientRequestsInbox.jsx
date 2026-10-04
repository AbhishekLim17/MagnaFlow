// Requests clients sent from their portal, for the people who run those projects (org admins,
// department heads, project managers). Accept one and it becomes a task in the same project;
// decline it and the client is told why. The client is emailed either way (mail job).
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Inbox, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldError from '@/components/shared/FieldError';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getProjects } from '@/services/organizationService';
import { getAssignableUsers } from '@/services/userService';
import { acceptRequest, declineRequest, listRequestsForTeam } from '@/services/clientRequestService';
import { MAX_RESPONSE, REQUEST_STATUS, taskDraftFromRequest } from '@/lib/clientRequests';
import { formatDate, toInputDate } from '@/lib/format';
import { priorityLabel } from '@/lib/taskLabels';
import { reportError } from '@/lib/reportError';
import { toUserMessage } from '@/lib/errorMessages';

const ORG_ADMIN = new Set(['org-admin', 'admin', 'master-admin']);
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const UNASSIGNED = '__none__';

/** The projects whose requests this person answers; null means the whole organization. */
export const triageScope = (user, projects) => {
  if (ORG_ADMIN.has(user?.role)) return null;
  if (user?.role === 'manager') return user.projectIds || [];
  if (user?.role === 'department-head') {
    const depts = new Set(user.departmentIds || []);
    return projects.filter((p) => depts.has(p.departmentId)).map((p) => p.id);
  }
  return [];
};

const AcceptDialog = ({ request, project, people, onClose, onAccepted }) => {
  const id = useId();
  const { createTask } = useTasks();
  const { currentUser: user } = useAuth();
  const [form, setForm] = useState(() => ({ ...taskDraftFromRequest(request, project), assignedTo: UNASSIGNED, note: '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors({}); };

  // The task, once created: a retry after a failed hand-back only marks the request, it
  // never makes a second task.
  const [createdTaskId, setCreatedTaskId] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setErrors({ title: 'Give the task a title.' }); return; }
    setSaving(true);
    let taskId = createdTaskId;
    try {
      if (!taskId) {
        const task = await createTask({
          title: form.title.trim(),
          description: form.description,
          priority: form.priority,
          status: 'pending',
          assignedTo: form.assignedTo === UNASSIGNED ? '' : form.assignedTo,
          startDate: toInputDate(),
          deadline: form.deadline || '',
          projectId: request.projectId,
          departmentId: form.departmentId || undefined,
          blockedBy: [],
        });
        taskId = task.id;
        setCreatedTaskId(taskId);
      }
    } catch {
      setSaving(false); // TasksContext has already said why
      return;
    }
    try {
      const decided = await acceptRequest(request.id, user, taskId, form.note);
      onAccepted({ ...request, ...decided, taskId });
    } catch (error) {
      setErrors({ form: `The task was created, but the request is not marked accepted yet: ${toUserMessage(error, 'please try again.')}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accept as a task</DialogTitle>
          <DialogDescription>It goes into {project?.name || 'the project'}. The client is told it was accepted.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor={`${id}-title`}>Task title</Label>
            <Input id={`${id}-title`} className="mt-1" value={form.title} onChange={(e) => set({ title: e.target.value })}
              aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? `${id}-title-error` : undefined} />
            <FieldError id={`${id}-title-error`}>{errors.title}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${id}-desc`}>Description</Label>
            <Textarea id={`${id}-desc`} className="mt-1" rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-assignee`}>Assign to</Label>
              <Select value={form.assignedTo} onValueChange={(v) => set({ assignedTo: v })}>
                <SelectTrigger id={`${id}-assignee`} className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
                  {people.filter((p) => p.status !== 'inactive').map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-priority`}>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set({ priority: v })}>
                <SelectTrigger id={`${id}-priority`} className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{priorityLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-deadline`}>Deadline</Label>
            <Input id={`${id}-deadline`} type="date" className="mt-1" value={form.deadline} onChange={(e) => set({ deadline: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={`${id}-note`}>Note to the client (optional)</Label>
            <Textarea id={`${id}-note`} className="mt-1" rows={2} maxLength={MAX_RESPONSE} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </div>
          <FieldError id={`${id}-form-error`}>{errors.form}</FieldError>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} disabled={saving}>{saving ? 'Creating…' : 'Create task and accept'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeclineDialog = ({ request, onClose, onDeclined }) => {
  const id = useId();
  const { currentUser: user } = useAuth();
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!response.trim()) { setError('Tell the client why, so they know what to do next.'); return; }
    setSaving(true);
    try {
      const decided = await declineRequest(request.id, user, response);
      onDeclined({ ...request, ...decided });
    } catch (err) {
      setError(toUserMessage(err, "Couldn't decline the request."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline “{request.title}”?</DialogTitle>
          <DialogDescription>The client sees your reason in their portal and by email.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={submit} noValidate>
          <Label htmlFor={`${id}-reason`}>Reason</Label>
          <Textarea id={`${id}-reason`} className="mt-1" rows={3} maxLength={MAX_RESPONSE} value={response}
            onChange={(e) => { setResponse(e.target.value); setError(''); }} autoFocus
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} disabled={saving}>{saving ? 'Declining…' : 'Decline'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ClientRequestsInbox = () => {
  const { user, currentUser } = useAuth();
  const { toast } = useToast();
  const orgId = user?.orgId;
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [declining, setDeclining] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const projectList = await getProjects(orgId);
      setProjects(projectList);
      const scope = triageScope(user, projectList);
      const [list, assignable] = await Promise.all([
        listRequestsForTeam(orgId, scope),
        getAssignableUsers(currentUser).catch(() => []),
      ]);
      setRequests(list);
      setPeople(assignable);
    } catch (error) {
      reportError(error, { title: "Couldn't load client requests" });
    } finally {
      setLoading(false);
    }
  }, [orgId, user, currentUser]);

  useEffect(() => { load(); }, [load]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const newCount = requests.filter((r) => r.status === 'new').length;
  const visible = showAll ? requests : requests.filter((r) => r.status === 'new');

  const replace = (next) => setRequests((list) => list.map((r) => (r.id === next.id ? next : r)));

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
            Client requests
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            What clients asked for from their portal. Accept one to make it a task, or decline it with a reason.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={showAll ? 'outline' : 'default'} size="sm" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
            New ({newCount})
          </Button>
          <Button type="button" variant={showAll ? 'default' : 'outline'} size="sm" aria-pressed={showAll} onClick={() => setShowAll(true)}>
            All ({requests.length})
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={load} disabled={loading} aria-label="Refresh client requests">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && requests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading requests…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {showAll ? 'No client has sent a request yet.' : 'Nothing waiting. New requests from clients appear here.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{r.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {projectById.get(r.projectId)?.name || 'A project'} · {r.requestedByName} · {formatDate(r.createdAt)}
                      {r.neededBy && ` · needed by ${formatDate(r.neededBy)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.urgency === 'urgent' && <Badge className="border border-destructive/30 bg-destructive-soft text-destructive">Urgent</Badge>}
                    <Badge variant="outline">{REQUEST_STATUS[r.status]?.teamLabel || r.status}</Badge>
                  </div>
                </div>
                {r.details && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{r.details}</p>}
                {r.status !== 'new' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.status === 'accepted' ? 'Accepted' : 'Declined'} by {r.decidedByName || 'the team'}
                    {r.decidedAt && ` on ${formatDate(r.decidedAt)}`}{r.response ? `: ${r.response}` : '.'}
                  </p>
                )}
                {r.status === 'new' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => setAccepting(r)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Accept as a task
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setDeclining(r)}>
                      <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Decline
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {accepting && (
        <AcceptDialog
          request={accepting}
          project={projectById.get(accepting.projectId)}
          people={people}
          onClose={() => setAccepting(null)}
          onAccepted={(next) => { replace(next); setAccepting(null); }}
        />
      )}
      {declining && (
        <DeclineDialog
          request={declining}
          onClose={() => setDeclining(null)}
          onDeclined={(next) => {
            replace(next);
            setDeclining(null);
            toast({ title: 'Request declined', description: 'The client will see your reason.' });
          }}
        />
      )}
    </Card>
  );
};

export default ClientRequestsInbox;
