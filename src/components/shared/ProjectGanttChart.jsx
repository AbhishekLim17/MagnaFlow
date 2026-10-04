// ProjectGanttChart - renders a project's tasks as a Gantt timeline.
// Critical path tasks (zero total float via CPM) are highlighted in amber.
//
// Dependencies are drawn as orthogonal finish-to-start connectors with rounded corners and an
// arrowhead that touches the successor's left edge. Where the line goes is worked out by
// lib/ganttLayout (pure and tested); this file only measures the grid and draws the result.
// A bar covers its whole last day (a one-day task is one day wide), so a line leaves the
// predecessor exactly where its work ends and enters the successor exactly where it begins.
//
// Milestones (key dates) are diamonds. People allowed to edit a task can drag its bar to move
// it, drag either end to change one date, or focus it and use the arrow keys; the change is
// handed to `onReschedule` and the bar stays where it was dropped until the new data arrives.

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { computeCriticalPath } from '@/lib/criticalPath';
import { isResolved } from '@/lib/dependencies';
import { formatDayMonth, toDate } from '@/lib/format';
import {
  addDays, startOfDay, axisTicks, routeDependency, roundedPath, dependencyKind, shiftRange,
} from '@/lib/ganttLayout';
import { dayKey } from '@/lib/calendarLayout';

const ROW_H = 48; // px - keep in sync with h-12 (Tailwind)
const MIN_BAR_PCT = 0.8;
const CORNER_RADIUS = 5;
const DIAMOND = 14;         // px, a milestone's width
const DRAG_THRESHOLD = 3;   // px of movement before a press counts as a drag
const KEY_COMMIT_MS = 900;  // arrow-key changes are saved after this pause

const STATUS_STYLES = {
  completed:     { bar: 'bg-success-accent',    label: 'Completed' },
  'in-progress': { bar: 'bg-primary',           label: 'In Progress' },
  pending:       { bar: 'bg-slate-500 dark:bg-slate-400',  label: 'Pending' },
  review:        { bar: 'bg-blue-400',           label: 'Review' },
  cancelled:     { bar: 'bg-slate-400 dark:bg-slate-500',  label: 'Cancelled' },
  overdue:       { bar: 'bg-destructive',       label: 'Overdue' },
};

const CRITICAL_EXTRA =
  'shadow-[0_0_14px_5px_rgba(251,191,36,0.55)] brightness-110';

// How each kind of dependency is drawn. Colours are design tokens (not raw palette values),
// so they follow the theme; the arrowhead takes the same colour as its line.
const EDGE_STYLES = {
  done:     { color: 'hsl(var(--muted-foreground))', width: 1.25, opacity: 0.4 },
  open:     { color: 'hsl(var(--muted-foreground))', width: 1.5,  opacity: 0.85 },
  critical: { color: 'hsl(var(--warning-accent))',   width: 2,    opacity: 1 },
  conflict: { color: 'hsl(var(--destructive))',      width: 1.75, opacity: 1, dash: '5 3' },
};
// Painted in this order, so the lines that matter end up on top.
const EDGE_ORDER = ['done', 'open', 'critical', 'conflict'];

const fmt = (d) => formatDayMonth(d);

// Where a bar starts and ends, as a percentage of the grid (for the bar itself) and in pixels
// (for the dependency lines). One source, so the two cannot drift apart.
const geometryOf = (pct, r, gridWidth) => {
  if (r.isMilestone) {
    // centred on its day
    const centre = (pct(r.start) + pct(addDays(r.start, 1))) / 2;
    const centrePx = (centre / 100) * gridWidth;
    return { centrePct: centre, leftPx: centrePx - DIAMOND / 2, rightPx: centrePx + DIAMOND / 2 };
  }
  const left = pct(r.start);
  const width = Math.max(pct(addDays(r.end, 1)) - left, MIN_BAR_PCT);
  return {
    leftPct: left,
    widthPct: width,
    leftPx: (left / 100) * gridWidth,
    rightPx: ((left + width) / 100) * gridWidth,
  };
};

