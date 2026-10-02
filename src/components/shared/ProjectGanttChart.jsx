// ProjectGanttChart - renders a project's tasks as a Gantt timeline.
// Critical path tasks (zero total float via CPM) are highlighted in amber.
//
// Dependencies are drawn as orthogonal finish-to-start connectors with rounded corners and an
// arrowhead that touches the successor's left edge. Where the line goes is worked out by
// lib/ganttLayout (pure and tested); this file only measures the grid and draws the result.
// A bar covers its whole last day (a one-day task is one day wide), so a line leaves the
// predecessor exactly where its work ends and enters the successor exactly where it begins.

import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { computeCriticalPath } from '@/lib/criticalPath';
import { isResolved } from '@/lib/dependencies';
import { formatDayMonth, toDate } from '@/lib/format';
import {
  addDays, startOfDay, axisTicks, routeDependency, roundedPath, dependencyKind,
} from '@/lib/ganttLayout';

const ROW_H = 48; // px - keep in sync with h-12 (Tailwind)
const MIN_BAR_PCT = 0.8;
const CORNER_RADIUS = 5;

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

const ProjectGanttChart = ({ tasks = [], getStaffName }) => {
  // The grid area is the flex-1 column that contains the Gantt bars.
  // We measure it so dependency lines have correct pixel coordinates.
  const gridAreaRef = useRef(null);
  const gridWidth   = useElementWidth(gridAreaRef);
  const uid         = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [activeId, setActiveId] = useState(null);

  const criticalSet = useMemo(() => computeCriticalPath(tasks), [tasks]);

  const model = useMemo(() => {
    const today = startOfDay(new Date());

    const rows = tasks
      .map((t) => {
        const start = toDate(t.startDate) || toDate(t.createdAt);
        const end   = toDate(t.deadline)  || start;
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

    return { rows, pct, ticks, todayPct, rowIndex };
  }, [tasks, getStaffName, criticalSet]);

  const edges = useMemo(() => {
    if (!model || gridWidth <= 0) return [];
    const { rows, pct, rowIndex } = model;
    const geo = (r) => geometryOf(pct, r, gridWidth);
    const out = [];
    rows.forEach((succ, succIdx) => {
      const seen = new Set();
      succ.blockedBy.forEach((predId) => {
        if (predId === succ.id || seen.has(predId)) return;
        seen.add(predId);
        const predIdx = rowIndex[predId];
        if (predIdx === undefined) return; // the prerequisite has no dates, so it has no bar
        const pred = rows[predIdx];

        const kind = dependencyKind(
          { start: pred.start, end: pred.end, resolved: isResolved(pred.rawStatus), critical: pred.isCritical },
          { start: succ.start, critical: succ.isCritical },
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
  }, [model, gridWidth]);

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

  // What each task is still waiting for, for people who cannot see the lines.
  const waitingOn = (r) => r.blockedBy
    .map((id) => rows[rowIndex[id]])
    .filter((p) => p && p.id !== r.id && !isResolved(p.rawStatus))
    .map((p) => p.title);

  return (
    <div className="w-full">
      {/* On a phone the chart is wider than the screen; say so, or the half that is off-screen reads as "no more tasks". */}
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">Swipe sideways to see the whole timeline.</p>
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

            {/* Task bars */}
            {rows.map((r) => {
              const { leftPct, widthPct } = geometryOf(pct, r, gridWidth);
              const style = STATUS_STYLES[r.statusKey] || STATUS_STYLES.pending;
              const waiting = waitingOn(r);
              return (
                <div
                  key={r.id}
                  style={{ height: ROW_H }}
                  className="relative border-b border-border"
                  onMouseEnter={() => setActiveId(r.id)}
                  onMouseLeave={() => setActiveId(null)}
                >
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded flex items-center px-1.5 shadow ${style.bar} ${r.isCritical ? CRITICAL_EXTRA : ''}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`${fmt(r.start)} → ${fmt(r.end)} · ${style.label}${r.isCritical ? ' · Critical path' : ''}${waiting.length ? ` · Waits for ${waiting.join(', ')}` : ''}`}
                    role="img"
                    aria-label={`${r.title}: ${style.label}${r.isCritical ? ', critical path' : ''}, ${fmt(r.start)} to ${fmt(r.end)}${waiting.length ? `, waits for ${waiting.join(', ')}` : ''}`}
                  >
                    {r.isCompleted && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-foreground flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {r.isCritical && !r.isCompleted && (
                      <Zap
                        className="w-3 h-3 text-amber-400 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
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
