// ProjectGanttChart - renders a project's tasks as a Gantt timeline.
// Each task is one row; its bar spans startDate -> deadline and is colored by
// status (completed tasks render as "done"). Tasks with no explicit startDate
// fall back to their createdAt. Pure CSS/flex positioning — no chart library.

import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';

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
  completed: { bar: 'bg-emerald-500', label: 'Completed' },
  'in-progress': { bar: 'bg-blue-500', label: 'In Progress' },
  pending: { bar: 'bg-slate-400', label: 'Pending' },
  cancelled: { bar: 'bg-gray-600', label: 'Cancelled' },
  overdue: { bar: 'bg-red-500', label: 'Overdue' },
};

const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const ProjectGanttChart = ({ tasks = [], getStaffName }) => {
  const model = useMemo(() => {
    const today = startOfDay(new Date());

    // Resolve each task's [start, end] window.
    const rows = tasks
      .map((t) => {
        const start = toDate(t.startDate) || toDate(t.createdAt);
        const end = toDate(t.deadline) || start;
        if (!start && !end) return null;
        const s = startOfDay(start || end);
        // Ensure at least a 1-day bar and that end is never before start.
        let e = startOfDay(end || start);
        if (e.getTime() < s.getTime()) e = s;
        const isCompleted = t.status === 'completed';
        const isOverdue = !isCompleted && t.status !== 'cancelled'
          && e.getTime() < today.getTime();
        return {
          id: t.id,
          title: t.title || 'Untitled task',
          assignee: getStaffName ? getStaffName(t.assignedTo) : null,
          start: s,
          end: e,
          statusKey: isOverdue ? 'overdue' : (t.status || 'pending'),
          isCompleted,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    if (rows.length === 0) return null;

    // Domain across all tasks, padded by a day on each side.
    let min = rows[0].start;
    let max = rows[0].end;
    for (const r of rows) {
      if (r.start < min) min = r.start;
      if (r.end > max) max = r.end;
    }
    min = new Date(min.getTime() - DAY_MS);
    max = new Date(max.getTime() + DAY_MS);
    const span = Math.max(max.getTime() - min.getTime(), DAY_MS);

    const pct = (d) => ((d.getTime() - min.getTime()) / span) * 100;

    // ~6 evenly spaced date ticks for the header.
    const ticks = [];
    const tickCount = 6;
    for (let i = 0; i <= tickCount; i++) {
      const t = new Date(min.getTime() + (span * i) / tickCount);
      ticks.push({ left: (i / tickCount) * 100, date: startOfDay(t) });
    }

    const todayPct = today >= min && today <= max ? pct(today) : null;

    return { rows, pct, ticks, todayPct };
  }, [tasks, getStaffName]);

  if (!model) {
    return (
      <div className="text-center py-12 text-gray-400">
        No tasks with dates yet. Add tasks with a start date and deadline to see the timeline.
      </div>
    );
  }

  const { rows, pct, ticks, todayPct } = model;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Timeline header */}
        <div className="flex">
          <div className="w-56 flex-shrink-0" />
          <div className="relative flex-1 h-6 border-b border-white/10">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute top-0 text-[10px] text-gray-400 -translate-x-1/2"
                style={{ left: `${t.left}%` }}
              >
                {fmt(t.date)}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {/* today marker spanning all rows */}
          {todayPct != null && (
            <div
              className="absolute top-0 bottom-0 z-10 pointer-events-none"
              style={{ left: `calc(14rem + (100% - 14rem) * ${todayPct} / 100)` }}
            >
              <div className="w-px h-full bg-amber-400/70" />
            </div>
          )}

          {rows.map((r) => {
            const left = pct(r.start);
            const width = Math.max(pct(r.end) - left, 1.5);
            const style = STATUS_STYLES[r.statusKey] || STATUS_STYLES.pending;
            return (
              <div key={r.id} className="flex items-center h-11 border-b border-white/5">
                <div className="w-56 flex-shrink-0 pr-3">
                  <p className="text-sm text-white truncate" title={r.title}>{r.title}</p>
                  {r.assignee && <p className="text-[11px] text-gray-400 truncate">{r.assignee}</p>}
                </div>
                <div className="relative flex-1 h-full">
                  {/* Status is conveyed by an accessible label as well as by
                      colour, so it doesn't depend on colour perception alone. */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded ${style.bar} flex items-center px-1.5 shadow`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmt(r.start)} → ${fmt(r.end)} · ${style.label}`}
                    role="img"
                    aria-label={`${r.title}: ${style.label}, ${fmt(r.start)} to ${fmt(r.end)}`}
                  >
                    {r.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-white flex-shrink-0" aria-hidden="true" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-300">
          {['completed', 'in-progress', 'pending', 'overdue'].map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded ${STATUS_STYLES[k].bar}`} />
              {STATUS_STYLES[k].label}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-px h-3 bg-amber-400" /> Today
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectGanttChart;
