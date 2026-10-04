import { describe, test, expect } from 'vitest';
import { parseCsv, toCsv, detectDelimiter, safeFilename } from './csv';

describe('parseCsv', () => {
  test('plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  test('quoted fields keep separators, line breaks and doubled quotes', () => {
    const text = 'Title,Notes\n"Fix, then ship","Line one\nline two"\n"Say ""hi""",x\n';
    expect(parseCsv(text)).toEqual([
      ['Title', 'Notes'],
      ['Fix, then ship', 'Line one\nline two'],
      ['Say "hi"', 'x'],
    ]);
  });

  test('Windows line endings, a byte-order mark and blank lines are handled', () => {
    expect(parseCsv('﻿a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  test('a last line without a newline still counts, and so do empty cells', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
  });

  test('semicolon and tab files (Excel in many locales, copy-paste from sheets)', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  test('a comma inside quotes in the header does not fool the separator detection', () => {
    expect(detectDelimiter('"Name, full";Email;Role\n')).toBe(';');
  });

  test('nothing at all is no rows', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(null)).toEqual([]);
  });
});

describe('toCsv', () => {
  test('starts with a byte-order mark and quotes only what needs it', () => {
    const out = toCsv([['Title', 'Owner'], ['Ship, now', 'Sana "S"'], ['Plain', '']]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toBe('﻿Title,Owner\r\n"Ship, now","Sana ""S"""\r\nPlain,\r\n');
  });

  test('a value a spreadsheet would run as a formula is neutralised', () => {
    const out = toCsv([['=HYPERLINK("http://x","y")', '+1', '-2', '@SUM(A1)', 'safe']]);
    expect(out).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(out).toContain(`'+1`);
    expect(out).toContain(`'-2`);
    expect(out).toContain(`'@SUM(A1)`);
    expect(out).toContain(',safe');
  });

  test('null, undefined and numbers', () => {
    expect(toCsv([[null, undefined, 3, 0]])).toBe('﻿,,3,0\r\n');
  });

  test('round-trips through parseCsv', () => {
    const rows = [['Title', 'Notes'], ['Multi\nline, "quoted"', '₹12,50,000']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('safeFilename', () => {
  test('removes characters Windows and macOS refuse', () => {
    expect(safeFilename('Apollo: tasks / Q3?')).toBe('Apollo- tasks - Q3-');
    expect(safeFilename('')).toBe('export');
  });
});
