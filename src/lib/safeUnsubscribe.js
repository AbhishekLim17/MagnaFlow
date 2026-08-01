/**
 * Detach a Firestore/Auth listener without letting teardown crash the app.
 *
 * Signing out tears down the Firestore watch stream at the same moment React
 * unmounts the providers that listen on it. If the SDK's internal queue has
 * already failed, `unsubscribe()` throws synchronously — and because that
 * happens inside React's unmount commit, nothing downstream can catch it. The
 * result was the ErrorBoundary's "Something went wrong" screen on every sign
 * out, from a real Firestore assertion:
 *
 *   FIRESTORE (12.5.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)
 *
 * Detaching is best-effort cleanup by nature: if the stream is already gone
 * there is nothing left to detach, so swallowing the failure loses nothing.
 *
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

export default safeUnsubscribe;
