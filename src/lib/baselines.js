// Baselines: a saved copy of a project's plan (each task's start and end), so the Gantt can
// show how far the work has drifted from it. Pure. Stored at
// organizations/{org}/projects/{project}/baselines/{id} (services/baselineService).

import { toDate } from './format';
import { DAY_MS } from './ganttLayout';

export const MAX_BASELINE_TASKS = 500;

// The stored day of a task date ("YYYY-MM-DD"; task dates are kept as midnight UTC).
const storedDay = (value) => {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : null;
};

/** { taskId: { s, e } } for every task with a date, as the plan stands now. */
export const snapshotOf = (tasks) => {
  const out = {};
  for (const t of (tasks || []).slice(0, MAX_BASELINE_TASKS)) {
    const s = storedDay(t.startDate) || storedDay(t.deadline);
    const e = storedDay(t.deadline) || s;
    if (s) out[t.id] = { s, e };
  }
  return out;
};

/**
 * How many days later (positive) or earlier (negative) a task now ends than in the baseline;
 * null when the task was not in it.
 */
export const endVariance = (task, entry) => {
  if (!entry) return null;
  const now = storedDay(task?.deadline) || storedDay(task?.startDate);
  if (!now) return null;
  return Math.round((Date.parse(now) - Date.parse(entry.e)) / DAY_MS);
};

/** "3 days later than the baseline", "on the baseline", "1 day earlier than the baseline" */
export const describeVariance = (days) => {
  if (days == null) return 'not in the baseline';
  if (days === 0) return 'on the baseline';
  const n = Math.abs(days);
  return `${n} day${n === 1 ? '' : 's'} ${days > 0 ? 'later' : 'earlier'} than the baseline`;
};
