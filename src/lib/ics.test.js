import { describe, expect, it } from 'vitest';
import { escapeText, icsDay, tasksToIcs } from './ics';

const now = new Date(Date.UTC(2026, 9, 9, 8, 30, 0));

describe('icsDay', () => {
  it('reads the stored day of a deadline', () => {
    expect(icsDay('2026-10-31')).toBe('20261031');
    expect(icsDay(new Date(Date.UTC(2026, 9, 31)))).toBe('20261031');
    expect(icsDay({ toDate: () => new Date(Date.UTC(2026, 11, 31)) })).toBe('20261231');
    expect(icsDay(null)).toBeNull();
  });
});

describe('tasksToIcs', () => {
  it('makes one all-day event per dated task and skips undated ones', () => {
    const text = tasksToIcs([
      { id: 't1', title: 'Launch, v2; final', status: 'in-progress', priority: 'high', deadline: '2026-12-31', milestone: true },
      { id: 't2', title: 'No date' },
    ], { appUrl: 'https://app.example/staff/', now });
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(text).toContain('DTSTART;VALUE=DATE:20261231');
    expect(text).toContain('DTEND;VALUE=DATE:20270101');
    expect(text).toContain('SUMMARY:◆ Launch\\, v2\\; final');
    expect(text).toContain('DTSTAMP:20261009T083000Z');
    expect(text).toContain('URL:https://app.example/staff?task=t1');
    expect(text).not.toContain('No date');
  });

  it('folds long lines', () => {
    const text = tasksToIcs([{ id: 'x', title: 'a'.repeat(200), deadline: '2026-01-01' }], { now });
    for (const line of text.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});

describe('escapeText', () => {
  it('escapes the special characters', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});
