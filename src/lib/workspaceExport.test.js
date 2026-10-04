import { describe, test, expect } from 'vitest';
import { buildWorkspaceSheets } from './workspaceExport';

const data = {
  tasks: [{ id: 't1', title: 'Write the spec', status: 'pending', priority: 'high', assignedTo: 'u1', projectId: 'p1', departmentId: 'd1', blockedBy: [] }],
  people: [
    { id: 'u1', name: 'Sana Staff', email: 'sana@demo.test', role: 'staff', designation: 'Developer', departmentIds: ['d1'], projectIds: ['p1'], status: 'active', createdAt: new Date('2026-09-01') },
    { id: 'u2', name: 'Old Hand', email: 'old@demo.test', role: 'department-head', departmentIds: ['d1', 'gone'], status: 'inactive' },
  ],
  projects: [{ id: 'p1', name: 'Apollo', departmentId: 'd1', createdAt: new Date('2026-08-01') }],
  departments: [{ id: 'd1', name: 'Engineering' }],
  designations: [{ id: 'x', name: 'Developer', description: 'Writes code' }],
};

describe('buildWorkspaceSheets', () => {
  const sheets = buildWorkspaceSheets(data, { organisation: 'Magnetar', exportedBy: 'Arjun', now: new Date('2026-10-04T10:15:00Z') });
  const sheet = (name) => sheets.find((s) => s.name === name).rows;

  test('one sheet per kind of record, in a sensible order', () => {
    expect(sheets.map((s) => s.name)).toEqual(['About', 'Tasks', 'People', 'Projects', 'Departments', 'Designations']);
  });

  test('the About sheet says what, whose and when', () => {
    expect(sheet('About')).toEqual(expect.arrayContaining([
      ['Organisation', 'Magnetar'],
      ['Exported', '2026-10-04 10:15 UTC'],
      ['Exported by', 'Arjun'],
      ['Tasks', 1],
      ['People', 2],
    ]));
  });

  test('tasks use the import columns, with names resolved', () => {
    const [header, row] = sheet('Tasks');
    expect(header[0]).toBe('Title');
    expect(row.slice(0, 6)).toEqual(['Write the spec', '', 'Pending', 'High', 'Sana Staff', 'sana@demo.test']);
    expect(row[8]).toBe('Apollo');
    expect(row[9]).toBe('Engineering');
  });

  test('people show role, scope and status in words; unknown ids are dropped, not printed', () => {
    const [header, sana, old] = sheet('People');
    expect(header).toEqual(['Name', 'Email', 'Role', 'Designation', 'Departments', 'Projects', 'Status', 'Phone', 'Added']);
    expect(sana).toEqual(['Sana Staff', 'sana@demo.test', 'Team member', 'Developer', 'Engineering', 'Apollo', 'Active', '', '2026-09-01']);
    expect(old[4]).toBe('Engineering');
    expect(old[6]).toBe('Deactivated');
  });

  test('projects and departments by name', () => {
    expect(sheet('Projects')[1]).toEqual(['Apollo', 'Engineering', 'active', '2026-08-01']);
    expect(sheet('Departments')[1]).toEqual(['Engineering', '']);
    expect(sheet('Designations')[1]).toEqual(['Developer', 'Writes code']);
  });

  test('says so when the task list was cut short', () => {
    const cut = buildWorkspaceSheets(data, { tasksTruncated: true });
    expect(cut[0].rows.flat().join(' ')).toMatch(/read limit/);
  });
});
