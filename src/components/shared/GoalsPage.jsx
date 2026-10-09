// Goals and key results (lib/goals). Org admins and department heads set goals, link projects
// and key results; the owner checks in with the current numbers; everyone on the team sees
// how each goal is doing against the time gone.
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Target, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldError from '@/components/shared/FieldError';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { getProjects } from '@/services/organizationService';
import { getAssignableUsers } from '@/services/userService';
import { checkIn, createGoal, deleteGoal, listGoals, updateGoal } from '@/services/goalService';
import { goalProblem, goalProgress, goalStatus, krProgress, MAX_KRS, STATUS_LABEL } from '@/lib/goals';
import { formatDate, toInputDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const SETTERS = new Set(['org-admin', 'admin', 'department-head']);
const PILL = {
  done: 'border-success/30 bg-success/10 text-success',
  on_track: 'border-success/30 bg-success/10 text-success',
  at_risk: 'border-warning/40 bg-warning-soft text-warning',
  off_track: 'border-destructive/30 bg-destructive-soft text-destructive',
};
const BLANK_KR = { title: '', start: '0', target: '', current: '0', unit: '' };
const pct = (p) => Math.round((p ?? 0) * 100);

const Bar = ({ value, label }) => (
  <div className="h-2 w-full rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={pct(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-2 rounded-full bg-primary" style={{ width: `${pct(value)}%` }} />
  </div>
);

const GoalForm = ({ initial, projects, people, onSave, onCancel }) => {
  const id = useId();
  const [goal, setGoal] = useState(initial);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setGoal((g) => ({ ...g, ...patch }));
  const setKr = (i, patch) => set({ keyResults: goal.keyResults.map((kr, j) => (j === i ? { ...kr, ...patch } : kr)) });

  const submit = async (e) => {
    e.preventDefault();
    const problem = goalProblem(goal);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const owner = people.find((p) => p.id === goal.ownerId);
      await onSave({ ...goal, ownerName: owner ? (owner.name || owner.email) : '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${id}-title`}>Goal</Label>
        <Input id={`${id}-title`} value={goal.title} maxLength={160} placeholder="Win five new enterprise clients"
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} onChange={(e) => set({ title: e.target.value })} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${id}-desc`}>Why it matters <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id={`${id}-desc`} rows={2} maxLength={2000} value={goal.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-owner`}>Owner</Label>
        <Select value={goal.ownerId || 'none'} onValueChange={(v) => set({ ownerId: v === 'none' ? '' : v })}>
          <SelectTrigger id={`${id}-owner`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nobody yet</SelectItem>
            {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-start`}>From</Label>
          <Input id={`${id}-start`} type="date" value={goal.startDate || ''} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-due`}>By</Label>
          <Input id={`${id}-due`} type="date" value={goal.dueDate || ''} min={goal.startDate || undefined} onChange={(e) => set({ dueDate: e.target.value })} />
        </div>
      </div>

      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium">Key results <span className="text-xs font-normal text-muted-foreground">(the numbers that show it is done; without any, progress comes from the linked projects' tasks)</span></legend>
        {goal.keyResults.map((kr, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_80px_80px_80px_80px_auto]">
            <Input aria-label={`Key result ${i + 1} name`} className="col-span-2 sm:col-span-1" placeholder="Signed contracts" value={kr.title} maxLength={160} onChange={(e) => setKr(i, { title: e.target.value })} />
            <Input aria-label={`Key result ${i + 1} starting value`} type="number" placeholder="Start" value={kr.start} onChange={(e) => setKr(i, { start: e.target.value })} />
            <Input aria-label={`Key result ${i + 1} target`} type="number" placeholder="Target" value={kr.target} onChange={(e) => setKr(i, { target: e.target.value })} />
            <Input aria-label={`Key result ${i + 1} current value`} type="number" placeholder="Now" value={kr.current} onChange={(e) => setKr(i, { current: e.target.value })} />
            <Input aria-label={`Key result ${i + 1} unit`} placeholder="Unit" maxLength={20} value={kr.unit} onChange={(e) => setKr(i, { unit: e.target.value })} />
            <Button type="button" size="icon" variant="ghost" aria-label={`Remove key result ${i + 1}`} onClick={() => set({ keyResults: goal.keyResults.filter((_, j) => j !== i) })}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {goal.keyResults.length < MAX_KRS && (
          <Button type="button" size="sm" variant="outline" onClick={() => set({ keyResults: [...goal.keyResults, { ...BLANK_KR }] })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a key result
          </Button>
        )}
      </fieldset>

      {projects.length > 0 && (
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Projects that deliver it</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {projects.map((p) => (
              <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={goal.projectIds.includes(p.id)}
                  onChange={(e) => set({ projectIds: e.target.checked ? [...goal.projectIds, p.id] : goal.projectIds.filter((x) => x !== p.id) })} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="sm:col-span-2">
        <FieldError id={`${id}-err`}>{error}</FieldError>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>Save goal</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </form>
  );
};

const CheckIn = ({ goal, onSave }) => {
  const [values, setValues] = useState(goal.keyResults.map((kr) => String(kr.current ?? 0)));
  const [saving, setSaving] = useState(false);
  return (
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (e) => {
      e.preventDefault();
      setSaving(true);
      try { await onSave(goal.keyResults.map((kr, i) => ({ ...kr, current: values[i] }))); } finally { setSaving(false); }
    }}>
      {goal.keyResults.map((kr, i) => (
        <label key={kr.title} className="space-y-1 text-xs">
          <span className="block text-muted-foreground">{kr.title}</span>
          <Input type="number" className="h-9 w-28" value={values[i]} onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
        </label>
      ))}
      <Button type="submit" size="sm" disabled={saving}>Save check-in</Button>
    </form>
  );
};

const GoalsPage = () => {
  const { currentUser } = useAuth();
  const { tasks } = useTasks();
  const confirm = useConfirm();
  const orgId = currentUser?.orgId;
  const me = currentUser?.uid;
  const canSet = SETTERS.has(currentUser?.role);
  const [goals, setGoals] = useState(null);
  const [projects, setProjects] = useState([]);
  const [people, setPeople] = useState([]);
  const [editing, setEditing] = useState(null); // a goal, or 'new'
  const [checkingIn, setCheckingIn] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setGoals(await listGoals(orgId));
    } catch (e) {
      setGoals([]);
      reportError(e, { title: "Couldn't load the goals" });
    }
  }, [orgId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!canSet || !orgId) return;
    getProjects(orgId).then(setProjects).catch(() => setProjects([]));
    getAssignableUsers(currentUser).then(setPeople).catch(() => setPeople([]));
  }, [canSet, orgId, currentUser]);

  const rows = useMemo(() => (goals || []).map((g) => {
    const progress = goalProgress(g, tasks);
    return { goal: g, progress, status: goalStatus(g, progress) };
  }).sort((a, b) => String(a.goal.dueDate || '9999').localeCompare(String(b.goal.dueDate || '9999'))), [goals, tasks]);

  const save = async (goal) => {
    try {
      if (goal.id) {
        const saved = await updateGoal(orgId, goal.id, goal);
        setGoals((list) => list.map((g) => (g.id === goal.id ? { ...g, ...saved } : g)));
      } else {
        const created = await createGoal(orgId, goal, currentUser);
        setGoals((list) => [...list, created]);
      }
      setEditing(null);
    } catch (e) {
      reportError(e, { title: "Couldn't save the goal" });
    }
  };

  const saveCheckIn = async (goal, keyResults) => {
    try {
      const saved = await checkIn(orgId, goal.id, keyResults);
      setGoals((list) => list.map((g) => (g.id === goal.id ? { ...g, ...saved } : g)));
      setCheckingIn(null);
    } catch (e) {
      reportError(e, { title: "Couldn't save the check-in" });
    }
  };

  const remove = async (goal) => {
    if (!(await confirm({ title: `Delete the goal “${goal.title}”?`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteGoal(orgId, goal.id);
      setGoals((list) => list.filter((g) => g.id !== goal.id));
    } catch (e) {
      reportError(e, { title: "Couldn't delete the goal" });
    }
  };

  if (goals === null) return <LoadingState label="Loading goals…" />;

  return (
    <div className="space-y-6">
      {editing ? (
        <Card>
          <CardHeader><CardTitle>{editing === 'new' ? 'New goal' : 'Edit goal'}</CardTitle></CardHeader>
          <CardContent>
            <GoalForm
              initial={editing === 'new'
                ? { title: '', description: '', ownerId: '', startDate: toInputDate(), dueDate: '', projectIds: [], keyResults: [{ ...BLANK_KR }] }
                : { ...editing, keyResults: editing.keyResults.map((kr) => ({ ...kr, start: String(kr.start), target: String(kr.target), current: String(kr.current) })) }}
              projects={projects}
              people={people}
              onSave={save}
              onCancel={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      ) : canSet && (
        <div className="flex justify-end"><Button type="button" onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden="true" /> New goal</Button></div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" hint={canSet ? 'Set what the organisation is aiming for, and the numbers that show it.' : 'Your leaders set the goals; they will show here.'} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ goal, progress, status }) => (
            <li key={goal.id}>
              <Card className="h-full">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" aria-hidden="true" /> {goal.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {goal.ownerName ? `Owner ${goal.ownerName}` : 'No owner'}
                      {goal.dueDate ? ` · by ${formatDate(goal.dueDate)}` : ''}
                    </p>
                  </div>
                  {status && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL[status]}`}>{STATUS_LABEL[status]}</span>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {goal.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{goal.description}</p>}
                  <div>
                    <div className="mb-1 flex justify-between text-xs"><span>Progress</span><span className="font-semibold">{progress === null ? 'Not measured yet' : `${pct(progress)}%`}</span></div>
                    <Bar value={progress} label={`${goal.title} progress`} />
                  </div>
                  {goal.keyResults?.length > 0 && (
                    <ul className="space-y-2">
                      {goal.keyResults.map((kr) => (
                        <li key={kr.title} className="text-sm">
                          <div className="flex justify-between gap-2"><span>{kr.title}</span><span className="tabular-nums text-muted-foreground">{kr.current} / {kr.target}{kr.unit ? ` ${kr.unit}` : ''}</span></div>
                          <Bar value={krProgress(kr)} label={`${kr.title} progress`} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {!goal.keyResults?.length && goal.projectIds?.length > 0 && (
                    <p className="text-xs text-muted-foreground">Measured by the tasks of {goal.projectIds.length} linked project{goal.projectIds.length === 1 ? '' : 's'}.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(goal.ownerId === me || canSet) && goal.keyResults?.length > 0 && (
                      <Button type="button" size="sm" variant="outline" aria-expanded={checkingIn === goal.id} onClick={() => setCheckingIn(checkingIn === goal.id ? null : goal.id)}>Check in</Button>
                    )}
                    {canSet && (
                      <>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(goal)}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Button>
                        <Button type="button" size="icon" variant="ghost" aria-label={`Delete the goal ${goal.title}`} onClick={() => remove(goal)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                  {checkingIn === goal.id && <CheckIn goal={goal} onSave={(krs) => saveCheckIn(goal, krs)} />}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GoalsPage;
