// Numbers behind the Reports page, as pure functions so they can be tested and so the
// screen, the PDF and the Excel export cannot disagree.
//
// What changed from the first version, and why:
//  - "Last 30 days" filtered on when a task was CREATED, so work finished this month
//    on a task created last month vanished from the report. A task is now in the
//    period if it was created in it, completed in it, or is still open.
//  - "Team Efficiency" was the on-time share of COMPLETED tasks only, so one on-time
//    task read as 100% efficiency for a team with 86% of its work open. It is now
//    called "On-time delivery", and says how many tasks it is based on.
//  - Cancelled tasks are not part of the plan and are excluded everywhere.
//  - Every KPI carried a green up-arrow that merely repeated its own number.
import { toDate, formatDateShort } from './format';
import { finishedOnTime } from './taskState';

const DAY = 24 * 60 * 60 * 1000;
export const RANGES = { '30': 30, '180': 180, '365': 365 };

export const periodStart = (range, now = new Date()) => {
  const days = RANGES[range];
  return days ? new Date(now.getTime() - days * DAY) : null;
};

const inWindow = (value, start, end) => {
  const d = toDate(value);
  return Boolean(d) && (!start || d >= start) && (!end || d < end);
};

/** Tasks that belong in the report for this period (cancelled work is never included). */
export const tasksForPeriod = (tasks, range, now = new Date()) => {
  const live = (tasks || []).filter((t) => t.status !== 'cancelled');
  const start = periodStart(range, now);
  if (!start) return live;
  return live.filter((t) => {
    // Open work is current whatever its age; finished work needs a date inside the period.
    if (t.status !== 'completed') return true;
    return inWindow(t.completedAt, start) || inWindow(t.createdAt, start);
  });
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** Average whole days from creation to completion across completed tasks. */
export const averageCompletionDays = (tasks) => {
  const durations = (tasks || [])
    .filter((t) => t.status === 'completed')
    .map((t) => {
      const created = toDate(t.createdAt);
      const completed = toDate(t.completedAt);
      return created && completed && completed >= created ? (completed - created) / DAY : null;
    })
    .filter((d) => d !== null);
  if (durations.length === 0) return { days: null, count: 0 };
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  return { days: Math.round(mean * 10) / 10, count: durations.length };
};

export const onTimeDelivery = (tasks) => {
  const known = (tasks || [])
    .filter((t) => t.status === 'completed')
    .map(finishedOnTime)
    .filter((v) => v !== null);
  const onTime = known.filter(Boolean).length;
  return { percent: pct(onTime, known.length), onTime, total: known.length };
};

/** Created vs completed for each of the last four weeks, oldest first. */
export const weeklyActivity = (tasks, now = new Date(), weeks = 4) => {
  const rows = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 7 * DAY);
    const start = new Date(end.getTime() - 7 * DAY);
    rows.push({
      week: `w/c ${formatDateShort(start, '', now)}`,
      created: (tasks || []).filter((t) => inWindow(t.createdAt, start, end)).length,
      completed: (tasks || []).filter((t) => t.status === 'completed' && inWindow(t.completedAt, start, end)).length,
    });
  }
  return rows;
};

export const statusBreakdown = (tasks) => {
  const count = (s) => (tasks || []).filter((t) => t.status === s).length;
  const rows = [
    { key: 'completed', name: 'Completed', value: count('completed') },
    { key: 'in-progress', name: 'In progress', value: count('in-progress') },
    { key: 'review', name: 'In review', value: count('review') },
    { key: 'pending', name: 'Pending', value: count('pending') },
  ];
  const total = rows.reduce((a, r) => a + r.value, 0);
  return rows.map((r) => ({ ...r, percent: pct(r.value, total) ?? 0 }));
};

export const staffRows = (tasks, staff) =>
  (staff || [])
    .map((member) => {
      const mine = (tasks || []).filter((t) => t.assignedTo === member.id);
      const completed = mine.filter((t) => t.status === 'completed').length;
      return {
        id: member.id,
        name: member.name || member.email,
        total: mine.length,
        completed,
        inProgress: mine.filter((t) => t.status === 'in-progress').length,
        review: mine.filter((t) => t.status === 'review').length,
        pending: mine.filter((t) => t.status === 'pending').length,
        percent: pct(completed, mine.length) ?? 0,
      };
    })
    .filter((row) => row.total > 0);

/** Ranked by work actually finished, not by a ratio that a single task can max out. */
export const topPerformers = (rows, limit = 3) =>
  [...(rows || [])]
    .filter((r) => r.completed > 0)
    .sort((a, b) => b.completed - a.completed || b.percent - a.percent || a.name.localeCompare(b.name))
    .slice(0, limit);

/** Everything the page needs, in one call. */
export const buildReport = (allTasks, staff, range, now = new Date()) => {
  const tasks = tasksForPeriod(allTasks, range, now);
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const rows = staffRows(tasks, staff);
  const activeStaff = (staff || []).filter((m) => m.status !== 'inactive');
  const withOpenWork = activeStaff.filter((m) =>
    tasks.some((t) => t.assignedTo === m.id && (t.status === 'in-progress' || t.status === 'pending' || t.status === 'review'))
  ).length;

  return {
    tasks,
    completion: { percent: pct(completed, tasks.length), done: completed, total: tasks.length },
    onTime: onTimeDelivery(tasks),
    avgCompletion: averageCompletionDays(tasks),
    withOpenWork: { count: withOpenWork, of: activeStaff.length },
    status: statusBreakdown(tasks),
    staff: rows,
    top: topPerformers(rows),
    // The weekly chart is independent of the range selector: it is always the last four weeks.
    weekly: weeklyActivity((allTasks || []).filter((t) => t.status !== 'cancelled'), now),
  };
};
