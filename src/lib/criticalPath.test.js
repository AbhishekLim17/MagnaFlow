import { describe, test, expect } from 'vitest';
import { computeCriticalPath } from './criticalPath';

// A task of `days` days (end exclusive in CPM terms), all starting 1 March.
const t = (id, days, extra = {}) => ({
  id,
  startDate: '2026-03-01T00:00:00Z',
  deadline: new Date(Date.UTC(2026, 2, 1 + days)).toISOString(),
  blockedBy: [],
  ...extra,
});
const ids = (set) => [...set].sort();

describe('computeCriticalPath', () => {
  test('the longest finish-to-start chain is critical; a shorter side task is not', () => {
    expect(ids(computeCriticalPath([t('a', 3), t('b', 2, { blockedBy: ['a'] }), t('c', 2)]))).toEqual(['a', 'b']);
  });

  test('lag lengthens a chain', () => {
    const plain = [t('a', 2), t('b', 2, { blockedBy: ['a'] }), t('c', 6)];
    expect(ids(computeCriticalPath(plain))).toEqual(['c']);
    const lagged = [t('a', 2), t('b', 2, { blockedBy: ['a'], dependencyLinks: { a: { type: 'FS', lag: 3 } } }), t('c', 6)];
    expect(ids(computeCriticalPath(lagged))).toEqual(['a', 'b']);
  });

  test('start to start lets work overlap', () => {
    const ss = (lag) => [t('a', 5), t('b', 2, { blockedBy: ['a'], dependencyLinks: { a: { type: 'SS', lag } } }), t('c', 4)];
    expect(ids(computeCriticalPath(ss(0)))).toEqual(['a']);
    expect(ids(computeCriticalPath(ss(3)))).toEqual(['a', 'b']);
  });

  test('finish to finish ties the ends together', () => {
    const ff = [t('a', 5), t('b', 2, { blockedBy: ['a'], dependencyLinks: { a: { type: 'FF', lag: 1 } } }), t('c', 4)];
    expect(ids(computeCriticalPath(ff))).toEqual(['a', 'b']);
  });

  test('a loop, or nothing at all, has no critical path', () => {
    expect(computeCriticalPath([t('x', 1, { blockedBy: ['y'] }), t('y', 1, { blockedBy: ['x'] })]).size).toBe(0);
    expect(computeCriticalPath([]).size).toBe(0);
  });
});
