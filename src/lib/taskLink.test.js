import { describe, test, expect } from 'vitest';
import { taskLink, taskIdFromSearch, withoutTaskParam } from './taskLink';

describe('task deep links', () => {
  test('a link keeps the current page and names the task', () => {
    expect(taskLink('/admin/tasks', 'abc123')).toBe('/admin/tasks?task=abc123');
  });
  test('the id is escaped', () => {
    expect(taskLink('/staff', 'a b&c')).toBe('/staff?task=a%20b%26c');
    expect(taskIdFromSearch('?task=a%20b%26c')).toBe('a b&c');
  });
  test('reads the id back, tolerating other parameters and junk', () => {
    expect(taskIdFromSearch('?foo=1&task=xyz')).toBe('xyz');
    expect(taskIdFromSearch('')).toBeNull();
    expect(taskIdFromSearch('?task=')).toBeNull();
    expect(taskIdFromSearch(undefined)).toBeNull();
  });
  test('closing removes only the task parameter', () => {
    expect(withoutTaskParam('?task=xyz')).toBe('');
    expect(withoutTaskParam('?foo=1&task=xyz')).toBe('?foo=1');
    expect(withoutTaskParam('?foo=1')).toBe('?foo=1');
  });
});
