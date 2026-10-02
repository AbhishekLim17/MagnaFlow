import { describe, test, expect } from 'vitest';
import {
  tasksForPeriod, averageCompletionDays, onTimeDelivery, weeklyActivity,
  statusBreakdown, staffRows, topPerformers, buildReport,
} from './reportMetrics';

const now = new Date(2026, 9, 31, 12, 0);
const d = (month, day, h = 12) => new Date(2026, month, day, h);
const staff = [
  { id: 's1', name: 'Sana', status: 'active' },
  { id: 's2', name: 'Vikram', status: 'active' },
  { id: 's3', name: 'Gone', status: 'inactive' },
];

describe('tasksForPeriod', () => {
  const tasks = [
    { id: 'old-open', status: 'pending', createdAt: d(0, 5) },
    { id: 'old-done-long-ago', status: 'completed', createdAt: d(0, 5), completedAt: d(1, 5) },
    { id: 'old-done-this-month', status: 'completed', createdAt: d(0, 5), completedAt: d(9, 20) },
    { id: 'new-open', status: 'in-progress', createdAt: d(9, 25) },
    { id: 'cancelled', status: 'cancelled', createdAt: d(9, 25) },
  ];
  test('work finished inside the period counts even if the task is older', () => {
    const ids = tasksForPeriod(tasks, '30', now).map((t) => t.id);
    expect(ids).toContain('old-done-this-month');
  });
  test('open work is always included, finished work outside the period is not, cancelled never', () => {
    const ids = tasksForPeriod(tasks, '30', now).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['old-open', 'new-open']));
    expect(ids).not.toContain('old-done-long-ago');
    expect(ids).not.toContain('cancelled');
  });
  test('all time keeps everything but cancelled', () => {
    expect(tasksForPeriod(tasks, 'all', now)).toHaveLength(4);
  });
});

describe('onTimeDelivery', () => {
  test('is measured over completed tasks with both dates, and says how many', () => {
    const r = onTimeDelivery([
      { status: 'completed', deadline: d(9, 10), completedAt: d(9, 10, 18) }, // same day: on time
      { status: 'completed', deadline: d(9, 10), completedAt: d(9, 12) },     // late
      { status: 'completed' },                                                // unknowable
      { status: 'pending', deadline: d(9, 1) },                               // not completed
    ]);
    expect(r).toEqual({ percent: 50, onTime: 1, total: 2 });
  });
  test('no data is null, not 0% or 100%', () => {
    expect(onTimeDelivery([]).percent).toBeNull();
  });
});

describe('averageCompletionDays', () => {
  test('mean of created-to-completed, ignoring impossible dates', () => {
    const r = averageCompletionDays([
      { status: 'completed', createdAt: d(9, 1), completedAt: d(9, 3) },
      { status: 'completed', createdAt: d(9, 1), completedAt: d(9, 5) },
      { status: 'completed', createdAt: d(9, 5), completedAt: d(9, 1) },
    ]);
    expect(r).toEqual({ days: 3, count: 2 });
    expect(averageCompletionDays([]).days).toBeNull();
  });
});

describe('weeklyActivity', () => {
  test('created and completed are counted independently per week', () => {
    const tasks = [
      { status: 'completed', createdAt: d(9, 1), completedAt: d(9, 27) },  // completed last week, created weeks ago
      { status: 'pending', createdAt: d(9, 28) },
    ];
    const weeks = weeklyActivity(tasks, now);
    expect(weeks).toHaveLength(4);
    const last = weeks[3];
    expect(last.completed).toBe(1);
    expect(last.created).toBe(1);
    expect(weeks[0].week).toMatch(/^w\/c /);
  });
});

describe('statusBreakdown', () => {
  test('counts and percentages', () => {
    const rows = statusBreakdown([{ status: 'completed' }, { status: 'pending' }, { status: 'pending' }, { status: 'review' }]);
    expect(rows.find((r) => r.key === 'pending')).toMatchObject({ value: 2, percent: 50 });
    expect(statusBreakdown([]).every((r) => r.value === 0 && r.percent === 0)).toBe(true);
  });
});

describe('staffRows and topPerformers', () => {
  const tasks = [
    { assignedTo: 's1', status: 'completed' }, { assignedTo: 's1', status: 'completed' }, { assignedTo: 's1', status: 'pending' },
    { assignedTo: 's2', status: 'completed' },
    { assignedTo: 's3', status: 'pending' },
  ];
  test('only people who hold tasks appear', () => {
    const rows = staffRows(tasks, staff.slice(0, 2).concat([{ id: 's9', name: 'Nobody' }]));
    expect(rows.map((r) => r.name)).toEqual(['Sana', 'Vikram']);
    expect(rows[0]).toMatchObject({ total: 3, completed: 2, percent: 67 });
  });
  test('ranked by tasks finished, so one lucky task does not top the list', () => {
    const top = topPerformers(staffRows(tasks, staff));
    expect(top.map((r) => r.name)).toEqual(['Sana', 'Vikram']);
  });
  test('people with nothing completed are not performers', () => {
    expect(topPerformers(staffRows([{ assignedTo: 's3', status: 'pending' }], staff))).toEqual([]);
  });
});

describe('buildReport', () => {
  test('one consistent set of numbers', () => {
    const tasks = [
      { assignedTo: 's1', status: 'completed', createdAt: d(9, 1), completedAt: d(9, 5), deadline: d(9, 6) },
      { assignedTo: 's1', status: 'pending', createdAt: d(9, 2) },
      { assignedTo: 's2', status: 'in-progress', createdAt: d(9, 3) },
      { assignedTo: 's2', status: 'cancelled', createdAt: d(9, 3) },
    ];
    const r = buildReport(tasks, staff, '30', now);
    expect(r.completion).toEqual({ percent: 33, done: 1, total: 3 });
    expect(r.onTime).toEqual({ percent: 100, onTime: 1, total: 1 });
    expect(r.withOpenWork).toEqual({ count: 2, of: 2 });
    expect(r.status.reduce((a, s) => a + s.value, 0)).toBe(3);
  });
  test('an empty workspace has no percentages rather than fake ones', () => {
    const r = buildReport([], staff, '30', now);
    expect(r.completion.percent).toBeNull();
    expect(r.onTime.percent).toBeNull();
  });
});
