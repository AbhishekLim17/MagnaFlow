// "My Work": what the viewer has to do, in the order it needs doing.
import { toDate } from './format';
import { isOverdueTask } from './taskState';

const FINISHED = new Set(['completed', 'cancelled']);
const DAY = 86_400_000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const byDeadline = (a, b) => (toDate(a.deadline)?.getTime() ?? Infinity) - (toDate(b.deadline)?.getTime() ?? Infinity);

/**
 * @param {Object[]} tasks every task the viewer can see
 * @param {string} uid the viewer
 * @returns {{ key: string, label: string, tasks: Object[] }[]} only groups that have something
 */
export const groupMyWork = (tasks = [], uid, now = new Date()) => {
  if (!uid) return [];
  const today = startOfDay(now).getTime();
  const groups = {
    overdue: { label: 'Overdue', tasks: [] },
    today: { label: 'Due today', tasks: [] },
    week: { label: 'Next 7 days', tasks: [] },
    later: { label: 'Later', tasks: [] },
    undated: { label: 'No deadline', tasks: [] },
    review: { label: 'Waiting for your review', tasks: [] },
    watching: { label: 'Watching', tasks: [] },
  };
  for (const task of tasks) {
    if (FINISHED.has(task.status)) continue;
    if (task.assignedTo === uid) {
      const due = toDate(task.deadline);
      let key = 'undated';
      if (isOverdueTask(task, now)) key = 'overdue';
      else if (due) {
        const day = startOfDay(due).getTime();
        if (day === today) key = 'today';
        else if (day - today <= 7 * DAY) key = 'week';
        else key = 'later';
      }
      groups[key].tasks.push(task);
    } else if (task.status === 'review' && task.createdBy === uid) {
      groups.review.tasks.push(task);
    } else if (Array.isArray(task.watchers) && task.watchers.includes(uid)) {
      groups.watching.tasks.push(task);
    }
  }
  return Object.entries(groups)
    .filter(([, g]) => g.tasks.length)
    .map(([key, g]) => ({ key, label: g.label, tasks: g.tasks.sort(byDeadline) }));
};
