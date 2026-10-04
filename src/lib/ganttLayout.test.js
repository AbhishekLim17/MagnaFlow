import { describe, test, expect } from 'vitest';
import { addDays, axisTicks, routeDependency, roundedPath, dependencyKind, shiftRange } from './ganttLayout';

const d = (y, m, day) => new Date(y, m - 1, day);

describe('addDays', () => {
  test('moves by calendar days, across month ends and daylight-saving changes', () => {
    expect(addDays(d(2026, 1, 31), 1)).toEqual(d(2026, 2, 1));
    expect(addDays(d(2026, 3, 28), 2)).toEqual(d(2026, 3, 30)); // EU clocks change on the 29th
    expect(addDays(d(2026, 10, 25), 1)).toEqual(d(2026, 10, 26));
    expect(addDays(new Date(2026, 5, 9, 18, 30), 0)).toEqual(d(2026, 6, 9));
  });
});

describe('axisTicks', () => {
  test('every tick is a day start inside the range, ascending', () => {
    const ticks = axisTicks(d(2026, 9, 14), d(2026, 10, 12));
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    ticks.forEach((t) => {
      expect([t.getHours(), t.getMinutes()]).toEqual([0, 0]);
      expect(t >= d(2026, 9, 14) && t <= d(2026, 10, 12)).toBe(true);
    });
    expect(ticks.map(Number)).toEqual([...ticks.map(Number)].sort((a, b) => a - b));
  });

  test('a month-long range gets weekly ticks that fall on Mondays', () => {
    const ticks = axisTicks(d(2026, 9, 14), d(2026, 10, 12), 6);
    expect(ticks.map((t) => t.getDay())).toEqual(ticks.map(() => 1));
    expect(ticks[0]).toEqual(d(2026, 9, 14)); // a Monday
    expect(ticks.at(-1)).toEqual(d(2026, 10, 12));
  });

  test('a short range gets daily ticks', () => {
    const ticks = axisTicks(d(2026, 10, 1), d(2026, 10, 6));
    expect(ticks).toHaveLength(6);
  });

  test('a long range gets month starts', () => {
    const ticks = axisTicks(d(2026, 1, 10), d(2026, 12, 20), 6);
    expect(ticks.every((t) => t.getDate() === 1)).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(8);
  });

  test('never produces a crowd of ticks, whatever the range', () => {
    for (const days of [3, 10, 20, 45, 90, 200, 400, 900]) {
      expect(axisTicks(d(2026, 1, 1), addDays(d(2026, 1, 1), days)).length).toBeLessThanOrEqual(8);
    }
  });

  test('an empty or reversed range has no ticks', () => {
    expect(axisTicks(d(2026, 1, 1), d(2026, 1, 1))).toEqual([]);
    expect(axisTicks(d(2026, 2, 1), d(2026, 1, 1))).toEqual([]);
  });
});

describe('routeDependency', () => {
  const xs = (route) => route.points.map((p) => p.x);
  const ys = (route) => route.points.map((p) => p.y);

  test('a successor well to the right is reached with one vertical and no backtracking', () => {
    const r = routeDependency({ exitX: 100, exitY: 24, entryX: 200, entryY: 72 });
    expect(r.route).toBe('direct');
    expect(r.points).toEqual([
      { x: 100, y: 24 },
      { x: 110, y: 24 },
      { x: 110, y: 72 },
      { x: 200, y: 72 },
    ]);
    // never travels left, and never passes the successor's left edge
    const x = xs(r);
    expect(x).toEqual([...x].sort((a, b) => a - b));
    expect(Math.max(...x)).toBe(200);
  });

  test('a small gap still leaves room for the arrowhead', () => {
    const r = routeDependency({ exitX: 100, exitY: 24, entryX: 118, entryY: 72 });
    expect(r.route).toBe('direct');
    const [, , bend, end] = r.points;
    expect(end.x - bend.x).toBeGreaterThanOrEqual(12); // 8 for the head, 4 of line
    expect(bend.x).toBeGreaterThan(100);
  });

  test('a successor that starts before the predecessor ends is entered from the left, around its bar', () => {
    const r = routeDependency({ exitX: 300, exitY: 24, entryX: 220, entryY: 72 });
    expect(r.route).toBe('detour');
    const last = r.points.at(-1);
    expect(last).toEqual({ x: 220, y: 72 });
    // the lane is clear of the successor's bar (bar half-height is 10) and of the row's top border (24)
    const laneY = r.points[2].y;
    expect(laneY).toBe(55);
    expect(Math.abs(72 - laneY)).toBeGreaterThan(10);
    expect(Math.abs(72 - laneY)).toBeLessThan(24 - 4);
    // the final run into the bar is horizontal and long enough for the arrowhead
    const beforeLast = r.points.at(-2);
    expect(beforeLast.y).toBe(72);
    expect(last.x - beforeLast.x).toBeGreaterThanOrEqual(12);
    // every segment is horizontal or vertical
    r.points.slice(1).forEach((p, i) => {
      const q = r.points[i];
      expect(p.x === q.x || p.y === q.y).toBe(true);
    });
  });

  test('a successor in a row above is approached from below', () => {
    const r = routeDependency({ exitX: 300, exitY: 120, entryX: 250, entryY: 72 });
    expect(r.route).toBe('detour');
    expect(r.points[2].y).toBe(89); // below the successor's row centre, not above
    expect(r.points.at(-1)).toEqual({ x: 250, y: 72 });
  });

  test('a detour never leaves the chart on the left', () => {
    const r = routeDependency({ exitX: 30, exitY: 24, entryX: 5, entryY: 72 });
    expect(Math.min(...xs(r))).toBeGreaterThanOrEqual(2);
  });

  test('two rows level with each other are joined by a straight line', () => {
    const r = routeDependency({ exitX: 10, exitY: 24, entryX: 90, entryY: 24 });
    expect(r.route).toBe('straight');
    expect(ys(r)).toEqual([24, 24]);
  });
});

