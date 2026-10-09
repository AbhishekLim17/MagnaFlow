import { describe, expect, it } from 'vitest';
import { openActions, pageProblem, parseLines, tickLine } from './wiki';

const body = [
  '# Kickoff notes',
  '## Decisions',
  '- Ship in November',
  '* Weekly demo',
  '- [ ] Book the venue',
  '- [x] Send the invite',
  '',
  'Plain words.',
].join('\n');

describe('wiki pages', () => {
  it('reads the line conventions', () => {
    expect(parseLines(body).map((l) => [l.kind, l.text])).toEqual([
      ['h1', 'Kickoff notes'],
      ['h2', 'Decisions'],
      ['bullet', 'Ship in November'],
      ['bullet', 'Weekly demo'],
      ['todo', 'Book the venue'],
      ['done', 'Send the invite'],
      ['blank', ''],
      ['text', 'Plain words.'],
    ]);
  });

  it('ticks an action item and counts the open ones', () => {
    expect(openActions(body)).toBe(1);
    const after = tickLine(body, 4);
    expect(after.split('\n')[4]).toBe('- [x] Book the venue');
    expect(openActions(after)).toBe(0);
    expect(tickLine('a\r\nb', 5)).toBe('a\nb');
  });

  it('checks a page', () => {
    expect(pageProblem({ title: 'Notes', body: 'x' })).toBeNull();
    expect(pageProblem({ title: ' ', body: '' })).toMatch(/title/);
    expect(pageProblem({ title: 'x', body: 'y'.repeat(50_001) })).toMatch(/split/);
  });
});
