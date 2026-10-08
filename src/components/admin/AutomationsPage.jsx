// Automations (org admins): where to post (Slack, Teams, a webhook), the rules ("when a task
// … then …"), and what the rules did lately. Rules run every 15 minutes in the mail job.
import React, { useCallback, useEffect, useId, useState } from 'react';
import { Zap, Plus, Trash2, Send, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FieldError from '@/components/shared/FieldError';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/organizationService';
import { getAssignableUsers } from '@/services/userService';
import {
  deleteRule, getChannels, listRecentEvents, listRules, saveChannels, saveRule, sendChannelTest,
} from '@/services/automationService';
import {
  ACTIONS, CHANNELS, PRIORITIES, STATUSES, TRIGGERS, channelProblem, describeRule, ruleProblem,
} from '@/lib/automations';
import { statusLabel, priorityLabel } from '@/lib/taskLabels';
import { formatRelative } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const SELECT = 'mt-1 h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm';
const BLANK = { name: '', enabled: true, trigger: 'status_changed', toStatus: 'completed', projectId: '', priority: '', action: { type: 'notify_channels' } };

const RuleDialog = ({ initial, projects, people, onClose, onSaved }) => {
  const id = useId();
  const { currentUser } = useAuth();
  const [rule, setRule] = useState(initial);
  const [checklist, setChecklist] = useState((initial.action.items || []).join('\n'));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => { setRule((r) => ({ ...r, ...patch })); setError(''); };
  const setAction = (patch) => set({ action: { ...rule.action, ...patch } });

  const submit = async (e) => {
    e.preventDefault();
    const next = rule.action.type === 'add_checklist'
      ? { ...rule, action: { type: 'add_checklist', items: checklist.split('\n').map((s) => s.trim()).filter(Boolean) } }
      : rule;
    const problem = ruleProblem(next);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      onSaved(await saveRule(currentUser.orgId, next, currentUser));
    } catch (err) {
      reportError(err, { title: "Couldn't save the rule" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.id ? 'Edit rule' : 'New rule'}</DialogTitle>
          <DialogDescription>Rules run every 15 minutes on what changed since.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} className="mt-1" value={rule.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-trigger`}>When</Label>
              <select id={`${id}-trigger`} className={SELECT} value={rule.trigger} onChange={(e) => set({ trigger: e.target.value })}>
                {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {rule.trigger === 'status_changed' && (
              <div>
                <Label htmlFor={`${id}-to`}>To status</Label>
                <select id={`${id}-to`} className={SELECT} value={rule.toStatus} onChange={(e) => set({ toStatus: e.target.value })}>
                  <option value="">Any status</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor={`${id}-project`}>In project</Label>
              <select id={`${id}-project`} className={SELECT} value={rule.projectId} onChange={(e) => set({ projectId: e.target.value })}>
                <option value="">Any project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor={`${id}-priority`}>At priority</Label>
              <select id={`${id}-priority`} className={SELECT} value={rule.priority} onChange={(e) => set({ priority: e.target.value })}>
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-action`}>Then</Label>
            <select id={`${id}-action`} className={SELECT} value={rule.action.type} onChange={(e) => set({ action: { type: e.target.value } })}>
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          {rule.action.type === 'set_priority' && (
            <div>
              <Label htmlFor={`${id}-setp`}>Priority to set</Label>
              <select id={`${id}-setp`} className={SELECT} value={rule.action.priority || ''} onChange={(e) => setAction({ priority: e.target.value })}>
                <option value="">Choose…</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
              </select>
            </div>
          )}
          {rule.action.type === 'assign_to' && (
            <div>
              <Label htmlFor={`${id}-who`}>Assign to</Label>
              <select id={`${id}-who`} className={SELECT} value={rule.action.userId || ''} onChange={(e) => setAction({ userId: e.target.value })}>
                <option value="">Choose…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
              </select>
            </div>
          )}
          {rule.action.type === 'add_checklist' && (
            <div>
              <Label htmlFor={`${id}-items`}>Checklist items (one per line)</Label>
              <Textarea id={`${id}-items`} className="mt-1" rows={4} value={checklist} onChange={(e) => { setChecklist(e.target.value); setError(''); }} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={rule.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            On
          </label>
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} disabled={saving}>{saving ? 'Saving…' : 'Save rule'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ChannelsCard = ({ orgId, currentUser }) => {
  const id = useId();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { getChannels(orgId).then(setForm).catch((e) => reportError(e, { title: "Couldn't load the channels" })); }, [orgId]);
  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    const problems = Object.fromEntries(CHANNELS.map((c) => [c.key, channelProblem(c.key, form[c.key])]).filter(([, p]) => p));
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      await saveChannels(orgId, form);
      toast({ title: 'Channels saved' });
    } catch (err) {
      reportError(err, { title: "Couldn't save the channels" });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    try {
      await sendChannelTest(orgId, currentUser);
      toast({ title: 'Test message on its way', description: 'It is posted within 15 minutes, with the next run.' });
    } catch (err) {
      reportError(err, { title: "Couldn't send the test" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <p className="text-sm text-muted-foreground">Where &quot;Post to the organisation&apos;s channels&quot; posts. Only org admins see these addresses.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-3" noValidate>
          {CHANNELS.map((c) => (
            <div key={c.key}>
              <Label htmlFor={`${id}-${c.key}`}>{c.label}</Label>
              <Input id={`${id}-${c.key}`} className="mt-1" placeholder="https://…" value={form[c.key]}
                onChange={(e) => { setForm((f) => ({ ...f, [c.key]: e.target.value })); setErrors((x) => ({ ...x, [c.key]: undefined })); }}
                aria-invalid={errors[c.key] ? true : undefined} aria-describedby={errors[c.key] ? `${id}-${c.key}-error` : undefined} />
              <FieldError id={`${id}-${c.key}-error`}>{errors[c.key]}</FieldError>
            </div>
          ))}
          <div>
            <Label htmlFor={`${id}-secret`}>Webhook signing secret (optional)</Label>
            <Input id={`${id}-secret`} className="mt-1" value={form.webhookSecret} onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
              aria-describedby={`${id}-secret-hint`} />
            <p id={`${id}-secret-hint`} className="mt-1 text-xs text-muted-foreground">
              Your webhook receives the header X-MagnaFlow-Signature: sha256=HMAC of the body with this secret.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={test}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Send a test message
            </Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save channels'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const AutomationsPage = () => {
  const { currentUser } = useAuth();
  const orgId = currentUser?.orgId;
  const confirm = useConfirm();
  const [rules, setRules] = useState([]);
  const [projects, setProjects] = useState([]);
  const [people, setPeople] = useState([]);
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [r, p, u, ev] = await Promise.all([
        listRules(orgId), getProjects(orgId), getAssignableUsers(currentUser).catch(() => []), listRecentEvents(orgId).catch(() => []),
      ]);
      setRules(r);
      setProjects(p);
      setPeople(u.filter((x) => x.status !== 'inactive'));
      setEvents(ev);
    } catch (error) {
      reportError(error, { title: "Couldn't load the automations" });
    }
  }, [orgId, currentUser]);
  useEffect(() => { load(); }, [load]);

  const projectName = (pid) => projects.find((p) => p.id === pid)?.name || '';

  const toggle = async (rule) => {
    try {
      const saved = await saveRule(orgId, { ...rule, enabled: !rule.enabled }, currentUser);
      setRules((list) => list.map((r) => (r.id === saved.id ? saved : r)));
    } catch (error) {
      reportError(error, { title: "Couldn't change the rule" });
    }
  };

  const remove = async (rule) => {
    if (!(await confirm({ title: `Delete “${rule.name}”?`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteRule(orgId, rule.id);
      setRules((list) => list.filter((r) => r.id !== rule.id));
    } catch (error) {
      reportError(error, { title: "Couldn't delete the rule" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
              Rules
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">They run every 15 minutes on tasks that were created or changed status since.</p>
          </div>
          <Button type="button" onClick={() => setEditing(BLANK)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New rule
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No rules yet. For example: when a task is completed, post it to Slack.</p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground">{r.name}</h3>
                    <p className="text-sm text-muted-foreground">{describeRule(r, projectName(r.projectId))}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="mr-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={r.enabled} onChange={() => toggle(r)} />
                      On
                    </label>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${r.name}`} onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {orgId && <ChannelsCard orgId={orgId} currentUser={currentUser} />}

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has run yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="text-foreground">
                    {e.type === 'channel_test' ? 'Channel test' : e.type === 'task_created' ? 'Task created' : `Status changed to ${statusLabel(e.to)}`}
                    <span className="text-muted-foreground"> · {e.byName || 'someone'} · {formatRelative(e.at)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{e.processed ? (e.results || []).join('; ') : 'Waiting for the next run'}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && (
        <RuleDialog
          initial={editing}
          projects={projects}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRules((list) => (list.some((r) => r.id === saved.id) ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved]));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default AutomationsPage;
