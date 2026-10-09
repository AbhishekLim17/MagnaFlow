// TaskCalendar - tasks on a month calendar by deadline.
//
// A month grid on wider screens; on a phone, where seven columns of task titles would be
// unreadable, the same month as a list of days. Clicking a task opens it (the caller
// decides how). Days with more tasks than fit show "+N more", which lists the whole day.

import React, { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { tasksToIcs } from '@/lib/ics';
import { downloadBlob } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatDateLong } from '@/lib/format';
import { statusLabel, priorityLabel } from '@/lib/taskLabels';
import { isOverdueTask } from '@/lib/taskState';
import {
  monthGrid, weekdayNames, groupTasksByDay, dayKey, addMonths, startOfMonth,
} from '@/lib/calendarLayout';

const VISIBLE_PER_DAY = 3;
const PRIORITY_DOT = {
  critical: 'bg-destructive',
  high: 'bg-warning-accent',
  medium: 'bg-info',
  low: 'bg-success-accent',
};
const MONTH_TITLE = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const DAY_SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const describe = (task) => [
  task.title || 'Untitled task',
  task.milestone ? 'milestone' : null,
  statusLabel(task.status),
  `${priorityLabel(task.priority)} priority`,
  isOverdueTask(task) ? 'overdue' : null,
].filter(Boolean).join(', ');

const TaskChip = ({ task, onClick, roomy = false }) => {
  const overdue = isOverdueTask(task);
  const done = task.status === 'completed' || task.status === 'cancelled';
  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      aria-label={describe(task)}
      title={task.title}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 text-left text-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        roomy ? 'min-h-10 py-2 text-sm' : 'py-1',
        overdue
          ? 'border-destructive/40 bg-destructive-soft text-destructive hover:bg-destructive-soft/80'
          : 'border-border bg-card text-foreground hover:bg-muted',
        done && 'text-muted-foreground line-through',
      )}
    >
      {task.milestone
        ? <Flag className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
        : <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium)} aria-hidden="true" />}
      <span className="truncate">{task.title || 'Untitled task'}</span>
    </button>
  );
};

/**
 * @param {Object[]} tasks
 * @param {(task: Object) => void} onTaskClick
 * @param {Date} [initialMonth]  any day in the month to open on (default: today)
 */
const TaskCalendar = ({ tasks = [], onTaskClick, initialMonth }) => {
  const [month, setMonth] = useState(() => startOfMonth(initialMonth || new Date()));
  const [openDay, setOpenDay] = useState(null); // dayKey shown in the "whole day" dialog

  const { byDay, undated } = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const days = useMemo(() => monthGrid(month), [month]);
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const todayKey = dayKey(new Date());
  const names = weekdayNames(1, 'short');
  const longNames = weekdayNames(1, 'long');
  const inMonth = (d) => d.getMonth() === month.getMonth();
  const monthDays = days.filter((d) => inMonth(d) && byDay.has(dayKey(d)));
  const dueThisMonth = monthDays.reduce((n, d) => n + byDay.get(dayKey(d)).length, 0);

  const pick = (task) => {
    setOpenDay(null);
    onTaskClick?.(task);
  };

  const openDayDate = openDay ? days.find((d) => dayKey(d) === openDay) : null;

  return (
    <section aria-label="Task calendar" className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      {/* Month navigation */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground" aria-live="polite">
          {MONTH_TITLE.format(month)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {dueThisMonth === 0 ? 'nothing due' : `${dueThisMonth} due`}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Download these deadlines for Google Calendar, Outlook or Apple Calendar"
            onClick={() => downloadBlob(
              new Blob([tasksToIcs(tasks, { appUrl: window.location.origin + window.location.pathname })], { type: 'text/calendar;charset=utf-8' }),
              'magnaflow-deadlines.ics',
            )}
          >
            <CalendarPlus aria-hidden="true" />
            <span className="hidden sm:inline">Add to calendar</span>
            <span className="sr-only sm:hidden">Add deadlines to your calendar</span>
          </Button>
        </div>
      </div>

      {/* Month grid (tablet and up) */}
      <table className="hidden w-full table-fixed border-collapse sm:table">
        <caption className="sr-only">Tasks due in {MONTH_TITLE.format(month)}</caption>
        <thead>
          <tr>
            {names.map((n, i) => (
              <th key={n} scope="col" className="pb-2 text-xs font-medium text-muted-foreground">
                <abbr title={longNames[i]} className="no-underline">{n}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={dayKey(week[0])}>
              {week.map((d) => {
                const key = dayKey(d);
                const list = byDay.get(key) || [];
                const isToday = key === todayKey;
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                const hidden = list.length - VISIBLE_PER_DAY;
                return (
                  <td
                    key={key}
                    className={cn(
                      'h-28 border border-border p-1 align-top lg:h-32',
                      !inMonth(d) && 'bg-muted/40',
                      inMonth(d) && weekend && 'bg-muted/20',
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          'grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs',
                          isToday ? 'bg-primary font-semibold text-primary-foreground' : inMonth(d) ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        <span aria-hidden="true">{d.getDate()}</span>
                        <span className="sr-only">
                          {formatDateLong(d)}{isToday ? ', today' : ''}{list.length ? `, ${list.length} due` : ''}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, VISIBLE_PER_DAY).map((t) => <TaskChip key={t.id} task={t} onClick={pick} />)}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenDay(key)}
                          className="w-full rounded-md px-1.5 py-0.5 text-left text-xs font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          +{hidden} more
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Agenda (phones) */}
      <div className="space-y-4 sm:hidden">
        {monthDays.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing is due in {MONTH_TITLE.format(month)}.</p>
        ) : (
          monthDays.map((d) => {
            const key = dayKey(d);
            return (
              <div key={key}>
                <h3 className={cn('mb-1.5 text-sm font-semibold', key === todayKey ? 'text-primary' : 'text-foreground')}>
                  {DAY_SHORT.format(d)}{key === todayKey ? ' · Today' : ''}
                </h3>
                <div className="space-y-1.5">
                  {byDay.get(key).map((t) => <TaskChip key={t.id} task={t} onClick={pick} roomy />)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {undated.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {undated.length} task{undated.length === 1 ? ' has' : 's have'} no deadline and {undated.length === 1 ? 'is' : 'are'} not shown on the calendar.
        </p>
      )}

      <Dialog open={Boolean(openDay)} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Due {openDayDate ? formatDateLong(openDayDate) : ''}</DialogTitle>
            <DialogDescription>{(byDay.get(openDay) || []).length} tasks</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {(byDay.get(openDay) || []).map((t) => <TaskChip key={t.id} task={t} onClick={pick} roomy />)}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default TaskCalendar;
