import { describe, expect, it } from 'vitest';
import { cleanKeyResults, goalProblem, goalProgress, goalStatus, krProgress, projectsProgress } from './goals';

describe('progress', () => {
  it('measures a key result from its start to its target, either way', () => {
    expect(krProgress({ start: 0, target: 100, current: 25 })).toBe(0.25);
    expect(krProgress({ start: 50, target: 10, current: 30 })).toBe(0.5); // bring a number down
    expect(krProgress({ start: 0, target: 10, current: 15 })).toBe(1);
    expect(krProgress({ start: 5, target: 5, current: 5 })).toBeNull();
  });

  it('averages key results, else uses the linked projects', () => {
    expect(goalProgress({ keyResults: [{ target: 10, current: 10 }, { target: 10, current: 0 }] })).toBe(0.5);
    const tasks = [
      { projectId: 'p', status: 'completed' }, { projectId: 'p', status: 'pending' },
      { projectId: 'p', status: 'cancelled' }, { projectId: 'q', status: 'completed' },
    ];
    expect(projectsProgress(tasks, ['p'])).toBe(0.5);
    expect(goalProgress({ keyResults: [], projectIds: ['p'] }, tasks)).toBe(0.5);
    expect(goalProgress({ keyResults: [], projectIds: [] }, tasks)).toBeNull();
  });
});

describe('status', () => {
  const goal = { startDate: '2026-01-01', dueDate: '2026-12-31' };
  const mid = new Date(2026, 6, 1); // about half way
  it('compares progress with the time gone', () => {
    expect(goalStatus(goal, 0.5, mid)).toBe('on_track');
    expect(goalStatus(goal, 0.35, mid)).toBe('at_risk');
    expect(goalStatus(goal, 0.1, mid)).toBe('off_track');
    expect(goalStatus(goal, 1, mid)).toBe('done');
    expect(goalStatus({ startDate: '2026-01-01' }, 0.5, mid)).toBeNull();
    expect(goalStatus(goal, null, mid)).toBeNull();
  });
});

describe('saving', () => {
  it('checks a goal and cleans its key results', () => {
    expect(goalProblem({ title: 'Grow', keyResults: [{ title: 'Clients', start: 0, target: 20 }] })).toBeNull();
    expect(goalProblem({ title: '' })).toMatch(/title/);
    expect(goalProblem({ title: 'x', keyResults: [{ title: '', target: 1 }] })).toMatch(/name/);
    expect(goalProblem({ title: 'x', keyResults: [{ title: 'a', target: '' }] })).toMatch(/target/);
    expect(goalProblem({ title: 'x', keyResults: [{ title: 'a', start: 3, target: 3 }] })).toMatch(/differ/);
    expect(cleanKeyResults([{ title: ' NPS ', start: '10', target: '40', current: '', unit: ' pts ' }]))
      .toEqual([{ title: 'NPS', start: 10, target: 40, current: 0, unit: 'pts' }]);
  });
});
