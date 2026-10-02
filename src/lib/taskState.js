// Derived task state shared by every screen, so they cannot disagree.
import { toDate, isPastDay } from './format';

const FINISHED = new Set(['completed', 'cancelled']);

/**
 * A task is overdue once its deadline DAY has ended. The screens used to compare the
 * deadline (a date at midnight) with "now", so anything due today was flagged overdue
 * from one minute past midnight, which no one means by "late".
 */
export const isOverdueTask = (task, now = new Date()) =>
  Boolean(task) && !FINISHED.has(task.status) && isPastDay(task.deadline, now);

/** Was a completed task finished by the end of its deadline day? null if unknowable. */
export const finishedOnTime = (task) => {
  const deadline = toDate(task?.deadline);
  const completed = toDate(task?.completedAt);
  if (!deadline || !completed) return null;
  const endOfDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59, 999);
  return completed.getTime() <= endOfDay.getTime();
};

/**
 * Headline numbers for a project as an outside stakeholder should see them.
 * Cancelled work is not part of the plan: counting it made a project whose live tasks
 * were all done sit at, say, 91% forever, and inflated "Total Tasks".
 */
export const summarizeProject = (tasks, now = new Date()) => {
  const all = tasks || [];
  const live = all.filter((t) => t.status !== 'cancelled');
  const completed = live.filter((t) => t.status === 'completed').length;
  return {
    total: live.length,
    completed,
    inProgress: live.filter((t) => t.status === 'in-progress').length,
    inReview: live.filter((t) => t.status === 'review').length,
    overdue: live.filter((t) => isOverdueTask(t, now)).length,
    cancelled: all.length - live.length,
    percent: live.length > 0 ? Math.round((completed / live.length) * 100) : 0,
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * A deadline in words: "Due today", "Due tomorrow", "Due in 5 days", "3 days overdue".
 * Finished tasks are not "overdue" whatever the date says. `tone` is for styling.
 */
export const describeDeadline = (task, now = new Date()) => {
  const deadline = toDate(task?.deadline);
  if (!deadline) return { label: 'No deadline', tone: 'muted' };
  if (FINISHED.has(task.status)) return { label: 'Finished', tone: 'muted' };
  const days = Math.round((startOfDay(deadline).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (days < 0) return { label: `${-days} day${-days > 1 ? 's' : ''} overdue`, tone: 'danger' };
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'warning' };
  return { label: `Due in ${days} days`, tone: 'muted' };
};
