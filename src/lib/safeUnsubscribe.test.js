import { describe, test, expect, vi, beforeEach } from 'vitest';
import { safeListen, safeUnsubscribe } from './safeUnsubscribe';

const FIRESTORE_ASSERTION =
  'FIRESTORE (12.5.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)';

describe('safeListen', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('returns the unsubscribe the listener handed back', () => {
    const unsubscribe = vi.fn();
    expect(safeListen(() => unsubscribe)).toBe(unsubscribe);
  });

  // Once Firestore's queue has failed — which is what a sign-out or an account
  // switch can leave behind — onSnapshot itself throws, not just teardown.
  // That throw happens while React is running the effect, so it escaped to the
  // ErrorBoundary and replaced the dashboard with the crash screen.
  test('does not rethrow when opening the listener throws', () => {
    const boom = () => {
      throw new Error(FIRESTORE_ASSERTION);
    };
    expect(() => safeListen(boom)).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  // Callers always call the result during cleanup, so a failure must still
  // hand back something callable.
  test('returns a callable no-op when the listener could not open', () => {
    const stop = safeListen(() => {
      throw new Error(FIRESTORE_ASSERTION);
    });
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });

  test('tolerates a subscribe that returns nothing', () => {
    const stop = safeListen(() => undefined);
    expect(() => stop()).not.toThrow();
  });
});

describe('safeUnsubscribe', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('detaches the listener', () => {
    const unsubscribe = vi.fn();
    safeUnsubscribe(unsubscribe);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  // The whole point. Firestore's unsubscribe throws synchronously when the
  // watch stream has already been torn down — which is what happens on sign
  // out — and because that runs inside React's unmount commit, the throw
  // escaped to the ErrorBoundary and replaced the app with its crash screen.
  test('does not rethrow when the SDK throws during teardown', () => {
    const boom = vi.fn(() => {
      throw new Error(
        'FIRESTORE (12.5.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)'
      );
    });
    expect(() => safeUnsubscribe(boom)).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  // A listener that never got created leaves the variable null; cleanup still
  // runs, so it must tolerate that rather than throwing a TypeError of its own.
  test.each([[null], [undefined], ['not a function'], [0]])(
    'ignores a non-function value (%s)',
    (value) => {
      expect(() => safeUnsubscribe(value)).not.toThrow();
    }
  );
});
