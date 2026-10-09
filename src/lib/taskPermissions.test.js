import { describe, test, expect } from 'vitest';
import { canEditTask, projectsInScope } from './taskPermissions';

const task = { orgId: 'o1', departmentId: 'd1', projectId: 'p1', createdBy: 'boss', assignedTo: 'sana' };

describe('canEditTask (mirrors the tasks update rule)', () => {
  test('org admins edit anything in their own organisation, nothing outside it', () => {
    expect(canEditTask({ id: 'a', role: 'org-admin', orgId: 'o1' }, task)).toBe(true);
    expect(canEditTask({ id: 'a', role: 'admin', orgId: 'o1' }, task)).toBe(true);
    expect(canEditTask({ id: 'a', role: 'org-admin', orgId: 'o2' }, task)).toBe(false);
  });

  test('the platform owner can edit anything', () => {
    expect(canEditTask({ id: 'm', role: 'master-admin' }, task)).toBe(true);
  });

  test('a department head owns their departments; a manager owns their projects', () => {
    expect(canEditTask({ id: 'h', role: 'department-head', orgId: 'o1', departmentIds: ['d1'] }, task)).toBe(true);
    expect(canEditTask({ id: 'h', role: 'department-head', orgId: 'o1', departmentIds: ['d2'] }, task)).toBe(false);
    expect(canEditTask({ id: 'm', role: 'manager', orgId: 'o1', projectIds: ['p1'] }, task)).toBe(true);
    expect(canEditTask({ id: 'm', role: 'manager', orgId: 'o1', projectIds: ['p9'] }, task)).toBe(false);
  });

  test('being a member of the project is not enough for staff; being the assignee is not either', () => {
    expect(canEditTask({ id: 'sana', role: 'staff', orgId: 'o1', projectIds: ['p1'], departmentIds: ['d1'] }, task)).toBe(false);
  });

  test('anyone may edit what they created, and accepts uid or id', () => {
    expect(canEditTask({ uid: 'boss', role: 'staff', orgId: 'o1' }, task)).toBe(true);
    expect(canEditTask({ id: 'boss', role: 'staff', orgId: 'o1' }, task)).toBe(true);
  });

  test('clients and missing data never can', () => {
    expect(canEditTask({ id: 'c', role: 'client', orgId: 'o1', projectIds: ['p1'] }, task)).toBe(false);
    expect(canEditTask(null, task)).toBe(false);
    expect(canEditTask({ id: 'a', role: 'org-admin', orgId: 'o1' }, null)).toBe(false);
  });
});

describe('projectsInScope', () => {
  const projects = [
    { id: 'p1', orgId: 'o', departmentId: 'd1' },
    { id: 'p2', orgId: 'o', departmentId: 'd2' },
    { id: 'p3', orgId: 'o' },
  ];
  test('is what a person runs plus what they are a member of', () => {
    expect(projectsInScope({ role: 'org-admin', orgId: 'o' }, projects).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(projectsInScope({ role: 'department-head', orgId: 'o', departmentIds: ['d2'] }, projects).map((p) => p.id)).toEqual(['p2']);
    expect(projectsInScope({ role: 'staff', orgId: 'o', projectIds: ['p3'] }, projects).map((p) => p.id)).toEqual(['p3']);
    expect(projectsInScope(null, projects)).toEqual([]);
  });
});
