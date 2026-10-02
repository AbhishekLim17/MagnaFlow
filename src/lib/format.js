// Date/time display, in one place.
//
// The app used to mix "Oct 22, 2026", "Tuesday, October 6, 2026", "Oct 22" and the
// browser's own dd-mm-yyyy in date inputs. Everything now reads day-first
// ("22 Oct 2026"), which is also how date inputs render for this app's audience.

/** Accepts a Firestore Timestamp, Date, ISO string or epoch ms; returns a Date or null. */
export const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmt = (options) => new Intl.DateTimeFormat('en-GB', options);
const DATE = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const DATE_NO_YEAR = fmt({ day: 'numeric', month: 'short' });
const DATE_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "22 Oct 2026" */
export const formatDate = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? DATE.format(d) : fallback;
};

/** "22 Oct" for the current year, "22 Oct 2025" otherwise. For tight spaces. */
export const formatDateShort = (value, fallback = '—', now = new Date()) => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.getFullYear() === now.getFullYear() ? DATE_NO_YEAR.format(d) : DATE.format(d);
};

/** "Tuesday, 6 October 2026" */
export const formatDateLong = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? DATE_LONG.format(d) : fallback;
};

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a plain date. */
export const formatRelative = (value, now = new Date()) => {
  const d = toDate(value);
  if (!d) return '';
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(d);
};

/** Is this deadline in the past (end of that day counts as still on time)? */
export const isPastDay = (value, now = new Date()) => {
  const d = toDate(value);
  if (!d) return false;
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return endOfDay.getTime() < now.getTime();
};
