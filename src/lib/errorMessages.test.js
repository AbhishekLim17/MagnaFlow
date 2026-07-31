import { describe, test, expect, afterEach, vi } from 'vitest';
import { toUserMessage, isExpectedError } from './errorMessages';

const fbError = (code, message = `Firebase: Error (${code}).`) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toUserMessage', () => {
  // The bug that motivated this: recent Firebase returns invalid-credential
  // for a wrong password, the old hand-written mapper had no case for it, and
  // the user was shown "Firebase: Error (auth/invalid-credential)."
  test('maps a wrong password to a plain sentence', () => {
    const message = toUserMessage(fbError('auth/invalid-credential'));
    expect(message).toBe('Incorrect email or password. Please check and try again.');
    expect(message).not.toMatch(/firebase|auth\//i);
  });

  test('maps a denied write without naming rules or collections', () => {
    const error = fbError('permission-denied', 'Missing or insufficient permissions.');
    expect(toUserMessage(error)).toBe("You don't have permission to do that.");
  });

  test('never leaks raw Firebase wording for an unrecognised code', () => {
    const message = toUserMessage(fbError('auth/some-code-we-have-not-seen'));
    expect(message).toBe('Something went wrong. Please try again.');
    expect(message).not.toContain('Firebase');
  });

  test('passes through an error the app wrote for the user', () => {
    expect(toUserMessage(new Error('Email and password are required'))).toBe(
      'Email and password are required'
    );
  });

  test('uses the caller fallback when nothing else matches', () => {
    expect(toUserMessage(fbError('unknown/code'), 'Could not save.')).toBe('Could not save.');
  });

  test('handles a non-Error value', () => {
    expect(toUserMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  test('being offline explains that the change was not saved', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(toUserMessage(fbError('unavailable'))).toMatch(/offline/i);
    expect(toUserMessage(fbError('unavailable'))).toMatch(/weren't saved/);
  });
});

describe('isExpectedError', () => {
  // Routine failures must not reach the error log: a wrong password is not an
  // incident, and logging every one would bury real faults.
  test.each([
    'auth/invalid-credential',
    'auth/too-many-requests',
    'permission-denied',
    'unavailable',
    'not-found',
  ])('treats %s as ordinary', (code) => {
    expect(isExpectedError(fbError(code))).toBe(true);
  });

  test.each(['internal', 'resource-exhausted', 'failed-precondition'])(
    'treats %s as a possible defect',
    (code) => {
      expect(isExpectedError(fbError(code))).toBe(false);
    }
  );

  test('a plain programming error is a defect', () => {
    expect(isExpectedError(new TypeError('x is not a function'))).toBe(false);
  });

  test('anything is ordinary while offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isExpectedError(new TypeError('boom'))).toBe(true);
  });
});
