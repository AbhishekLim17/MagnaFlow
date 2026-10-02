import { describe, test, expect } from 'vitest';
import { statusLabel, priorityLabel, roleLabel } from './taskLabels';

describe('labels', () => {
  test('known values read as words, not ids', () => {
    expect(statusLabel('in-progress')).toBe('In progress');
    expect(statusLabel('review')).toBe('In review');
    expect(priorityLabel('critical')).toBe('Critical');
    expect(roleLabel('org-admin')).toBe('Organization admin');
    expect(roleLabel('admin')).toBe('Organization admin');
  });
  test('unknown values are humanized rather than shown raw or blank', () => {
    expect(statusLabel('on-hold')).toBe('On hold');
    expect(roleLabel('some_new_role')).toBe('Some new role');
  });
  test('missing values get a sensible default', () => {
    expect(statusLabel(undefined)).toBe('Unknown');
    expect(priorityLabel(null)).toBe('Medium');
    expect(roleLabel('')).toBe('User');
  });
});
