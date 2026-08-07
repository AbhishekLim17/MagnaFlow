import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const ASSERTION_MESSAGE =
  'FIRESTORE (12.5.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815) CONTEXT: {}';

let reload;
const originalLocation = window.location;

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.sessionStorage.clear();
  delete window.__firestoreRecoveryInstalled;
  reload = vi.fn();
  // jsdom's window.location is non-configurable, so it cannot be spied on
  // directly — replace the whole object for the duration of the test.
  delete window.location;
  window.location = { ...originalLocation, reload };
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location = originalLocation;
});

describe('isFirestoreInternalAssertion', () => {
  test('recognises the specific SDK signature', async () => {
    const { isFirestoreInternalAssertion } = await import('./firestoreRecovery');
    expect(isFirestoreInternalAssertion(new Error(ASSERTION_MESSAGE))).toBe(true);
  });

  // The whole point: an ordinary failure — a wrong password, a denied read —
  // must never trigger a surprise reload.
  test('rejects an ordinary error', async () => {
    const { isFirestoreInternalAssertion } = await import('./firestoreRecovery');
    expect(isFirestoreInternalAssertion(new TypeError('x is not a function'))).toBe(false);
    expect(isFirestoreInternalAssertion({ code: 'permission-denied', message: 'Missing permissions' })).toBe(false);
  });

  test('handles a non-Error value without throwing', async () => {
    const { isFirestoreInternalAssertion } = await import('./firestoreRecovery');
    expect(isFirestoreInternalAssertion(undefined)).toBe(false);
    expect(isFirestoreInternalAssertion('a plain string')).toBe(false);
  });
});

describe('recoverFromFirestoreFailure', () => {
  test('reloads the page', async () => {
    const { recoverFromFirestoreFailure } = await import('./firestoreRecovery');
    recoverFromFirestoreFailure();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // Guards against turning an unrecovered condition into a refresh loop.
  test('does not reload a second time within the guard window', async () => {
    const { recoverFromFirestoreFailure } = await import('./firestoreRecovery');
    recoverFromFirestoreFailure();
    recoverFromFirestoreFailure();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('installFirestoreRecovery', () => {
  test('reloads on an uncaught error carrying the Firestore assertion', async () => {
    const { installFirestoreRecovery } = await import('./firestoreRecovery');
    installFirestoreRecovery();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error(ASSERTION_MESSAGE) }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('reloads on an unhandled promise rejection carrying the assertion', async () => {
    const { installFirestoreRecovery } = await import('./firestoreRecovery');
    installFirestoreRecovery();
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', { value: new Error(ASSERTION_MESSAGE) });
    window.dispatchEvent(event);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('ignores an unrelated error', async () => {
    const { installFirestoreRecovery } = await import('./firestoreRecovery');
    installFirestoreRecovery();
    window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('x is not a function') }));
    expect(reload).not.toHaveBeenCalled();
  });

  test('installing twice does not attach duplicate listeners', async () => {
    const { installFirestoreRecovery } = await import('./firestoreRecovery');
    installFirestoreRecovery();
    installFirestoreRecovery();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error(ASSERTION_MESSAGE) }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
