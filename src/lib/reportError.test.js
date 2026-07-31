import { describe, test, expect, vi, beforeEach } from 'vitest';

const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ toast: (...args) => toast(...args) }));

// Mocked so these tests never reach Firebase.
const logError = vi.fn();
vi.mock('@/services/errorLogService', () => ({ logError: (...args) => logError(...args) }));

const { reportError, ERROR_TOAST_DURATION } = await import('./reportError');

const fbError = (code) => {
  const error = new Error(`Firebase: Error (${code}).`);
  error.code = code;
  return error;
};

describe('reportError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    toast.mockClear();
    logError.mockClear();
  });

  test('shows the user a readable message, not the raw error', () => {
    reportError(fbError('permission-denied'), { title: 'Could not save' });

    expect(toast).toHaveBeenCalledTimes(1);
    const arg = toast.mock.calls[0][0];
    expect(arg.title).toBe('Could not save');
    expect(arg.description).toBe("You don't have permission to do that.");
    expect(arg.variant).toBe('destructive');
  });

  test('gives an error longer on screen than the 5s default', () => {
    reportError(new Error('boom'));
    expect(toast.mock.calls[0][0].duration).toBe(ERROR_TOAST_DURATION);
    expect(ERROR_TOAST_DURATION).toBeGreaterThan(5000);
  });

  test('records a likely defect to the error log', () => {
    reportError(new TypeError('x is not a function'), { title: 'Crash' });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  // Otherwise every mistyped password becomes a log entry, burying real
  // faults and consuming the Spark plan's write quota.
  test('does not log an ordinary failure like a wrong password', () => {
    reportError(fbError('auth/invalid-credential'), { title: 'Login failed' });
    expect(logError).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test('silent still logs but shows nothing', () => {
    reportError(new TypeError('boom'), { silent: true });
    expect(toast).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  // The user is waiting on the message; diagnostics failing must not swallow it.
  test('still toasts if writing the error log throws', () => {
    logError.mockImplementationOnce(() => {
      throw new Error('firestore is down');
    });
    expect(() => reportError(new TypeError('boom'), { title: 'Oops' })).not.toThrow();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test('returns the message it displayed', () => {
    expect(reportError(fbError('unavailable'))).toMatch(/internet connection/i);
  });
});
