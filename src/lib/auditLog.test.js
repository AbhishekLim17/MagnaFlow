import { describe, test, expect } from 'vitest';
import { describeAuditEntry } from './auditLog';

const names = { u1: 'Priya Nair', u2: 'Old Hand' };
const nameOf = (uid) => names[uid];
const text = (entry) => describeAuditEntry(entry, nameOf).text;

describe('describeAuditEntry', () => {
  test('people: added, removed, password reset', () => {
    expect(text({ action: 'create_user', targetUserId: 'u1', targetRole: 'staff' })).toBe('Added Priya Nair as team member');
    expect(text({ action: 'delete_user', targetEmail: 'gone@x.test' })).toBe('Removed gone@x.test');
    expect(text({ action: 'reset_password', targetName: 'Asha' })).toBe('Sent Asha a password reset link');
  });

  test('access changes read as what happened', () => {
    expect(text({ action: 'update_user', targetUserId: 'u2', changes: { status: 'inactive' } })).toBe('Deactivated Old Hand');
    expect(text({ action: 'update_user', targetUserId: 'u2', changes: { status: 'active', role: 'manager' } }))
      .toBe('Reactivated Old Hand and made them project manager');
    expect(text({ action: 'update_user', targetUserId: 'u1', changes: { projectIds: ['p2'] } })).toBe('Moved Priya Nair to a different team');
    expect(text({ action: 'update_user', targetUserId: 'u1', changes: {} })).toBe('Updated Priya Nair');
  });

  test('departments, projects, budgets', () => {
    expect(text({ action: 'create_department', targetName: 'Design' })).toBe('Created the Design department');
    expect(text({ action: 'delete_department' })).toBe('Deleted a department');
    expect(text({ action: 'create_project', targetName: 'Apollo' })).toBe('Created the project Apollo');
    expect(text({ action: 'update_budget', targetName: 'Apollo' })).toBe('Changed the budget of Apollo');
  });

  test('categories for filtering', () => {
    expect(describeAuditEntry({ action: 'create_user' }).category).toBe('people');
    expect(describeAuditEntry({ action: 'delete_project' }).category).toBe('structure');
    expect(describeAuditEntry({ action: 'suspend_org' }).category).toBe('organisation');
  });

  test('an action it does not know is still readable', () => {
    expect(text({ action: 'export_data' })).toBe('Export data');
    expect(text({})).toBe('Something');
  });
});
