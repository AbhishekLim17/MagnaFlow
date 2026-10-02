import { describe, test, expect } from 'vitest';
import { toDate, formatDate, formatDateShort, formatDateLong, formatRelative, isPastDay } from './format';

const ts = (d) => ({ toDate: () => d });

describe('toDate', () => {
  test('handles Timestamps, Dates, strings and epochs', () => {
    const d = new Date(2026, 9, 6);
    expect(toDate(ts(d))).toEqual(d);
    expect(toDate(d)).toEqual(d);
    expect(toDate(d.getTime())).toEqual(d);
    expect(toDate('2026-10-06T00:00:00')).toEqual(new Date('2026-10-06T00:00:00'));
  });
  test('returns null for empty or invalid input', () => {
    for (const v of [null, undefined, '', 'not a date', NaN]) expect(toDate(v)).toBeNull();
  });
});

describe('formatting', () => {
  const d = new Date(2026, 9, 22, 10, 0);
  test('day-first, never month-first', () => {
    expect(formatDate(d)).toBe('22 Oct 2026');
    expect(formatDateLong(new Date(2026, 9, 6))).toBe('Tuesday, 6 October 2026');
  });
  test('short form drops the current year only', () => {
    expect(formatDateShort(d, '—', new Date(2026, 0, 1))).toBe('22 Oct');
    expect(formatDateShort(d, '—', new Date(2027, 0, 1))).toBe('22 Oct 2026');
  });
  test('missing values fall back instead of printing "Invalid Date"', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined, 'No deadline')).toBe('No deadline');
    expect(formatDateShort('garbage')).toBe('—');
  });
});

describe('formatRelative', () => {
  const now = new Date(2026, 9, 10, 12, 0, 0);
  const ago = (ms) => new Date(now.getTime() - ms);
  test('buckets', () => {
    expect(formatRelative(ago(20_000), now)).toBe('just now');
    expect(formatRelative(ago(5 * 60_000), now)).toBe('5 min ago');
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe('3 h ago');
    expect(formatRelative(ago(2 * 86_400_000), now)).toBe('2 d ago');
    expect(formatRelative(ago(30 * 86_400_000), now)).toBe(formatDate(ago(30 * 86_400_000)));
    expect(formatRelative(null, now)).toBe('');
  });
});

describe('isPastDay', () => {
  const now = new Date(2026, 9, 10, 15, 0);
  test('a deadline is overdue only after its day has ended', () => {
    expect(isPastDay(new Date(2026, 9, 10), now)).toBe(false);
    expect(isPastDay(new Date(2026, 9, 9), now)).toBe(true);
    expect(isPastDay(new Date(2026, 9, 11), now)).toBe(false);
    expect(isPastDay(null, now)).toBe(false);
  });
});
