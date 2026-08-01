import { describe, test, expect, vi, beforeEach } from 'vitest';
import { safeUnsubscribe } from './safeUnsubscribe';

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
