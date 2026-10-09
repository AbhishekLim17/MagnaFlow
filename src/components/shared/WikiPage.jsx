// Project pages: meeting notes, specs, decisions (lib/wiki). Anyone on the project reads and
// edits them; an action item ("- [ ] ...") becomes a task assigned to you with one click.
import React, { useCallback, useEffect, useId, useState } from 'react';
import { BookOpen, FilePlus2, ListPlus, Pencil, Trash2 } from 'lucide-react';
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
import { useMyProjects } from '@/hooks/useMyProjects';
import { createPage, deletePage, listPages, savePage } from '@/services/wikiService';
import { MAX_BODY, MAX_TITLE, openActions, pageProblem, parseLines, tickLine } from '@/lib/wiki';
import { runsProject } from '@/lib/taskPermissions';
import { formatRelative } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const HELP = '# Heading · ## Smaller heading · - bullet · - [ ] action item (can become a task) · - [x] done';

const Body = ({ body, onMakeTask, busyLine }) => (
  <div className="space-y-1 text-sm leading-relaxed">
    {parseLines(body).map((l) => {
      switch (l.kind) {
        case 'h1': return <h3 key={l.index} className="pt-3 text-lg font-semibold">{l.text}</h3>;
        case 'h2': return <h4 key={l.index} className="pt-2 font-semibold">{l.text}</h4>;
        case 'bullet': return <p key={l.index} className="pl-4 before:-ml-3 before:mr-2 before:content-['•']">{l.text}</p>;
        case 'done': return <p key={l.index} className="pl-1 text-muted-foreground line-through"><span aria-hidden="true">☑ </span>{l.text}</p>;
        case 'todo': return (
          <div key={l.index} className="flex flex-wrap items-center gap-2 pl-1">
            <span><span aria-hidden="true">☐ </span>{l.text}</span>
            {onMakeTask && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" disabled={busyLine === l.index}
                onClick={() => onMakeTask(l)} aria-label={`Make a task: ${l.text}`}>
                <ListPlus className="h-3.5 w-3.5" aria-hidden="true" /> Make task
              </Button>
            )}
          </div>
        );
        case 'blank': return <div key={l.index} className="h-2" />;
        default: return <p key={l.index} className="whitespace-pre-wrap">{l.text}</p>;
      }
    })}
  </div>
);

const WikiPage = () => {
  const { currentUser } = useAuth();
  const { createTask } = useTasks();
  const confirm = useConfirm();
  const id = useId();
  const { projects, projectId, setProjectId, project } = useMyProjects();
  const [pages, setPages] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null); // { id?, title, body } while editing
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyLine, setBusyLine] = useState(null);
  const orgId = currentUser?.orgId;
  const me = currentUser?.uid;

  const load = useCallback(async () => {
    if (!projectId) return;
    setPages(null);
    setDraft(null);
    try {
      const list = await listPages(orgId, projectId);
      setPages(list);
      setOpenId(list[0]?.id || null);
    } catch (e) {
      setPages([]);
      reportError(e, { title: "Couldn't load the pages" });
    }
  }, [orgId, projectId]);
  useEffect(() => { load(); }, [load]);

  const page = pages?.find((p) => p.id === openId) || null;

  const save = async (e) => {
    e.preventDefault();
    const problem = pageProblem(draft);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      if (draft.id) {
        const saved = await savePage(orgId, projectId, draft.id, draft, currentUser);
        setPages((list) => list.map((p) => (p.id === draft.id ? { ...p, ...saved } : p)));
      } else {
        const created = await createPage(orgId, projectId, draft, currentUser);
        setPages((list) => [...list, created].sort((a, b) => a.title.localeCompare(b.title)));
        setOpenId(created.id);
      }
      setDraft(null);
    } catch (err) {
      reportError(err, { title: "Couldn't save the page" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Delete “${page.title}”?`, description: 'The page is gone for everyone.', confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deletePage(orgId, projectId, page.id);
      setPages((list) => list.filter((p) => p.id !== page.id));
      setOpenId(null);
    } catch (err) {
      reportError(err, { title: "Couldn't delete the page" });
    }
  };

  // An action item becomes a task assigned to me in this project; the line is ticked.
  const makeTask = async (line) => {
    setBusyLine(line.index);
    try {
      await createTask({
        title: line.text.slice(0, 200),
        description: `From the page “${page.title}”.`,
        assignedTo: me,
        priority: 'medium',
        status: 'pending',
        projectId,
        departmentId: project?.departmentId || undefined,
      });
    } catch {
      setBusyLine(null);
      return; // TasksContext has said why
    }
    try {
      const body = tickLine(page.body, line.index);
      const saved = await savePage(orgId, projectId, page.id, { title: page.title, body }, currentUser);
      setPages((list) => list.map((p) => (p.id === page.id ? { ...p, ...saved } : p)));
    } catch (err) {
      reportError(err, { title: 'The task was made, but the line could not be ticked' });
    } finally {
      setBusyLine(null);
    }
  };

  if (projects === null) return <LoadingState label="Loading projects…" />;
  if (!projects.length) return <EmptyState icon={BookOpen} title="No projects" hint="Pages are kept per project; you are not on one yet." />;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit">
        <CardHeader className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${id}-project`}>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id={`${id}-project`}><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => { setDraft({ title: '', body: '' }); setError(null); }}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" /> New page
          </Button>
        </CardHeader>
        <CardContent>
          {pages === null ? <LoadingState label="Loading…" rows={2} /> : pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages yet.</p>
          ) : (
            <nav aria-label="Pages">
              <ul className="space-y-1">
                {pages.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { setOpenId(p.id); setDraft(null); }}
                      aria-current={p.id === openId ? 'page' : undefined}
                      className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm ${p.id === openId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      <span className="truncate">{p.title}</span>
                      {openActions(p.body) > 0 && <span className="shrink-0 text-xs opacity-80">{openActions(p.body)} to do</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </CardContent>
      </Card>

      <Card>
        {draft ? (
          <>
            <CardHeader><CardTitle>{draft.id ? 'Edit page' : 'New page'}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={save} className="space-y-4" noValidate>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-title`}>Title</Label>
                  <Input id={`${id}-title`} value={draft.title} maxLength={MAX_TITLE} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${id}-body`}>Text</Label>
                  <Textarea id={`${id}-body`} rows={18} className="font-mono text-sm" value={draft.body} maxLength={MAX_BODY}
                    aria-describedby={`${id}-help`} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
                  <p id={`${id}-help`} className="text-xs text-muted-foreground">{HELP}</p>
                </div>
                <FieldError id={`${id}-err`}>{error}</FieldError>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </>
        ) : page ? (
          <>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{page.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Last edited by {page.updatedByName || 'someone'} {formatRelative(page.updatedAt)}</p>
              </div>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => { setDraft({ id: page.id, title: page.title, body: page.body }); setError(null); }}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                </Button>
                {(page.createdBy === me || runsProject(currentUser, project)) && (
                  <Button type="button" size="icon" variant="ghost" aria-label={`Delete the page ${page.title}`} onClick={remove}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {page.body.trim() ? <Body body={page.body} onMakeTask={makeTask} busyLine={busyLine} /> : <p className="text-sm text-muted-foreground">This page is empty.</p>}
            </CardContent>
          </>
        ) : (
          <CardContent className="pt-6">
            <EmptyState icon={BookOpen} title="Pick a page or start one" hint="Meeting notes, specs, decisions. Write “- [ ] something” and it can become a task." />
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default WikiPage;
