// Tasks to and from CSV.
//
// The export uses exactly the columns the import reads, so a list can be exported, edited
// in a spreadsheet and brought back in. The import is forgiving about how a sheet names its
// columns (it also reads files exported from other tools: "Due date", "Owner", "Name"...),
// strict about what a value means, and reports every problem with its line number instead
// of importing half a file.
import { parseCsv } from './csv';
import { toDate } from './format';

export const MAX_IMPORT_ROWS = 500;

// Column keys, the header written on export, and the other names accepted on import.
export const TASK_COLUMNS = [
  { key: 'title', header: 'Title', aliases: ['task', 'task name', 'name', 'summary', 'subject'] },
  { key: 'description', header: 'Description', aliases: ['details', 'notes', 'description / notes'] },
  { key: 'status', header: 'Status', aliases: ['state', 'section', 'stage'] },
  { key: 'priority', header: 'Priority', aliases: ['importance'] },
  { key: 'assignee', header: 'Assignee', aliases: ['assigned to', 'owner', 'assignee name', 'responsible'] },
  { key: 'assigneeEmail', header: 'Assignee email', aliases: ['email', 'owner email', 'assigned to email'] },
  { key: 'startDate', header: 'Start date', aliases: ['start', 'start on', 'begin', 'begins'] },
  { key: 'deadline', header: 'Deadline', aliases: ['due date', 'due', 'due on', 'end date', 'end', 'finish'] },
  { key: 'project', header: 'Project', aliases: ['project name'] },
];

// Export-only columns (ignored on import).
const EXPORT_ONLY = ['Department', 'Waiting on', 'Created', 'Completed', 'Task ID'];

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_]+/g, ' ');

/**
 * Which column of the file holds which field.
 * @param {string[]} headerRow
 * @returns {{ map: Object<string, number>, unknown: string[] }}
 */
export const mapColumns = (headerRow) => {
  const map = {};
  const unknown = [];
  (headerRow || []).forEach((raw, index) => {
    const h = norm(raw);
    if (!h) return;
    const col = TASK_COLUMNS.find((c) => norm(c.header) === h || c.aliases.includes(h));
    if (col && map[col.key] === undefined) map[col.key] = index;
    else if (!col && !EXPORT_ONLY.some((e) => norm(e) === h)) unknown.push(String(raw).trim());
  });
  return { map, unknown };
};

