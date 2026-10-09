// Sprints: time-boxed iterations of a project (organizations/{org}/projects/{p}/sprints).
// A task joins one with `sprintId` and is sized with `storyPoints`; tasks of the project
// without a sprint are its backlog. Pure.
import { toDate } from './format';

export const MAX_POINTS = 100;
const DAY = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };

/** Story points from a form: a whole number 0..100, or null when empty. */
export const parsePoints = (value) => {
  if (value === '' || value == null) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_POINTS) : null;
};

export const pointsOf = (task) => Number(task?.storyPoints) || 0;

/** Why a sprint cannot be saved, or null. */
export const sprintProblem = ({ name, startDate, endDate }) => {
  if (!String(name || '').trim()) return 'Name the sprint.';
  if (!startDate || !endDate) return 'Choose the first and last day.';
  if (endDate < startDate) return 'The last day cannot be before the first.';
  if ((parse(endDate) - parse(startDate)) / DAY > 62) return 'Keep a sprint to two months at most.';
  return null;
};

/** Active first, then planned (soonest first), then closed (latest first). */
export const sortSprints = (sprints = []) => {
  const rank = { active: 0, planned: 1, closed: 2 };
  return [...sprints].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
    || (a.status === 'closed' ? String(b.endDate).localeCompare(String(a.endDate)) : String(a.startDate).localeCompare(String(b.startDate))));
};

/** Points in the sprint, done and left. */
export const sprintTotals = (tasks = []) => {
  const live = tasks.filter((t) => t.status !== 'cancelled');
  const total = live.reduce((n, t) => n + pointsOf(t), 0);
  const done = live.filter((t) => t.status === 'completed').reduce((n, t) => n + pointsOf(t), 0);
  return { total, done, left: total - done, tasks: live.length, unsized: live.filter((t) => !pointsOf(t)).length };
};

/**
 * Burndown: for each day of the sprint, the ideal line (straight from all points to none)
 * and what was actually left at the end of that day (from each task's completedAt), up to
 * today. Points added mid-sprint count from the start (the history is not kept).
 * @returns {{ day: string, ideal: number, left: number|null }[]}
 */
export const burndown = (sprint, tasks = [], today = new Date()) => {
  if (sprintProblem({ ...sprint, name: 'x' })) return [];
  const { total } = sprintTotals(tasks);
  const start = parse(sprint.startDate);
  const days = Math.round((parse(sprint.endDate) - start) / DAY) + 1;
  const done = tasks.filter((t) => t.status === 'completed')
    .map((t) => ({ at: toDate(t.completedAt)?.getTime() ?? Infinity, points: pointsOf(t) }));
  const now = today.getTime();
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const endOfDay = day.getTime() + DAY;
    const ideal = days === 1 ? 0 : Math.round(total * (1 - i / (days - 1)) * 10) / 10;
    const left = day.getTime() > now ? null : total - done.filter((d) => d.at < endOfDay).reduce((n, d) => n + d.points, 0);
    return { day: ymd(day), ideal, left };
  });
};

/** Average points finished in the last few closed sprints (they record completedPoints). */
export const velocity = (sprints = [], last = 3) => {
  const closed = sortSprints(sprints).filter((s) => s.status === 'closed' && Number.isFinite(Number(s.completedPoints))).slice(0, last);
  return closed.length ? Math.round(closed.reduce((n, s) => n + Number(s.completedPoints), 0) / closed.length) : null;
};
