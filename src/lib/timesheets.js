// Weekly timesheets and client invoices, from logged time (time_entries). Pure.
//
// A timesheet is one person's logged time on one project for one week (Monday to Sunday).
// Whoever runs the project approves or rejects it (projects/{id}/timesheets/{uid}_{monday});
// an invoice bills the APPROVED weeks of a period at an hourly bill rate.

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The Monday of the week a "YYYY-MM-DD" day falls in. */
export const weekStart = (day) => {
  const d = parse(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
};

/** "YYYY-MM-DD" plus n days. */
export const addDaysTo = (day, n) => {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** The seven days of the week starting on `monday`. */
export const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDaysTo(monday, i));

export const sheetId = (userId, monday) => `${userId}_${monday}`;

/**
 * One row per person for the week: minutes per day and in total, and their entries.
 * @param {Object[]} entries time entries of the project in that week
 * @param {string} monday
 */
export const summarizeWeek = (entries, monday) => {
  const days = weekDays(monday);
  const people = new Map();
  for (const e of entries || []) {
    const i = days.indexOf(e.date);
    if (i < 0) continue;
    const p = people.get(e.userId) || { userId: e.userId, userName: e.userName || 'Someone', byDay: Array(7).fill(0), minutes: 0, entries: [] };
    p.byDay[i] += Number(e.minutes) || 0;
    p.minutes += Number(e.minutes) || 0;
    p.entries.push(e);
    people.set(e.userId, p);
  }
  return [...people.values()].sort((a, b) => a.userName.localeCompare(b.userName));
};

/** Has the week changed since it was approved? (more or less time logged than was signed off) */
export const changedSinceDecision = (row, sheet) => Boolean(sheet) && sheet.minutes !== row.minutes;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Invoice lines from approved timesheets: one per person, their approved hours at the rate.
 * @param {Object[]} sheets approved timesheets in the period ({ userId, userName, minutes })
 * @param {(userId: string) => number} rateOf hourly bill rate
 */
export const invoiceLines = (sheets, rateOf) => {
  const people = new Map();
  for (const s of sheets || []) {
    if (s.status !== 'approved') continue;
    const p = people.get(s.userId) || { userId: s.userId, description: s.userName || 'Someone', minutes: 0 };
    p.minutes += Number(s.minutes) || 0;
    people.set(s.userId, p);
  }
  return [...people.values()].map((p) => {
    const hours = round2(p.minutes / 60);
    const rate = Math.max(0, Number(rateOf(p.userId)) || 0);
    return { ...p, hours, rate, amount: round2(hours * rate) };
  });
};

/** Subtotal, tax and total; tax as a percentage (18 = 18%). */
export const invoiceTotals = (lines, taxPercent = 0) => {
  const subtotal = round2((lines || []).reduce((n, l) => n + (Number(l.amount) || 0), 0));
  const tax = round2(subtotal * (Math.max(0, Number(taxPercent) || 0) / 100));
  return { subtotal, tax, total: round2(subtotal + tax) };
};

/** The next number in the "INV-2026-0007" sequence for this year. */
export const nextInvoiceNumber = (existing = [], year = new Date().getFullYear()) => {
  const prefix = `INV-${year}-`;
  const last = existing
    .filter((n) => typeof n === 'string' && n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(last + 1).padStart(4, '0')}`;
};

/** Money as plain text for a PDF (the built-in PDF fonts have no ₹ sign). */
export const moneyText = (amount, currency = 'INR') =>
  `${currency} ${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