const STATUS_WORDS = {
  pending: ['pending', 'todo', 'to do', 'to-do', 'not started', 'open', 'new', 'backlog'],
  'in-progress': ['in progress', 'in-progress', 'doing', 'started', 'wip', 'working on it', 'active'],
  review: ['review', 'in review', 'in-review', 'reviewing', 'awaiting review'],
  completed: ['completed', 'complete', 'done', 'finished', 'closed', 'resolved'],
  cancelled: ['cancelled', 'canceled', 'dropped', "won't do", 'wont do'],
};
const PRIORITY_WORDS = {
  low: ['low', 'minor', 'p4', 'p3'],
  medium: ['medium', 'normal', 'moderate', 'p2'],
  high: ['high', 'major', 'important', 'p1'],
  critical: ['critical', 'urgent', 'highest', 'blocker', 'p0'],
};
const lookupWord = (table, value) => {
  const v = norm(value);
  return Object.keys(table).find((k) => table[k].includes(v)) || null;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');
const validDay = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const fullYear = (y) => (y < 100 ? 2000 + y : y);

/**
 * A spreadsheet date as "YYYY-MM-DD" (the form the task dialogs use), or null if it is not
 * a real date. ISO dates and month names are always understood; for 03/04/2026 the sheet's
 * order has to be stated, because 3 April and 4 March are both real.
 *
 * @param {string} value
 * @param {'dmy'|'mdy'} [order] how to read numeric day/month dates (default day first)
 */
export const parseDay = (value, order = 'dmy') => {
  const s = String(value ?? '').trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validDay(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), fullYear(Number(m[3]))];
    const [d, mo] = order === 'mdy' ? [b, a] : [a, b];
    return validDay(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // "22 Oct 2026", "22-Oct-26", "October 22, 2026", "Oct 22 2026"
  m = /^(\d{1,2})[\s-]+([a-z]+)\.?[\s,-]+(\d{2}|\d{4})$/i.exec(s);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const [d, y] = [Number(m[1]), fullYear(Number(m[3]))];
    return mo > 0 && validDay(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/i.exec(s);
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const [d, y] = [Number(m[2]), fullYear(Number(m[3]))];
    return mo > 0 && validDay(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // An Excel date serial (days since 30 Dec 1899) - what a date cell becomes when a sheet
  // is saved without formatting. Only plausible values (1982..2173) are accepted.
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    if (serial >= 30000 && serial <= 100000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    }
  }
  return null;
};

const findPerson = (people, { email, name }) => {
  const e = norm(email);
  if (e) {
    const byEmail = people.find((p) => norm(p.email) === e);
    return byEmail ? { person: byEmail } : { error: `No one in your team has the email “${email}”.` };
  }
  const n = norm(name);
  if (!n) return { person: null };
  const matches = people.filter((p) => norm(p.name) === n || norm(p.email) === n);
  if (matches.length === 1) return { person: matches[0] };
  if (matches.length > 1) return { error: `More than one person is called “${name}”. Add an Assignee email column.` };
  return { error: `No one in your team is called “${name}”.` };
};

/**
 * Read a CSV of tasks and check every row.
 *
 * @param {string} text
 * @param {Object} ctx
 * @param {{id:string,name?:string,email?:string}[]} ctx.people   who tasks may be assigned to
 * @param {{id:string,name:string,departmentId?:string}[]} ctx.projects  projects the caller may add to
 * @param {'dmy'|'mdy'} [ctx.dateOrder]
 * @param {string} [ctx.defaultProjectId]  used when a row names no project
 * @returns {{ error?: string, columns: Object, unknownColumns: string[], rows: {line:number, task?:Object, errors:string[], warnings:string[]}[] }}
 */
export const parseTaskImport = (text, ctx = {}) => {
  const people = ctx.people || [];
  const projects = ctx.projects || [];
  const order = ctx.dateOrder || 'dmy';
  const all = parseCsv(text);
  if (all.length === 0) return { error: 'The file is empty.', columns: {}, unknownColumns: [], rows: [] };

  const { map, unknown } = mapColumns(all[0]);
  if (map.title === undefined) {
    return {
      error: 'There is no Title column. The first row must hold column names, one of them “Title”.',
      columns: map,
      unknownColumns: unknown,
      rows: [],
    };
  }
  const body = all.slice(1);
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      error: `This file has ${body.length} tasks. Import at most ${MAX_IMPORT_ROWS} at a time; split the file and import it in parts.`,
      columns: map,
      unknownColumns: unknown,
      rows: [],
    };
  }

  const cell = (row, key) => (map[key] === undefined ? '' : String(row[map[key]] ?? '').trim());

  const rows = body.map((row, i) => {
    const line = i + 2; // the header is line 1
    const errors = [];
    const warnings = [];
    const title = cell(row, 'title');
    if (!title) errors.push('Title is empty.');
    else if (title.length > 200) errors.push('Title is longer than 200 characters.');

    let status = 'pending';
    const statusText = cell(row, 'status');
    if (statusText) {
      status = lookupWord(STATUS_WORDS, statusText);
      if (!status) errors.push(`Status “${statusText}” is not one of: Pending, In progress, Review, Completed, Cancelled.`);
    }

    let priority = 'medium';
    const priorityText = cell(row, 'priority');
    if (priorityText) {
      priority = lookupWord(PRIORITY_WORDS, priorityText);
      if (!priority) errors.push(`Priority “${priorityText}” is not one of: Low, Medium, High, Critical.`);
    }

    const { person, error: personError } = findPerson(people, {
      email: cell(row, 'assigneeEmail'),
      name: cell(row, 'assignee'),
    });
    if (personError) errors.push(personError);
    else if (!person) warnings.push('No assignee: the task will be unassigned.');

    const dates = {};
    for (const key of ['startDate', 'deadline']) {
      const raw = cell(row, key);
      if (!raw) continue;
      const day = parseDay(raw, order);
      if (!day) errors.push(`${key === 'deadline' ? 'Deadline' : 'Start date'} “${raw}” is not a date I can read.`);
      else dates[key] = day;
    }
    if (dates.startDate && dates.deadline && dates.deadline < dates.startDate) {
      errors.push('The deadline is before the start date.');
    }

    let project = null;
    const projectText = cell(row, 'project');
    if (projectText) {
      project = projects.find((p) => norm(p.name) === norm(projectText)) || null;
      if (!project) errors.push(`Project “${projectText}” does not exist, or you cannot add tasks to it.`);
    } else if (ctx.defaultProjectId) {
      project = projects.find((p) => p.id === ctx.defaultProjectId) || null;
    }

    if (errors.length) return { line, errors, warnings };
    return {
      line,
      errors,
      warnings,
      task: {
        title,
        description: cell(row, 'description'),
        status,
        priority,
        assignedTo: person ? person.id : '',
        startDate: dates.startDate || '',
        deadline: dates.deadline || '',
        ...(project && { projectId: project.id, departmentId: project.departmentId || undefined }),
      },
    };
  });

  return { columns: map, unknownColumns: unknown, rows };
};

