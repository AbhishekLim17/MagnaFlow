/**
 * Attach and detach Firestore listeners without letting the SDK's internal
 * state take the app down.
 *
 * Firestore runs everything through one AsyncQueue. When that queue enters a
 * failed state — which happens around sign-out and account switches, as the
 * watch stream is torn down while React is unmounting the providers listening
 * on it — it re-throws that failure *synchronously* from every subsequent call:
 *
 *   FIRESTORE (12.5.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)
 *
 * Both ends are exposed, and both throw inside React's own commit phase where
 * nothing downstream can catch them, so the ErrorBoundary's "Something went
 * wrong" screen was the first thing the user saw:
 *
 *   - unsubscribe() during effect cleanup   -> safeUnsubscribe
 *   - onSnapshot() when opening a listener  -> safeListen
 *
 * Both are best-effort by nature. If the queue is dead there is nothing to
 * detach and nothing that could have streamed, so swallowing the failure costs
 * only the listener — which was never going to work — instead of the screen.
 */

/**
 * Detach a listener. Safe to call with null/undefined.
 * @param {Function|null|undefined} unsubscribe
 */
export const safeUnsubscribe = (unsubscribe) => {
  if (typeof unsubscribe !== 'function') return;
  try {
    unsubscribe();
  } catch (error) {
    console.warn('Listener teardown failed (already detached):', error?.message || error);
  }
};

/**
 * Open a listener, returning a no-op unsubscribe if the SDK refuses.
 *
 * Callers keep the normal shape — `const stop = safeListen(() => onSnapshot(...))`
 * — and can always call the result during cleanup.
 *
 * @param {Function} subscribe a thunk that calls onSnapshot and returns its unsubscribe
 * @returns {Function} unsubscribe, or a no-op when the listener could not open
 */
export const safeListen = (subscribe) => {
  try {
    const unsubscribe = subscribe();
    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
  } catch (error) {
    console.warn('Could not open Firestore listener:', error?.message || error);
    return () => {};
  }
};

export default safeUnsubscribe;
