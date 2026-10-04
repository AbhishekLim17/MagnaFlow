// CSV reading and writing, as pure functions.
//
// Written by hand rather than pulled in as a dependency: the format is small, and the two
// things that matter here - surviving whatever Excel and Google Sheets produce, and not
// writing a cell that a spreadsheet would execute as a formula - are easy to get exactly
// right and test.

const BOM = '﻿';

/** Which separator a file uses: comma, semicolon (Excel in many locales) or tab. */
export const detectDelimiter = (text) => {
  const firstLine = String(text || '').replace(/^﻿/, '').split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
};

/**
 * Parse CSV text into rows of strings (RFC 4180: quoted fields may contain the separator,
 * line breaks and doubled quotes). A leading byte-order mark is dropped, CRLF and LF are
 * both accepted, and completely empty lines are skipped.
 *
 * @param {string} text
 * @param {{ delimiter?: string }} [options] separator; detected when omitted
 * @returns {string[][]}
 */
export const parseCsv = (text, options = {}) => {
  const src = String(text ?? '').replace(/^﻿/, '');
  const sep = options.delimiter || detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    // a line with nothing on it is not a record
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (ch === sep) {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1;
      endRow();
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
};

// A cell starting with one of these is run as a formula by Excel, LibreOffice and Google
// Sheets ("CSV injection"): a task titled =HYPERLINK(...) would become a live link in the
// admin's spreadsheet. Prefixing an apostrophe keeps the text and stops the formula.
const FORMULA_START = /^[=+\-@\t\r]/;

const toCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n;\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Rows to CSV text. Starts with a byte-order mark so Excel opens it as UTF-8 (names and
 * ₹ would otherwise come out garbled) and uses CRLF line endings, which every
 * spreadsheet accepts.
 *
 * @param {Array<Array<unknown>>} rows
 */
export const toCsv = (rows) => BOM + (rows || []).map((r) => r.map(toCell).join(',')).join('\r\n') + '\r\n';

/** Offer a Blob to the browser as a file download. */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Offer `text` to the browser as a file download. */
export const downloadText = (text, filename, type = 'text/csv;charset=utf-8') =>
  downloadBlob(new Blob([text], { type }), filename);

/** "Apollo Platform tasks 2026-10-04.csv" -> a name that is safe on every OS. */
export const safeFilename = (name) => String(name || 'export').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