// Dates are stored as midnight UTC of the chosen day (see CLAUDE.md, "Known limitation"),
// so the UTC date is the day the person picked. Export it that way to round-trip.
const storedDay = (value) => {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : '';
};

const STATUS_TEXT = { pending: 'Pending', 'in-progress': 'In progress', review: 'Review', completed: 'Completed', cancelled: 'Cancelled' };
const PRIORITY_TEXT = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

/**
 * Tasks as spreadsheet rows (header first), in the columns the import reads, plus a few
 * read-only ones that make the sheet useful on its own.
 *
 * @param {Object[]} tasks
 * @param {Object} lookups
 * @param {(uid:string)=>({name?:string,email?:string}|undefined)} [lookups.person]
 * @param {(id:string)=>string|undefined} [lookups.projectName]
 * @param {(id:string)=>string|undefined} [lookups.departmentName]
 */
export const tasksToRows = (tasks, lookups = {}) => {
  const byId = new Map((tasks || []).map((t) => [t.id, t]));
  const header = [...TASK_COLUMNS.map((c) => c.header), ...EXPORT_ONLY];
  const rows = (tasks || []).map((t) => {
    const person = t.assignedTo ? lookups.person?.(t.assignedTo) : undefined;
    const waitingOn = (Array.isArray(t.blockedBy) ? t.blockedBy : [])
      .map((id) => byId.get(id)?.title)
      .filter(Boolean)
      .join('; ');
    return [
      t.title || '',
      t.description || '',
      STATUS_TEXT[t.status] || t.status || '',
      PRIORITY_TEXT[t.priority] || t.priority || '',
      person?.name || '',
      person?.email || '',
      storedDay(t.startDate),
      storedDay(t.deadline),
      (t.projectId && lookups.projectName?.(t.projectId)) || '',
      (t.departmentId && lookups.departmentName?.(t.departmentId)) || '',
      waitingOn,
      storedDay(t.createdAt),
      storedDay(t.completedAt),
      t.id || '',
    ];
  });
  return [header, ...rows];
};

/** A small file showing the expected columns, offered from the import dialog. */
export const sampleImportRows = () => [
  TASK_COLUMNS.map((c) => c.header),
  ['Draft the launch plan', 'One page: goals, owners, dates', 'Pending', 'High', '', 'someone@yourcompany.com', '06/10/2026', '10/10/2026', ''],
  ['Book the venue', '', 'In progress', 'Medium', 'Asha Rao', '', '2026-10-07', '2026-10-09', ''],
];
