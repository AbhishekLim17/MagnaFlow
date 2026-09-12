// ProjectGanttChart - renders a project tasks as a Gantt timeline.
// Critical path tasks (zero total float via CPM) are highlighted in amber.
// Dependency edges are drawn as SVG elbow-connector arrows with correct
// pixel positions measured via ResizeObserver on the actual grid element.

import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { computeCriticalPath } from '@/lib/criticalPath';

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_H  = 44; // px — keep in sync with h-11 (Tailwind)

const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const STATUS_STYLES = {
  completed:     { bar: 'bg-success-accent',    label: 'Completed' },
  'in-progress': { bar: 'bg-primary',           label: 'In Progress' },
  pending:       { bar: 'bg-muted-foreground',  label: 'Pending' },
  review:        { bar: 'bg-blue-400',           label: 'Review' },
  cancelled:     { bar: 'bg-muted',             label: 'Cancelled' },
  overdue:       { bar: 'bg-destructive',       label: 'Overdue' },
};

const CRITICAL_EXTRA =
  'ring-2 ring-amber-400 ring-offset-0 shadow-[0_0_8px_2px_rgba(251,191,36,0.45)]';

const fmt = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// --- Hook: observe width of a DOM element ---
function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const update = () => setWidth(ref.current ? ref.current.offsetWidth : 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

const ProjectGanttChart = ({ tasks = [], getStaffName }) => {
  // The grid area is the flex-1 column that contains the Gantt bars.
  // We measure it so dependency arrows have correct pixel coordinates.
  const gridAreaRef = useRef(null);
  const gridWidth   = useElementWidth(gridAreaRef);

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
          isCompleted,
          isCritical: criticalSet.has(t.id),
          blockedBy:  Array.isArray(t.blockedBy) ? t.blockedBy : [],
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    if (rows.length === 0) return null;

    let min = rows[0].start;
    let max = rows[0].end;
    for (const r of rows) {
      if (r.start < min) min = r.start;
      if (r.end   > max) max = r.end;
    }
    min = new Date(min.getTime() - DAY_MS);
    max = new Date(max.getTime() + DAY_MS);
    const span = Math.max(max.getTime() - min.getTime(), DAY_MS);

    // pct: date -> fraction 0-100 within the timeline
    const pct = (d) => ((d.getTime() - min.getTime()) / span) * 100;

    const ticks = [];
    const N = 6;
    for (let i = 0; i <= N; i++) {
      const t = new Date(min.getTime() + (span * i) / N);
      ticks.push({ left: (i / N) * 100, date: startOfDay(t) });
    }

    const today2 = startOfDay(new Date());
    const todayPct =
      today2 >= min && today2 <= max ? pct(today2) : null;

    // Map row id -> index for arrow rendering
    const rowIndex = {};
    rows.forEach((r, i) => { rowIndex[r.id] = i; });

    return { rows, pct, ticks, todayPct, rowIndex };
  }, [tasks, getStaffName, criticalSet]);

  if (!model) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks with dates yet. Add tasks with a start date and deadline to
        see the timeline.
      </div>
    );
  }

  const { rows, pct, ticks, todayPct, rowIndex } = model;

  // bar geometry: left and right as pixel offsets within gridArea
  const barPx = (r) => {
    const l = pct(r.start);
    const w = Math.max(pct(r.end) - l, 1.5);
    const leftPx  = (l / 100) * gridWidth;
    const rightPx = ((l + w) / 100) * gridWidth;
    return { leftPx, rightPx, leftPct: l, widthPct: w };
  };

  const svgH = rows.length * ROW_H;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[640px]">

        {/* ── Timeline header ── */}
        <div className="flex">
          <div className="w-56 flex-shrink-0" />
          <div className="relative flex-1 h-6 border-b border-border">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute top-0 text-[10px] text-muted-foreground -translate-x-1/2"
                style={{ left: `${t.left}%` }}
              >
                {fmt(t.date)}
              </div>
            ))}
          </div>
        </div>

        {/* ── Rows + SVG overlay ── */}
        <div className="flex">

          {/* Label column — fixed 14rem (w-56) */}
          <div className="w-56 flex-shrink-0">
            {rows.map((r) => (
              <div
                key={r.id}
                style={{ height: ROW_H }}
                className="flex flex-col justify-center pr-3 border-b border-border"
              >
                <p
                  data-testid="gantt-task-title"
                  className={`text-sm truncate ${
                    r.isCritical
                      ? 'text-amber-400 font-semibold'
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
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.assignee}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Grid column — flex-1, measured for arrow pixel math */}
          <div className="relative flex-1" ref={gridAreaRef}>

            {/* Today marker */}
            {todayPct != null && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: `${todayPct}%` }}
              >
                <div className="w-px h-full bg-warning-soft" />
              </div>
            )}

            {/* Task bars */}
            {rows.map((r) => {
              const { leftPct, widthPct } = barPx(r);
              const style = STATUS_STYLES[r.statusKey] || STATUS_STYLES.pending;
              return (
                <div
                  key={r.id}
                  style={{ height: ROW_H }}
                  className="relative border-b border-border"
                >
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded flex items-center px-1.5 shadow ${style.bar} ${r.isCritical ? CRITICAL_EXTRA : ''}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`${fmt(r.start)} → ${fmt(r.end)} · ${style.label}${r.isCritical ? ' · Critical path' : ''}`}
                    role="img"
                    aria-label={`${r.title}: ${style.label}${r.isCritical ? ', critical path' : ''}, ${fmt(r.start)} to ${fmt(r.end)}`}
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

            {/* SVG dependency arrows — positioned over the grid area only.
                All x coords are real CSS pixels within the grid element,
                measured via ResizeObserver so the math is always accurate. */}
            {gridWidth > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none z-20"
                width={gridWidth}
                height={svgH}
                viewBox={`0 0 ${gridWidth} ${svgH}`}
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <marker
                    id="dep-arrow-normal"
                    markerWidth="7" markerHeight="7"
                    refX="6" refY="3.5"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L0,7 L7,3.5 z"
                      fill="currentColor"
                      className="text-muted-foreground"
                      fillOpacity="0.55"
                    />
                  </marker>
                  <marker
                    id="dep-arrow-critical"
                    markerWidth="7" markerHeight="7"
                    refX="6" refY="3.5"
                    orient="auto"
                  >
                    <path d="M0,0 L0,7 L7,3.5 z" fill="rgb(251,191,36)" />
                  </marker>
                </defs>

                {rows.map((succRow) =>
                  succRow.blockedBy.map((predId) => {
                    const predIdx = rowIndex[predId];
                    if (predIdx === undefined) return null;

                    const predRow = rows[predIdx];
                    const succIdx = rowIndex[succRow.id];

                    const predGeo = barPx(predRow);
                    const succGeo = barPx(succRow);

                    // Arrow: right edge of predecessor → left edge of successor
                    const x1 = predGeo.rightPx;
                    const y1 = predIdx * ROW_H + ROW_H / 2;
                    const x2 = succGeo.leftPx;
                    const y2 = succIdx * ROW_H + ROW_H / 2;

                    const isCriticalEdge =
                      predRow.isCritical && succRow.isCritical;
                    const stroke = isCriticalEdge
                      ? 'rgb(251,191,36)'
                      : 'var(--muted-foreground, #888)';
                    const strokeOpacity = isCriticalEdge ? 0.95 : 0.5;
                    const markerEnd = isCriticalEdge
                      ? 'url(#dep-arrow-critical)'
                      : 'url(#dep-arrow-normal)';
                    const strokeW = isCriticalEdge ? 2 : 1.5;

                    // Elbow connector: go right from pred, bend down/up, arrive at succ.
                    // Midpoint X is at least 12px past pred right edge so the elbow
                    // doesn't double back on itself when succ starts before pred ends.
                    const elbowX = Math.max(x1 + 12, (x1 + x2) / 2);
                    const d =
                      `M ${x1} ${y1} ` +
                      `H ${elbowX} ` +
                      `V ${y2} ` +
                      `H ${x2}`;

                    return (
                      <path
                        key={`${predId}->${succRow.id}`}
                        d={d}
                        stroke={stroke}
                        strokeOpacity={strokeOpacity}
                        strokeWidth={strokeW}
                        fill="none"
                        markerEnd={markerEnd}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })
                )}
              </svg>
            )}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
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
          <div className="flex items-center gap-1.5">
            <svg width="20" height="10" viewBox="0 0 20 10" className="overflow-visible">
              <path d="M0,5 H14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.55" fill="none" markerEnd="url(#dep-arrow-normal)" />
            </svg>
            Dependency
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-px h-3 bg-warning" /> Today
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProjectGanttChart;
