import { describe, test, expect } from 'vitest';
import { parseDay, mapColumns, parseTaskImport, tasksToRows, sampleImportRows, MAX_IMPORT_ROWS } from './taskCsv';
import { toCsv, parseCsv } from './csv';

const people = [
  { id: 'u1', name: 'Sana Staff', email: 'sana@demo.test' },
  { id: 'u2', name: 'Vikram Iyer', email: 'vikram@demo.test' },
  { id: 'u3', name: 'Ravi Kumar', email: 'ravi.k@demo.test' },
  { id: 'u4', name: 'Ravi Kumar', email: 'ravi.kumar@demo.test' },
];
const projects = [
  { id: 'p1', name: 'Apollo Platform', departmentId: 'd1' },
  { id: 'p2', name: 'Atlas', departmentId: 'd2' },
];
const ctx = { people, projects };
const csv = (...lines) => lines.join('\n');

describe('parseDay', () => {
  test('ISO dates, with or without a time', () => {
    expect(parseDay('2026-10-22')).toBe('2026-10-22');
    expect(parseDay('2026-1-5')).toBe('2026-01-05');
    expect(parseDay('2026-10-22T09:30:00Z')).toBe('2026-10-22');
  });

  test('numeric dates are day-first unless told otherwise', () => {
    expect(parseDay('03/04/2026')).toBe('2026-04-03');
    expect(parseDay('03/04/2026', 'mdy')).toBe('2026-03-04');
    expect(parseDay('22.10.26')).toBe('2026-10-22');
    expect(parseDay('22-10-2026')).toBe('2026-10-22');
  });

  test('month names in either order', () => {
    expect(parseDay('22 Oct 2026')).toBe('2026-10-22');
    expect(parseDay('22-Oct-26')).toBe('2026-10-22');
    expect(parseDay('October 22, 2026')).toBe('2026-10-22');
    expect(parseDay('Sept 3 2026')).toBe('2026-09-03');
  });

  test('an Excel date serial', () => {
    expect(parseDay('46317')).toBe('2026-10-22');
  });

  test('impossible or unreadable dates are rejected, not rolled over', () => {
    for (const bad of ['31/02/2026', '2026-13-01', '13/13/2026', 'next week', '12345', '']) {
      expect(parseDay(bad)).toBeNull();
    }
  });
});

describe('mapColumns', () => {
  test('reads our own headers and common names from other tools, ignoring case and spacing', () => {
    const { map, unknown } = mapColumns(['Task Name', 'Due Date', 'OWNER', 'assigned_to email', 'Notes', 'Colour']);
    expect(map).toEqual({ title: 0, deadline: 1, assignee: 2, assigneeEmail: 3, description: 4 });
    expect(unknown).toEqual(['Colour']);
  });

  test('the read-only columns of our own export are not reported as unknown', () => {
    expect(mapColumns(['Title', 'Department', 'Waiting on', 'Task ID']).unknown).toEqual([]);
  });
});

