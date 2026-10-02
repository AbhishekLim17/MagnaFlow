// Human-readable labels for the raw values stored on tasks and users. Raw ids such as
// "in-progress", "medium priority" or "org-admin" used to leak into badges and toasts.

export const STATUS_LABELS = {
  pending: 'Pending',
  'in-progress': 'In progress',
  review: 'In review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const ROLE_LABELS = {
  'master-admin': 'Platform owner',
  'org-admin': 'Organization admin',
  admin: 'Organization admin',
  'department-head': 'Department head',
  manager: 'Project manager',
  staff: 'Team member',
  client: 'Client',
};

const humanize = (value) => {
  const s = String(value ?? '').replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

export const statusLabel = (status) => STATUS_LABELS[status] || humanize(status) || 'Unknown';
export const priorityLabel = (priority) => PRIORITY_LABELS[priority] || humanize(priority) || 'Medium';
export const roleLabel = (role) => ROLE_LABELS[role] || humanize(role) || 'User';
