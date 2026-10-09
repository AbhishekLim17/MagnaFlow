// A project's RAID log: risks, assumptions, issues and decisions (lib/raid). Anyone on the
// project raises one; whoever runs the project (or the author) edits, closes or removes it.
// Open high-impact risks and issues show on Portfolio Health.
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ShieldAlert, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldError from '@/components/shared/FieldError';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProjects } from '@/hooks/useMyProjects';
import { addRaid, deleteRaid, listRaid, updateRaid } from '@/services/raidService';
import { getAssignableUsers } from '@/services/userService';
import { IMPACTS, MAX_DETAIL, MAX_TITLE, RAID_TYPES, raidAttention, raidProblem, sortRaid } from '@/lib/raid';
import { runsProject } from '@/lib/taskPermissions';
import { formatDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const IMPACT_BADGE = { high: 'destructive', medium: 'warning', low: 'outline' };
const BLANK = { type: 'risk', title: '', detail: '', impact: 'medium', ownerId: '', dueDate: '' };

const RaidPage = () => {
  const { currentUser } = useAuth();
  const confirm = useConfirm();
  const id = useId();
  const { projects, projectId, setProjectId, project } = useMyProjects();
  const [items, setItems] = useState(null);
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('open');
  const [draft, setDraft] = useState(null); // the form: BLANK, or an entry being edited
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const orgId = currentUser?.orgId;
  const me = currentUser?.uid;
  const runs = runsProject(currentUser, project);

  useEffect(() => { getAssignableUsers(currentUser).then(setPeople).catch(() => setPeople([])); }, [currentUser]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setItems(null);
    try {
      setItems(await listRaid(orgId, projectId));
    } catch (e) {
      setItems([]);
      reportError(e, { title: "Couldn't load the risk log" });
    }
  }, [orgId, projectId]);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    const problem = raidProblem(draft);
    setError(problem);
    if (problem) return;
    const owner = people.find((p) => p.id === draft.ownerId);
    const entry = { ...draft, ownerName: owner ? (owner.name || owner.email) : '' };
    setSaving(true);
    try {
      if (draft.id) {
        await updateRaid(orgId, projectId, draft.id, entry);
        setItems((list) => list.map((i) => (i.id === draft.id ? { ...i, ...entry } : i)));
      } else {
        const saved = await addRaid(orgId, projectId, entry, currentUser);
        setItems((list) => [saved, ...list]);
      }
      setDraft(null);
    } catch (err) {
      reportError(err, { title: "Couldn't save the entry" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (item, status) => {
    try {
      await updateRaid(orgId, projectId, item.id, { status });
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status } : i)));
    } catch (err) {
      reportError(err, { title: "Couldn't change the entry" });
    }
  };

  const remove = async (item) => {
    if (!(await confirm({ title: `Delete “${item.title}”?`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteRaid(orgId, projectId, item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
    } catch (err) {
      reportError(err, { title: "Couldn't delete the entry" });
    }
  };

  const shown = useMemo(() => sortRaid((items || []).filter((i) =>
    (filter === 'all' || (filter === 'open' ? i.status !== 'closed' : i.type === filter)))), [items, filter]);
  const attention = raidAttention(items || []);

  if (projects === null) return <LoadingState label="Loading projects…" />;
  if (!projects.length) return <EmptyState icon={ShieldAlert} title="No projects" hint="The risk log is kept per project; you are not on one yet." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-project`}>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id={`${id}-project`} className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {!draft && <Button type="button" onClick={() => { setDraft(BLANK); setError(null); }}>Add an entry</Button>}
      </div>

      {draft && (
        <Card>
          <CardHeader><CardTitle>{draft.id ? 'Edit entry' : 'New entry'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
              <div className="space-y-1">
                <Label htmlFor={`${id}-type`}>Kind</Label>
                <Select value={draft.type} onValueChange={(type) => setDraft((d) => ({ ...d, type }))}>
                  <SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RAID_TYPES).map(([k, t]) => <SelectItem key={k} value={k}>{t.label}: {t.hint.toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-impact`}>Impact</Label>
                <Select value={draft.impact} onValueChange={(impact) => setDraft((d) => ({ ...d, impact }))}>
                  <SelectTrigger id={`${id}-impact`}><SelectValue /></SelectTrigger>
                  <SelectContent>{IMPACTS.map((i) => <SelectItem key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={`${id}-title`}>Title</Label>
                <Input id={`${id}-title`} value={draft.title} maxLength={MAX_TITLE} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                <FieldError id={`${id}-err`}>{error}</FieldError>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={`${id}-detail`}>Details, mitigation or reasoning</Label>
                <Textarea id={`${id}-detail`} rows={3} value={draft.detail} maxLength={MAX_DETAIL} onChange={(e) => setDraft((d) => ({ ...d, detail: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-owner`}>Owner</Label>
                <Select value={draft.ownerId || 'none'} onValueChange={(v) => setDraft((d) => ({ ...d, ownerId: v === 'none' ? '' : v }))}>
                  <SelectTrigger id={`${id}-owner`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nobody yet</SelectItem>
                    {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-due`}>Review by <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                <Input id={`${id}-due`} type="date" value={draft.dueDate || ''} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={saving}>Save</Button>
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" /> RAID log</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              {attention.openRisks} open risk{attention.openRisks === 1 ? '' : 's'}, {attention.openIssues} open issue{attention.openIssues === 1 ? '' : 's'}
              {attention.highOpen ? `, ${attention.highOpen} high impact` : ''}.
            </p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]" aria-label="Show"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="all">Everything</SelectItem>
              {Object.entries(RAID_TYPES).map(([k, t]) => <SelectItem key={k} value={k}>{t.plural}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {items === null ? <LoadingState label="Loading…" rows={3} /> : shown.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="Nothing here" hint="Raise a risk before it becomes an issue, and write decisions down while the reasons are fresh." />
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((item) => {
                const mayEdit = runs || item.createdBy === me;
                return (
                  <li key={item.id} className={`py-3 ${item.status === 'closed' ? 'opacity-70' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">
                          <span className="text-muted-foreground">{RAID_TYPES[item.type]?.label}:</span> {item.title}
                        </h3>
                        {item.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.detail}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.ownerName ? `Owner ${item.ownerName}` : 'No owner'}
                          {item.dueDate ? ` · review by ${formatDate(item.dueDate)}` : ''}
                          {item.createdByName ? ` · raised by ${item.createdByName}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={IMPACT_BADGE[item.impact] || 'outline'}>{item.impact} impact</Badge>
                        {item.status === 'closed' && <Badge variant="secondary">Closed</Badge>}
                        {mayEdit && (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => setStatus(item, item.status === 'closed' ? 'open' : 'closed')}>
                              {item.status === 'closed' ? 'Reopen' : 'Close'}
                            </Button>
                            <Button type="button" size="icon" variant="ghost" aria-label={`Edit ${item.title}`} onClick={() => { setDraft({ ...BLANK, ...item }); setError(null); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${item.title}`} onClick={() => remove(item)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RaidPage;
