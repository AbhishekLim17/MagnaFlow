// Task templates: a reusable plan of tasks (titles, priorities, how long each takes, when it
// starts relative to the others, what it waits on, its checklist), saved from an existing
// project and laid out again from any start date.
//
// Dates are kept as whole-day offsets from the template's first day, so "kick-off on day 0,
// design days 2-6, review on day 7" lands on the right days whatever the new start date is.
// Pure functions: no Firestore here.
import { toDate } from './format';

export const MAX_TEMPLATE_TASKS = 300;
const DAY_MS = 86400000;

// Task dates are stored as midnight UTC of the chosen day (see CLAUDE.md), so the UTC date is
// the day; count whole days on that basis.
const dayNumber = (value) => {
  const d = toDate(value);
  return d ? Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS) : null;
};
const isoDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const parseIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS) : null;
};

/**
 * Turn a project's tasks into template items.
 *
 * @param {Object[]} tasks
 * @param {Object<string, string[]>} [checklists] subtask titles by task id
 * @returns {Object[]} items: { key, title, description, priority, milestone, startOffset, duration, dependsOn, subtasks }
 *   startOffset/duration are whole days (null when the task had no dates); dependsOn lists keys
 *   of other items (dependencies on tasks outside the set are dropped).
 */
export const tasksToTemplateItems = (tasks, checklists = {}) => {
  const list = (tasks || []).filter((t) => t && t.status !== 'cancelled');
  const keyOf = new Map(list.map((t, i) => [t.id, `t${i + 1}`]));
  const starts = list.map((t) => dayNumber(t.startDate) ?? dayNumber(t.deadline)).filter((n) => n !== null);
  const origin = starts.length ? Math.min(...starts) : null;

  return list.map((t) => {
    const end = dayNumber(t.deadline);
    const start = dayNumber(t.startDate) ?? end;
    return {
      key: keyOf.get(t.id),
      title: t.title || 'Untitled task',
      description: t.description || '',
      priority: t.priority || 'medium',
      milestone: Boolean(t.milestone),
      startOffset: start === null || origin === null ? null : start - origin,
      duration: start === null || end === null ? null : Math.max(0, end - start),
      dependsOn: (Array.isArray(t.blockedBy) ? t.blockedBy : []).map((id) => keyOf.get(id)).filter(Boolean),
      subtasks: (checklists[t.id] || []).map((s) => String(s).trim()).filter(Boolean),
    };
  });
};

/** Items ordered so that every item comes after the items it depends on (stable otherwise). */
export const dependencyOrder = (items) => {
  const byKey = new Map(items.map((it) => [it.key, it]));
  const done = new Set();
  const visiting = new Set();
  const out = [];
  const visit = (it) => {
    if (done.has(it.key) || visiting.has(it.key)) return; // a loop is broken rather than followed
    visiting.add(it.key);
    for (const k of it.dependsOn || []) if (byKey.has(k)) visit(byKey.get(k));
    visiting.delete(it.key);
    done.add(it.key);
    out.push(it);
  };
  items.forEach(visit);
  return out;
};

/**
 * Lay a template out from a start date.
 *
 * @param {{ items: Object[] }} template
 * @param {Object} options
 * @param {string} options.startDate "YYYY-MM-DD", the template's day 0
 * @param {string} [options.projectId]
 * @param {string} [options.departmentId]
 * @param {string} [options.assignedTo] given to every task (empty: unassigned)
 * @returns {{ key: string, dependsOn: string[], subtasks: string[], task: Object }[]} in creation order
 */
export const planFromTemplate = (template, { startDate, projectId, departmentId, assignedTo = '' } = {}) => {
  const day0 = parseIso(startDate);
  return dependencyOrder(template?.items || []).map((it) => {
    const hasDates = day0 !== null && it.startOffset !== null && it.startOffset !== undefined;
    const start = hasDates ? day0 + it.startOffset : null;
    const end = hasDates ? start + (it.duration || 0) : null;
    return {
      key: it.key,
      dependsOn: it.dependsOn || [],
      subtasks: it.subtasks || [],
      task: {
        title: it.title,
        description: it.description || '',
        priority: it.priority || 'medium',
        status: 'pending',
        assignedTo,
        milestone: Boolean(it.milestone),
        startDate: start === null ? '' : isoDay(it.milestone ? end : start),
        deadline: end === null ? '' : isoDay(end),
        ...(projectId && { projectId }),
        ...(departmentId && { departmentId }),
      },
    };
  });
};

/** "12 tasks over 20 days, 5 dependencies, 18 checklist items" - for the template list. */
export const describeTemplate = (template) => {
  const items = template?.items || [];
  const spans = items.filter((i) => i.startOffset !== null && i.startOffset !== undefined)
    .map((i) => i.startOffset + (i.duration || 0) + 1);
  const days = spans.length ? Math.max(...spans) : 0;
  const deps = items.reduce((n, i) => n + (i.dependsOn?.length || 0), 0);
  const checks = items.reduce((n, i) => n + (i.subtasks?.length || 0), 0);
  const parts = [`${items.length} task${items.length === 1 ? '' : 's'}`];
  if (days) parts[0] += ` over ${days} day${days === 1 ? '' : 's'}`;
  if (deps) parts.push(`${deps} dependenc${deps === 1 ? 'y' : 'ies'}`);
  if (checks) parts.push(`${checks} checklist item${checks === 1 ? '' : 's'}`);
  return parts.join(', ');
};