describe('parseTaskImport', () => {
  test('a good row becomes a task ready to create', () => {
    const r = parseTaskImport(csv(
      'Title,Description,Status,Priority,Assignee email,Start date,Deadline,Project',
      'Write the spec,One pager,In progress,High,SANA@demo.test,01/10/2026,05/10/2026,apollo platform',
    ), ctx);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toEqual({
      line: 2,
      errors: [],
      warnings: [],
      task: {
        title: 'Write the spec',
        description: 'One pager',
        status: 'in-progress',
        priority: 'high',
        assignedTo: 'u1',
        startDate: '2026-10-01',
        deadline: '2026-10-05',
        projectId: 'p1',
        departmentId: 'd1',
      },
    });
  });

  test('defaults: pending, medium, unassigned (with a warning), no dates, default project', () => {
    const r = parseTaskImport(csv('Title', 'Just a title'), { ...ctx, defaultProjectId: 'p2' });
    expect(r.rows[0].task).toMatchObject({ status: 'pending', priority: 'medium', assignedTo: '', startDate: '', deadline: '', projectId: 'p2' });
    expect(r.rows[0].warnings[0]).toMatch(/unassigned/);
  });

  test('words other tools use for status and priority', () => {
    const r = parseTaskImport(csv(
      'Title,Status,Priority',
      'a,Done,Urgent',
      'b,To do,Normal',
      'c,WIP,P1',
    ), ctx);
    expect(r.rows.map((x) => [x.task.status, x.task.priority])).toEqual([
      ['completed', 'critical'], ['pending', 'medium'], ['in-progress', 'high'],
    ]);
  });

  test('every problem is reported with its line, and bad rows are not turned into tasks', () => {
    const r = parseTaskImport(csv(
      'Title,Status,Priority,Assignee,Deadline,Start date,Project',
      ',Done,Low,,,,',
      'b,Someday,Huge,Nobody Here,32/01/2026,,Mars',
      'c,,,Ravi Kumar,01/10/2026,05/10/2026,',
    ), ctx);
    expect(r.rows.map((x) => x.line)).toEqual([2, 3, 4]);
    expect(r.rows[0].errors).toEqual(['Title is empty.']);
    expect(r.rows[1].errors).toEqual([
      expect.stringMatching(/Status “Someday”/),
      expect.stringMatching(/Priority “Huge”/),
      expect.stringMatching(/No one in your team is called “Nobody Here”/),
      expect.stringMatching(/Deadline “32\/01\/2026”/),
      expect.stringMatching(/Project “Mars”/),
    ]);
    expect(r.rows[2].errors).toEqual([
      expect.stringMatching(/More than one person is called “Ravi Kumar”/),
      'The deadline is before the start date.',
    ]);
    expect(r.rows.every((x) => x.task === undefined)).toBe(true);
  });

  test('an email settles a name that two people share', () => {
    const r = parseTaskImport(csv('Title,Assignee,Assignee email', 'a,Ravi Kumar,ravi.kumar@demo.test'), ctx);
    expect(r.rows[0].task.assignedTo).toBe('u4');
  });

  test('a file without a Title column, an empty file and an oversized file are refused outright', () => {
    expect(parseTaskImport(csv('Name,Due', 'x,05/10/2026'), ctx).rows[0].task.title).toBe('x'); // "Name" is a title alias
    expect(parseTaskImport(csv('Foo,Bar', 'x,y'), ctx).error).toMatch(/no Title column/);
    expect(parseTaskImport('', ctx).error).toMatch(/empty/);
    const big = ['Title', ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `t${i}`)].join('\n');
    expect(parseTaskImport(big, ctx).error).toMatch(/at most 500/);
  });

  test('the US date order can be chosen', () => {
    const r = parseTaskImport(csv('Title,Deadline', 'a,10/05/2026'), { ...ctx, dateOrder: 'mdy' });
    expect(r.rows[0].task.deadline).toBe('2026-10-05');
  });
});

describe('export', () => {
  const tasks = [
    {
      id: 't1', title: 'Write the spec', description: 'Notes', status: 'in-progress', priority: 'high',
      assignedTo: 'u1', startDate: new Date('2026-10-01'), deadline: new Date('2026-10-05'),
      projectId: 'p1', departmentId: 'd1', createdAt: new Date('2026-09-30'), completedAt: null, blockedBy: ['t2'],
    },
    { id: 't2', title: 'Agree scope', status: 'completed', priority: 'low', assignedTo: null, blockedBy: [] },
  ];
  const lookups = {
    person: (uid) => people.find((p) => p.id === uid),
    projectName: (id) => projects.find((p) => p.id === id)?.name,
    departmentName: (id) => ({ d1: 'Engineering' })[id],
  };

  test('rows carry the import columns first, then read-only context', () => {
    const [header, first, second] = tasksToRows(tasks, lookups);
    expect(header.slice(0, 9)).toEqual(['Title', 'Description', 'Status', 'Priority', 'Assignee', 'Assignee email', 'Start date', 'Deadline', 'Project']);
    expect(first).toEqual([
      'Write the spec', 'Notes', 'In progress', 'High', 'Sana Staff', 'sana@demo.test',
      '2026-10-01', '2026-10-05', 'Apollo Platform', 'Engineering', 'Agree scope', '2026-09-30', '', 't1',
    ]);
    expect(second[4]).toBe('');
  });

  test('an exported file imports back to the same tasks', () => {
    const text = toCsv(tasksToRows(tasks, lookups));
    const back = parseTaskImport(text, ctx);
    expect(back.unknownColumns).toEqual([]);
    expect(back.rows[0].task).toMatchObject({
      title: 'Write the spec', status: 'in-progress', priority: 'high', assignedTo: 'u1',
      startDate: '2026-10-01', deadline: '2026-10-05', projectId: 'p1',
    });
    expect(back.rows[1].task).toMatchObject({ title: 'Agree scope', status: 'completed', priority: 'low', assignedTo: '' });
  });

  test('the sample file parses (apart from its placeholder people)', () => {
    const rows = parseCsv(toCsv(sampleImportRows()));
    expect(rows[0][0]).toBe('Title');
    expect(rows).toHaveLength(3);
  });
});
