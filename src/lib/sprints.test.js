import { describe, expect, it } from 'vitest';
import { burndown, parsePoints, sortSprints, sprintProblem, sprintTotals, velocity } from './sprints';

describe('sprints', () => {
  it('reads story points', () => {
    expect(parsePoints('5')).toBe(5);
    expect(parsePoints('2.6')).toBe(3);
    expect(parsePoints('')).toBeNull();
    expect(parsePoints('-1')).toBeNull();
    expect(parsePoints('500')).toBe(100);
  });

  it('checks a sprint', () => {
    expect(sprintProblem({ name: 'Sprint 1', startDate: '2026-10-05', endDate: '2026-10-16' })).toBeNull();
    expect(sprintProblem({ name: '', startDate: '2026-10-05', endDate: '2026-10-16' })).toMatch(/Name/);
    expect(sprintProblem({ name: 'x', startDate: '2026-10-16', endDate: '2026-10-05' })).toMatch(/before/);
    expect(sprintProblem({ name: 'x', startDate: '2026-01-01', endDate: '2026-06-01' })).toMatch(/two months/);
  });

  it('orders active, planned, then closed', () => {
    const order = sortSprints([
      { id: 'c1', status: 'closed', endDate: '2026-09-01' },
      { id: 'p2', status: 'planned', startDate: '2026-11-01' },
      { id: 'a', status: 'active', startDate: '2026-10-05' },
      { id: 'c2', status: 'closed', endDate: '2026-09-20' },
      { id: 'p1', status: 'planned', startDate: '2026-10-20' },
    ]).map((s) => s.id);
    expect(order).toEqual(['a', 'p1', 'p2', 'c2', 'c1']);
  });

  it('totals points, leaving cancelled tasks out', () => {
    expect(sprintTotals([
      { storyPoints: 5, status: 'completed' }, { storyPoints: 3, status: 'pending' },
      { status: 'pending' }, { storyPoints: 8, status: 'cancelled' },
    ])).toEqual({ total: 8, done: 5, left: 3, tasks: 3, unsized: 1 });
  });

  it('burns down day by day, up to today', () => {
    const sprint = { startDate: '2026-10-05', endDate: '2026-10-09' };
    const tasks = [
      { storyPoints: 4, status: 'completed', completedAt: new Date(2026, 9, 6, 15) },
      { storyPoints: 4, status: 'pending' },
    ];
    const chart = burndown(sprint, tasks, new Date(2026, 9, 7, 10));
    expect(chart.map((d) => d.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
    expect(chart.map((d) => d.ideal)).toEqual([8, 6, 4, 2, 0]);
    expect(chart.map((d) => d.left)).toEqual([8, 4, 4, null, null]);
  });

  it('works out velocity from closed sprints', () => {
    expect(velocity([
      { status: 'closed', endDate: '2026-09-01', completedPoints: 10 },
      { status: 'closed', endDate: '2026-09-15', completedPoints: 20 },
      { status: 'active' },
    ])).toBe(15);
    expect(velocity([{ status: 'active' }])).toBeNull();
  });
});
