// The monthly performance report emailed to org admins on the 1st (scripts/send-monthly-
// report.cjs). Pure and import-free, so the Node job can load it.

const ms = (v) => {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};
const pad = (n) => String(n).padStart(2, '0');

/** The calendar month before `now`: { start, end (exclusive), label, fromDay, toDay }. */
export const previousMonth = (now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(end.getTime() - 86_400_000);
  return {
    start,
    end,
    label: start.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
    fromDay: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    toDay: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
};

const fmtHours = (minutes) => `${Math.round((minutes / 60) * 10) / 10}h`;

/**
 * @param {{ tasks: Object[], entries: Object[], projects: Object[], people: Object[] }} data the org's
 * @param {{ start: Date, end: Date }} month
 */
export const monthlyReport = ({ tasks = [], entries = [], projects = [], people = [] }, month, now = month.end) => {
  const inMonth = (v) => { const t = ms(v); return t !== null && t >= month.start.getTime() && t < month.end.getTime(); };
  const created = tasks.filter((t) => inMonth(t.createdAt));
  const completed = tasks.filter((t) => t.status === 'completed' && inMonth(t.completedAt));
  const dated = completed.filter((t) => ms(t.deadline) !== null);
  // on time: finished by the end of its deadline day (deadlines are stored as midnight UTC)
  const onTime = dated.filter((t) => ms(t.completedAt) < ms(t.deadline) + 86_400_000);
  const overdueNow = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status) && ms(t.deadline) !== null && ms(t.deadline) + 86_400_000 <= now.getTime());
  const minutes = entries.reduce((n, e) => n + (Number(e.minutes) || 0), 0);

  const nameOf = (uid) => people.find((p) => p.id === uid)?.name || 'Former member';
  const byPerson = new Map();
  for (const t of completed) if (t.assignedTo) byPerson.set(t.assignedTo, (byPerson.get(t.assignedTo) || 0) + 1);
  const topPeople = [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, n]) => ({ name: nameOf(uid), completed: n }));

  const projectName = (id) => projects.find((p) => p.id === id)?.name || 'No project';
  const byProject = new Map();
  for (const t of completed) byProject.set(t.projectId || '', (byProject.get(t.projectId || '') || 0) + 1);
  const projectRows = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ name: projectName(id), completed: n }));

  return {
    created: created.length,
    completed: completed.length,
    onTimePercent: dated.length ? Math.round((onTime.length / dated.length) * 100) : null,
    overdueNow: overdueNow.length,
    hoursLogged: fmtHours(minutes),
    topPeople,
    projectRows,
  };
};

/** The email's opening sentence. */
export const reportSummary = (r, label) => [
  `In ${label} your team finished ${r.completed} task${r.completed === 1 ? '' : 's'}`,
  r.onTimePercent === null ? '' : ` (${r.onTimePercent}% on time)`,
  ` and started ${r.created}.`,
  r.overdueNow ? ` ${r.overdueNow} task${r.overdueNow === 1 ? ' is' : 's are'} overdue now.` : ' Nothing is overdue.',
].join('');

/** Label/value rows for the email. */
export const reportRows = (r) => [
  { label: 'Tasks finished', value: String(r.completed) },
  { label: 'Finished on time', value: r.onTimePercent === null ? '—' : `${r.onTimePercent}%` },
  { label: 'Tasks started', value: String(r.created) },
  { label: 'Overdue now', value: String(r.overdueNow) },
  { label: 'Time logged', value: r.hoursLogged },
  ...r.topPeople.map((p, i) => ({ label: i === 0 ? 'Most finished' : '', value: `${p.name}: ${p.completed}` })),
  ...r.projectRows.map((p, i) => ({ label: i === 0 ? 'By project' : '', value: `${p.name}: ${p.completed} finished` })),
];
