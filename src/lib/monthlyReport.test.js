import { describe, expect, it } from 'vitest';
import { monthlyReport, previousMonth, reportRows, reportSummary } from './monthlyReport';

const utc = (s) => new Date(`${s}T00:00:00Z`);

describe('previousMonth', () => {
  it('is the calendar month before today, across a year', () => {
    const m = previousMonth(new Date(2026, 0, 1, 9));
    expect(m.label).toBe('December 2025');
    expect(m.fromDay).toBe('2025-12-01');
    expect(m.toDay).toBe('2025-12-31');
  });
});

describe('monthlyReport', () => {
  const month = previousMonth(new Date(2026, 10, 1, 9)); // October 2026
  const data = {
    people: [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bea' }],
    projects: [{ id: 'p', name: 'Apollo' }],
    tasks: [
      { assignedTo: 'a', projectId: 'p', status: 'completed', createdAt: utc('2026-10-02'), deadline: utc('2026-10-10'), completedAt: new Date(2026, 9, 10, 18) },
      { assignedTo: 'a', projectId: 'p', status: 'completed', createdAt: utc('2026-09-02'), deadline: utc('2026-10-01'), completedAt: new Date(2026, 9, 5) },
      { assignedTo: 'b', status: 'completed', createdAt: utc('2026-10-03'), completedAt: new Date(2026, 9, 6) },
      { assignedTo: 'b', status: 'completed', createdAt: utc('2026-08-01'), completedAt: new Date(2026, 8, 6) }, // September
      { assignedTo: 'b', status: 'pending', createdAt: utc('2026-10-20'), deadline: utc('2026-10-25') },
      { assignedTo: 'b', status: 'cancelled', createdAt: utc('2026-10-20'), deadline: utc('2026-10-01') },
    ],
    entries: [{ minutes: 90 }, { minutes: 60 }],
  };

  it('counts the month', () => {
    const r = monthlyReport(data, month);
    expect(r).toMatchObject({ created: 4, completed: 3, onTimePercent: 50, overdueNow: 1, hoursLogged: '2.5h' });
    expect(r.topPeople).toEqual([{ name: 'Ann', completed: 2 }, { name: 'Bea', completed: 1 }]);
    expect(r.projectRows).toEqual([{ name: 'Apollo', completed: 2 }, { name: 'No project', completed: 1 }]);
  });

  it('writes the email', () => {
    const r = monthlyReport(data, month);
    expect(reportSummary(r, month.label)).toBe('In October 2026 your team finished 3 tasks (50% on time) and started 4. 1 task is overdue now.');
    expect(reportRows(r)[0]).toEqual({ label: 'Tasks finished', value: '3' });
    expect(reportRows(r).find((row) => row.label === 'Most finished').value).toBe('Ann: 2');
  });
});
