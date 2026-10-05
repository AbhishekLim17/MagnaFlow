// Portfolio health: every project the viewer looks after, worst first, with its status (the
// team's latest update, or a suggestion from the tasks), progress and what is overdue. Whoever
// runs a project posts its weekly status update here; leaders also get it by email on Mondays.
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { HeartPulse, Megaphone, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FieldError from '@/components/shared/FieldError';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getProjects } from '@/services/organizationService';
import { latestUpdates, listUpdates, postUpdate } from '@/services/projectUpdateService';
import { HEALTH, HEALTH_KEYS, MAX_SUMMARY, projectHealth, projectMetrics, sortByHealth } from '@/lib/portfolio';
import { runsProject } from '@/lib/taskPermissions';
import { formatDate, formatRelative } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const PILL = {
  on_track: 'border-success/30 bg-success/10 text-success',
  at_risk: 'border-warning/40 bg-warning-soft text-warning',
  off_track: 'border-destructive/30 bg-destructive-soft text-destructive',
};

export const HealthPill = ({ health }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL[health.key]}`}>
    {health.label}{health.declared ? '' : ' (suggested)'}
  </span>
);

const UpdateDialog = ({ project, onClose, onPosted }) => {
  const id = useId();
  const { currentUser } = useAuth();
  const [health, setHealth] = useState(project.health.key);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) { setError('Say in a sentence or two how it is going.'); return; }
    setSaving(true);
    try {
      onPosted(await postUpdate(currentUser.orgId, project.id, { health, summary }, currentUser));
    } catch (err) {
      reportError(err, { title: "Couldn't post the update" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Status of {project.name}</DialogTitle>
          <DialogDescription>Leaders see it here and in Monday&apos;s summary email.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={submit} className="space-y-4" noValidate>
          <fieldset>
            <legend className="text-sm font-medium">How is it going?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {HEALTH_KEYS.map((k) => (
                <label key={k} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${health === k ? PILL[k] : 'border-border'}`}>
                  <input type="radio" name={`${id}-health`} value={k} checked={health === k} onChange={() => setHealth(k)} className="accent-[hsl(var(--primary))]" />
                  {HEALTH[k].label}
                </label>
              ))}
            </div>
            {!project.health.declared && (
              <p className="mt-1 text-xs text-muted-foreground">The tasks suggest {project.health.label.toLowerCase()}.</p>
            )}
          </fieldset>
          <div>
            <Label htmlFor={`${id}-summary`}>Summary</Label>
            <Textarea
              id={`${id}-summary`}
              className="mt-1"
              rows={4}
              maxLength={MAX_SUMMARY}
              value={summary}
              onChange={(e) => { setSummary(e.target.value); setError(''); }}
              placeholder="What moved this week, what is in the way, what happens next."
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            <FieldError id={`${id}-error`}>{error}</FieldError>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} disabled={saving}>{saving ? 'Posting…' : 'Post update'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EarlierUpdates = ({ orgId, projectId }) => {
  const [list, setList] = useState(null);
  useEffect(() => {
    listUpdates(orgId, projectId, 10).then(setList).catch(() => setList([]));
  }, [orgId, projectId]);
  if (!list) return <p className="text-xs text-muted-foreground" role="status">Loading…</p>;
  if (list.length === 0) return <p className="text-xs text-muted-foreground">No updates yet.</p>;
  return (
    <ol className="space-y-2 border-l border-border pl-3">
      {list.map((u) => (
        <li key={u.id} className="text-sm">
          <HealthPill health={{ key: u.health, label: HEALTH[u.health]?.label || u.health, declared: true }} />
          <span className="ml-2 text-xs text-muted-foreground">{u.createdByName} · {formatDate(u.createdAt)}</span>
          {u.summary && <p className="mt-1 whitespace-pre-wrap text-foreground">{u.summary}</p>}
        </li>
      ))}
    </ol>
  );
};

const PortfolioHealth = () => {
  const { currentUser } = useAuth();
  const { tasks, tasksTruncated } = useTasks();
  const orgId = currentUser?.orgId;
  const [projects, setProjects] = useState([]);
  const [latest, setLatest] = useState({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(null);
  const [history, setHistory] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const mine = (await getProjects(orgId)).filter((p) => runsProject(currentUser, p));
      setProjects(mine);
      setLatest(await latestUpdates(orgId, mine.map((p) => p.id)));
    } catch (error) {
      reportError(error, { title: "Couldn't load the portfolio" });
    } finally {
      setLoading(false);
    }
  }, [orgId, currentUser]);
  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => sortByHealth(projects.map((p) => {
    const metrics = projectMetrics(tasks.filter((t) => t.projectId === p.id));
    return { ...p, metrics, health: projectHealth(metrics, latest[p.id]) };
  })), [projects, tasks, latest]);

  const counts = HEALTH_KEYS.map((k) => [k, items.filter((i) => i.health.key === k).length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" aria-hidden="true" />
          Projects
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Each project&apos;s status: the team&apos;s latest update, or, until there is one, what its tasks suggest.
        </p>
        {items.length > 0 && (
          <p className="flex flex-wrap gap-2 pt-1" aria-label="Projects by status">
            {counts.map(([k, n]) => <span key={k} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL[k]}`}>{n} {HEALTH[k].label.toLowerCase()}</span>)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {tasksTruncated && (
          <p className="mb-3 text-xs text-warning" role="note">Only the most recent 500 tasks are counted.</p>
        )}
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading projects…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No projects to show.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((p) => {
              const m = p.metrics;
              const u = p.health.update;
              return (
                <li key={p.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {m.total ? `${m.done} of ${m.total} tasks done` : 'No tasks yet'}
                        {m.overdue ? ` · ${m.overdue} overdue` : ''}
                        {m.dueSoon ? ` · ${m.dueSoon} due this week` : ''}
                        {m.nextMilestone ? ` · next milestone ${m.nextMilestone.title}, ${formatDate(new Date(m.nextMilestone.deadline))}` : ''}
                      </p>
                    </div>
                    <HealthPill health={p.health} />
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-muted" role="progressbar" aria-label={`${p.name} progress`} aria-valuenow={m.percent} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${m.percent}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-foreground">
                    {u
                      ? <><span className="whitespace-pre-wrap">{u.summary}</span> <span className="text-xs text-muted-foreground">— {u.createdByName}, {formatRelative(u.createdAt)}</span></>
                      : <span className="text-muted-foreground">No status update yet.</span>}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runsProject(currentUser, p) && (
                      <Button type="button" size="sm" onClick={() => setPosting(p)}>
                        <Megaphone className="mr-1.5 h-4 w-4" aria-hidden="true" />
                        Post update
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" aria-expanded={history === p.id} onClick={() => setHistory(history === p.id ? null : p.id)}>
                      <History className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      {history === p.id ? 'Hide earlier updates' : 'Earlier updates'}
                    </Button>
                  </div>
                  {history === p.id && <div className="mt-3"><EarlierUpdates orgId={orgId} projectId={p.id} /></div>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {posting && (
        <UpdateDialog
          project={posting}
          onClose={() => setPosting(null)}
          onPosted={(update) => {
            setLatest((l) => ({ ...l, [posting.id]: update }));
            setPosting(null);
            setHistory(null);
            toast({ title: 'Update posted' });
          }}
        />
      )}
    </Card>
  );
};

export default PortfolioHealth;
