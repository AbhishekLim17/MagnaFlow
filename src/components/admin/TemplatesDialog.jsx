// Templates: save a project's tasks as a reusable plan, and lay a plan out again from a new
// start date (titles, priorities, durations, gaps, dependencies, checklists, milestones).

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { LayoutTemplate, Trash2, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useTasks } from '@/contexts/TasksContext';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import FieldError from '@/components/shared/FieldError';
import { listTemplates, saveTemplate, deleteTemplate } from '@/services/templateService';
import { getSubtasks } from '@/services/subtaskService';
import {
  tasksToTemplateItems, planFromTemplate, describeTemplate, MAX_TEMPLATE_TASKS,
} from '@/lib/templates';
import { formatDate, toInputDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ORG_ADMIN = new Set(['org-admin', 'admin']);

/**
 * @param {Object}   currentUser   { uid, role, orgId, projectIds }
 * @param {Object[]} projects      projects the caller may add tasks to
 * @param {Object[]} people        who tasks may be assigned to
 * @param {Object[]} tasks         tasks the caller can see (to save a project as a template)
 */
const TemplatesDialog = ({ open, onOpenChange, currentUser, projects = [], people = [], tasks = [] }) => {
  const ids = useId();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { createFromPlan } = useTasks();
  const orgId = currentUser?.orgId;

  const [tab, setTab] = useState('use');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // use
  const [templateId, setTemplateId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState(() => toInputDate());
  const [assignee, setAssignee] = useState('none');
  const [notify, setNotify] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  // save
  const [sourceProject, setSourceProject] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      setTemplates(await listTemplates(orgId));
    } catch (error) {
      reportError(error, { title: 'Could not load templates' });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!projectId && projects.length === 1) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const template = templates.find((t) => t.id === templateId);
  const project = projects.find((p) => p.id === projectId);
  const plan = useMemo(() => (template
    ? planFromTemplate(template, {
      startDate,
      projectId: project?.id,
      departmentId: project?.departmentId,
      assignedTo: assignee === 'none' ? '' : assignee,
    })
    : []), [template, startDate, project, assignee]);

  const sourceTasks = tasks.filter((t) => t.projectId && t.projectId === sourceProject && t.status !== 'cancelled');
  const canSave = ['org-admin', 'admin', 'department-head', 'manager'].includes(currentUser?.role);
  const canDelete = (t) => ORG_ADMIN.has(currentUser?.role) || t.createdBy === currentUser?.uid;
  const busy = progress !== null || saving;

  const close = (next) => {
    if (busy) return;
    if (!next) {
      setResult(null);
      setTemplateId('');
    }
    onOpenChange(next);
  };

  const create = async () => {
    setProgress({ done: 0, total: plan.length });
    try {
      const outcome = await createFromPlan(plan, { notify, onProgress: (done, total) => setProgress({ done, total }) });
      setResult({ created: outcome.created.length, failed: outcome.failed });
    } finally {
      setProgress(null);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setNameError('Give the template a name.');
      return;
    }
    setSaving(true);
    try {
      // The checklists come along: they are often the most reusable part.
      const checklists = {};
      await Promise.all(sourceTasks.map(async (t) => {
        try {
          checklists[t.id] = (await getSubtasks(t.id)).map((s) => s.title);
        } catch {
          checklists[t.id] = [];
        }
      }));
      const items = tasksToTemplateItems(sourceTasks, checklists);
      await saveTemplate(orgId, { name, description, items }, currentUser.uid);
      toast({ title: 'Template saved', description: `“${name.trim()}”: ${describeTemplate({ items })}.` });
      setName('');
      setDescription('');
      setSourceProject('');
      await load();
      setTab('use');
    } catch (error) {
      reportError(error, { title: 'Could not save the template' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    const ok = await confirm({
      title: `Delete the “${t.name}” template?`,
      description: <p>Tasks already created from it are not affected.</p>,
      confirmLabel: 'Delete template',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate(orgId, t.id);
      if (templateId === t.id) setTemplateId('');
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast({ title: 'Template deleted' });
    } catch (error) {
      reportError(error, { title: 'Could not delete the template' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Templates</DialogTitle>
          <DialogDescription>Reuse the plan of a project you have run before.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="use" disabled={busy}>Use a template</TabsTrigger>
            {canSave && <TabsTrigger value="save" disabled={busy}>Save as template</TabsTrigger>}
          </TabsList>

          {/* ── Use ── */}
          <TabsContent value="use" className="mt-5 space-y-5">
            {result ? (
              <div className="space-y-4" role="status">
                <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  <p className="font-semibold text-foreground">{plural(result.created, 'task')} created.</p>
                </div>
                {result.failed.length > 0 && (
                  <ul className="space-y-1 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
                    {result.failed.map((f) => (
                      <li key={f.index}><span className="font-medium">{f.task.title}:</span> {f.message}</li>
                    ))}
                  </ul>
                )}
                <Button type="button" variant="outline" onClick={() => setResult(null)}>Use another template</Button>
              </div>
            ) : (
              <>
                {loading ? (
                  <p className="text-sm text-muted-foreground" role="status">Loading templates…</p>
                ) : templates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    <LayoutTemplate className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
                    No templates yet.{canSave ? ' Save a project you have planned as a template to reuse it.' : ''}
                  </div>
                ) : (
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-foreground">Template</legend>
                    <div className="space-y-2">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          className={`flex items-start gap-3 rounded-xl border p-3 ${templateId === t.id ? 'border-primary bg-primary-soft' : 'border-border'}`}
                        >
                          <input
                            type="radio"
                            id={`${ids}-tpl-${t.id}`}
                            name={`${ids}-template`}
                            value={t.id}
                            checked={templateId === t.id}
                            onChange={() => setTemplateId(t.id)}
                            className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <label htmlFor={`${ids}-tpl-${t.id}`} className="min-w-0 flex-1 cursor-pointer">
                            <span className="block font-medium text-foreground">{t.name}</span>
                            <span className="block text-xs text-muted-foreground">{describeTemplate(t)}</span>
                            {t.description && <span className="mt-1 block text-sm text-muted-foreground">{t.description}</span>}
                          </label>
                          {canDelete(t) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => remove(t)}
                              aria-label={`Delete the ${t.name} template`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                )}

                {template && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${ids}-project`}>Add to project</Label>
                      <Select value={projectId || 'none'} onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}>
                        <SelectTrigger id={`${ids}-project`} className="bg-muted"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${ids}-start`}>Starts on</Label>
                      <Input id={`${ids}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${ids}-assignee`}>Assign every task to</Label>
                      <Select value={assignee} onValueChange={setAssignee}>
                        <SelectTrigger id={`${ids}-assignee`} className="bg-muted"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nobody yet (assign later)</SelectItem>
                          {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm sm:mt-7">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                        checked={notify}
                        disabled={assignee === 'none'}
                        onChange={(e) => setNotify(e.target.checked)}
                      />
                      <span>Email the assignee about the new tasks</span>
                    </label>
                  </div>
                )}

                {template && plan.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Tasks that will be created</caption>
                      <thead className="bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">Task</th>
                          <th scope="col" className="px-3 py-2 font-medium">Starts</th>
                          <th scope="col" className="px-3 py-2 font-medium">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.slice(0, 8).map((p) => (
                          <tr key={p.key} className="border-t border-border">
                            <td className="max-w-[18rem] truncate px-3 py-2 text-foreground">
                              {p.task.milestone && <span className="mr-1 text-primary" aria-hidden="true">◆</span>}
                              {p.task.title}
                              {p.dependsOn.length > 0 && <span className="ml-1 text-xs text-muted-foreground">(waits for {p.dependsOn.length})</span>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.task.startDate ? formatDate(p.task.startDate) : '—'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.task.deadline ? formatDate(p.task.deadline) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.length > 8 && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">and {plan.length - 8} more</p>}
                  </div>
                )}

                {progress && (
                  <div className="space-y-2" role="status">
                    <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} aria-label="Progress" />
                    <p className="text-sm text-muted-foreground">Creating {progress.done} of {progress.total}…</p>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
                  <Button type="button" onClick={create} disabled={busy || !template || plan.length === 0 || !startDate}>
                    {template ? `Create ${plural(plan.length, 'task')}` : 'Create tasks'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Save ── */}
          {canSave && (
            <TabsContent value="save" className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor={`${ids}-source`}>Project to copy</Label>
                <Select value={sourceProject || 'none'} onValueChange={(v) => setSourceProject(v === 'none' ? '' : v)}>
                  <SelectTrigger id={`${ids}-source`} className="bg-muted"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a project</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {sourceProject && (
                  <p className="text-xs text-muted-foreground">
                    {sourceTasks.length
                      ? `${describeTemplate({ items: tasksToTemplateItems(sourceTasks) })}. Titles, priorities, durations, gaps, dependencies, milestones and checklists are kept; people and statuses are not.`
                      : 'This project has no tasks to copy.'}
                    {sourceTasks.length > MAX_TEMPLATE_TASKS && ` Only the first ${MAX_TEMPLATE_TASKS} can be saved.`}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${ids}-name`}>Template name</Label>
                <Input
                  id={`${ids}-name`}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  placeholder="e.g. Website launch"
                  maxLength={120}
                  className="bg-muted"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `${ids}-name-error` : undefined}
                />
                <FieldError id={`${ids}-name-error`}>{nameError}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${ids}-description`}>What it is for (optional)</Label>
                <Textarea
                  id={`${ids}-description`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="bg-muted"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
                <Button type="button" onClick={save} disabled={busy || sourceTasks.length === 0}>
                  {saving ? 'Saving…' : 'Save template'}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TemplatesDialog;
