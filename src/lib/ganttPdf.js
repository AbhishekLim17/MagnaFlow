// The project timeline as a PDF to send to a client or print: A4 landscape, vector shapes,
// the same rules as the on-screen chart (lib/ganttLayout, dependencyLinks, criticalPath).
// ganttPdfLayout is pure (and tested); downloadGanttPdf draws it with jsPDF.

import { addDays, axisTicks, routeLink, startOfDay, taskRange } from './ganttLayout';
import { computeCriticalPath } from './criticalPath';
import { linkOf, violates } from './dependencyLinks';
import { isResolved } from './dependencies';
import { formatDate, formatDayMonth, toDate } from './format';

// Page geometry in millimetres (A4 landscape).
export const PAGE = { w: 297, h: 210, margin: 10, nameW: 70, top: 34, rowH: 7, bottom: 16 };
// Lines are routed in the on-screen chart's units, where a row is 48px, so a PDF line has the
// same shape as the one on screen; this turns those units back into millimetres.
const PX = PAGE.rowH / 48;

export const COLORS = {
  completed: [22, 163, 74],
  'in-progress': [79, 70, 229],
  review: [217, 119, 6],
  pending: [100, 116, 139],
  overdue: [220, 38, 38],
  cancelled: [148, 163, 184],
  critical: [245, 158, 11],
  criticalText: [180, 83, 9], // darker amber: readable as text on white
  baseline: [148, 163, 184],
  grid: [226, 232, 240],
  line: [100, 116, 139],
  conflict: [220, 38, 38],
  text: [15, 23, 42],
  muted: [100, 116, 139],
};

/**
 * Pages of rows, ready to draw.
 * @param {Object[]} tasks
 * @param {{ today?: Date, baseline?: Object|null }} [options]
 */
export const ganttPdfLayout = (tasks, { today = new Date(), baseline = null } = {}) => {
  const day = startOfDay(today);
  const critical = computeCriticalPath(tasks);
  const rows = (tasks || [])
    .map((t) => {
      const range = taskRange(t);
      if (!range) return null;
      const entry = baseline?.[t.id];
      const status = t.status || 'pending';
      const overdue = status !== 'completed' && status !== 'cancelled' && range.end < day;
      return {
        id: t.id,
        task: t,
        title: t.title || 'Untitled task',
        ...range,
        color: COLORS[overdue ? 'overdue' : status] || COLORS.pending,
        critical: critical.has(t.id),
        resolved: isResolved(status),
        planned: entry ? { start: startOfDay(toDate(entry.s)), end: startOfDay(toDate(entry.e)) } : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  if (rows.length === 0) return { pages: [], ticks: [], todayX: null };

  let first = rows[0].start;
  let last = rows[0].end;
  for (const r of rows) {
    for (const x of r.planned ? [r, r.planned] : [r]) {
      if (x.start < first) first = x.start;
      if (x.end > last) last = x.end;
    }
  }
  const min = addDays(first, -1);
  const max = addDays(last, 2);
  const x0 = PAGE.margin + PAGE.nameW + 2;
  const width = PAGE.w - PAGE.margin - x0;
  const X = (d) => x0 + ((d.getTime() - min.getTime()) / (max.getTime() - min.getTime())) * width;
  const halfDay = (X(addDays(min, 1)) - X(min)) / 2;

  const perPage = Math.floor((PAGE.h - PAGE.top - PAGE.bottom) / PAGE.rowH);
  const pages = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));

  const placed = pages.map((pageRows) => {
    const at = new Map();
    const out = pageRows.map((r, i) => {
      const y = PAGE.top + i * PAGE.rowH;
      const left = X(r.start);
      const right = r.isMilestone ? left + 2 * halfDay : Math.max(X(addDays(r.end, 1)), left + 0.8);
      const bar = r.isMilestone
        ? { cx: left + halfDay, cy: y + PAGE.rowH / 2, size: 1.8, left: left + halfDay - 1.8, right: left + halfDay + 1.8 }
        : { x: left, y: y + 1.8, w: right - left, h: PAGE.rowH - 3.6, left, right };
      const planned = r.planned
        ? { x: X(r.planned.start), y: y + PAGE.rowH - 1.4, w: Math.max(X(addDays(r.planned.end, 1)) - X(r.planned.start), 0.8), h: 0.8 }
        : null;
      const row = { ...r, y, bar, planned };
      at.set(r.id, row);
      return row;
    });

    // Lines between tasks on the same page (a link that crosses a page break is not drawn).
    const links = [];
    for (const succ of out) {
      for (const predId of new Set(succ.task.blockedBy || [])) {
        const pred = at.get(predId);
        if (!pred || pred.id === succ.id) continue;
        const link = linkOf(succ.task, predId);
        const conflict = !pred.resolved && violates(link, pred, succ);
        const toPx = (r) => ({ leftPx: r.bar.left / PX, rightPx: r.bar.right / PX, y: (r.y + PAGE.rowH / 2) / PX });
        const { points } = routeLink(link.type, toPx(pred), toPx(succ));
        links.push({
          points: points.map((p) => ({ x: p.x * PX, y: p.y * PX })),
          conflict,
          critical: pred.critical && succ.critical,
        });
      }
    }
    return { rows: out, links };
  });

  const noon = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12);
  return {
    pages: placed,
    ticks: axisTicks(min, max).map((d) => ({ x: X(d), label: formatDayMonth(d) })),
    todayX: noon >= min && noon <= max ? X(noon) : null,
  };
};

