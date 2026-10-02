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
