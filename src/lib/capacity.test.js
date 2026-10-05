import { describe, test, expect } from 'vitest';
import { weekStart, capacityOf, weeklyLoad, unestimatedCount, loadLevel, assignmentWarning, DEFAULT_CAPACITY } from './capacity';

const day = (iso) => ({ toDate: () => new Date(`${iso}T00:00:00`) });
const t = (id, who, hours, start, end, extra = {}) => ({ id, assignedTo: who, estimateHours: hours, startDate: day(start), deadline: day(end), status: 'pending', ...extra });
const today = new Date('2026-10-07T10:00:00'); // a Wednesday; its week starts Mon 5 Oct

test('weeks start on Monday', () => {
  expect(weekStart(today).getDate()).toBe(5);
  expect(weekStart(new Date('2026-10-11T10:00:00')).getDate()).toBe(5); // Sunday
});

test("a person's capacity, else the default", () => {
  expect(capacityOf({ weeklyCapacityHours: 20 })).toBe(20);
  expect(capacityOf({ weeklyCapacityHours: 0 })).toBe(0);
  expect(capacityOf({})).toBe(DEFAULT_CAPACITY);
  expect(capacityOf({ weeklyCapacityHours: '' })).toBe(DEFAULT_CAPACITY);
});

describe('weeklyLoad', () => {
  test('spreads an estimate over its weekdays, week by week', () => {
    // Mon 5 Oct to Fri 16 Oct: 10 weekdays, 40h -> 20h in each week
    const { weeks, load } = weeklyLoad([t('a', 'u1', 40, '2026-10-05', '2026-10-16')], { today, weeks: 3 });
    expect(weeks.map((w) => w.getDate())).toEqual([5, 12, 19]);
    expect(load.get('u1')).toEqual([20, 20, 0]);
  });

  test('weekends are skipped unless the task only spans a weekend', () => {
    // Fri 9 to Mon 12 Oct: 2 weekdays -> 4h each side
    expect(weeklyLoad([t('a', 'u1', 8, '2026-10-09', '2026-10-12')], { today, weeks: 2 }).load.get('u1')).toEqual([4, 4]);
    expect(weeklyLoad([t('a', 'u1', 6, '2026-10-10', '2026-10-11')], { today, weeks: 1 }).load.get('u1')).toEqual([6]);
  });

  test('finished, unassigned and unestimated work does not count', () => {
    const { load } = weeklyLoad([
      t('a', 'u1', 10, '2026-10-05', '2026-10-05', { status: 'completed' }),
      t('b', null, 10, '2026-10-05', '2026-10-05'),
      t('c', 'u1', 0, '2026-10-05', '2026-10-05'),
    ], { today, weeks: 1 });
    expect(load.size).toBe(0);
    expect(unestimatedCount([t('c', 'u1', 0, '2026-10-05', '2026-10-05'), t('d', 'u1', null, '2026-10-05', '2026-10-05')], 'u1')).toBe(2);
  });
});

test('loadLevel', () => {
  expect(loadLevel(41, 40)).toBe('over');
  expect(loadLevel(36, 40)).toBe('near');
  expect(loadLevel(20, 40)).toBe('ok');
  expect(loadLevel(1, 0)).toBe('over');
});

describe('assignmentWarning', () => {
  const sana = { id: 'u1', name: 'Sana', weeklyCapacityHours: 40 };
  const busy = [t('a', 'u1', 30, '2026-10-12', '2026-10-16')];

  test('warns about the first week the assignment would push someone over', () => {
    const draft = { id: 'new', estimateHours: 15, startDate: '2026-10-12', deadline: '2026-10-16' };
    expect(assignmentWarning(busy, draft, sana, { today })).toBe('Sana would have 45h of work in the week of 12 Oct, over their 40h a week.');
  });

  test('says nothing when it fits, or when there is nothing to judge by', () => {
    expect(assignmentWarning(busy, { id: 'new', estimateHours: 5, startDate: '2026-10-12', deadline: '2026-10-16' }, sana, { today })).toBeNull();
    expect(assignmentWarning(busy, { id: 'new', startDate: '2026-10-12', deadline: '2026-10-16' }, sana, { today })).toBeNull();
    expect(assignmentWarning(busy, { id: 'new', estimateHours: 15 }, sana, { today })).toBeNull();
  });

  test('editing a task does not count it twice', () => {
    const editing = { id: 'a', estimateHours: 30, startDate: '2026-10-12', deadline: '2026-10-16' };
    expect(assignmentWarning(busy, editing, sana, { today })).toBeNull();
  });
});
