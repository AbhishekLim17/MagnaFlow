// Audit entries in words, for the org admin's activity log (and the platform owner's).
// Pure: the caller supplies how to name people.
import { roleLabel } from './taskLabels';

export const AUDIT_CATEGORIES = [
  { value: 'all', label: 'Everything' },
  { value: 'people', label: 'People and access' },
  { value: 'structure', label: 'Departments and projects' },
  { value: 'organisation', label: 'Organisation' },
];

const CATEGORY = {
  create_user: 'people',
  delete_user: 'people',
  update_user: 'people',
  reset_password: 'people',
  create_department: 'structure',
  delete_department: 'structure',
  create_project: 'structure',
  delete_project: 'structure',
  update_budget: 'structure',
  provision_org: 'organisation',
  update_org: 'organisation',
  delete_org: 'organisation',
  suspend_org: 'organisation',
  reactivate_org: 'organisation',
};

const humanize = (s) => String(s || 'something').replace(/[_-]+/g, ' ');

/**
 * @param {Object} entry  an audit_logs document
 * @param {(uid: string) => string|undefined} [nameOf]
 * @returns {{ text: string, category: string }}
 */
export const describeAuditEntry = (entry, nameOf = () => undefined) => {
  const e = entry || {};
  const who = e.targetName || (e.targetUserId && nameOf(e.targetUserId)) || e.targetEmail || 'someone';
  const c = e.changes || {};
  const category = CATEGORY[e.action] || 'organisation';

  switch (e.action) {
    case 'create_user':
      return { category, text: `Added ${who}${e.targetRole ? ` as ${roleLabel(e.targetRole).toLowerCase()}` : ''}` };
    case 'delete_user':
      return { category, text: `Removed ${who}` };
    case 'reset_password':
      return { category, text: `Sent ${who} a password reset link` };
    case 'update_user': {
      const parts = [];
      if (c.status === 'inactive') parts.push(`Deactivated ${who}`);
      else if (c.status === 'active') parts.push(`Reactivated ${who}`);
      if (c.role) parts.push(`${parts.length ? 'and made them' : `Made ${who}`} ${roleLabel(c.role).toLowerCase()}`);
      if (c.departmentIds || c.projectIds) parts.push(`${parts.length ? 'and moved them' : `Moved ${who}`} to a different team`);
      return { category, text: parts.length ? parts.join(' ') : `Updated ${who}` };
    }
    case 'create_department':
      return { category, text: `Created the ${e.targetName || ''} department`.replace('the  department', 'a department') };
    case 'delete_department':
      return { category, text: `Deleted the ${e.targetName || ''} department`.replace('the  department', 'a department') };
    case 'create_project':
      return { category, text: e.targetName ? `Created the project ${e.targetName}` : 'Created a project' };
    case 'delete_project':
      return { category, text: e.targetName ? `Deleted the project ${e.targetName}` : 'Deleted a project' };
    case 'update_budget':
      return { category, text: e.targetName ? `Changed the budget of ${e.targetName}` : 'Changed a project budget' };
    case 'provision_org':
      return { category, text: 'Set up the organisation' };
    case 'update_org':
      return { category, text: 'Changed the organisation settings' };
    case 'suspend_org':
      return { category, text: 'Suspended the organisation' };
    case 'reactivate_org':
      return { category, text: 'Reactivated the organisation' };
    case 'delete_org':
      return { category, text: 'Deleted the organisation' };
    default: {
      const t = humanize(e.action);
      return { category, text: t.charAt(0).toUpperCase() + t.slice(1) };
    }
  }
};