describe('roundedPath', () => {
  test('starts at the first point, ends exactly at the last, and curves the corners in between', () => {
    const d1 = roundedPath([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 40 }], 5);
    expect(d1.startsWith('M 0 0')).toBe(true);
    expect(d1.endsWith('L 100 40')).toBe(true);
    expect((d1.match(/Q/g) || []).length).toBe(2);
    expect(d1).toContain('L 45 0 Q 50 0 50 5');
  });

  test('a corner between short segments gets a smaller radius instead of overshooting', () => {
    const p = roundedPath([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 40 }], 5);
    expect(p).toContain('L 3 0 Q 6 0 6 3');
  });

  test('a straight line and degenerate input are fine', () => {
    expect(roundedPath([{ x: 1, y: 2 }, { x: 9, y: 2 }])).toBe('M 1 2 L 9 2');
    expect(roundedPath([])).toBe('');
    expect(roundedPath([{ x: 3, y: 3 }])).toBe('M 3 3');
  });

  test('repeated points do not produce NaN', () => {
    const p = roundedPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(p).not.toContain('NaN');
  });
});

describe('dependencyKind', () => {
  const pred = (over = {}) => ({ start: d(2026, 10, 1), end: d(2026, 10, 5), resolved: false, critical: false, ...over });
  const succ = (over = {}) => ({ start: d(2026, 10, 6), critical: false, ...over });

  test('an ordinary prerequisite that still has to finish', () => {
    expect(dependencyKind(pred(), succ())).toBe('open');
  });

  test('starting before the prerequisite ends is a conflict, and so is starting on its last day', () => {
    expect(dependencyKind(pred(), succ({ start: d(2026, 10, 3) }))).toBe('conflict');
    expect(dependencyKind(pred(), succ({ start: d(2026, 10, 5) }))).toBe('conflict');
  });

  test('starting the day after is fine', () => {
    expect(dependencyKind(pred(), succ({ start: d(2026, 10, 6) }))).toBe('open');
  });

  test('a finished prerequisite cannot conflict; its line just reads as done', () => {
    expect(dependencyKind(pred({ resolved: true }), succ({ start: d(2026, 10, 3) }))).toBe('done');
  });

  test('both ends on the critical path', () => {
    expect(dependencyKind(pred({ critical: true }), succ({ critical: true }))).toBe('critical');
    expect(dependencyKind(pred({ critical: true }), succ({ critical: false }))).toBe('open');
  });

  test('a conflict outranks critical', () => {
    expect(dependencyKind(pred({ critical: true }), succ({ critical: true, start: d(2026, 10, 2) }))).toBe('conflict');
  });
});

describe('shiftRange', () => {
  const range = { start: d(2026, 10, 5), end: d(2026, 10, 9) };

  test('moving shifts both ends by whole days', () => {
    expect(shiftRange(range, 'move', 3)).toEqual({ start: d(2026, 10, 8), end: d(2026, 10, 12) });
    expect(shiftRange(range, 'move', -5)).toEqual({ start: d(2026, 9, 30), end: d(2026, 10, 4) });
  });

  test('dragging an edge changes only that end, and never past the other one', () => {
    expect(shiftRange(range, 'end', 2)).toEqual({ start: d(2026, 10, 5), end: d(2026, 10, 11) });
    expect(shiftRange(range, 'end', -9)).toEqual({ start: d(2026, 10, 5), end: d(2026, 10, 5) });
    expect(shiftRange(range, 'start', -2)).toEqual({ start: d(2026, 10, 3), end: d(2026, 10, 9) });
    expect(shiftRange(range, 'start', 7)).toEqual({ start: d(2026, 10, 9), end: d(2026, 10, 9) });
  });

  test('no movement, or a fraction of a day, changes nothing', () => {
    expect(shiftRange(range, 'move', 0)).toEqual(range);
    expect(shiftRange(range, 'move', 0.6)).toEqual(range);
  });
});
