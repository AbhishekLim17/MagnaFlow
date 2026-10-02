import { describe, test, expect } from 'vitest';
import { isOverdueTask, finishedOnTime, summarizeProject } from './taskState';

const now = new Date(2026, 9, 10, 15, 0);
const day = (d) => new Date(2026, 9, d);

describe('isOverdueTask', () => {
  test('due today is not overdue; yesterday is', () => {
    expect(isOverdueTask({ status: 'pending', deadline: day(10) }, now)).toBe(false);
    expect(isOverdueTask({ status: 'pending', deadline: day(9) }, now)).toBe(true);
  });
  test('finished or undated work is never overdue', () => {
    expect(isOverdueTask({ status: 'completed', deadline: day(1) }, now)).toBe(false);
    expect(isOverdueTask({ status: 'cancelled', deadline: day(1) }, now)).toBe(false);
    expect(isOverdueTask({ status: 'pending' }, now)).toBe(false);
    expect(isOverdueTask(null, now)).toBe(false);
  });
});

describe('finishedOnTime', () => {
  test('finishing on the deadline day, at any hour, is on time', () => {
    expect(finishedOnTime({ deadline: day(10), completedAt: new Date(2026, 9, 10, 17, 30) })).toBe(true);
    expect(finishedOnTime({ deadline: day(10), completedAt: new Date(2026, 9, 11, 0, 5) })).toBe(false);
  });
  test('unknowable without both dates', () => {
    expect(finishedOnTime({ deadline: day(10) })).toBeNull();
    expect(finishedOnTime({ completedAt: day(10) })).toBeNull();
  });
});

describe('summarizeProject', () => {
  const tasks = [
    { status: 'completed' }, { status: 'completed' },
    { status: 'in-progress', deadline: day(5) },
    { status: 'review' },
    { status: 'pending' },
    { status: 'cancelled', deadline: day(1) },
  ];
  test('cancelled work is left out of the total and the percentage', () => {
    const s = summarizeProject(tasks, now);
    expect(s).toMatchObject({ total: 5, completed: 2, inProgress: 1, inReview: 1, overdue: 1, cancelled: 1, percent: 40 });
  });
  test('a project whose live tasks are all done reads 100%', () => {
    expect(summarizeProject([{ status: 'completed' }, { status: 'cancelled' }], now).percent).toBe(100);
  });
  test('an empty project is 0%, not NaN', () => {
    expect(summarizeProject([], now)).toMatchObject({ total: 0, percent: 0 });
    expect(summarizeProject(undefined, now).total).toBe(0);
  });
});
