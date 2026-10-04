// Import tasks from a spreadsheet, export them to one, or export the whole workspace.
//
// The import never creates anything until the person has seen what will happen: every row
// is checked first, problems are listed with their line numbers, and only the rows that
// passed are created.

import React, { useId, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, FileDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/contexts/TasksContext';
import { toCsv, downloadText, safeFilename } from '@/lib/csv';
import { parseTaskImport, tasksToRows, sampleImportRows, MAX_IMPORT_ROWS } from '@/lib/taskCsv';
import { buildWorkspaceSheets, downloadWorkbook } from '@/lib/workspaceExport';
import { formatDate } from '@/lib/format';
import { statusLabel, priorityLabel } from '@/lib/taskLabels';
import { reportError } from '@/lib/reportError';

const today = () => new Date().toISOString().slice(0, 10);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * @param {Object[]} people           who tasks may be assigned to ({id,name,email})
 * @param {Object[]} projects         projects the caller may add tasks to ({id,name,departmentId})
 * @param {Object[]} visibleTasks     the list as currently filtered
 * @param {Object[]} allTasks         every task the caller can see
 * @param {boolean}  filtered         whether visibleTasks is narrower than allTasks
 * @param {Object}   lookups          { person(uid), projectName(id), departmentName(id) }
 * @param {string}   [defaultProjectId]
 * @param {Function} [loadWorkspace]  async () => ({ people, projects, departments, designations, organisation, exportedBy, tasksTruncated });
 *                                    when given, the whole-workspace export is offered (org admins)
 */
const TaskImportExportDialog = ({
  open, onOpenChange, people = [], projects = [], visibleTasks = [], allTasks = [], filtered = false,
  lookups = {}, defaultProjectId, loadWorkspace,
}) => {
  const { importTasks } = useTasks();
  const fileRef = useRef(null);
  const ids = useId();
  const [tab, setTab] = useState('import');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [dateOrder, setDateOrder] = useState('dmy');
  const [notify, setNotify] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } while importing
  const [result, setResult] = useState(null);     // { created, failed } after importing
  const [exporting, setExporting] = useState(false);

  const parsed = useMemo(
    () => (fileText ? parseTaskImport(fileText, { people, projects, dateOrder, defaultProjectId }) : null),
    [fileText, people, projects, dateOrder, defaultProjectId],
  );
  const ready = parsed?.rows.filter((r) => r.task) || [];
  const problems = parsed?.rows.filter((r) => r.errors.length) || [];
  const unassigned = ready.filter((r) => r.warnings.length).length;
  const importing = progress !== null;

  const reset = () => {
    setFileName('');
    setFileText('');
    setResult(null);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = (next) => {
    if (importing) return; // creating tasks; closing now would hide the outcome
    if (!next) reset();
    onOpenChange(next);
  };

  const readFile = async (file) => {
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    setFileText(await file.text());
  };

  const runImport = async () => {
    const tasks = ready.map((r) => r.task);
    setProgress({ done: 0, total: tasks.length });
    try {
      const outcome = await importTasks(tasks, {
        notify,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      // map failures back to the spreadsheet lines they came from
      setResult({
        created: outcome.created.length,
        failed: outcome.failed.map((f) => ({ line: ready[f.index].line, title: f.task.title, message: f.message })),
      });
      setFileText('');
    } finally {
      setProgress(null);
    }
  };

  const exportCsv = (tasks, label) => {
    const text = toCsv(tasksToRows(tasks, lookups));
    downloadText(text, safeFilename(`${label} ${today()}.csv`));
  };

  const exportWorkspace = async () => {
    setExporting(true);
    try {
      const data = await loadWorkspace();
      const sheets = buildWorkspaceSheets(
        { tasks: allTasks, people: data.people, projects: data.projects, departments: data.departments, designations: data.designations },
        { organisation: data.organisation, exportedBy: data.exportedBy, tasksTruncated: data.tasksTruncated },
      );
      await downloadWorkbook(sheets, safeFilename(`${data.organisation || 'MagnaFlow'} workspace ${today()}.xlsx`));
    } catch (error) {
      reportError(error, { title: 'Could not export the workspace' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import and export</DialogTitle>
          <DialogDescription>Bring tasks in from a spreadsheet, or take them out to one.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="import" disabled={importing}><Upload aria-hidden="true" className="h-4 w-4" />Import</TabsTrigger>
            <TabsTrigger value="export" disabled={importing}><Download aria-hidden="true" className="h-4 w-4" />Export</TabsTrigger>
          </TabsList>

          {/* ── Import ── */}
          <TabsContent value="import" className="mt-5 space-y-5">
            {result ? (
              <div className="space-y-4" role="status">
                <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">{plural(result.created, 'task')} imported.</p>
                    {notify && result.created > 0 && (
                      <p className="text-sm text-muted-foreground">Assignees will get an email within about 15 minutes.</p>
                    )}
                  </div>
                </div>
                {result.failed.length > 0 && (
                  <ProblemList
                    title={`${plural(result.failed.length, 'row')} could not be created`}
                    items={result.failed.map((f) => ({ line: f.line, text: `${f.title}: ${f.message}` }))}
                  />
                )}
                <Button type="button" variant="outline" onClick={reset}>Import another file</Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${ids}-file`}>Spreadsheet (CSV)</Label>
                  <input
                    id={`${ids}-file`}
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    disabled={importing}
                    onChange={(e) => readFile(e.target.files?.[0])}
                    className="block w-full cursor-pointer rounded-xl border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    The first row must hold column names; only <strong>Title</strong> is required. Also read: Description,
                    Status, Priority, Assignee (name or email), Start date, Deadline, Project. Up to {MAX_IMPORT_ROWS} rows.
                    In Excel or Google Sheets, use File → Download / Save as → CSV.{' '}
                    <button
                      type="button"
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => downloadText(toCsv(sampleImportRows()), 'MagnaFlow task import sample.csv')}
                    >
                      Download a sample file
                    </button>
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${ids}-order`}>Dates like 03/04/2026 mean</Label>
                    <Select value={dateOrder} onValueChange={setDateOrder} disabled={importing}>
                      <SelectTrigger id={`${ids}-order`} className="bg-muted">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dmy">3 April (day first)</SelectItem>
                        <SelectItem value="mdy">March 4 (month first)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm sm:mt-7">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={notify}
                      disabled={importing}
                      onChange={(e) => setNotify(e.target.checked)}
                    />
                    <span>
                      Email the assignees about their new tasks
                      <span className="block text-xs text-muted-foreground">Off by default, so a large import doesn&apos;t flood inboxes.</span>
                    </span>
                  </label>
                </div>

                {parsed && (
                  <div className="space-y-4" aria-live="polite">
                    {parsed.error ? (
                      <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{parsed.error}
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span className="font-semibold text-foreground">{fileName}</span>
                          <span className="text-success">{plural(ready.length, 'task')} ready</span>
                          {problems.length > 0 && <span className="text-destructive">{plural(problems.length, 'row')} with problems (skipped)</span>}
                          {unassigned > 0 && <span className="text-muted-foreground">{unassigned} without an assignee</span>}
                        </div>
                        {parsed.unknownColumns.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Ignored columns: {parsed.unknownColumns.join(', ')}.
                          </p>
                        )}
                        {problems.length > 0 && (
                          <ProblemList
                            title="Fix these in the spreadsheet and choose the file again, or import the rest now"
                            items={problems.map((r) => ({ line: r.line, text: r.errors.join(' ') }))}
                          />
                        )}
                        {ready.length > 0 && <Preview rows={ready.slice(0, 5)} lookups={lookups} more={ready.length - 5} />}
                      </>
                    )}
                  </div>
                )}

                {importing && (
                  <div className="space-y-2" role="status">
                    <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} aria-label="Import progress" />
                    <p className="text-sm text-muted-foreground">Creating {progress.done} of {progress.total}…</p>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => close(false)} disabled={importing}>Cancel</Button>
                  <Button type="button" onClick={runImport} disabled={importing || ready.length === 0}>
                    <Upload aria-hidden="true" />
                    {ready.length ? `Import ${plural(ready.length, 'task')}` : 'Import'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Export ── */}
          <TabsContent value="export" className="mt-5 space-y-3">
            {filtered && (
              <ExportRow
                icon={FileDown}
                title="These tasks"
                text={`The ${plural(visibleTasks.length, 'task')} matching your filters, as CSV.`}
                action="Export CSV"
                disabled={visibleTasks.length === 0}
                onClick={() => exportCsv(visibleTasks, 'MagnaFlow tasks (filtered)')}
              />
            )}
            <ExportRow
              icon={FileDown}
              title="All tasks"
              text={`Every task you can see (${allTasks.length}), as CSV. The file can be edited and imported back.`}
              action="Export CSV"
              disabled={allTasks.length === 0}
              onClick={() => exportCsv(allTasks, 'MagnaFlow tasks')}
            />
            {loadWorkspace && (
              <ExportRow
                icon={FileSpreadsheet}
                title="Whole workspace"
                text="Tasks, people, projects, departments and designations, one sheet each, as an Excel workbook."
                action={exporting ? 'Preparing…' : 'Export Excel'}
                disabled={exporting}
                onClick={exportWorkspace}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const ExportRow = ({ icon: Icon, title, text, action, onClick, disabled }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled} className="shrink-0">
      <Download aria-hidden="true" />{action}
    </Button>
  </div>
);

const ProblemList = ({ title, items }) => (
  <div className="rounded-xl border border-warning/40 bg-warning-soft p-3">
    <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
      {items.slice(0, 100).map((item) => (
        <li key={`${item.line}-${item.text}`}>
          <span className="font-medium text-foreground">Line {item.line}:</span>{' '}
          <span className="text-muted-foreground">{item.text}</span>
        </li>
      ))}
      {items.length > 100 && <li className="text-muted-foreground">…and {items.length - 100} more.</li>}
    </ul>
  </div>
);

const Preview = ({ rows, lookups, more }) => (
  <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">The first tasks that will be created</caption>
      <thead className="bg-muted text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="px-3 py-2 font-medium">Title</th>
          <th scope="col" className="px-3 py-2 font-medium">Assignee</th>
          <th scope="col" className="px-3 py-2 font-medium">Deadline</th>
          <th scope="col" className="px-3 py-2 font-medium">Status</th>
          <th scope="col" className="px-3 py-2 font-medium">Priority</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ line, task }) => (
          <tr key={line} className="border-t border-border">
            <td className="max-w-[16rem] truncate px-3 py-2 text-foreground">{task.title}</td>
            <td className="px-3 py-2 text-muted-foreground">{task.assignedTo ? lookups.person?.(task.assignedTo)?.name || '—' : 'Unassigned'}</td>
            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{task.deadline ? formatDate(task.deadline) : '—'}</td>
            <td className="px-3 py-2 text-muted-foreground">{statusLabel(task.status)}</td>
            <td className="px-3 py-2 text-muted-foreground">{priorityLabel(task.priority)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {more > 0 && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">and {more} more</p>}
  </div>
);

export default TaskImportExportDialog;
