import { describe, test, expect } from 'vitest';
import {
  filterAndSortTasks, activeFilterCount, filtersFromParams, writeFilters, DEFAULT_FILTERS,
} from './taskFilters';

const now = new Date(2026, 9, 10, 12, 0);
const mk = (id, extra) => ({ id, title: `Task ${id}`, status: 'pending', priority: 'medium', createdAt: new Date(2026, 8, Number(id) || 1), ...extra });

const tasks = [
  mk('1', { title: 'Write spec', assignedTo: 'sana', priority: 'high', deadline: new Date(2026, 9, 20), projectId: 'p1' }),
  mk('2', { title: 'Fix login', assignedTo: 'vik', priority: 'critical', deadline: new Date(2026, 9, 5), projectId: 'p1' }),
  mk('3', { title: 'Plan offsite', priority: 'low', description: 'book the venue', projectId: 'p2' }),
  mk('4', { title: 'Ship it', assignedTo: 'sana', status: 'completed', deadline: new Date(2026, 9, 1) }),
  mk('5', { title: 'Old idea', assignedTo: 'vik', status: 'cancelled' }),
];
const names = { sana: 'Sana Staff', vik: 'Vikram Iyer' };
const ctx = { me: 'sana', getName: (id) => names[id] };
const ids = (filters) => filterAndSortTasks(tasks, filters, ctx, now).map((t) => t.id);

describe('filtering', () => {
  test('no filters: everything, newest first', () => {
    expect(ids({})).toEqual(['5', '4', '3', '2', '1']);
  });
  test('overdue means the deadline day has ended and the work is not finished', () => {
    expect(ids({ status: 'overdue' })).toEqual(['2']);
  });
  test('open excludes completed and cancelled', () => {
    expect(ids({ status: 'open' })).toEqual(['3', '2', '1']);
  });
  test('by exact status, priority, project', () => {
    expect(ids({ status: 'cancelled' })).toEqual(['5']);
    expect(ids({ priority: 'critical' })).toEqual(['2']);
    expect(ids({ project: 'p1' })).toEqual(['2', '1']);
    expect(ids({ project: 'none' })).toEqual(['5', '4']);
  });
  test('by assignee: a person, me, or nobody', () => {
    expect(ids({ assignee: 'vik' })).toEqual(['5', '2']);
    expect(ids({ assignee: 'me' })).toEqual(['4', '1']);
    expect(ids({ assignee: 'unassigned' })).toEqual(['3']);
  });
  test('search covers title, description and the assignee name', () => {
    expect(ids({ q: 'login' })).toEqual(['2']);
    expect(ids({ q: 'venue' })).toEqual(['3']);
    expect(ids({ q: 'vikram' })).toEqual(['5', '2']);
    expect(ids({ q: '  SANA ' })).toEqual(['4', '1']);
  });
  test('filters combine', () => {
    expect(ids({ assignee: 'sana', status: 'open' })).toEqual(['1']);
  });
});

describe('sorting', () => {
  test('by deadline, soonest first, undated last', () => {
    expect(ids({ sort: 'deadline' }).slice(0, 3)).toEqual(['4', '2', '1']);
    expect(ids({ sort: 'deadline' }).slice(3).sort()).toEqual(['3', '5']);
  });
  test('by priority, highest first', () => {
    const order = ids({ sort: 'priority' });
    expect(order[0]).toBe('2'); // critical
    expect(order[1]).toBe('1'); // high
    expect(order.at(-1)).toBe('3'); // low
  });
  test('by title', () => {
    expect(ids({ sort: 'title' })).toEqual(['2', '5', '3', '4', '1']);
  });
  test('does not mutate the input', () => {
    const before = tasks.map((t) => t.id).join();
    filterAndSortTasks(tasks, { sort: 'title' }, ctx, now);
    expect(tasks.map((t) => t.id).join()).toBe(before);
  });
});

describe('URL round trip', () => {
  test('only non-default filters are written', () => {
    const params = writeFilters(new URLSearchParams('task=abc'), { ...DEFAULT_FILTERS, q: 'login', status: 'overdue' });
    expect(params.get('q')).toBe('login');
    expect(params.get('status')).toBe('overdue');
    expect(params.has('priority')).toBe(false);
    expect(params.get('task')).toBe('abc'); // unrelated parameters survive
  });
  test('clearing a filter removes it', () => {
    const params = writeFilters(new URLSearchParams('q=login&status=overdue'), { ...DEFAULT_FILTERS, q: '' });
    expect(params.has('q')).toBe(false);
    expect(params.has('status')).toBe(false);
  });
  test('reading falls back to defaults and ignores an unknown sort', () => {
    expect(filtersFromParams(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS);
    expect(filtersFromParams(new URLSearchParams('sort=bogus&assignee=me')).sort).toBe('newest');
    expect(filtersFromParams(new URLSearchParams('assignee=me')).assignee).toBe('me');
  });
  test('counts the filters that are narrowing the list, not the sort', () => {
    expect(activeFilterCount({ sort: 'title' })).toBe(0);
    expect(activeFilterCount({ q: 'x', status: 'open', sort: 'title' })).toBe(2);
  });
});
