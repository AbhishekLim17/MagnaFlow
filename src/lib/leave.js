// Leave and public holidays, and what they do to a person's capacity. Pure.
// Holidays: organizations/{org}/holidays/list { days: [{ date, name }] } (org admins).
// Leave: organizations/{org}/leave/{id} { userId, userName, from, to, note } (the person,
// their head or manager, or an org admin records it).

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const isWeekday = (d) => d.getDay() !== 0 && d.getDay() !== 6;

export const MAX_LEAVE_DAYS = 366;

/** Why a leave range cannot be saved, or null. */
export const leaveProblem = (from, to) => {
  if (!DATE.test(String(from)) || !DATE.test(String(to))) return 'Choose the first and last day.';
  if (to < from) return 'The last day cannot be before the first.';
  if ((parse(to) - parse(from)) / 86_400_000 >= MAX_LEAVE_DAYS) return 'One leave can be at most a year long.';
  return null;
};

/** Every day from `from` to `to`, inclusive. */
export const daysBetween = (from, to) => {
  if (leaveProblem(from, to)) return [];
  const out = [];
  for (let d = parse(from); ymd(d) <= to; d.setDate(d.getDate() + 1)) out.push(ymd(d));
  return out;
};

/** Weekdays in a range (what a leave costs in working days). */
export const workingDaysBetween = (from, to, holidays = []) => {
  const closed = new Set(holidays.map((h) => h.date));
  return daysBetween(from, to).filter((day) => isWeekday(parse(day)) && !closed.has(day)).length;
};

/** The days a person is away: the organisation's holidays plus their own leave. */
export const daysOff = (holidays = [], leave = [], uid) => {
  const off = new Set(holidays.map((h) => h.date).filter((d) => DATE.test(d)));
  for (const l of leave) if (l.userId === uid) daysBetween(l.from, l.to).forEach((d) => off.add(d));
  return off;
};

/**
 * Capacity in the week starting on `monday` (a Date): the weekly hours, less a fifth for
 * each weekday off. Weekends do not count either way.
 */
export const weekCapacity = (weekly, monday, off) => {
  let working = 5;
  for (let i = 0; i < 5; i += 1) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    if (off?.has(ymd(d))) working -= 1;
  }
  return Math.round(weekly * (working / 5) * 10) / 10;
};

/** Leave that has not ended by `today` ("YYYY-MM-DD"), soonest first. */
export const upcomingLeave = (leave = [], today) => leave
  .filter((l) => l.to >= today)
  .sort((a, b) => a.from.localeCompare(b.from) || String(a.userName).localeCompare(String(b.userName)));

/** Holidays sorted by date, one per date (a later entry for the same date replaces it). */
export const cleanHolidays = (days = []) => [...new Map(days
  .filter((h) => h && DATE.test(h.date))
  .map((h) => [h.date, { date: h.date, name: String(h.name || '').trim().slice(0, 80) || 'Holiday' }])).values()]
  .sort((a, b) => a.date.localeCompare(b.date))
  .slice(0, 100);
