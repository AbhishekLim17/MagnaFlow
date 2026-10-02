import { describe, test, expect } from 'vitest';
import { describeDeadline } from './taskState';

const now = new Date(2026, 9, 10, 15, 0);
const day = (d) => new Date(2026, 9, d);

describe('describeDeadline', () => {
  test('counts calendar days, not hours', () => {
    expect(describeDeadline({ status: 'pending', deadline: day(10) }, now)).toEqual({ label: 'Due today', tone: 'warning' });
    expect(describeDeadline({ status: 'pending', deadline: day(11) }, now)).toEqual({ label: 'Due tomorrow', tone: 'warning' });
    expect(describeDeadline({ status: 'pending', deadline: day(15) }, now)).toEqual({ label: 'Due in 5 days', tone: 'muted' });
  });
  test('overdue is singular and plural, and danger-toned', () => {
    expect(describeDeadline({ status: 'pending', deadline: day(9) }, now)).toEqual({ label: '1 day overdue', tone: 'danger' });
    expect(describeDeadline({ status: 'in-progress', deadline: day(5) }, now)).toEqual({ label: '5 days overdue', tone: 'danger' });
  });
  test('finished work is never overdue; no deadline says so', () => {
    expect(describeDeadline({ status: 'completed', deadline: day(1) }, now).label).toBe('Finished');
    expect(describeDeadline({ status: 'cancelled', deadline: day(1) }, now).label).toBe('Finished');
    expect(describeDeadline({ status: 'pending' }, now).label).toBe('No deadline');
  });
});
