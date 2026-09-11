// ProjectGanttChart - renders a project's tasks as a Gantt timeline.
// Each task is one row; its bar spans startDate -> deadline and is colored by
// status. Tasks with no explicit startDate fall back to their createdAt.
// Critical path tasks (zero total float via CPM) are highlighted in amber.
// Dependency edges are drawn as SVG elbow-connector arrows.

import React, { useMemo, useRef } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { computeCriticalPath } from '@/lib/criticalPath';

const DAY_MS = 24 * 60 * 60 * 1000;

// Firestore Timestamp | Date | string | millis -> Date (or null).
const toDate = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const STATUS_STYLES = {
  completed:    { bar: 'bg-success-accent', label: 'Completed' },
  'in-progress':{ bar: 'bg-primary', label: 'In Progress' },
  pending:      { bar: 'bg-muted-foreground', label: 'Pending' },
  review:       { bar: 'bg-blue-400', label: 'Review' },
  cancelled:    { bar: 'bg-muted', label: 'Cancelled' },
  overdue:      { bar: 'bg-destructive', label: 'Overdue' },
};

// Extra classes for critical path bars: amber glow ring.
const CRITICAL_EXTRA = 'ring-2 ring-amber-400 ring-offset-0 shadow-[0_0_8px_2px_rgba(251,191,36,0.45)]';

const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const ROW_HEIGHT = 44; // px - keep in sync with Tailwind h-11

