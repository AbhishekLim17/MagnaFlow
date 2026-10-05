import { test, expect } from 'vitest';
import { snapshotOf, endVariance, describeVariance } from './baselines';

const ts = (iso) => ({ toDate: () => new Date(`${iso}T00:00:00Z`) });

test('a snapshot keeps each dated task as stored days', () => {
  expect(snapshotOf([
    { id: 'a', startDate: ts('2026-03-02'), deadline: ts('2026-03-06') },
    { id: 'm', deadline: ts('2026-03-10') },
    { id: 'none' },
  ])).toEqual({ a: { s: '2026-03-02', e: '2026-03-06' }, m: { s: '2026-03-10', e: '2026-03-10' } });
});

test('variance is measured at the end, in days', () => {
  const entry = { s: '2026-03-02', e: '2026-03-06' };
  expect(endVariance({ deadline: ts('2026-03-09') }, entry)).toBe(3);
  expect(endVariance({ deadline: ts('2026-03-05') }, entry)).toBe(-1);
  expect(endVariance({ deadline: ts('2026-03-06') }, entry)).toBe(0);
  expect(endVariance({ deadline: ts('2026-03-06') }, undefined)).toBeNull();
});

test('describeVariance', () => {
  expect(describeVariance(3)).toBe('3 days later than the baseline');
  expect(describeVariance(-1)).toBe('1 day earlier than the baseline');
  expect(describeVariance(0)).toBe('on the baseline');
  expect(describeVariance(null)).toBe('not in the baseline');
});
