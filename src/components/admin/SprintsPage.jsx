// Sprints (lib/sprints): plan time-boxed iterations of a project, pull sized tasks from the
// backlog into one, follow its burndown, and complete it (unfinished work goes back to the
// backlog). Whoever runs the project plans; everyone on it can look.
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Flag, Play, Plus, Trash2, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldError from '@/components/shared/FieldError';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useMyProjects } from '@/hooks/useMyProjects';
import { createSprint, deleteSprint, listSprints, setSprintStatus } from '@/services/sprintService';
import { burndown, pointsOf, sortSprints, sprintProblem, sprintTotals, velocity } from '@/lib/sprints';
import { runsProject } from '@/lib/taskPermissions';
import { statusLabel } from '@/lib/taskLabels';
import { formatDate, formatDayMonth, toInputDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const AXIS = 'hsl(var(--muted-foreground))';
const GRID = 'hsl(var(--border))';
const TOOLTIP_STYLE = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' };
const STATUS_BADGE = { active: 'success', planned: 'secondary', closed: 'outline' };
const DONE = new Set(['completed', 'cancelled']);
const plusDays = (day, n) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return toInputDate(d); };

const TaskRow = ({ task, action }) => (
  <li className="flex flex-wrap items-center justify-between gap-2 py-2">
    <div className="min-w-0 flex-1">
      <p className={`truncate text-sm font-medium ${task.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>{task.title}</p>
      <p className="text-xs text-muted-foreground">{statusLabel(task.status)}{task.deadline ? ` · due ${formatDate(task.deadline)}` : ''}</p>
    </div>
    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums" title="Story points">
      {pointsOf(task) || '–'}<span className="sr-only"> story points</span>
    </span>
    {action}
  </li>
);

const SprintsPage = () => {
  const { currentUser } = useAuth();
  const { tasks, updateTask, bulkUpdateTasks } = useTasks();
  const confirm = useConfirm();
  const id = useId();
  const { projects, projectId, setProjectId, project } = useMyProjects();
  const [sprints, setSprints] = useState(null);
  const [sprintId, setSprintId] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const orgId = currentUser?.orgId;
  const runs = runsProject(currentUser, project);

  const load = useCallback(async () => {
    if (!projectId) return;
    setSprints(null);
    try {
      const list = sortSprints(await listSprints(orgId, projectId));
      setSprints(list);
      setSprintId(list[0]?.id || '');
    } catch (e) {
      setSprints([]);
      reportError(e, { title: "Couldn't load the sprints" });
    }
  }, [orgId, projectId]);
  useEffect(() => { load(); }, [load]);

  const sprint = sprints?.find((s) => s.id === sprintId) || null;
  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);
  const inSprint = useMemo(() => projectTasks.filter((t) => sprint && t.sprintId === sprint.id), [projectTasks, sprint]);
  const backlog = useMemo(() => projectTasks.filter((t) => !t.sprintId && !DONE.has(t.status)), [projectTasks]);
  const totals = sprintTotals(inSprint);
  const chart = useMemo(() => (sprint ? burndown(sprint, inSprint) : []), [sprint, inSprint]);
  const avg = velocity(sprints || []);
  const activeOther = sprints?.some((s) => s.status === 'active' && s.id !== sprintId);

  const startNew = () => {
    const n = (sprints?.length || 0) + 1;
    const start = toInputDate();
    setDraft({ name: `Sprint ${n}`, goal: '', startDate: start, endDate: plusDays(start, 13) });
    setError(null);
  };

  const create = async (e) => {
    e.preventDefault();
    const problem = sprintProblem(draft);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const created = await createSprint(orgId, projectId, draft, currentUser);
      setSprints((list) => sortSprints([...list, created]));
      setSprintId(created.id);
      setDraft(null);
    } catch (err) {
      reportError(err, { title: "Couldn't create the sprint" });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status) => {
    if (status === 'closed') {
      const open = inSprint.filter((t) => !DONE.has(t.status));
      const ok = await confirm({
        title: `Complete ${sprint.name}?`,
        description: open.length
          ? `${totals.done} of ${totals.total} points are done. The ${open.length} unfinished task${open.length === 1 ? '' : 's'} go back to the backlog.`
          : `All ${totals.total} points are done.`,
        confirmLabel: 'Complete sprint',
      });
      if (!ok) return;
      setBusy(true);
      try {
        await setSprintStatus(orgId, projectId, sprint.id, 'closed', totals.done);
        if (open.length) await bulkUpdateTasks(open.map((t) => t.id), { sprintId: null });
        setSprints((list) => sortSprints(list.map((s) => (s.id === sprint.id ? { ...s, status: 'closed', completedPoints: totals.done } : s))));
      } catch (err) {
        reportError(err, { title: "Couldn't complete the sprint" });
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await setSprintStatus(orgId, projectId, sprint.id, status, null);
      setSprints((list) => sortSprints(list.map((s) => (s.id === sprint.id ? { ...s, status } : s))));
    } catch (err) {
      reportError(err, { title: "Couldn't start the sprint" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Delete ${sprint.name}?`, description: 'Its tasks go back to the backlog.', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      if (inSprint.length) await bulkUpdateTasks(inSprint.map((t) => t.id), { sprintId: null });
      await deleteSprint(orgId, projectId, sprint.id);
      const rest = sprints.filter((s) => s.id !== sprint.id);
      setSprints(rest);
      setSprintId(rest[0]?.id || '');
    } catch (err) {
      reportError(err, { title: "Couldn't delete the sprint" });
    }
  };

  const move = (task, toSprint) => updateTask(task.id, { sprintId: toSprint }, {
    successTitle: toSprint ? 'Added to the sprint' : 'Back in the backlog',
    successDescription: `“${task.title}”`,
  }).catch(() => {});

  if (projects === null) return <LoadingState label="Loading projects…" />;
  if (!projects.length) return <EmptyState icon={Flag} title="No projects" hint="Sprints are planned per project." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-project`}>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id={`${id}-project`} className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {sprints?.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor={`${id}-sprint`}>Sprint</Label>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger id={`${id}-sprint`} className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.status === 'active' ? 'active' : s.status === 'planned' ? 'planned' : 'done'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {runs && !draft && <Button type="button" variant="outline" onClick={startNew}><Plus className="h-4 w-4" aria-hidden="true" /> New sprint</Button>}
        {avg !== null && <p className="text-sm text-muted-foreground">Velocity: about {avg} points a sprint</p>}
      </div>

      {draft && (
        <Card>
          <CardHeader><CardTitle>New sprint</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 sm:grid-cols-2" noValidate>
              <div className="space-y-1">
                <Label htmlFor={`${id}-name`}>Name</Label>
                <Input id={`${id}-name`} value={draft.name} maxLength={80} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-goal`}>Sprint goal <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                <Input id={`${id}-goal`} value={draft.goal} maxLength={500} onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-start`}>First day</Label>
                <Input id={`${id}-start`} type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-end`}>Last day</Label>
                <Input id={`${id}-end`} type="date" value={draft.endDate} min={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <FieldError id={`${id}-err`}>{error}</FieldError>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>Create sprint</Button>
                  <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {sprints === null ? <LoadingState label="Loading sprints…" /> : !sprint ? (
        <EmptyState icon={Flag} title="No sprints yet" hint={runs ? 'Plan the first one: two weeks is a good length.' : 'Whoever runs the project plans the sprints.'} />
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Flag className="h-5 w-5 text-primary" aria-hidden="true" /> {sprint.name}
                <Badge variant={STATUS_BADGE[sprint.status]}>{sprint.status === 'closed' ? 'Done' : sprint.status === 'active' ? 'Active' : 'Planned'}</Badge>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(sprint.startDate)} to {formatDate(sprint.endDate)}
                {sprint.goal ? ` · ${sprint.goal}` : ''}
              </p>
            </div>
            {runs && (
              <div className="flex flex-wrap gap-2">
                {sprint.status === 'planned' && (
                  <Button type="button" size="sm" disabled={busy || activeOther} title={activeOther ? 'Complete the active sprint first' : undefined} onClick={() => changeStatus('active')}>
                    <Play className="h-4 w-4" aria-hidden="true" /> Start sprint
                  </Button>
                )}
                {sprint.status === 'active' && (
                  <Button type="button" size="sm" disabled={busy} onClick={() => changeStatus('closed')}>Complete sprint</Button>
                )}
                {sprint.status !== 'closed' && (
                  <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${sprint.name}`} onClick={remove}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm" role="status">
              <span className="font-semibold">{totals.done} of {totals.total} points done</span>
              {' · '}{totals.tasks} task{totals.tasks === 1 ? '' : 's'}
              {totals.unsized ? ` · ${totals.unsized} without points` : ''}
              {sprint.status === 'closed' && sprint.completedPoints != null ? ` · finished ${sprint.completedPoints} points` : ''}
            </p>

            {chart.length > 1 && totals.total > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Burndown</h3>
                <div role="img" aria-label={`Burndown: ${chart.filter((d) => d.left !== null).map((d) => `${formatDayMonth(d.day)} ${d.left} left`).join('; ')}`}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chart.map((d) => ({ ...d, label: formatDayMonth(d.day) }))} margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                      <XAxis dataKey="label" stroke={AXIS} fontSize={12} />
                      <YAxis stroke={AXIS} fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="linear" dataKey="ideal" name="Ideal" stroke={AXIS} strokeDasharray="5 5" dot={false} />
                      <Line type="linear" dataKey="left" name="Points left" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <section aria-labelledby={`${id}-in`}>
              <h3 id={`${id}-in`} className="text-sm font-semibold">In this sprint</h3>
              {inSprint.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Nothing yet. Add tasks from the backlog below.</p> : (
                <ul className="divide-y divide-border">
                  {inSprint.map((t) => (
                    <TaskRow key={t.id} task={t} action={runs && sprint.status !== 'closed' && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => move(t, null)} aria-label={`Move ${t.title} back to the backlog`}>
                        <Undo2 className="h-4 w-4" aria-hidden="true" /> Backlog
                      </Button>
                    )} />
                  ))}
                </ul>
              )}
            </section>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Backlog</CardTitle>
          <p className="text-sm text-muted-foreground">Open tasks of {project?.name || 'this project'} that are in no sprint. Size them with story points in the task form.</p>
        </CardHeader>
        <CardContent>
          {backlog.length === 0 ? <p className="text-sm text-muted-foreground">The backlog is empty.</p> : (
            <ul className="divide-y divide-border">
              {backlog.map((t) => (
                <TaskRow key={t.id} task={t} action={runs && sprint && sprint.status !== 'closed' && (
                  <Button type="button" size="sm" variant="outline" onClick={() => move(t, sprint.id)} aria-label={`Add ${t.title} to ${sprint.name}`}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> {sprint.name}
                  </Button>
                )} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SprintsPage;
