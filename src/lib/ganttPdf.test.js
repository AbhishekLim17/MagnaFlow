import { describe, test, expect } from 'vitest';
import { ganttPdfLayout, drawGanttPdf, PAGE } from './ganttPdf';

const ts = (iso) => ({ toDate: () => new Date(`${iso}T00:00:00`) });
const task = (id, start, end, extra = {}) => ({ id, title: `Task ${id}`, startDate: ts(start), deadline: ts(end), status: 'pending', ...extra });
const today = new Date('2026-03-05T09:00:00');

describe('ganttPdfLayout', () => {
  test('bars run left to right in date order, inside the chart area', () => {
    const { pages, ticks, todayX } = ganttPdfLayout([
      task('b', '2026-03-09', '2026-03-12'),
      task('a', '2026-03-02', '2026-03-06'),
    ], { today });
    expect(pages).toHaveLength(1);
    const [a, b] = pages[0].rows;
    expect([a.id, b.id]).toEqual(['a', 'b']);
    expect(b.bar.x).toBeGreaterThan(a.bar.x + a.bar.w);
    expect(a.bar.x).toBeGreaterThan(PAGE.margin + PAGE.nameW);
    expect(b.bar.x + b.bar.w).toBeLessThan(PAGE.w - PAGE.margin);
    expect(ticks.length).toBeGreaterThan(0);
    expect(todayX).toBeGreaterThan(a.bar.x);
  });

  test('milestones, baselines, critical path and overdue colouring', () => {
    const { pages } = ganttPdfLayout([
      task('a', '2026-03-02', '2026-03-03'),
      task('m', '2026-03-08', '2026-03-08', { milestone: true }),
    ], { today, baseline: { a: { s: '2026-03-01', e: '2026-03-02' } } });
    const [a, m] = pages[0].rows;
    expect(m.isMilestone).toBe(true);
    expect(m.bar.cx).toBeDefined();
    expect(a.planned.x).toBeLessThan(a.bar.x);
    expect(a.color).toEqual([220, 38, 38]); // ended before today, not done: overdue
    expect(m.critical).toBe(true);
  });

  test('dependency lines follow the link type, and clashes are flagged', () => {
    const { pages } = ganttPdfLayout([
      task('a', '2026-03-02', '2026-03-06'),
      task('b', '2026-03-04', '2026-03-10', { blockedBy: ['a'] }),
      task('c', '2026-03-04', '2026-03-10', { blockedBy: ['a'], dependencyLinks: { a: { type: 'SS' } } }),
    ], { today });
    const [fs, ss] = pages[0].links;
    expect(fs.conflict).toBe(true);
    expect(ss.conflict).toBe(false);
    expect(ss.points[1].x).toBeLessThan(ss.points[0].x); // a bracket round the left
  });

  test('a long plan goes over several pages', () => {
    const many = Array.from({ length: 50 }, (_, i) => task(`t${i}`, '2026-03-02', '2026-03-03'));
    const { pages } = ganttPdfLayout(many, { today });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((p) => p.rows)).toHaveLength(50);
  });

  test('nothing with dates, nothing to draw', () => {
    expect(ganttPdfLayout([{ id: 'x', title: 'No dates' }], { today }).pages).toEqual([]);
  });
});

test('drawGanttPdf draws every page without errors', () => {
  const calls = [];
  const doc = new Proxy({}, {
    get: (_t, name) => (name === 'getTextWidth' ? (s) => String(s).length * 1.5 : (...args) => { calls.push([name, ...args]); }),
  });
  const many = Array.from({ length: 30 }, (_, i) => task(`t${i}`, '2026-03-02', '2026-03-03', { blockedBy: i ? [`t${i - 1}`] : [] }));
  many[0].title = 'Migrate every reporting job from the legacy warehouse to the new one';
  drawGanttPdf(doc, ganttPdfLayout(many, { today }), { title: 'Apollo', subtitle: 'Timeline' });
  expect(calls.filter(([n]) => n === 'addPage')).toHaveLength(1);
  expect(calls.some(([n, text]) => n === 'text' && text === 'Page 2 of 2')).toBe(true);
  expect(calls.some(([n, text]) => n === 'text' && String(text).endsWith('…'))).toBe(true); // long titles are cut to fit
});