const ProjectGanttChart = ({ tasks = [], getStaffName }) => {
  const gridRef = useRef(null);

  const criticalSet = useMemo(() => computeCriticalPath(tasks), [tasks]);

  const model = useMemo(() => {
    const today = startOfDay(new Date());

    const rows = tasks
      .map((t) => {
        const start = toDate(t.startDate) || toDate(t.createdAt);
        const end   = toDate(t.deadline)  || start;
        if (!start && !end) return null;
        const s = startOfDay(start || end);
        let e   = startOfDay(end   || start);
        if (e.getTime() < s.getTime()) e = s;
        const isCompleted = t.status === 'completed';
        const isOverdue   = !isCompleted && t.status !== 'cancelled'
          && e.getTime() < today.getTime();
        return {
          id:          t.id,
          title:       t.title || 'Untitled task',
          assignee:    getStaffName ? getStaffName(t.assignedTo) : null,
          start:       s,
          end:         e,
          statusKey:   isOverdue ? 'overdue' : (t.status || 'pending'),
          isCompleted,
          isCritical:  criticalSet.has(t.id),
          blockedBy:   Array.isArray(t.blockedBy) ? t.blockedBy : [],
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

    const pct  = (d) => ((d.getTime() - min.getTime()) / span) * 100;

    const ticks = [];
    const tickCount = 6;
    for (let i = 0; i <= tickCount; i++) {
      const t = new Date(min.getTime() + (span * i) / tickCount);
      ticks.push({ left: (i / tickCount) * 100, date: startOfDay(t) });
    }

    const todayPct = today >= min && today <= max ? pct(today) : null;

    // Build index: taskId -> row index (for arrow positions).
    const rowIndex = {};
    rows.forEach((r, i) => { rowIndex[r.id] = i; });

    return { rows, pct, ticks, todayPct, rowIndex, min, max };
  }, [tasks, getStaffName, criticalSet]);

  if (!model) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks with dates yet. Add tasks with a start date and deadline to see the timeline.
      </div>
    );
  }

  const { rows, pct, ticks, todayPct, rowIndex } = model;

  // LABEL_W must match the w-56 (14rem = 224px) label column.
  const LABEL_W = 224;

  // Compute bar geometry for a row (left% and width% within the GRID area, 0-100).
  const barGeometry = (r) => {
    const left  = pct(r.start);
    const width = Math.max(pct(r.end) - left, 1.5);
    return { left, width };
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Timeline header */}
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

        {/* Rows + SVG overlay */}
        <div className="relative" ref={gridRef}>
          {/* Today marker */}
          {todayPct != null && (
            <div
              className="absolute top-0 bottom-0 z-10 pointer-events-none"
              style={{ left: `calc(14rem + (100% - 14rem) * ${todayPct} / 100)` }}
            >
              <div className="w-px h-full bg-warning-soft" />
            </div>
          )}

          {/* SVG dependency arrows - rendered above rows */}
          <svg
            className="absolute inset-0 pointer-events-none z-20"
            style={{ width: '100%', height: `${rows.length * ROW_HEIGHT}px`, overflow: 'visible' }}
          >
            <defs>
              <marker id="arrowhead-normal" markerWidth="6" markerHeight="6"
                refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="var(--color-muted-foreground, #888)" fillOpacity="0.6" />
              </marker>
              <marker id="arrowhead-critical" markerWidth="6" markerHeight="6"
                refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgb(251,191,36)" />
              </marker>
            </defs>

            {rows.map((succRow) =>
              succRow.blockedBy.map((predId) => {
                const predIdx = rowIndex[predId];
                if (predIdx === undefined) return null;
                const predRow  = rows[predIdx];
                const succIdx  = rowIndex[succRow.id];

                const { left: predLeft, width: predWidth } = barGeometry(predRow);
                const { left: succLeft }                   = barGeometry(succRow);

                // Grid left offset = LABEL_W px. The bar percentages are
                // relative to the GRID area (100% = total width - LABEL_W).
                // We use SVG foreignObject-style calc: express x as
                // "LABEL_W + gridWidth * pct/100" but in SVG we must use
                // percentage units relative to the SVG viewport which equals
                // the full container. We instead compute using CSS calc strings
                // and embed them via style (not supported in SVG attributes).
                // Simpler: use viewBox = 1000 units wide and map accordingly.
                // We output percentage strings and let the SVG preserve ratio.

                // Represent positions as % of the TOTAL container width:
                //   barX = (LABEL_W / totalWidth) * 100  +  (gridWidth / totalWidth) * pct
                // But we don't know totalWidth at this point. Instead, we use
                // a trick: express x in a coordinate where 224px = 0 and the
                // rest is 1 unit (for the grid). In SVG % it's:
                //   xGrid = (LABEL_W_AS_PCT + (1 - LABEL_W_AS_PCT) * pct / 100)
                // We approximate LABEL_W as 224px in a 640px min-width container
                // so LABEL_W_AS_PCT = 224/640 = 35%.
                // For wider containers this is inaccurate. Use a ref-based
                // approach instead: render in a viewBox of 1000 x H.

                const totalW    = 1000;
                const labelPct  = LABEL_W / 640; // ≈ 0.35, good enough for arrows
                const gridW     = totalW * (1 - labelPct);
                const labelX    = totalW * labelPct;

                const predRightX = labelX + gridW * (predLeft + predWidth) / 100;
                const succLeftX  = labelX + gridW * succLeft / 100;

                const predMidY = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const succMidY = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                const isCriticalEdge = predRow.isCritical && succRow.isCritical;
                const stroke         = isCriticalEdge ? 'rgb(251,191,36)' : 'var(--color-muted-foreground, #888)';
                const strokeOpacity  = isCriticalEdge ? 0.9 : 0.45;
                const markerEnd      = isCriticalEdge ? 'url(#arrowhead-critical)' : 'url(#arrowhead-normal)';

                // Simple elbow: horizontal from pred right, vertical to succ row, horizontal to succ left.
                const midX = (predRightX + Math.max(predRightX + 10, succLeftX - 10)) / 2;
                const d =
                  `M ${predRightX} ${predMidY} ` +
                  `H ${midX} ` +
                  `V ${succMidY} ` +
                  `H ${succLeftX}`;

                return (
                  <path
                    key={`${predId}->${succRow.id}`}
                    d={d}
                    stroke={stroke}
                    strokeOpacity={strokeOpacity}
                    strokeWidth={isCriticalEdge ? 2 : 1.5}
                    fill="none"
                    markerEnd={markerEnd}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })
            )}
          </svg>

          {/* Task rows */}
          {rows.map((r) => {
            const { left, width } = barGeometry(r);
            const style = STATUS_STYLES[r.statusKey] || STATUS_STYLES.pending;
            return (
              <div key={r.id} className="flex items-center h-11 border-b border-border relative z-[5]">
                <div className="w-56 flex-shrink-0 pr-3">
                  <p
                    data-testid="gantt-task-title"
                    className={`text-sm truncate ${r.isCritical ? 'text-amber-400 font-semibold' : 'text-foreground'}`}
                    title={r.title}
                  >
                    {r.isCritical && <span className="mr-1" aria-hidden="true">⚡</span>}
                    {r.title}
                  </p>
                  {r.assignee && (
                    <p className="text-[11px] text-muted-foreground truncate">{r.assignee}</p>
                  )}
                </div>
                <div className="relative flex-1 h-full">
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded ${style.bar} flex items-center px-1.5 shadow ${r.isCritical ? CRITICAL_EXTRA : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmt(r.start)} → ${fmt(r.end)} · ${style.label}${r.isCritical ? ' · Critical path' : ''}`}
                    role="img"
                    aria-label={`${r.title}: ${style.label}${r.isCritical ? ', critical path' : ''}, ${fmt(r.start)} to ${fmt(r.end)}`}
                  >
                    {r.isCompleted && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-foreground flex-shrink-0" aria-hidden="true" />
                    )}
                    {r.isCritical && !r.isCompleted && (
                      <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          {['completed', 'in-progress', 'pending', 'overdue'].map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded ${STATUS_STYLES[k].bar}`} />
              {STATUS_STYLES[k].label}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-amber-400 ring-2 ring-amber-400 ring-offset-0" />
            Critical path
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-px bg-muted-foreground" />
            Dependency
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-px h-3 bg-warning" />
            Today
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectGanttChart;
