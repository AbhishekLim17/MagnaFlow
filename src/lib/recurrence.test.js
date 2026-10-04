import { describe, test, expect } from 'vitest';
import {
  REPEAT_OPTIONS, optionFromRepeat, repeatFromOption, describeRepeat, addInterval, nextOccurrence,
} from './recurrence';

describe('options', () => {
  test('a form choice becomes a stored repeat anchored on the task dates, and back', () => {
    const r = repeatFromOption('fortnightly', { startDate: '2026-10-05', deadline: '2026-10-09' });
    expect(r).toEqual({ every: 2, unit: 'week', anchorStart: '2026-10-05', anchorDeadline: '2026-10-09' });
    expect(optionFromRepeat(r)).toBe('fortnightly');
    expect(repeatFromOption('none')).toBeNull();
    expect(optionFromRepeat(null)).toBe('none');
    expect(optionFromRepeat({ every: 5, unit: 'day' })).toBe('none');
  });

  test('every option except "none" has a schedule', () => {
    expect(REPEAT_OPTIONS.filter((o) => o.unit).map((o) => o.value)).toEqual(['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly']);
  });

  test('described in words', () => {
    expect(describeRepeat({ every: 1, unit: 'week' })).toBe('every week');
    expect(describeRepeat({ every: 3, unit: 'month' })).toBe('every 3 months');
    expect(describeRepeat(null)).toBe('');
  });
});

describe('addInterval', () => {
  test('days and weeks, across month and year ends', () => {
    expect(addInterval('2026-10-30', { every: 1, unit: 'day' }, 3)).toBe('2026-11-02');
    expect(addInterval('2026-12-28', { every: 1, unit: 'week' })).toBe('2027-01-04');
    expect(addInterval('2026-10-05', { every: 2, unit: 'week' }, 2)).toBe('2026-11-02');
  });

  test('months keep the day of the month, or use the last day when it does not exist', () => {
    const monthly = { every: 1, unit: 'month' };
    expect(addInterval('2026-01-31', monthly, 1)).toBe('2026-02-28');
    expect(addInterval('2026-01-31', monthly, 2)).toBe('2026-03-31');
    expect(addInterval('2028-01-31', monthly, 1)).toBe('2028-02-29');
    expect(addInterval('2026-11-15', { every: 3, unit: 'month' })).toBe('2027-02-15');
  });

  test('bad input gives nothing', () => {
    expect(addInterval('', { every: 1, unit: 'day' })).toBe('');
    expect(addInterval('2026-10-01', null)).toBe('');
  });
});

describe('nextOccurrence', () => {
  const weekly = { every: 1, unit: 'week', anchorStart: '2026-10-05', anchorDeadline: '2026-10-09' };

  test('the next one, both dates moved by one interval', () => {
    expect(nextOccurrence(weekly, 0, '2026-10-08')).toEqual({ occurrence: 1, startDate: '2026-10-12', deadline: '2026-10-16' });
  });

  test('counted from the anchor, so monthly dates do not drift', () => {
    const monthly = { every: 1, unit: 'month', anchorStart: '', anchorDeadline: '2026-01-31' };
    expect(nextOccurrence(monthly, 0, '2026-01-31').deadline).toBe('2026-02-28');
    expect(nextOccurrence(monthly, 1, '2026-02-28').deadline).toBe('2026-03-31');
  });

  test('finished late, the missed occurrences are skipped and the next one is not already overdue', () => {
    const next = nextOccurrence(weekly, 0, '2026-10-31');
    expect(next).toEqual({ occurrence: 4, startDate: '2026-11-02', deadline: '2026-11-06' });
  });

  test('due today still counts as on time', () => {
    expect(nextOccurrence(weekly, 0, '2026-10-16').occurrence).toBe(1);
  });

  test('no start anchor means no start date; no deadline anchor means no schedule', () => {
    expect(nextOccurrence({ every: 1, unit: 'day', anchorDeadline: '2026-10-09' }, 0, '2026-10-09').startDate).toBe('');
    expect(nextOccurrence({ every: 1, unit: 'day', anchorDeadline: '' }, 0, '2026-10-09')).toBeNull();
    expect(nextOccurrence(null, 0, '2026-10-09')).toBeNull();
  });
});
