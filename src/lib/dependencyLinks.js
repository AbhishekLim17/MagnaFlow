// How a task depends on each of its prerequisites. `blockedBy` (the ids) stays the source of
// truth for which tasks are linked; `dependencyLinks` adds, per prerequisite, the kind of link
// and a lag in days. A prerequisite with no entry is the classic finish-to-start, no lag, so
// every task saved before this existed keeps meaning exactly what it meant.
//
//   FS  finish to start   the task starts after the prerequisite finishes (+ lag)
//   SS  start to start    the task starts once the prerequisite has started (+ lag)
//   FF  finish to finish  the task finishes once the prerequisite has finished (+ lag)
//
// Dates here are local day starts and `end` is the last day of work (inclusive), as on the
// Gantt chart. Pure.

import { addDays, DAY_MS } from './ganttLayout';

export const LINK_TYPES = [
  { value: 'FS', label: 'Finish to start', short: 'starts after it finishes' },
  { value: 'SS', label: 'Start to start', short: 'starts once it has started' },
  { value: 'FF', label: 'Finish to finish', short: 'finishes once it has finished' },
];
const TYPES = new Set(LINK_TYPES.map((t) => t.value));
export const MAX_LAG = 365;
export const DEFAULT_LINK = Object.freeze({ type: 'FS', lag: 0 });

const clampLag = (v) => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(-MAX_LAG, Math.min(MAX_LAG, n));
};

/** A link with a known type and a whole-day lag. */
export const normalizeLink = (link) => ({ type: TYPES.has(link?.type) ? link.type : 'FS', lag: clampLag(link?.lag) });

/** How `task` depends on the prerequisite `predId`. */
export const linkOf = (task, predId) => normalizeLink(task?.dependencyLinks?.[predId]);

export const isDefaultLink = (link) => {
  const l = normalizeLink(link);
  return l.type === 'FS' && l.lag === 0;
};

/** What to store: only the prerequisites still listed, and only links that are not the default. */
export const cleanLinks = (blockedBy, links) => {
  const out = {};
  for (const id of blockedBy || []) {
    const l = normalizeLink(links?.[id]);
    if (!isDefaultLink(l)) out[id] = l;
  }
  return out;
};

const days = (n) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;

/** "Finish to start", "Start to start + 2 days", "Finish to finish − 1 day" */
export const describeLink = (link) => {
  const l = normalizeLink(link);
  const label = LINK_TYPES.find((t) => t.value === l.type).label;
  if (!l.lag) return label;
  return `${label} ${l.lag > 0 ? '+' : '−'} ${days(l.lag)}`;
};

const durationDays = (range) => Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS);

/**
 * The earliest day a successor of this length may start, given its prerequisite's dates.
 * @param {{type, lag}} link
 * @param {{start: Date, end: Date}} pred
 * @param {number} succDuration whole days between the successor's start and end
 */
export const earliestStart = (link, pred, succDuration = 0) => {
  const { type, lag } = normalizeLink(link);
  if (type === 'SS') return addDays(pred.start, lag);
  if (type === 'FF') return addDays(pred.end, lag - succDuration);
  return addDays(pred.end, 1 + lag);
};

/** Is the successor scheduled earlier than the link allows? */
export const violates = (link, pred, succ) =>
  succ.start.getTime() < earliestStart(link, pred, durationDays(succ)).getTime();

const RESOLVED = new Set(['completed', 'cancelled']);
const STARTED = new Set(['in-progress', 'review', 'completed']);

/**
 * Does a prerequisite in `predStatus` stop the task from moving to `nextStatus`?
 *  FS: not started until the prerequisite is finished
 *  SS: not started until the prerequisite has started
 *  FF: not completed until the prerequisite is finished
 */
export const blocksStatus = (link, predStatus, nextStatus) => {
  if (RESOLVED.has(predStatus)) return false;
  const { type } = normalizeLink(link);
  if (type === 'SS') return STARTED.has(nextStatus) && !STARTED.has(predStatus);
  if (type === 'FF') return nextStatus === 'completed';
  return STARTED.has(nextStatus);
};

/** What the person has to do about a blocking prerequisite, in words. */
export const blockerAdvice = (link) => {
  const { type } = normalizeLink(link);
  if (type === 'SS') return 'Start it first.';
  if (type === 'FF') return 'It has to finish before this one can.';
  return 'Finish it first.';
};

/**
 * Push the tasks that depend on a moved task (and theirs, and so on) just far enough
 * later that every link holds again, keeping each task's length. Tasks are only ever moved
 * later, finished or cancelled ones are left alone, and so are those `canMove` refuses
 * (their links then show as conflicts, as before).
 *
 * @param {Array<{id, start: Date, end: Date, blockedBy?: string[], dependencyLinks?: Object, status?: string}>} rows
 * @param {string} movedId
 * @param {{start: Date, end: Date}} next the moved task's new dates
 * @param {{ canMove?: (row) => boolean }} [options]
 * @returns {Array<{ id: string, start: Date, end: Date }>} the other tasks to move, in order
 */
export const cascadeSchedule = (rows, movedId, next, { canMove = () => true } = {}) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const placed = new Map([[movedId, next]]);
  const successors = new Map();
  for (const r of rows) {
    for (const p of r.blockedBy || []) {
      if (!successors.has(p)) successors.set(p, []);
      successors.get(p).push(r);
    }
  }
  const at = (id) => placed.get(id) || byId.get(id);
  const moves = [];
  const queue = [movedId];
  let guard = rows.length * 4 + 10; // a cycle must never spin forever
  while (queue.length && guard-- > 0) {
    const predId = queue.shift();
    for (const succ of successors.get(predId) || []) {
      if (succ.id === movedId || RESOLVED.has(succ.status) || !canMove(succ)) continue;
      const current = at(succ.id);
      const length = durationDays(current);
      let earliest = current.start;
      for (const p of succ.blockedBy || []) {
        const pred = at(p);
        if (!pred) continue;
        const e = earliestStart(linkOf(succ, p), pred, length);
        if (e > earliest) earliest = e;
      }
      if (earliest.getTime() > current.start.getTime()) {
        const moved = { start: earliest, end: addDays(earliest, length) };
        placed.set(succ.id, moved);
        const i = moves.findIndex((m) => m.id === succ.id);
        if (i >= 0) moves.splice(i, 1);
        moves.push({ id: succ.id, ...moved });
        queue.push(succ.id);
      }
    }
  }
  return moves;
};
