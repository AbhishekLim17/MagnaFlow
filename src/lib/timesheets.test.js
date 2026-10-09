import { describe, expect, it } from 'vitest';
import {
  addDaysTo, changedSinceDecision, invoiceLines, invoiceTotals, moneyText, nextInvoiceNumber,
  sheetId, summarizeWeek, weekDays, weekStart,
} from './timesheets';

describe('weeks', () => {
  it('finds the Monday of any day', () => {
    expect(weekStart('2026-10-09')).toBe('2026-10-05'); // Friday
    expect(weekStart('2026-10-05')).toBe('2026-10-05'); // Monday
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(weekStart('2026-01-01')).toBe('2025-12-29'); // across a year
  });
  it('lists the days and steps across months', () => {
    expect(weekDays('2026-09-28')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(addDaysTo('2026-10-05', -7)).toBe('2026-09-28');
    expect(sheetId('u1', '2026-10-05')).toBe('u1_2026-10-05');
  });
});

describe('summarizeWeek', () => {
  it('adds up each person by day and ignores days outside the week', () => {
    const rows = summarizeWeek([
      { userId: 'b', userName: 'Bea', date: '2026-10-05', minutes: 60 },
      { userId: 'b', userName: 'Bea', date: '2026-10-05', minutes: 30 },
      { userId: 'a', userName: 'Ann', date: '2026-10-11', minutes: 120 },
      { userId: 'a', userName: 'Ann', date: '2026-10-12', minutes: 999 },
    ], '2026-10-05');
    expect(rows.map((r) => [r.userName, r.minutes, r.byDay])).toEqual([
      ['Ann', 120, [0, 0, 0, 0, 0, 0, 120]],
      ['Bea', 90, [90, 0, 0, 0, 0, 0, 0]],
    ]);
    expect(changedSinceDecision(rows[1], { minutes: 90 })).toBe(false);
    expect(changedSinceDecision(rows[1], { minutes: 60 })).toBe(true);
    expect(changedSinceDecision(rows[1], null)).toBe(false);
  });
});

describe('invoices', () => {
  const sheets = [
    { userId: 'a', userName: 'Ann', minutes: 600, status: 'approved' },
    { userId: 'a', userName: 'Ann', minutes: 90, status: 'approved' },
    { userId: 'b', userName: 'Bea', minutes: 300, status: 'rejected' },
  ];
  it('bills approved hours only, per person', () => {
    const lines = invoiceLines(sheets, () => 1000);
    expect(lines).toEqual([{ userId: 'a', description: 'Ann', minutes: 690, hours: 11.5, rate: 1000, amount: 11500 }]);
    expect(invoiceTotals(lines, 18)).toEqual({ subtotal: 11500, tax: 2070, total: 13570 });
    expect(invoiceTotals([], 18)).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
  it('numbers invoices per year', () => {
    expect(nextInvoiceNumber([], 2026)).toBe('INV-2026-0001');
    expect(nextInvoiceNumber(['INV-2026-0007', 'INV-2025-0099', 'junk'], 2026)).toBe('INV-2026-0008');
  });
  it('writes money without a currency symbol', () => {
    expect(moneyText(123456.5, 'INR')).toBe('INR 1,23,456.50');
  });
});
