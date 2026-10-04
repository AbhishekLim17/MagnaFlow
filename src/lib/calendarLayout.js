// Month-calendar arithmetic for the task calendar, as pure functions.
import { toDate } from './format';

const pad = (n) => String(n).padStart(2, '0');

/** "2026-10-22" for the local calendar day of `date`. */
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** First day of the month containing `date` (local). */
export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/** The same day `n` months later, clamped to the first of that month. */
export const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1);

/**
 * The 6 x 7 days shown for a month, starting on Monday (the convention in India and most
 * of the world; pass 0 for Sunday). Always six weeks, so the grid never changes height
 * from one month to the next.
 *
 * @param {Date} month any day in the month
 * @param {0|1} [weekStartsOn]
 * @returns {Date[]} 42 local dates
 */
export const monthGrid = (month, weekStartsOn = 1) => {
  const first = startOfMonth(month);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + i));
};

/** Weekday names in grid order: ["Mon", ..., "Sun"]. */
export const weekdayNames = (weekStartsOn = 1, style = 'short') => {
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: style });
  // 2 Jan 2023 was a Monday
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + weekStartsOn + i)));
};

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const DONE = new Set(['completed', 'cancelled']);

/**
 * Tasks grouped by the local day of `field` (deadline by default), each day sorted with
 * open work first, then by priority, then by title. Tasks without that date are returned
 * separately, so the calendar can say how many it is not showing.
 *
 * @param {Object[]} tasks
 * @param {'deadline'|'startDate'} [field]
 * @returns {{ byDay: Map<string, Object[]>, undated: Object[] }}
 */
export const groupTasksByDay = (tasks, field = 'deadline') => {
  const byDay = new Map();
  const undated = [];
  for (const task of tasks || []) {
    const d = toDate(task[field]);
    if (!d) {
      undated.push(task);
      continue;
    }
    const key = dayKey(d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(task);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) =>
      (DONE.has(a.status) ? 1 : 0) - (DONE.has(b.status) ? 1 : 0)
      || (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
      || String(a.title || '').localeCompare(String(b.title || '')));
  }
  return { byDay, undated };
};
