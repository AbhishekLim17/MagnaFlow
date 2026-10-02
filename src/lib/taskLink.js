// Deep links to a task. Every dashboard hosts a TaskDeepLink that opens the task named
// in the `?task=` query parameter, so a link works from wherever the user happens to be.

export const TASK_PARAM = 'task';

/** Same page, with the task opened: taskLink('/admin/tasks', 'abc') -> '/admin/tasks?task=abc' */
export const taskLink = (pathname, taskId) =>
  `${pathname}?${TASK_PARAM}=${encodeURIComponent(taskId)}`;

/** The id requested by a location.search string, or null. */
export const taskIdFromSearch = (search) => {
  const id = new URLSearchParams(search || '').get(TASK_PARAM);
  return id && id.trim() ? id.trim() : null;
};

/** The same search string without the task parameter (other parameters are kept). */
export const withoutTaskParam = (search) => {
  const params = new URLSearchParams(search || '');
  params.delete(TASK_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
};
