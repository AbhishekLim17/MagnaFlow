import { describe, test, expect } from 'vitest';
import { getMentionQuery, suggestPeople, applyMention, resolveMentions } from './mentions';

const people = [
  { id: '1', name: 'Ann Lee' },
  { id: '2', name: 'Joanna Park' },
  { id: '3', name: 'Annabel Cho' },
  { id: '4', name: 'Bo Zhang' },
];

describe('getMentionQuery', () => {
  test('finds the @ being typed and what follows it', () => {
    expect(getMentionQuery('hi @an', 6)).toEqual({ start: 3, query: 'an' });
    expect(getMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(getMentionQuery('ping @Ann and more', 9)).toEqual({ start: 5, query: 'Ann' });
  });
  test('uses the caret, not the end of the text', () => {
    expect(getMentionQuery('@Ann and more', 4)).toEqual({ start: 0, query: 'Ann' });
    expect(getMentionQuery('@Ann and more', 9)).toBeNull();
  });
  test('an email address is not a mention', () => {
    expect(getMentionQuery('write to bob@ex', 15)).toBeNull();
  });
  test('stops once the token has a space in it', () => {
    expect(getMentionQuery('@Ann Lee', 8)).toBeNull();
  });
  test('no @, or no caret, means no mention', () => {
    expect(getMentionQuery('hello', 5)).toBeNull();
    expect(getMentionQuery('@a', null)).toBeNull();
  });
});

describe('suggestPeople', () => {
  const names = (q, limit) => suggestPeople(people, q, limit).map((p) => p.name);
  test('prefix matches come first, then word starts, then substrings', () => {
    expect(names('ann')).toEqual(['Ann Lee', 'Annabel Cho', 'Joanna Park']);
    expect(names('park')).toEqual(['Joanna Park']);
  });
  test('matches the start of any word in a name', () => {
    expect(names('lee')).toEqual(['Ann Lee']);
  });
  test('an empty query offers everyone, alphabetically, up to the limit', () => {
    expect(names('', 2)).toEqual(['Ann Lee', 'Annabel Cho']);
  });
  test('nothing matches nothing', () => {
    expect(names('zzz')).toEqual([]);
    expect(suggestPeople(null, 'a')).toEqual([]);
  });
});

describe('applyMention', () => {
  test('replaces the partial mention with the full token and a space, and moves the caret after it', () => {
    const r = applyMention('hi @an there', 3, 6, people[0]);
    expect(r.text).toBe('hi @AnnLee  there');
    expect(r.caret).toBe(3 + '@AnnLee '.length);
  });
  test('what it inserts is exactly what resolveMentions recognises', () => {
    const r = applyMention('@', 0, 1, people[2]);
    expect(resolveMentions(r.text, people).map((p) => p.id)).toEqual(['3']);
  });
});
