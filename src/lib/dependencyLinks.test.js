import { describe, test, expect } from 'vitest';
import {
  normalizeLink, linkOf, cleanLinks, describeLink, earliestStart, violates, blocksStatus, blockerAdvice, cascadeSchedule,
} from './dependencyLinks';

const d = (iso) => { const [y, m, day] = iso.split('-').map(Number); return new Date(y, m - 1, day); };
const r = (start, end) => ({ start: d(start), end: d(end) });
const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('links', () => {
  test('anything unknown is finish-to-start with no lag', () => {
    expect(normalizeLink(undefined)).toEqual({ type: 'FS', lag: 0 });
    expect(normalizeLink({ type: 'XX', lag: 'two' })).toEqual({ type: 'FS', lag: 0 });
    expect(normalizeLink({ type: 'SS', lag: 2.7 })).toEqual({ type: 'SS', lag: 2 });
    expect(normalizeLink({ type: 'FF', lag: 9999 }).lag).toBe(365);
    expect(linkOf({ dependencyLinks: { a: { type: 'SS', lag: 1 } } }, 'a')).toEqual({ type: 'SS', lag: 1 });
    expect(linkOf({}, 'a')).toEqual({ type: 'FS', lag: 0 });
  });

  test('only non-default links of listed prerequisites are stored', () => {
    expect(cleanLinks(['a', 'b'], { a: { type: 'FS', lag: 0 }, b: { type: 'SS', lag: 0 }, gone: { type: 'FF' } }))
      .toEqual({ b: { type: 'SS', lag: 0 } });
    expect(cleanLinks([], { a: { type: 'SS' } })).toEqual({});
  });

  test('describeLink', () => {
    expect(describeLink()).toBe('Finish to start');
    expect(describeLink({ type: 'SS', lag: 2 })).toBe('Start to start + 2 days');
    expect(describeLink({ type: 'FF', lag: -1 })).toBe('Finish to finish − 1 day');
  });
});

describe('schedule constraints', () => {
  const pred = r('2026-03-02', '2026-03-06'); // Mon-Fri, inclusive

  test('finish to start: the day after it ends, plus lag', () => {
    expect(key(earliestStart({ type: 'FS' }, pred))).toBe('2026-03-07');
    expect(key(earliestStart({ type: 'FS', lag: 2 }, pred))).toBe('2026-03-09');
    expect(violates({ type: 'FS' }, pred, r('2026-03-06', '2026-03-08'))).toBe(true);
    expect(violates({ type: 'FS' }, pred, r('2026-03-07', '2026-03-08'))).toBe(false);
  });

  test('start to start: once it has started, plus lag', () => {
    expect(violates({ type: 'SS' }, pred, r('2026-03-02', '2026-03-04'))).toBe(false);
    expect(violates({ type: 'SS', lag: 1 }, pred, r('2026-03-02', '2026-03-04'))).toBe(true);
  });

  test('finish to finish: it may start any time but not end before the prerequisite', () => {
    expect(violates({ type: 'FF' }, pred, r('2026-02-20', '2026-03-06'))).toBe(false);
    expect(violates({ type: 'FF' }, pred, r('2026-02-20', '2026-03-05'))).toBe(true);
    expect(key(earliestStart({ type: 'FF' }, pred, 3))).toBe('2026-03-03');
  });
});

describe('what a prerequisite blocks', () => {
  test('finish to start blocks starting until it is done', () => {
    expect(blocksStatus({ type: 'FS' }, 'in-progress', 'in-progress')).toBe(true);
    expect(blocksStatus({ type: 'FS' }, 'completed', 'in-progress')).toBe(false);
    expect(blocksStatus({ type: 'FS' }, 'pending', 'pending')).toBe(false);
  });

  test('start to start only waits for it to start', () => {
    expect(blocksStatus({ type: 'SS' }, 'pending', 'in-progress')).toBe(true);
    expect(blocksStatus({ type: 'SS' }, 'in-progress', 'completed')).toBe(false);
  });

  test('finish to finish only blocks completing', () => {
    expect(blocksStatus({ type: 'FF' }, 'pending', 'in-progress')).toBe(false);
    expect(blocksStatus({ type: 'FF' }, 'in-progress', 'completed')).toBe(true);
    expect(blocksStatus({ type: 'FF' }, 'cancelled', 'completed')).toBe(false);
  });

  test('advice', () => {
    expect(blockerAdvice()).toBe('Finish it first.');
    expect(blockerAdvice({ type: 'SS' })).toBe('Start it first.');
  });
});

describe('cascadeSchedule', () => {
  const rows = [
    { id: 'a', ...r('2026-03-02', '2026-03-04'), blockedBy: [] },
    { id: 'b', ...r('2026-03-05', '2026-03-06'), blockedBy: ['a'] },
    { id: 'c', ...r('2026-03-09', '2026-03-10'), blockedBy: ['b'] },
    { id: 'ss', ...r('2026-03-02', '2026-03-03'), blockedBy: ['a'], dependencyLinks: { a: { type: 'SS' } } },
    { id: 'done', ...r('2026-03-05', '2026-03-05'), blockedBy: ['a'], status: 'completed' },
  ];
  const moved = (list) => Object.fromEntries(list.map((m) => [m.id, `${key(m.start)}..${key(m.end)}`]));

  test('pushes dependents just far enough, keeping their length, down the chain', () => {
    // c already starts after b's new end, so it stays put
    expect(moved(cascadeSchedule(rows, 'a', r('2026-03-04', '2026-03-06')))).toEqual({
      b: '2026-03-07..2026-03-08',
      ss: '2026-03-04..2026-03-05',
    });
  });

  test('a longer push carries on to the next task', () => {
    expect(moved(cascadeSchedule(rows, 'a', r('2026-03-06', '2026-03-08')))).toEqual({
      b: '2026-03-09..2026-03-10',
      c: '2026-03-11..2026-03-12',
      ss: '2026-03-06..2026-03-07',
    });
  });

  test('never pulls dependents earlier, and leaves finished or locked tasks alone', () => {
    expect(cascadeSchedule(rows, 'a', r('2026-02-20', '2026-02-21'))).toEqual([]);
    const locked = cascadeSchedule(rows, 'a', r('2026-03-06', '2026-03-08'), { canMove: (row) => row.id !== 'b' });
    expect(locked.map((m) => m.id)).toEqual(['ss']);
  });

  test('a loop in the data cannot hang it', () => {
    const loop = [
      { id: 'x', ...r('2026-03-02', '2026-03-02'), blockedBy: ['y'] },
      { id: 'y', ...r('2026-03-03', '2026-03-03'), blockedBy: ['x'] },
    ];
    expect(() => cascadeSchedule(loop, 'x', r('2026-03-05', '2026-03-05'))).not.toThrow();
  });
});
