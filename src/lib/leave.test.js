import { describe, expect, it } from 'vitest';
import {
  cleanHolidays, daysBetween, daysOff, leaveProblem, upcomingLeave, weekCapacity, workingDaysBetween,
} from './leave';

describe('leave ranges', () => {
  it('checks the range', () => {
    expect(leaveProblem('2026-10-05', '2026-10-09')).toBeNull();
    expect(leaveProblem('2026-10-09', '2026-10-05')).toMatch(/before/);
    expect(leaveProblem('', '2026-10-05')).toMatch(/Choose/);
    expect(leaveProblem('2026-01-01', '2027-01-02')).toMatch(/year/);
  });
  it('lists the days and the working days', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(daysBetween('2026-10-02', '2026-10-01')).toEqual([]);
    // Fri 30 Oct .. Mon 2 Nov = 2 weekdays; Mon is a holiday -> 1
    expect(workingDaysBetween('2026-10-30', '2026-11-02', [{ date: '2026-11-02' }])).toBe(1);
  });
});

describe('capacity', () => {
  const holidays = [{ date: '2026-10-02', name: 'Gandhi Jayanti' }];
  const leave = [
    { userId: 'a', from: '2026-10-06', to: '2026-10-07' },
    { userId: 'b', from: '2026-10-05', to: '2026-10-09' },
  ];
  it("collects a person's days off", () => {
    expect([...daysOff(holidays, leave, 'a')].sort()).toEqual(['2026-10-02', '2026-10-06', '2026-10-07']);
  });
  it('takes a fifth of the week off per weekday away', () => {
    const monday = new Date(2026, 9, 5);
    expect(weekCapacity(40, monday, daysOff(holidays, leave, 'a'))).toBe(24);
    expect(weekCapacity(40, monday, daysOff(holidays, leave, 'b'))).toBe(0);
    expect(weekCapacity(40, new Date(2026, 8, 28), daysOff(holidays, [], 'a'))).toBe(32); // Fri 2 Oct holiday
    expect(weekCapacity(40, monday, new Set(['2026-10-10', '2026-10-11']))).toBe(40); // weekend
  });
});

describe('lists', () => {
  it('shows leave that has not ended, soonest first', () => {
    const list = upcomingLeave([
      { userName: 'B', from: '2026-10-20', to: '2026-10-21' },
      { userName: 'A', from: '2026-10-01', to: '2026-10-02' },
      { userName: 'C', from: '2026-10-08', to: '2026-10-12' },
    ], '2026-10-09');
    expect(list.map((l) => l.userName)).toEqual(['C', 'B']);
  });
  it('keeps one holiday per date, sorted, named', () => {
    expect(cleanHolidays([
      { date: '2026-12-25', name: 'Christmas' },
      { date: '2026-10-02', name: '' },
      { date: 'nope', name: 'x' },
      { date: '2026-12-25', name: 'Xmas' },
    ])).toEqual([{ date: '2026-10-02', name: 'Holiday' }, { date: '2026-12-25', name: 'Xmas' }]);
  });
});
