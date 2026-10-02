import { describe, test, expect } from 'vitest';
import { validateNewAccount, emailProblem, nameProblem, clearEditedErrors } from './accountForm';

describe('validateNewAccount', () => {
  test('a complete form has no errors', () => {
    expect(validateNewAccount({ name: 'Sana Staff', email: 'sana@demo.test', password: 'Quiet-River-83' })).toEqual({});
  });

  test('reports every wrong field at once, each in its own words', () => {
    expect(validateNewAccount({ name: '  ', email: '', password: '' })).toEqual({
      name: 'Enter a name.',
      email: 'Enter an email address.',
      password: 'Enter a password.',
    });
  });

  test('says how short the password is', () => {
    expect(validateNewAccount({ name: 'A', email: 'a@b.co', password: 'abc' }).password).toMatch(/at least 8 characters \(this has 3\)/);
  });
});

describe('emailProblem', () => {
  test.each(['sana', 'sana@', '@demo.test', 'sana@demo', 'sa na@demo.test'])('rejects %s', (value) => {
    expect(emailProblem(value)).toMatch(/does not look like an email/);
  });
  test('accepts an address with surrounding spaces, as the form trims it', () => {
    expect(emailProblem('  sana@demo.test ')).toBeNull();
  });
});

describe('nameProblem', () => {
  test('wants something other than spaces', () => {
    expect(nameProblem('   ')).toBe('Enter a name.');
    expect(nameProblem(undefined)).toBe('Enter a name.');
    expect(nameProblem('Sana')).toBeNull();
  });
});

describe('clearEditedErrors', () => {
  const errors = { name: 'Enter a name.', password: 'Enter a password.' };
  test('drops the error for the field that was edited, keeps the rest', () => {
    expect(clearEditedErrors(errors, { name: '', password: '' }, { name: 'S', password: '' })).toEqual({
      password: 'Enter a password.',
    });
  });
  test('keeps everything when nothing relevant changed', () => {
    expect(clearEditedErrors(errors, { name: '', password: '' }, { name: '', password: '', phone: '1' })).toEqual(errors);
  });
});
