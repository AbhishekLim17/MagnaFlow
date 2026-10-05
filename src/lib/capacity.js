// Workload against capacity. Each open task with an estimate, an assignee and dates spreads its
// hours evenly over its working days (Monday to Friday; all days if it only spans a weekend);
// a person's load in a week is what lands in it. Capacity is hours per week: the person's own
// (users/{uid}.weeklyCapacityHours) or the default. Pure.

import { addDays, startOfDay, taskRange } from './ganttLayout';
import { formatDayMonth } from './format';

export const DEFAULT_CAPACITY = 40;
export const WEEKS_SHOWN = 6;

const DONE = new Set(['completed', 'cancelled']);

/** Monday of the week a day falls in. */
export const weekStart = (date) => {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() + 6) % 7));
};

export const capacityOf = (person) => {
  const n = Number(person?.weeklyCapacityHours);
  return Number.isFinite(n) && n >= 0 && person?.weeklyCapacityHours !== '' && person?.weeklyCapacityHours != null ? n : DEFAULT_CAPACITY;
};

/** The days a task's estimate is spread over: its weekdays, or all its days if it has none. */
const workDays = (range) => {
  const all = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) all.push(d);
  const weekdays = all.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  return weekdays.length ? weekdays : all;
};

/** Does this task count towards anyone's load? */
export const counts = (t) => !DONE.has(t.status) && Boolean(t.assignedTo) && Number(t.estimateHours) > 0 && Boolean(taskRange(t));

/**
 * Hours per person per week, for `weeks` weeks from the week of `today`.
 * @returns {{ weeks: Date[], load: Map<string, number[]> }}
 */
export const weeklyLoad = (tasks, { today = new Date(), weeks = WEEKS_SHOWN } = {}) => {
  const first = weekStart(today);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(first, i * 7));
  const end = addDays(first, weeks * 7);
  const load = new Map();
  for (const t of tasks || []) {
    if (!counts(t)) continue;
    const days = workDays(taskRange(t));
    const perDay = Number(t.estimateHours) / days.length;
    const row = load.get(t.assignedTo) || Array(weeks).fill(0);
    for (const d of days) {
      if (d < first || d >= end) continue;
      // whole days first: a day with a clock change is not 24 hours long
      row[Math.floor(Math.round((d - first) / (24 * 3600 * 1000)) / 7)] += perDay;
    }
    load.set(t.assignedTo, row);
  }
  for (const [uid, row] of load) load.set(uid, row.map((h) => Math.round(h * 10) / 10));
  return { weeks: starts, load };
};

/** Open tasks assigned to a person that have no estimate (their load is understated). */
export const unestimatedCount = (tasks, uid) => (tasks || [])
  .filter((t) => t.assignedTo === uid && !DONE.has(t.status) && !(Number(t.estimateHours) > 0)).length;

/** 'over' above capacity, 'near' above 85%, 'ok' otherwise. */
export const loadLevel = (hours, capacity) => {
  if (capacity <= 0) return hours > 0 ? 'over' : 'ok';
  if (hours > capacity) return 'over';
  if (hours > capacity * 0.85) return 'near';
  return 'ok';
};

/**
 * A warning for assigning `draft` to `person`: the first week it would push them over
 * capacity, or null. `tasks` are the other tasks (the draft itself is left out by id).
 */
export const assignmentWarning = (tasks, draft, person, { today = new Date() } = {}) => {
  if (!person || !counts({ ...draft, assignedTo: person.id, status: draft.status || 'pending' })) return null;
  const others = (tasks || []).filter((t) => t.id !== draft.id);
  const range = taskRange(draft);
  const from = weekStart(range.start < startOfDay(today) ? today : range.start);
  const weeks = Math.min(52, Math.ceil((addDays(range.end, 1) - from) / (7 * 24 * 3600 * 1000)) + 1);
  const { weeks: starts, load } = weeklyLoad([...others, { ...draft, assignedTo: person.id, status: draft.status || 'pending' }], { today: from, weeks });
  const row = load.get(person.id) || [];
  const capacity = capacityOf(person);
  const i = row.findIndex((h) => h > capacity);
  if (i < 0) return null;
  return `${person.name || 'They'} would have ${row[i]}h of work in the week of ${formatDayMonth(starts[i])}, over their ${capacity}h a week.`;
};
