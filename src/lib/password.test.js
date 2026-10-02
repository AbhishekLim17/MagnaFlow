import { describe, test, expect } from 'vitest';
import { generatePassword, passwordProblem, passwordStrength, MIN_PASSWORD_LENGTH } from './password';

describe('generatePassword', () => {
  test('has the requested length, but never less than the minimum', () => {
    expect(generatePassword()).toHaveLength(14);
    expect(generatePassword(20)).toHaveLength(20);
    expect(generatePassword(3)).toHaveLength(MIN_PASSWORD_LENGTH);
  });

  test('always mixes lower case, upper case and digits', () => {
    for (let i = 0; i < 200; i += 1) {
      const pw = generatePassword(MIN_PASSWORD_LENGTH);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/\d/);
    }
  });

  test('avoids characters that are easy to misread', () => {
    const sample = Array.from({ length: 300 }, () => generatePassword(20)).join('');
    expect(sample).not.toMatch(/[01OIl]/);
  });

  test('is different every time', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(seen.size).toBe(50);
  });

  test('what it generates is always acceptable', () => {
    for (let i = 0; i < 50; i += 1) expect(passwordProblem(generatePassword())).toBeNull();
  });
});

describe('passwordProblem', () => {
  test('asks for a password when there is none', () => {
    expect(passwordProblem('')).toMatch(/enter a password/i);
    expect(passwordProblem(undefined)).toMatch(/enter a password/i);
  });

  test('says how short it is, so the fix is obvious', () => {
    expect(passwordProblem('abc123')).toBe('Use at least 8 characters (this has 6).');
  });

  test('accepts the minimum length, spaces and all', () => {
    expect(passwordProblem('12345678')).toBeNull();
    expect(passwordProblem('a b c d e')).toBeNull();
  });
});

describe('passwordStrength', () => {
  test('is empty until something is typed', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '' });
  });

  test('flags a password below the minimum as too short', () => {
    expect(passwordStrength('Ab1!')).toEqual({ score: 0, label: 'Too short' });
  });

  test('calls out passwords that are easy to guess even when long enough', () => {
    expect(passwordStrength('password123').label).toBe('Easy to guess');
    expect(passwordStrength('aaaaaaaaaaaa').label).toBe('Easy to guess');
    expect(passwordStrength('12345678').label).toBe('Easy to guess');
  });

  test('flags a password that contains the person\'s own email name', () => {
    expect(passwordStrength('sana.staff-2026', { email: 'sana.staff@demo.test' }).label).toBe('Easy to guess');
    expect(passwordStrength('Zq7-mellow-Kiwi', { email: 'sana.staff@demo.test' }).score).toBeGreaterThanOrEqual(2);
  });

  test('rates by length and variety', () => {
    expect(passwordStrength('quietriver').score).toBe(2);          // 10 letters: Good
    expect(passwordStrength('quiet').score).toBe(0);
    expect(passwordStrength('Quiet-River-83').label).toBe('Strong');
  });

  test('rates what the generator produces as strong', () => {
    for (let i = 0; i < 30; i += 1) expect(passwordStrength(generatePassword()).label).toBe('Strong');
  });
});
