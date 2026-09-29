import { describe, test, expect } from 'vitest';
import { resolveMentions, mergePeople, mentionToken } from './mentions';

const people = [
  { id: '1', name: 'Ann' },
  { id: '2', name: 'Joanna' },
  { id: '3', name: 'Annabel Lee' },
  { id: '4', name: "Pat O'Brien" },
];
const ids = (text) => resolveMentions(text, people).map((p) => p.id);

describe('resolveMentions', () => {
  test('matches exactly, not by substring', () => {
    expect(ids('hi @Ann can you look')).toEqual(['1']);
    expect(ids('@Joanna thanks')).toEqual(['2']);
  });
  test('a longer name is not also a hit for its prefix', () => {
    expect(ids('@AnnabelLee please review')).toEqual(['3']);
  });
  test('multi-word names are written without spaces', () => {
    expect(mentionToken('Annabel Lee')).toBe('AnnabelLee');
    expect(ids('cc @AnnabelLee, @Ann')).toEqual(['1', '3']);
  });
  test('case-insensitive, and punctuation after the name is fine', () => {
    expect(ids('ping @ann!')).toEqual(['1']);
    expect(ids("thanks @PatO'Brien")).toEqual(['4']);
  });
  test('an email address is not a mention', () => {
    expect(ids('mail me at bob@Ann.com')).toEqual([]);
  });
  test('the same person mentioned twice is returned once', () => {
    expect(ids('@Ann and again @Ann')).toEqual(['1']);
  });
  test('no text, no people', () => {
    expect(ids('')).toEqual([]);
    expect(resolveMentions('@Ann', [])).toEqual([]);
    expect(resolveMentions('@Ann', null)).toEqual([]);
  });
});

describe('mergePeople', () => {
  test('dedupes by id, first wins, fills a missing email', () => {
    const merged = mergePeople([{ id: '1', name: 'Ann' }], [{ id: '1', name: 'Ann X', email: 'a@x.com' }, { id: '2', name: 'Bo' }]);
    expect(merged).toEqual([{ id: '1', name: 'Ann', email: 'a@x.com' }, { id: '2', name: 'Bo' }]);
  });
  test('ignores junk entries', () => {
    expect(mergePeople([null, {}, { id: '9', name: 'Z' }])).toEqual([{ id: '9', name: 'Z' }]);
  });
});
