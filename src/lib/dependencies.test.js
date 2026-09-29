import { describe, test, expect } from 'vitest';
import { wouldCreateCycle, dependsOn, unfinishedBlockers, isResolved } from './dependencies';

const graph = {
  a: { blockedBy: [] },
  b: { blockedBy: ['a'] },
  c: { blockedBy: ['b'] },
  d: { blockedBy: [] },
};
const load = async (id) => graph[id]?.blockedBy ?? [];

describe('wouldCreateCycle', () => {
  test('a task cannot depend on itself', async () => {
    expect(await wouldCreateCycle('a', ['a'], load)).toBe(true);
  });
  test('direct loop is detected', async () => {
    expect(await wouldCreateCycle('a', ['b'], load)).toBe(true);
  });
  test('transitive loop is detected', async () => {
    expect(await wouldCreateCycle('a', ['c'], load)).toBe(true);
  });
  test('independent and forward dependencies are fine', async () => {
    expect(await wouldCreateCycle('d', ['c'], load)).toBe(false);
    expect(await wouldCreateCycle('c', ['a', 'd'], load)).toBe(false);
    expect(await wouldCreateCycle('a', [], load)).toBe(false);
  });
  test('an existing loop elsewhere in the graph does not hang the walk', async () => {
    const looped = { x: ['y'], y: ['x'] };
    expect(await wouldCreateCycle('z', ['x'], async (id) => looped[id] ?? [])).toBe(false);
  });
});

describe('dependsOn (UI filter)', () => {
  test('excludes tasks that already depend on the target', () => {
    expect(dependsOn('c', 'a', graph)).toBe(true);
    expect(dependsOn('b', 'a', graph)).toBe(true);
    expect(dependsOn('a', 'c', graph)).toBe(false);
    expect(dependsOn('d', 'a', graph)).toBe(false);
    expect(dependsOn('a', 'a', graph)).toBe(true);
  });
});

describe('unfinishedBlockers', () => {
  const tasks = { a: { status: 'completed' }, b: { status: 'in-progress' }, c: { status: 'cancelled' }, d: { status: 'pending' } };
  const lookup = (id) => tasks[id];
  test('only unresolved existing prerequisites block', () => {
    expect(unfinishedBlockers(['a', 'b', 'c', 'd', 'gone'], lookup)).toEqual(['b', 'd']);
    expect(unfinishedBlockers(undefined, lookup)).toEqual([]);
  });
  test('resolved statuses', () => {
    expect(isResolved('completed')).toBe(true);
    expect(isResolved('cancelled')).toBe(true);
    expect(isResolved('review')).toBe(false);
  });
});
