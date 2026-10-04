// Repeating tasks: the schedule, as pure functions with no imports, so the browser (the task
// form's preview) and the scheduled job that creates the next occurrence
// (scripts/roll-recurring-tasks.cjs) use exactly the same arithmetic.
//
// A repeating task carries
//   repeat: { every, unit: 'day'|'week'|'month', anchorStart, anchorDeadline }
//   occurrence: 0, 1, 2 ...
// Occurrence n is due on anchorDeadline + n intervals. Counting from the anchor (rather than
// from the previous occurrence) stops monthly dates drifting: 31 Jan -> 28 Feb -> 31 Mar,
// not 31 Jan -> 28 Feb -> 28 Mar.
//
// Days are "YYYY-MM-DD" strings in the storage convention (task dates are midnight UTC of
// the chosen day), so all arithmetic is done in UTC.

export const REPEAT_OPTIONS = [
  { value: 'none', label: "Doesn't repeat" },
  { value: 'daily', label: 'Every day', every: 1, unit: 'day' },
  { value: 'weekly', label: 'Every week', every: 1, unit: 'week' },
  { value: 'fortnightly', label: 'Every 2 weeks', every: 2, unit: 'week' },
  { value: 'monthly', label: 'Every month', every: 1, unit: 'month' },
  { value: 'quarterly', label: 'Every 3 months', every: 3, unit: 'month' },
];

/** The form's choice for a stored repeat (unknown schedules show as "Doesn't repeat"). */
export const optionFromRepeat = (repeat) => {
  if (!repeat) return 'none';
  const hit = REPEAT_OPTIONS.find((o) => o.every === repeat.every && o.unit === repeat.unit);
  return hit ? hit.value : 'none';
};

/**
 * A repeat to store for a form choice and the task's dates, or null for "Doesn't repeat".
 * @param {string} option one of REPEAT_OPTIONS' values
 * @param {{ startDate?: string, deadline?: string }} dates "YYYY-MM-DD"
 */
export const repeatFromOption = (option, { startDate = '', deadline = '' } = {}) => {
  const o = REPEAT_OPTIONS.find((x) => x.value === option);
  if (!o || !o.unit) return null;
  return { every: o.every, unit: o.unit, anchorStart: startDate || '', anchorDeadline: deadline || '' };
};

/** "every week", "every 2 weeks", "every month" ... */
export const describeRepeat = (repeat) => {
  if (!repeat || !repeat.unit) return '';
  const every = Number(repeat.every) || 1;
  return every === 1 ? `every ${repeat.unit}` : `every ${every} ${repeat.unit}s`;
};

const DAY = 86400000;
const parse = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
};
const fmt = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * `iso` moved by `times` intervals. Months keep the day of the month where it exists and
 * otherwise use the month's last day (31 Jan + 1 month = 28 Feb).
 */
export const addInterval = (iso, repeat, times = 1) => {
  const p = parse(iso);
  if (!p || !repeat) return '';
  const n = (Number(repeat.every) || 1) * times;
  if (repeat.unit === 'month') {
    const lastDay = new Date(Date.UTC(p.y, p.m + n + 1, 0)).getUTCDate();
    return fmt(Date.UTC(p.y, p.m + n, Math.min(p.d, lastDay)));
  }
  const days = repeat.unit === 'week' ? n * 7 : n;
  return fmt(Date.UTC(p.y, p.m, p.d) + days * DAY);
};

/**
 * The next occurrence after `occurrence`, skipping any whose deadline has already passed by
 * `today` (a weekly task finished three weeks late comes back due next week, not three times
 * overdue).
 *
 * @param {{ every: number, unit: string, anchorStart?: string, anchorDeadline: string }} repeat
 * @param {number} occurrence the one just finished (0 for the first)
 * @param {string} today "YYYY-MM-DD"
 * @returns {{ occurrence: number, startDate: string, deadline: string } | null}
 */
export const nextOccurrence = (repeat, occurrence, today) => {
  if (!repeat || !parse(repeat.anchorDeadline) || !parse(today)) return null;
  let n = (Number(occurrence) || 0) + 1;
  // bounded: at most ~10 years of daily occurrences are skipped
  for (let guard = 0; guard < 4000; guard += 1, n += 1) {
    const deadline = addInterval(repeat.anchorDeadline, repeat, n);
    if (deadline >= today) {
      return {
        occurrence: n,
        startDate: repeat.anchorStart ? addInterval(repeat.anchorStart, repeat, n) : '',
        deadline,
      };
    }
  }
  return null;
};
