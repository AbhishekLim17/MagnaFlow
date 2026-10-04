import { describe, test, expect } from 'vitest';
import { monthGrid, weekdayNames, groupTasksByDay, dayKey, addMonths, startOfMonth } from './calendarLayout';

describe('monthGrid', () => {
  test('six full weeks starting on the Monday on or before the 1st', () => {
    const grid = monthGrid(new Date(2026, 9, 15)); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(dayKey(grid[0])).toBe('2026-09-28');
    expect(grid[0].getDay()).toBe(1);
    expect(dayKey(grid[3])).toBe('2026-10-01');
    expect(dayKey(grid[41])).toBe('2026-11-08');
  });

  test('a month starting on a Monday starts on its own first day', () => {
    expect(dayKey(monthGrid(new Date(2026, 5, 10))[0])).toBe('2026-06-01');
  });

  test('Sunday-first grids are available', () => {
    const grid = monthGrid(new Date(2026, 9, 1), 0);
    expect(grid[0].getDay()).toBe(0);
    expect(dayKey(grid[0])).toBe('2026-09-27');
  });

  test('every day is a local midnight, one day apart, across a clock change', () => {
    const grid = monthGrid(new Date(2026, 2, 1));
    grid.forEach((d) => expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]));
    const gaps = grid.slice(1).map((d, i) => Math.round((d - grid[i]) / 86400000));
    expect(new Set(gaps)).toEqual(new Set([1]));
  });
});

describe('weekdayNames', () => {
  test('in grid order', () => {
    expect(weekdayNames()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(weekdayNames(0)[0]).toBe('Sun');
  });
});

describe('month helpers', () => {
  test('move by months from the first of the month, never overflowing (31 Jan + 1 = Feb)', () => {
    expect(dayKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(dayKey(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-01');
    expect(dayKey(startOfMonth(new Date(2026, 9, 22)))).toBe('2026-10-01');
  });
});

describe('groupTasksByDay', () => {
  const tasks = [
    { id: 'a', title: 'Zebra', priority: 'low', status: 'pending', deadline: new Date(2026, 9, 22, 18) },
    { id: 'b', title: 'Alpha', priority: 'critical', status: 'completed', deadline: new Date(2026, 9, 22) },
    { id: 'c', title: 'Mango', priority: 'critical', status: 'pending', deadline: new Date(2026, 9, 22, 9) },
    { id: 'd', title: 'Later', priority: 'medium', status: 'pending', deadline: { toDate: () => new Date(2026, 9, 23) } },
    { id: 'e', title: 'Someday', priority: 'high', status: 'pending', deadline: null },
  ];

  test('groups by local day; open work first, then priority, then title', () => {
    const { byDay, undated } = groupTasksByDay(tasks);
    expect(byDay.get('2026-10-22').map((t) => t.id)).toEqual(['c', 'a', 'b']);
    expect(byDay.get('2026-10-23').map((t) => t.id)).toEqual(['d']);
    expect(undated.map((t) => t.id)).toEqual(['e']);
  });

  test('can group by start date instead', () => {
    const { byDay, undated } = groupTasksByDay([{ id: 'x', startDate: '2026-10-05' }, { id: 'y' }], 'startDate');
    expect([...byDay.keys()]).toEqual(['2026-10-05']);
    expect(undated).toHaveLength(1);
  });
});
