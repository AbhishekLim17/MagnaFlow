// Watching a task: people who are not its assignee can follow it and hear (in the bell)
// when its status changes or someone comments. A task carries `watchers: uid[]`; the
// rules let each person add or remove only themselves.
import { statusLabel } from './taskLabels';

export const isWatching = (task, uid) => Boolean(uid) && Array.isArray(task?.watchers) && task.watchers.includes(uid);

/** Who to tell about a change: the watchers, minus whoever made it and anyone already told. */
export const watcherRecipients = (task, actorUid, alreadyTold = []) => {
  const skip = new Set([actorUid, ...alreadyTold]);
  return [...new Set(Array.isArray(task?.watchers) ? task.watchers : [])]
    .filter((uid) => typeof uid === 'string' && uid && !skip.has(uid))
    .slice(0, 50);
};

/** The bell's sentence for a watcher notification, or null for any other kind. */
export const watchNotificationText = (n) => {
  const who = n?.mentionedByName || 'Someone';
  const on = n?.taskTitle ? `“${n.taskTitle}”` : 'a task you watch';
  switch (n?.type) {
    case 'watch_status': return `${who} moved ${on} to ${statusLabel(n.status).toLowerCase()}`;
    case 'watch_comment': return `${who} commented on ${on}`;
    default: return null;
  }
};
