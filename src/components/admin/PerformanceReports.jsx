import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download, Award, Target, Clock, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useTasks } from '@/contexts/TasksContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, getAssignableUsers } from '@/services/userService';
import { reportError } from '@/lib/reportError';
import { buildReport } from '@/lib/reportMetrics';
import { formatDate } from '@/lib/format';
import { statusLabel, priorityLabel } from '@/lib/taskLabels';

// Chart colours come from the theme tokens. They used to be hard-coded for a dark
// background (white pie labels, near-white legend), so on the light theme the status
// chart's labels and legend were invisible.
const AXIS = 'hsl(var(--muted-foreground))';
const GRID = 'hsl(var(--border))';
const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};
const STATUS_COLORS = { completed: '#10B981', 'in-progress': '#3B82F6', review: '#F59E0B', pending: '#8B5CF6' };

const PERIOD_LABELS = {
  '30': 'the last 30 days',
  '180': 'the last 6 months',
  '365': 'the last year',
  all: 'all time',
};

const shownPercent = (p) => (p === null || p === undefined ? '—' : `${p}%`);

const KpiCard = ({ title, value, sub, icon: Icon, tone, index }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
    <Card className="p-6 interactive h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-muted-foreground text-xs mt-1">{sub}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tone}`} aria-hidden="true">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  </motion.div>
);

const KpiSkeleton = () => (
  <Card className="p-6 h-[116px] animate-pulse" aria-hidden="true">
    <div className="h-3 w-24 rounded bg-muted mb-3" />
    <div className="h-7 w-16 rounded bg-muted mb-3" />
    <div className="h-3 w-32 rounded bg-muted" />
  </Card>
);

const PerformanceReports = () => {
  const { tasks: allTasks, loading: tasksLoading } = useTasks();
  const { currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  // Everyone who can hold a task, only used to put a name on an exported assignee.
  const [directory, setDirectory] = useState([]);
  const [staffState, setStaffState] = useState('loading'); // loading | ready | error
  const [timeRange, setTimeRange] = useState('30');
  const [exporting, setExporting] = useState(null);
  const { toast } = useToast();

  const loadStaff = async () => {
    setStaffState('loading');
    try {
      setStaff(await getAllUsers({ role: 'staff' }));
      setStaffState('ready');
      getAssignableUsers(currentUser).then(setDirectory).catch(() => {});
    } catch (error) {
      reportError(error, { title: 'Error loading data' });
      setStaffState('error');
    }
  };

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const report = useMemo(
    () => buildReport(allTasks || [], staff, timeRange),
    [allTasks, staff, timeRange]
  );
  const loading = tasksLoading || staffState === 'loading';
  const periodLabel = PERIOD_LABELS[timeRange];

  const assigneeName = (id) => {
    if (!id) return 'Unassigned';
    return directory.find((s) => s.id === id)?.name || 'Former member';
  };

  const summaryRows = () => [
    ['Period', periodLabel],
    ['Tasks in this report', report.completion.total],
    ['Completed', report.status.find((s) => s.key === 'completed').value],
    ['In progress', report.status.find((s) => s.key === 'in-progress').value],
    ['In review', report.status.find((s) => s.key === 'review').value],
    ['Pending', report.status.find((s) => s.key === 'pending').value],
    ['Completion rate', report.completion.percent === null ? 'n/a' : `${report.completion.percent}% (${report.completion.done} of ${report.completion.total})`],
    ['On-time delivery', report.onTime.percent === null ? 'n/a' : `${report.onTime.percent}% (${report.onTime.onTime} of ${report.onTime.total} completed tasks with a deadline)`],
    ['Average completion time', report.avgCompletion.days === null ? 'n/a' : `${report.avgCompletion.days} days (${report.avgCompletion.count} tasks)`],
    ['Active staff', report.withOpenWork.of],
    ['Staff with open work', report.withOpenWork.count],
  ];

  const handleExportReport = async (format = 'pdf') => {
    setExporting(format);
    try {
      if (format === 'pdf') await exportToPDF();
      else await exportToExcel();
      toast({ title: 'Report exported', description: `Downloaded as ${format.toUpperCase()}.` });
    } catch (error) {
      reportError(error, { title: 'Export failed' });
    } finally {
      setExporting(null);
    }
  };

  const exportToPDF = async () => {
    // jspdf-autotable v5 dropped the old `doc.autoTable({...})` mixin (it only ever
    // worked by patching a global `window.jsPDF`); v5's API is a plain function that
    // takes the document as its first argument.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Performance Report - MagnaFlow', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDate(new Date())}`, 14, 28);

    doc.setFontSize(12);
    doc.text('Summary', 14, 38);
    autoTable(doc, {
      startY: 42,
      head: [['Metric', 'Value']],
      body: summaryRows().map(([k, v]) => [k, String(v)]),
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text('Staff', 14, finalY);
    autoTable(doc, {
      startY: finalY + 4,
      head: [['Staff member', 'Tasks', 'Completed', 'In progress', 'In review', 'Pending', 'Completed %']],
      body: report.staff.map((s) => [s.name, s.total, s.completed, s.inProgress, s.review, s.pending, `${s.percent}%`].map(String)),
    });

    doc.save(`performance-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Performance Report - MagnaFlow']);
    summarySheet.addRow([`Generated: ${formatDate(new Date())}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Metric', 'Value']);
    summaryRows().forEach((row) => summarySheet.addRow(row));

    const staffSheet = workbook.addWorksheet('Staff');
    staffSheet.addRow(['Staff member', 'Tasks', 'Completed', 'In progress', 'In review', 'Pending', 'Completed %']);
    report.staff.forEach((s) => {
      staffSheet.addRow([s.name, s.total, s.completed, s.inProgress, s.review, s.pending, s.percent]);
    });

    const taskSheet = workbook.addWorksheet('Tasks');
    taskSheet.addRow(['Title', 'Status', 'Priority', 'Assigned to', 'Created', 'Deadline', 'Completed']);
    report.tasks.forEach((t) => {
      taskSheet.addRow([
        t.title,
        statusLabel(t.status),
        priorityLabel(t.priority),
        assigneeName(t.assignedTo),
        formatDate(t.createdAt, ''),
        formatDate(t.deadline, ''),
        formatDate(t.completedAt, ''),
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const noTasksAtAll = !loading && (allTasks || []).length === 0;
  const statusTotal = report.status.reduce((a, s) => a + s.value, 0);
  const completedRow = report.status.find((s) => s.key === 'completed');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Track team productivity and project progress</p>
          <p className="text-xs text-muted-foreground mt-1">
            Showing work created, completed or still open in {periodLabel}. Cancelled tasks are left out.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              onClick={() => handleExportReport('pdf')}
              disabled={exporting !== null || loading || noTasksAtAll}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted/60"
            >
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </Button>
            <Button
              onClick={() => handleExportReport('excel')}
              disabled={exporting !== null || loading || noTasksAtAll}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted/60"
            >
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </Button>
          </div>
        </div>
      </div>

      {staffState === 'error' && (
        <Card className="p-4 mb-6 border-destructive/30 bg-destructive-soft" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-destructive">We couldn't load your staff list, so the per-person charts are empty.</p>
            <Button size="sm" variant="outline" onClick={loadStaff}>Try again</Button>
          </div>
        </Card>
      )}

      {noTasksAtAll ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <BarChart3 className="w-16 h-16 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-foreground">No data yet</h3>
            <p className="text-muted-foreground max-w-md">
              There are no tasks yet. Create tasks and assign them to your team to see performance analytics here.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {loading ? (
              [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
            ) : (
              <>
                <KpiCard
                  index={0}
                  title="Completion rate"
                  value={shownPercent(report.completion.percent)}
                  sub={`${report.completion.done} of ${report.completion.total} tasks completed`}
                  icon={Target}
                  tone="bg-success-soft text-success"
                />
                <KpiCard
                  index={1}
                  title="Staff with open work"
                  value={String(report.withOpenWork.count)}
                  sub={`of ${report.withOpenWork.of} active staff`}
                  icon={Users}
                  tone="bg-primary-soft text-primary"
                />
                <KpiCard
                  index={2}
                  title="On-time delivery"
                  value={shownPercent(report.onTime.percent)}
                  sub={report.onTime.total > 0
                    ? `${report.onTime.onTime} of ${report.onTime.total} completed tasks with a deadline`
                    : 'No completed tasks with a deadline yet'}
                  icon={CheckCircle2}
                  tone="bg-warning-soft text-warning"
                />
                <KpiCard
                  index={3}
                  title="Average completion time"
                  value={report.avgCompletion.days === null ? '—' : `${report.avgCompletion.days} days`}
                  sub={report.avgCompletion.count > 0
                    ? `across ${report.avgCompletion.count} completed task${report.avgCompletion.count > 1 ? 's' : ''}`
                    : 'No completed tasks yet'}
                  icon={Clock}
                  tone="bg-muted text-muted-foreground"
                />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Staff productivity */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-foreground">Staff workload</h3>
                <Badge className="bg-primary-soft text-primary border-primary/30">Tasks per person</Badge>
              </div>
              {report.staff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-16 text-center">
                  {loading ? 'Loading…' : 'No tasks are assigned to staff in this period.'}
                </p>
              ) : (
                <div
                  role="img"
                  aria-label={`Tasks per person: ${report.staff.map((s) => `${s.name} ${s.completed} completed, ${s.inProgress + s.review} in progress, ${s.pending} pending`).join('; ')}`}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.staff} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                      <XAxis dataKey="name" stroke={AXIS} fontSize={12} angle={-30} textAnchor="end" height={70} />
                      <YAxis stroke={AXIS} fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="completed" name="Completed" fill={STATUS_COLORS.completed} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="inProgress" name="In progress" fill={STATUS_COLORS['in-progress']} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="pending" name="Pending" fill={STATUS_COLORS.pending} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Status distribution */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-foreground">Task status</h3>
                <Badge className="bg-primary-soft text-primary border-primary/30">{statusTotal} tasks</Badge>
              </div>
              {statusTotal === 0 ? (
                <p className="text-sm text-muted-foreground py-16 text-center">{loading ? 'Loading…' : 'No tasks in this period.'}</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div
                    className="w-full sm:w-1/2"
                    role="img"
                    aria-label={`Task status: ${report.status.map((s) => `${s.name} ${s.value}`).join(', ')}`}
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={report.status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                          {report.status.map((entry) => (
                            <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} stroke="hsl(var(--card))" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Counts as text: exact, readable and not dependent on colour. */}
                  <ul className="w-full sm:w-1/2 space-y-2">
                    {report.status.map((s) => (
                      <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.key] }} aria-hidden="true" />
                          {s.name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{s.value} · {s.percent}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* Weekly activity and top performers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-foreground">Last four weeks</h3>
                  <Badge className="bg-success-soft text-success border-success/30">Created vs completed</Badge>
                </div>
                <div
                  role="img"
                  aria-label={`Created versus completed per week: ${report.weekly.map((w) => `${w.week} ${w.created} created, ${w.completed} completed`).join('; ')}`}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.weekly} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                      <XAxis dataKey="week" stroke={AXIS} fontSize={12} />
                      <YAxis stroke={AXIS} fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="created" name="Created" fill={STATUS_COLORS['in-progress']} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="completed" name="Completed" fill={STATUS_COLORS.completed} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Weeks run back from today. A task finished this week counts as completed this week, whenever it was created.
                </p>
              </Card>
            </div>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-foreground">Most tasks completed</h3>
                <Award className="w-5 h-5 text-warning" aria-hidden="true" />
              </div>
              {report.top.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {loading ? 'Loading…' : 'Nobody has completed a task in this period yet.'}
                </p>
              ) : (
                <ol className="space-y-4">
                  {report.top.map((performer, index) => (
                    <li
                      key={performer.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/60"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-warning text-warning-foreground font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-foreground font-medium">{performer.name}</p>
                          <p className="text-xs text-muted-foreground">of {performer.total} task{performer.total > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-success font-semibold">{performer.completed}</p>
                        <p className="text-xs text-muted-foreground">completed</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {completedRow && completedRow.value > 0 && report.top.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4">Ranked by tasks completed, not by percentage.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default PerformanceReports;