// --- Hook: width of a DOM element, to the fraction of a pixel ---
function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const update = () => setWidth(ref.current ? ref.current.getBoundingClientRect().width : 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

const Arrowhead = ({ id, color }) => (
  <marker
    id={id}
    markerWidth="8" markerHeight="8"
    refX="7.5" refY="4"
    orient="auto"
    markerUnits="userSpaceOnUse"
  >
    <path d="M0.5,0.5 L7.5,4 L0.5,7.5 Z" style={{ fill: color }} />
  </marker>
);

/**
 * @param {Object[]} tasks
 * @param {(uid: string) => string} [getStaffName]
 * @param {(task: Object) => boolean} [canReschedule]  whether the viewer may change this task's dates
 * @param {(task: Object, dates: { startDate: string, deadline: string }) => Promise<unknown>} [onReschedule]
 *        called with "YYYY-MM-DD" days; a rejection puts the bar back
 */
const ProjectGanttChart = ({ tasks = [], getStaffName, canReschedule, onReschedule }) => {
  // The grid area is the flex-1 column that contains the Gantt bars.
  // We measure it so dependency lines have correct pixel coordinates.
  const gridAreaRef = useRef(null);
  const gridWidth   = useElementWidth(gridAreaRef);
  const uid         = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [activeId, setActiveId] = useState(null);
  // A bar being dragged: { id, mode: 'move'|'start'|'end', originX, days, moved }
  const [drag, setDrag] = useState(null);
  // Arrow-key changes not yet saved: { id, move, end } (days)
  const [keyed, setKeyed] = useState(null);
  // Where a bar was dropped, shown until the saved data comes back: { id, start, end }
  const [dropped, setDropped] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const editable = useCallback(
    (task) => Boolean(onReschedule && canReschedule && canReschedule(task)),
    [onReschedule, canReschedule],
  );

  const criticalSet = useMemo(() => computeCriticalPath(tasks), [tasks]);

  const model = useMemo(() => {
    const today = startOfDay(new Date());

    const rows = tasks
      .map((t) => {
        const isMilestone = Boolean(t.milestone);
        // A milestone is one day: its deadline (or whatever single date it has).
        const start = isMilestone
          ? toDate(t.deadline) || toDate(t.startDate) || toDate(t.createdAt)
          : toDate(t.startDate) || toDate(t.createdAt);
        const end   = isMilestone ? start : toDate(t.deadline) || start;
        if (!start && !end) return null;
        const s = startOfDay(start || end);
        let   e = startOfDay(end   || start);
        if (e < s) e = s;
        const isCompleted = t.status === 'completed';
        const isOverdue   =
          !isCompleted &&
          t.status !== 'cancelled' &&
          e.getTime() < today.getTime();
        return {
          id:         t.id,
          title:      t.title || 'Untitled task',
          assignee:   getStaffName ? getStaffName(t.assignedTo) : null,
          start:      s,
          end:        e,
          statusKey:  isOverdue ? 'overdue' : (t.status || 'pending'),
          rawStatus:  t.status || 'pending',
          isCompleted,
          isCritical: criticalSet.has(t.id),
          blockedBy:  Array.isArray(t.blockedBy) ? t.blockedBy : [],
          isMilestone,
          task:       t,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    if (rows.length === 0) return null;

    let first = rows[0].start;
    let last  = rows[0].end;
    for (const r of rows) {
      if (r.start < first) first = r.start;
      if (r.end   > last)  last  = r.end;
    }
    // A day of air before the first bar; the last bar covers its whole final day, plus a day of air.
    const min = addDays(first, -1);
    const max = addDays(last, 2);
    const span = Math.max(max.getTime() - min.getTime(), 1);

    // pct: date -> position 0-100 within the timeline
    const pct = (d) => ((d.getTime() - min.getTime()) / span) * 100;

    // Ticks sit on real day boundaries, so a label and its gridline never disagree.
    const ticks = axisTicks(min, max).map((date) => ({ left: pct(date), date }));

    const noon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    const todayPct = noon >= min && noon <= max ? pct(noon) : null;

    const rowIndex = {};
    rows.forEach((r, i) => { rowIndex[r.id] = i; });

    // One day as a share of the timeline, to turn a drag distance into days.
    const dayPct = (86400000 / span) * 100;

    return { rows, pct, ticks, todayPct, rowIndex, dayPct };
  }, [tasks, getStaffName, criticalSet]);

  // New data replaces a dropped position.
  useEffect(() => { setDropped(null); }, [tasks]);

  // The dates a row shows right now: while dragged, while being moved with the keyboard,
  // or just dropped and waiting for the save.
  const rangeOf = useCallback((r) => {
    if (drag && drag.id === r.id) return shiftRange(r, r.isMilestone ? 'move' : drag.mode, drag.days);
    if (keyed && keyed.id === r.id) return shiftRange(shiftRange(r, 'move', keyed.move), 'end', r.isMilestone ? 0 : keyed.end);
    if (dropped && dropped.id === r.id) return { start: dropped.start, end: dropped.end };
    return r;
  }, [drag, keyed, dropped]);
  const shown = useCallback((r) => ({ ...r, ...rangeOf(r) }), [rangeOf]);

  const edges = useMemo(() => {
    if (!model || gridWidth <= 0) return [];
    const { rows, pct, rowIndex } = model;
    const geo = (r) => geometryOf(pct, shown(r), gridWidth);
    const out = [];
    rows.forEach((succ, succIdx) => {
      const seen = new Set();
      succ.blockedBy.forEach((predId) => {
        if (predId === succ.id || seen.has(predId)) return;
        seen.add(predId);
        const predIdx = rowIndex[predId];
        if (predIdx === undefined) return; // the prerequisite has no dates, so it has no bar
        const pred = shown(rows[predIdx]);
        const succNow = shown(succ);

        const kind = dependencyKind(
          { start: pred.start, end: pred.end, resolved: isResolved(pred.rawStatus), critical: pred.isCritical },
          { start: succNow.start, critical: succ.isCritical },
        );
        const { points } = routeDependency({
          exitX: geo(pred).rightPx,
          exitY: predIdx * ROW_H + ROW_H / 2,
          // one pixel short, so the arrowhead touches the bar instead of overlapping its edge
          entryX: geo(succ).leftPx - 1,
          entryY: succIdx * ROW_H + ROW_H / 2,
        });
        out.push({ key: `${predId}->${succ.id}`, predId, succId: succ.id, kind, d: roundedPath(points, CORNER_RADIUS) });
      });
    });
    return out.sort((a, b) => EDGE_ORDER.indexOf(a.kind) - EDGE_ORDER.indexOf(b.kind));
  }, [model, gridWidth, shown]);

  // ---- rescheduling ----
  const commit = useCallback(async (r, next) => {
    const deadline = dayKey(next.end);
    const startDate = r.isMilestone ? deadline : dayKey(next.start);
    setDropped({ id: r.id, start: next.start, end: next.end });
    setAnnouncement(`${r.title}: ${formatDayMonth(next.start)}${r.isMilestone ? '' : ` to ${formatDayMonth(next.end)}`}. Saving.`);
    try {
      await onReschedule(r.task, { startDate, deadline });
    } catch {
      setDropped(null); // refused: put it back
    }
  }, [onReschedule]);

  const keyedRef = useRef(null);
  keyedRef.current = keyed;
  const commitKeyed = useCallback(() => {
    const k = keyedRef.current;
    if (!k || !model) return;
    setKeyed(null);
    const r = model.rows.find((x) => x.id === k.id);
    if (!r || (k.move === 0 && k.end === 0)) return;
    commit(r, shiftRange(shiftRange(r, 'move', k.move), 'end', r.isMilestone ? 0 : k.end));
  }, [commit, model]);
  useEffect(() => {
    if (!keyed) return undefined;
    const t = setTimeout(commitKeyed, KEY_COMMIT_MS);
    return () => clearTimeout(t);
  }, [keyed, commitKeyed]);

  const startDrag = (e, r, mode) => {
    if (!editable(r.task) || e.button !== 0 || e.pointerType === 'touch') return;
    e.preventDefault();
    e.stopPropagation();
    // Keep receiving moves if the pointer leaves the bar. Capture can fail for a pointer
    // the browser no longer tracks; dragging still works without it, just less forgivingly.
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* see above */ }
    setDrag({ id: r.id, mode, originX: e.clientX, days: 0, moved: false });
  };
  const moveDrag = (e) => {
    if (!drag || !model || gridWidth <= 0) return;
    const dx = e.clientX - drag.originX;
    const dayPx = (gridWidth * model.dayPct) / 100;
    const days = Math.round(dx / dayPx);
    const moved = drag.moved || Math.abs(dx) > DRAG_THRESHOLD;
    if (days !== drag.days || moved !== drag.moved) setDrag({ ...drag, days, moved });
  };
  const endDrag = (r) => {
    const d = drag;
    setDrag(null);
    if (d && d.id === r.id && d.moved && d.days !== 0) {
      commit(r, shiftRange(r, r.isMilestone ? 'move' : d.mode, d.days));
    }
  };
  const onBarKey = (e, r) => {
    if (!editable(r.task)) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.key === 'ArrowLeft' ? -1 : 1;
      const base = keyed && keyed.id === r.id ? keyed : { id: r.id, move: 0, end: 0 };
      const next = e.shiftKey && !r.isMilestone ? { ...base, end: base.end + step } : { ...base, move: base.move + step };
      setKeyed(next);
      const range = shiftRange(shiftRange(r, 'move', next.move), 'end', r.isMilestone ? 0 : next.end);
      setAnnouncement(`${formatDayMonth(range.start)}${r.isMilestone ? '' : ` to ${formatDayMonth(range.end)}`}`);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitKeyed();
    } else if (e.key === 'Escape' && keyed) {
      e.preventDefault();
      setKeyed(null);
      setAnnouncement('Change cancelled.');
    }
  };

  if (!model) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks with dates yet. Add tasks with a start date and deadline to
        see the timeline.
      </div>
    );
  }

  const { rows, pct, ticks, todayPct, rowIndex } = model;
  const svgH = rows.length * ROW_H;
  const hasConflict = edges.some((e) => e.kind === 'conflict');
  const hasMilestone = rows.some((r) => r.isMilestone);
  const anyEditable = rows.some((r) => editable(r.task));

  // What each task is still waiting for, for people who cannot see the lines.
  const waitingOn = (r) => r.blockedBy
    .map((id) => rows[rowIndex[id]])
    .filter((p) => p && p.id !== r.id && !isResolved(p.rawStatus))
    .map((p) => p.title);

  return (
    <div className="w-full">
      {/* On a phone the chart is wider than the screen; say so, or the half that is off-screen reads as "no more tasks". */}
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">Swipe sideways to see the whole timeline.</p>
      {anyEditable && (
        <p id={`${uid}-help`} className="mb-2 hidden text-xs text-muted-foreground sm:block">
          Drag a bar to move it, or drag either end to change one date. With the keyboard: arrow keys
          move a task by a day, Shift and arrow keys change its deadline, Enter saves, Escape cancels.
        </p>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <div
        className="w-full overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="region"
        aria-label="Project timeline, scrolls sideways"
      >
      <div className="min-w-[560px]">

        {/* ── Timeline header ── */}
        <div className="flex">
          <div className="w-32 flex-shrink-0 sticky left-0 z-30 bg-card sm:w-56" />
          <div className="relative flex-1 h-6 border-b border-border overflow-hidden">
            {/* a label centred on a tick near either end would be cut off by the edge */}
            {ticks.filter((t) => t.left >= 4 && t.left <= 95).map((t) => (
              <div
                key={t.date.getTime()}
                className="absolute top-0 text-[10px] text-muted-foreground -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${t.left}%` }}
              >
                {fmt(t.date)}
              </div>
            ))}
          </div>
        </div>

        {/* ── Rows + SVG overlay ── */}
        <div className="flex">

          {/* Label column: 8rem on a phone, 14rem from sm up */}
          <div className="w-32 flex-shrink-0 sticky left-0 z-30 bg-card sm:w-56">
            {rows.map((r) => (
              <div
                key={r.id}
                style={{ height: ROW_H }}
                className="flex flex-col justify-center pr-3 border-b border-border"
                onMouseEnter={() => setActiveId(r.id)}
                onMouseLeave={() => setActiveId(null)}
              >
                <p
                  data-testid="gantt-task-title"
                  className={`text-xs leading-[1.15] line-clamp-2 sm:text-sm sm:leading-normal sm:truncate ${
                    r.isCritical
                      ? 'text-warning font-semibold'
                      : 'text-foreground'
                  }`}
                  title={r.title}
                >
                  {r.isCritical && (
                    <span className="mr-1" aria-hidden="true">⚡</span>
                  )}
                  {r.isMilestone && (
                    <span className="mr-1 text-primary" aria-hidden="true">◆</span>
                  )}
                  {r.title}
                </p>
                {r.assignee && (
                  <p className="text-[10px] leading-tight text-muted-foreground truncate sm:text-[11px]">
                    {r.assignee}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Grid column - flex-1, measured for the dependency lines */}
          <div className="relative flex-1" ref={gridAreaRef}>

            {/* Gridlines, one per tick, behind everything */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {ticks.map((t) => (
                <div
                  key={t.date.getTime()}
                  className="absolute top-0 bottom-0 w-px bg-border/60"
                  style={{ left: `${t.left}%` }}
                />
              ))}
            </div>

            {/* Today marker */}
            {todayPct != null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 border-l border-dashed border-destructive/60"
                style={{ left: `${todayPct}%` }}
                aria-hidden="true"
              />
            )}

            {/* Task bars (and milestone diamonds) */}
            {rows.map((r) => {
              const now = shown(r);
              const geo = geometryOf(pct, now, gridWidth);
              const style = STATUS_STYLES[r.statusKey] || STATUS_STYLES.pending;
              const waiting = waitingOn(r);
              const canEdit = editable(r.task);
              const dragging = drag && drag.id === r.id && drag.moved;
              const changed = (keyed && keyed.id === r.id) || dragging;
              const span = r.isMilestone ? fmt(now.start) : `${fmt(now.start)} → ${fmt(now.end)}`;
              const label = `${r.title}: ${r.isMilestone ? 'milestone, ' : ''}${style.label}${r.isCritical ? ', critical path' : ''}, ${r.isMilestone ? fmt(now.start) : `${fmt(now.start)} to ${fmt(now.end)}`}${waiting.length ? `, waits for ${waiting.join(', ')}` : ''}`;
              const shape = r.isMilestone
                ? 'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] shadow'
                : 'absolute top-1/2 -translate-y-1/2 h-5 rounded flex items-center px-1.5 shadow';
              const position = r.isMilestone
                ? { left: `${geo.centrePct}%` }
                : { left: `${geo.leftPct}%`, width: `${geo.widthPct}%` };
              return (
                <div
                  key={r.id}
                  style={{ height: ROW_H }}
                  className="relative border-b border-border"
                  onMouseEnter={() => setActiveId(r.id)}
                  onMouseLeave={() => setActiveId(null)}
                >
                  <div
                    className={[
                      shape,
                      style.bar,
                      r.isCritical ? CRITICAL_EXTRA : '',
                      canEdit ? 'cursor-grab select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : '',
                      dragging ? 'cursor-grabbing ring-2 ring-ring' : '',
                    ].join(' ')}
                    style={position}
                    title={`${span} · ${style.label}${r.isCritical ? ' · Critical path' : ''}${waiting.length ? ` · Waits for ${waiting.join(', ')}` : ''}${canEdit ? ' · Drag to reschedule' : ''}`}
                    {...(canEdit
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          'aria-roledescription': r.isMilestone ? 'milestone' : 'task bar',
                          'aria-label': label,
                          'aria-describedby': `${uid}-help`,
                          onPointerDown: (e) => startDrag(e, r, 'move'),
                          onPointerMove: moveDrag,
                          onPointerUp: () => endDrag(r),
                          onPointerCancel: () => setDrag(null),
                          onKeyDown: (e) => onBarKey(e, r),
                          onBlur: commitKeyed,
                        }
                      : { role: 'img', 'aria-label': label })}
                  >
                    {!r.isMilestone && r.isCompleted && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-foreground flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {!r.isMilestone && r.isCritical && !r.isCompleted && (
                      <Zap
                        className="w-3 h-3 text-amber-400 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {/* resize handles: a sliver at each end of an editable bar */}
                    {canEdit && !r.isMilestone && (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l"
                          onPointerDown={(e) => startDrag(e, r, 'start')}
                        />
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r"
                          onPointerDown={(e) => startDrag(e, r, 'end')}
                        />
                      </>
                    )}
                  </div>
                  {changed && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-1 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background shadow"
                      style={{ left: `${r.isMilestone ? geo.centrePct : geo.leftPct + geo.widthPct / 2}%` }}
                    >
                      {span}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Dependency lines, over the grid only. All coordinates are CSS pixels within the
                grid element (measured), so they meet the bars exactly. A card-coloured halo
                under each line keeps it legible where it crosses a bar. */}
            {gridWidth > 0 && edges.length > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none z-20"
                width={gridWidth}
                height={svgH}
                viewBox={`0 0 ${gridWidth} ${svgH}`}
                style={{ overflow: 'visible' }}
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  {EDGE_ORDER.map((kind) => (
                    <Arrowhead key={kind} id={`${uid}-arrow-${kind}`} color={EDGE_STYLES[kind].color} />
                  ))}
                </defs>

                {edges.map((e) => {
                  const base = EDGE_STYLES[e.kind];
                  const related = activeId && (e.predId === activeId || e.succId === activeId);
                  const dimmed = activeId && !related;
                  const width = base.width + (related ? 0.75 : 0);
                  const opacity = related ? 1 : dimmed ? base.opacity * 0.25 : base.opacity;
                  return (
                    <g
                      key={e.key}
                      data-testid="gantt-dependency"
                      data-kind={e.kind}
                      data-from={e.predId}
                      data-to={e.succId}
                      style={{ opacity, transition: 'opacity 120ms ease' }}
                    >
                      <path
                        d={e.d}
                        fill="none"
                        strokeWidth={width + 3}
                        strokeLinejoin="round"
                        style={{ stroke: 'hsl(var(--card))', opacity: 0.9 }}
                      />
                      <path
                        d={e.d}
                        fill="none"
                        strokeWidth={width}
                        strokeLinejoin="round"
                        strokeDasharray={base.dash}
                        markerEnd={`url(#${uid}-arrow-${e.kind})`}
                        style={{ stroke: base.color }}
                      />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </div>
      </div>

        {/* ── Legend (outside the scroller so it is never half off-screen) ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-muted-foreground">
          {['completed', 'in-progress', 'pending', 'overdue'].map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className={`inline-block w-3 h-3 rounded ${STATUS_STYLES[k].bar}`}
              />
              {STATUS_STYLES[k].label}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-amber-400 ring-2 ring-amber-400" />
            Critical path
          </div>
          {hasMilestone && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-slate-500 dark:bg-slate-400" />
              Milestone
            </div>
          )}
          <LegendLine label="Dependency" kind="open" />
          {hasConflict && <LegendLine label="Starts before its prerequisite ends" kind="conflict" />}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 border-l border-dashed border-destructive/60" /> Today
          </div>
        </div>

    </div>
  );
};

// A sample of a dependency line for the legend, drawn the way the chart draws it.
const LegendLine = ({ label, kind }) => {
  const { color, width, opacity, dash } = EDGE_STYLES[kind];
  return (
    <div className="flex items-center gap-1.5">
      <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden="true" focusable="false">
        <path d="M0 5 H15" fill="none" strokeWidth={width} strokeDasharray={dash} style={{ stroke: color, opacity }} />
        <path d="M15.5 1.5 L23 5 L15.5 8.5 Z" style={{ fill: color, opacity }} />
      </svg>
      {label}
    </div>
  );
};

export default ProjectGanttChart;
