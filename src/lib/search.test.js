import { describe, expect, it } from 'vitest';
import { matchScore, searchEverything, typingInField } from './search';

const tasks = [
  { id: 'a', title: 'Fix the login page', description: 'reset password flow' },
  { id: 'b', title: 'Login audit', description: '' },
  { id: 'c', title: 'Write report', description: 'monthly login numbers' },
  { id: 'd', title: 'Café menu', description: '' },
];

describe('matchScore', () => {
  it('prefers a title start, then a word start, then anywhere, then the description', () => {
    expect(matchScore('log', 'Login audit')).toBe(0);
    expect(matchScore('log', 'Fix the login page')).toBe(1);
    expect(matchScore('ogi', 'Fix the login page')).toBe(2);
    expect(matchScore('login', 'Write report', 'monthly login numbers')).toBe(3);
    expect(matchScore('zzz', 'Write report', 'x')).toBeNull();
    expect(matchScore('  ', 'anything')).toBeNull();
  });

  it('ignores case and accents', () => {
    expect(matchScore('CAFE', 'Café menu')).toBe(0);
  });
});

describe('searchEverything', () => {
  it('ranks tasks by how well they match', () => {
    expect(searchEverything('login', { tasks }).tasks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('lists every page and no tasks when nothing is typed', () => {
    const pages = [{ id: 'x', label: 'Reports' }];
    expect(searchEverything('', { pages, tasks })).toEqual({ pages, tasks: [] });
  });

  it('matches pages by label and caps the list', () => {
    const pages = [{ id: 'r', label: 'Reports & Analytics' }, { id: 't', label: 'Task Management' }];
    expect(searchEverything('rep', { pages }).pages.map((p) => p.id)).toEqual(['r']);
    expect(searchEverything('o', { tasks }, 2).tasks).toHaveLength(2);
  });
});

describe('typingInField', () => {
  it('knows text fields from the page', () => {
    expect(typingInField({ tagName: 'INPUT' })).toBe(true);
    expect(typingInField({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(typingInField({ tagName: 'BUTTON' })).toBe(false);
    expect(typingInField(null)).toBe(false);
  });
});
