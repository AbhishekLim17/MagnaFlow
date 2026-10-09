// Tasks as an iCalendar file (.ics): one all-day event per deadline, which Google
// Calendar, Outlook and Apple Calendar import. A download, not a live feed (a feed needs
// a server; this app has none on the free plan).
import { toDate } from './format';
import { priorityLabel, statusLabel } from './taskLabels';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The stored day of a deadline as YYYYMMDD (deadlines are kept as midnight UTC). */
export const icsDay = (value) => {
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim().replace(/-/g, '');
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10).replace(/-/g, '') : null;
};

const nextDay = (yyyymmdd) => {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};

/** RFC 5545 text: backslash, semicolon, comma and newlines escaped. */
export const escapeText = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 characters continue on the next line after a space. */
const fold = (line) => {
  const out = [];
  for (let i = 0; i < line.length; i += 74) out.push((i ? ' ' : '') + line.slice(i, i + 74));
  return out.join('\r\n');
};

const stamp = (now) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * @param {Object[]} tasks
 * @param {{ appUrl?: string, now?: Date }} [options] appUrl: links each event back to its task
 * @returns {string} the file's text (tasks without a deadline are left out)
 */
export const tasksToIcs = (tasks = [], { appUrl = '', now = new Date() } = {}) => {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MagnaFlow//Tasks//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const task of tasks) {
    const day = icsDay(task.deadline);
    if (!day) continue;
    const link = appUrl ? `${appUrl.replace(/\/$/, '')}?task=${encodeURIComponent(task.id)}` : '';
    const about = [`Status: ${statusLabel(task.status)}`, `Priority: ${priorityLabel(task.priority)}`, task.description, link]
      .filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@magnaflow`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${nextDay(day)}`,
      `SUMMARY:${escapeText(`${task.milestone ? '◆ ' : ''}${task.title || 'Task'}`)}`,
      `DESCRIPTION:${escapeText(about)}`,
      ...(link ? [`URL:${link}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
};
