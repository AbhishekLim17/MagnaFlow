// Automation rules: "when a task is created / changes status (in this project, at this
// priority), then post to our channels / set the priority / assign someone / add checklist
// items". Pure and import-free: the browser uses it to decide whether a change is worth an
// event, and the mail job (scripts/lib/automations.cjs) uses it to run the rules.

export const TRIGGERS = [
  { value: 'task_created', label: 'A task is created' },
  { value: 'status_changed', label: 'A task changes status' },
];

export const ACTIONS = [
  { value: 'notify_channels', label: "Post to the organisation's channels" },
  { value: 'set_priority', label: 'Set the priority' },
  { value: 'assign_to', label: 'Assign it to someone (if nobody is assigned)' },
  { value: 'add_checklist', label: 'Add checklist items' },
];

export const STATUSES = ['pending', 'in-progress', 'review', 'completed', 'cancelled'];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const MAX_RULES = 50;
export const MAX_CHECKLIST = 20;

const ANY = '';

/** Why a rule cannot be saved, or null. */
export const ruleProblem = (rule) => {
  if (!String(rule?.name || '').trim()) return 'Give the rule a name.';
  if (!TRIGGERS.some((t) => t.value === rule.trigger)) return 'Choose when it runs.';
  if (rule.trigger === 'status_changed' && rule.toStatus && !STATUSES.includes(rule.toStatus)) return 'Choose a status.';
  const a = rule.action || {};
  if (!ACTIONS.some((x) => x.value === a.type)) return 'Choose what it does.';
  if (a.type === 'set_priority' && !PRIORITIES.includes(a.priority)) return 'Choose the priority to set.';
  if (a.type === 'assign_to' && !a.userId) return 'Choose who to assign it to.';
  if (a.type === 'add_checklist') {
    const items = (a.items || []).map((s) => String(s).trim()).filter(Boolean);
    if (!items.length) return 'Add at least one checklist item.';
    if (items.length > MAX_CHECKLIST) return `At most ${MAX_CHECKLIST} items.`;
  }
  return null;
};

/** Does this rule apply to this event on this task (as the task is now)? */
export const ruleMatches = (rule, event, task) => {
  if (!rule?.enabled || !task) return false;
  if (rule.trigger !== event.type) return false;
  if (event.type === 'status_changed') {
    if (task.status !== event.to) return false; // the task must still be in the status the event says
    if (rule.toStatus && rule.toStatus !== event.to) return false;
  }
  if (rule.projectId && rule.projectId !== (task.projectId || ANY)) return false;
  if (rule.priority && rule.priority !== task.priority) return false;
  return true;
};

/** Should the app record this change as an event? (Only if some enabled rule could want it.) */
export const worthAnEvent = (rules, type, task) => (rules || []).some((r) => r.enabled && r.trigger === type
  && (!r.projectId || r.projectId === task?.projectId)
  && (type !== 'status_changed' || !r.toStatus || r.toStatus === task?.status));

const STATUS_WORDS = { pending: 'Pending', 'in-progress': 'In progress', review: 'In review', completed: 'Completed', cancelled: 'Cancelled' };

/** The line posted to Slack / Teams / a webhook. */
export const channelText = (event, task, projectName) => {
  const where = projectName ? ` in ${projectName}` : '';
  const title = `“${task?.title || 'A task'}”`;
  if (event.type === 'task_created') return `New task${where}: ${title}${task?.priority ? ` (${task.priority} priority)` : ''}`;
  return `${title}${where} is now ${STATUS_WORDS[event.to] || event.to}${event.byName ? ` (by ${event.byName})` : ''}`;
};

/** "When a task changes status to Completed in Apollo → Post to the organisation's channels" */
export const describeRule = (rule, projectName = '') => {
  const when = rule.trigger === 'task_created'
    ? 'When a task is created'
    : `When a task changes status${rule.toStatus ? ` to ${STATUS_WORDS[rule.toStatus] || rule.toStatus}` : ''}`;
  const filters = [projectName && `in ${projectName}`, rule.priority && `at ${rule.priority} priority`].filter(Boolean).join(' ');
  const a = rule.action || {};
  const then = a.type === 'set_priority' ? `set the priority to ${a.priority}`
    : a.type === 'assign_to' ? 'assign it'
      : a.type === 'add_checklist' ? `add ${(a.items || []).length} checklist item${(a.items || []).length === 1 ? '' : 's'}`
        : 'post to the channels';
  return `${when}${filters ? ` ${filters}` : ''}, ${then}.`;
};

// Where a channel may point: Slack and Teams webhooks on their own domains, anything else https.
export const CHANNELS = [
  { key: 'slack', label: 'Slack incoming webhook', pattern: /^https:\/\/hooks\.slack\.com\/services\/[\w/-]+$/ },
  { key: 'teams', label: 'Microsoft Teams webhook', pattern: /^https:\/\/[\w.-]+\.(webhook\.office\.com|logic\.azure\.com|powerplatform\.com|environment\.api\.powerplatform\.com)(:443)?\/[\S]+$/ },
  { key: 'webhook', label: 'Your own webhook (https)', pattern: /^https:\/\/[^\s/$.?#].[^\s]*$/ },
];

/** Why a channel URL cannot be saved, or null (empty means "not used"). */
export const channelProblem = (key, url) => {
  const u = String(url || '').trim();
  if (!u) return null;
  const c = CHANNELS.find((x) => x.key === key);
  return c && c.pattern.test(u) ? null : `That is not a ${c ? c.label : 'webhook'} address.`;
};