// The built-in PDF fonts cover Western European text; anything else would come out as junk.
// ponytail: non-Latin titles become "?"; embed a Unicode font if customers need them.
const pdfText = (s) => String(s ?? '').replace(/[^\x20-\x7E -ÿ–—‘’“”…₹]/g, '?');

const fit = (doc, text, maxW) => {
  const t = pdfText(text);
  if (doc.getTextWidth(t) <= maxW) return t;
  let s = t;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
};

const arrowAt = (doc, points) => {
  const [a, b] = points.slice(-2);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const s = 1.2;
  doc.triangle(b.x, b.y, b.x - ux * s - uy * s * 0.6, b.y - uy * s + ux * s * 0.6, b.x - ux * s + uy * s * 0.6, b.y - uy * s - ux * s * 0.6, 'F');
};

/**
 * Draw the layout on a jsPDF document (separate from the download so it can be tested with a
 * stand-in document).
 */
export const drawGanttPdf = (doc, layout, { title, subtitle }) => {
  const total = layout.pages.length;
  layout.pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    // header
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(pdfText(title), PAGE.margin, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(pdfText(subtitle), PAGE.margin, 22);

    // axis and grid
    doc.setDrawColor(...COLORS.grid);
    doc.setLineWidth(0.2);
    for (const t of layout.ticks) {
      doc.line(t.x, PAGE.top - 2, t.x, PAGE.top + page.rows.length * PAGE.rowH);
      doc.text(pdfText(t.label), t.x, PAGE.top - 3.5, { align: 'center' });
    }
    for (let i = 0; i <= page.rows.length; i += 1) {
      const y = PAGE.top + i * PAGE.rowH;
      doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y);
    }

    // rows
    doc.setFontSize(8.5);
    for (const r of page.rows) {
      doc.setTextColor(...(r.critical ? COLORS.criticalText : COLORS.text));
      doc.text(fit(doc, r.title, PAGE.nameW - 2), PAGE.margin, r.y + PAGE.rowH / 2 + 1.2);
      if (r.planned) {
        doc.setFillColor(...COLORS.baseline);
        doc.rect(r.planned.x, r.planned.y, r.planned.w, r.planned.h, 'F');
      }
      doc.setFillColor(...r.color);
      if (r.isMilestone) {
        const { cx, cy, size } = r.bar;
        doc.triangle(cx - size, cy, cx, cy - size, cx + size, cy, 'F');
        doc.triangle(cx - size, cy, cx, cy + size, cx + size, cy, 'F');
      } else {
        doc.roundedRect(r.bar.x, r.bar.y, r.bar.w, r.bar.h, 0.8, 0.8, 'F');
        if (r.critical) {
          doc.setDrawColor(...COLORS.critical);
          doc.setLineWidth(0.5);
          doc.roundedRect(r.bar.x, r.bar.y, r.bar.w, r.bar.h, 0.8, 0.8, 'S');
        }
      }
    }

    // dependency lines
    for (const l of page.links) {
      const color = l.conflict ? COLORS.conflict : l.critical ? COLORS.critical : COLORS.line;
      doc.setDrawColor(...color);
      doc.setFillColor(...color);
      doc.setLineWidth(0.3);
      if (l.conflict) doc.setLineDashPattern([0.8, 0.6], 0);
      for (let i = 1; i < l.points.length; i += 1) {
        doc.line(l.points[i - 1].x, l.points[i - 1].y, l.points[i].x, l.points[i].y);
      }
      if (l.conflict) doc.setLineDashPattern([], 0);
      arrowAt(doc, l.points);
    }

    // today
    if (layout.todayX != null) {
      doc.setDrawColor(...COLORS.overdue);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(layout.todayX, PAGE.top - 2, layout.todayX, PAGE.top + page.rows.length * PAGE.rowH);
      doc.setLineDashPattern([], 0);
    }

    // legend and page number
    const ly = PAGE.h - 8;
    let lx = PAGE.margin;
    doc.setFontSize(7.5);
    for (const [label, color] of [['Completed', 'completed'], ['In progress', 'in-progress'], ['Pending', 'pending'], ['Overdue', 'overdue'], ['Critical path', 'critical'], ['Baseline', 'baseline']]) {
      doc.setFillColor(...COLORS[color]);
      doc.rect(lx, ly - 2.2, 3, 2.4, 'F');
      doc.setTextColor(...COLORS.muted);
      doc.text(label, lx + 4, ly);
      lx += doc.getTextWidth(label) + 9;
    }
    doc.text('Diamond: milestone.  Red dashes: scheduled earlier than its prerequisite allows.', lx, ly);
    doc.text(`Page ${index + 1} of ${total}`, PAGE.w - PAGE.margin, ly, { align: 'right' });
  });
};

/**
 * Build and download the PDF.
 * @param {{ title: string, tasks: Object[], baselineName?: string, baseline?: Object|null, filename?: string }} args
 */
export const downloadGanttPdf = async ({ title, tasks, baseline = null, baselineName = '', filename }) => {
  const { jsPDF } = await import('jspdf');
  const layout = ganttPdfLayout(tasks, { baseline });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const subtitle = [
    `Timeline as of ${formatDate(new Date())}`,
    baselineName ? `compared with ${baselineName}` : '',
    `${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');
  if (layout.pages.length === 0) {
    doc.text(pdfText(title), PAGE.margin, 16);
    doc.text('No tasks with dates yet.', PAGE.margin, 24);
  } else {
    drawGanttPdf(doc, layout, { title, subtitle });
  }
  doc.save(filename || `${pdfText(title).replace(/[\\/:*?"<>|]+/g, '-')} timeline.pdf`);
};
