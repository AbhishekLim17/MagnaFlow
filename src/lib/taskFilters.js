// Searching, filtering and sorting a task list, as pure functions.
//
// The list used to have a search box and two filters (status, priority) and no way to
// sort, so "what is due soonest?", "what is overdue?" and "what has Sana got?" could
// not be answered without reading every card.
import { toDate } from './format';
import { isOverdueTask } from './taskState';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'deadline', label: 'Deadline (soonest first)' },
  { value: 'priority', label: 'Priority (highest first)' },
  { value: 'title', label: 'Title (A to Z)' },
];

export const DEFAULT_FILTERS = {
  q: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
  project: 'all',
  sort: 'newest',
};

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const time = (v) => toDate(v)?.getTime() ?? null;

const compare = {
  newest: (a, b) => (time(b.createdAt) ?? 0) - (time(a.createdAt) ?? 0),
  // Undated work sinks to the bottom; it is never "soonest".
  deadline: (a, b) => (time(a.deadline) ?? Infinity) - (time(b.deadline) ?? Infinity),
  priority: (a, b) =>
    (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
    || (time(a.deadline) ?? Infinity) - (time(b.deadline) ?? Infinity),
  title: (a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }),
};

/**
 * @param {Object[]} tasks
 * @param {Partial<typeof DEFAULT_FILTERS>} filters
 *   status: a status, 'open' (not completed/cancelled), 'overdue', or 'all'
 *   assignee: 'all' | 'unassigned' | 'me' | a uid
 * @param {{ me?: string, getName?: (uid: string) => string }} [context]
 * @param {Date} [now]
 */
export const filterAndSortTasks = (tasks, filters = {}, context = {}, now = new Date()) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const q = String(f.q || '').trim().toLowerCase();

  const matches = (task) => {
    if (f.status === 'overdue') {
      if (!isOverdueTask(task, now)) return false;
    } else if (f.status === 'open') {
      if (task.status === 'completed' || task.status === 'cancelled') return false;
    } else if (f.status !== 'all' && task.status !== f.status) {
      return false;
    }

    if (f.priority !== 'all' && task.priority !== f.priority) return false;

    if (f.assignee === 'unassigned') {
      if (task.assignedTo) return false;
    } else if (f.assignee === 'me') {
      if (!context.me || task.assignedTo !== context.me) return false;
    } else if (f.assignee !== 'all' && task.assignedTo !== f.assignee) {
      return false;
    }

    if (f.project !== 'all' && (task.projectId || 'none') !== f.project) return false;

    if (q) {
      const assigneeName = task.assignedTo && context.getName ? context.getName(task.assignedTo) : '';
      const haystack = `${task.title || ''} ${task.description || ''} ${assigneeName || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const sorter = compare[f.sort] || compare.newest;
  // sort() is stable, so equal items keep their incoming (newest-first) order.
  return (tasks || []).filter(matches).sort(sorter);
};

/** How many filters are narrowing the list (the sort is not a filter). */
export const activeFilterCount = (filters = {}) => {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return ['q', 'status', 'priority', 'assignee', 'project'].filter((k) => f[k] !== DEFAULT_FILTERS[k] && f[k] !== '').length;
};

/** URL search params <-> filters, so a filtered list can be shared, bookmarked and survives Back. */
export const filtersFromParams = (params) => {
  const out = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    const v = params.get(key);
    if (v !== null && v !== '') out[key] = v;
  }
  if (!SORT_OPTIONS.some((s) => s.value === out.sort)) out.sort = DEFAULT_FILTERS.sort;
  return out;
};

/** Returns a copy of `params` with the filters written in (defaults are omitted to keep URLs short). */
export const writeFilters = (params, filters) => {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    const v = filters[key];
    if (v === undefined || v === '' || v === DEFAULT_FILTERS[key]) next.delete(key);
    else next.set(key, v);
  }
  return next;
};
