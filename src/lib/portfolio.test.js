import { describe, test, expect } from 'vitest';
import { projectMetrics, suggestedHealth, projectHealth, sortByHealth, digestLine, digestSummary } from './portfolio';

const now = new Date('2026-10-05T10:00:00');
const due = (iso) => ({ toMillis: () => new Date(`${iso}T00:00:00`).getTime() });
const t = (status, deadline, extra = {}) => ({ status, deadline: deadline ? due(deadline) : null, ...extra });

describe('projectMetrics', () => {
  test('counts progress, overdue and due-this-week work; cancelled work does not count', () => {
    const m = projectMetrics([
      t('completed', '2026-10-01'),
      t('in-progress', '2026-10-03'), // overdue
      t('pending', '2026-10-05'), // due today: not overdue, due this week
      t('pending', '2026-10-20'),
      t('cancelled', '2026-09-01'),
      t('pending', '2026-10-09', { milestone: true, title: 'Beta' }),
    ], now);
    expect(m).toMatchObject({ total: 5, done: 1, open: 4, percent: 20, overdue: 1, dueSoon: 2, overdueMilestones: 0 });
    expect(m.nextMilestone.title).toBe('Beta');
  });

  test('an empty project', () => {
    expect(projectMetrics([], now)).toMatchObject({ total: 0, percent: 0, overdue: 0, nextMilestone: null });
  });
});

describe('health', () => {
  test('suggested from the tasks', () => {
    expect(suggestedHealth({ open: 4, overdue: 0, overdueMilestones: 0 })).toBe('on_track');
    expect(suggestedHealth({ open: 10, overdue: 1, overdueMilestones: 0 })).toBe('at_risk');
    expect(suggestedHealth({ open: 4, overdue: 1, overdueMilestones: 0 })).toBe('off_track');
    expect(suggestedHealth({ open: 10, overdue: 1, overdueMilestones: 1 })).toBe('off_track');
    expect(suggestedHealth({ open: 0, overdue: 0, overdueMilestones: 0 })).toBe('on_track');
  });

  test("the team's latest update wins over the suggestion", () => {
    const m = { open: 4, overdue: 2, overdueMilestones: 0 };
    expect(projectHealth(m, null)).toMatchObject({ key: 'off_track', declared: false });
    expect(projectHealth(m, { health: 'at_risk', summary: 'Vendor late' })).toMatchObject({ key: 'at_risk', label: 'At risk', declared: true });
    expect(projectHealth(m, { health: 'nonsense' })).toMatchObject({ declared: false });
  });

  test('worst first', () => {
    const item = (name, key) => ({ name, health: { key } });
    expect(sortByHealth([item('B', 'on_track'), item('A', 'off_track'), item('C', 'at_risk')]).map((i) => i.name)).toEqual(['A', 'C', 'B']);
  });
});

test('digest wording', () => {
  const items = [
    { metrics: { percent: 62, overdue: 2, dueSoon: 3 }, health: { key: 'at_risk', label: 'At risk', declared: false } },
    { metrics: { percent: 100, overdue: 0, dueSoon: 0 }, health: { key: 'on_track', label: 'On track', declared: true } },
  ];
  expect(digestLine(items[0])).toBe('At risk (suggested) · 62% done · 2 overdue · 3 due this week');
  expect(digestLine(items[1])).toBe('On track · 100% done');
  expect(digestSummary(items)).toBe('2 projects: 1 at risk, 1 on track. 2 tasks overdue.');
});
