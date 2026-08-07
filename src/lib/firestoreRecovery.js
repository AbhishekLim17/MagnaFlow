// Recovers from a specific Firestore JS SDK defect: opening several
// onSnapshot listeners in quick succession — which happens on every login,
// where the notification bell, the designations list and (on some
// dashboards) the recent-activity feed all attach at once — can trip an
// internal assertion in the SDK's watch-stream bookkeeping:
//
//   FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: b815 / ca9)
//
// AuthContext already works around the one place this was known to bite:
// sign-out, where it does a hard navigation instead of a client-side route
// change. This generalizes that recovery, because the same failure was
// reproduced from a plain page load under load (a ~50-person seeded
// organisation) with no sign-out involved — and once it fires, the SDK's
// async queue is left permanently broken. Every Firestore read after that
// throws immediately.
//
// That throw does not reliably reach a global `window.onerror`/
// `unhandledrejection` handler: most reads in this codebase already run
// inside their own try/catch (a service function that logs and rethrows,
// then a caller that catches that and shows a toast), and a rejection
// handled anywhere in its chain is by definition never "unhandled". Relying
// on a global listener alone silently misses exactly the cases this exists
// to fix — confirmed by reproducing it live: the failure surfaced only as
// this codebase's own `console.error` calls inside existing catch blocks,
// never as an uncaught exception. So detection lives here as a plain
// function too, callable directly from the two functions nearly every
// screen's data ultimately passes through (getAllUsers, getAllTasks) —
// that catches the failure at the choke point instead of chasing every
// call site that reads Firestore.
//
// This cannot fix the SDK's internal state; it can only recognise that exact
// failure and recover the way a person would — reload the page. A guard
// against reloading more than once in a short window stops that from ever
// becoming a refresh loop if the underlying condition doesn't clear.

const SIGNATURE = /FIRESTORE[\s\S]*INTERNAL ASSERTION FAILED/;
const GUARD_KEY = 'magnaflow-firestore-recovery-at';
const GUARD_WINDOW_MS = 15_000;

/**
 * @param {unknown} error
 * @returns {boolean} true if this is the specific unrecoverable SDK failure,
 *   not just any Firestore error (a wrong password or a denied read must
 *   never trigger a surprise reload).
 */
export const isFirestoreInternalAssertion = (error) => {
  const message = typeof error === 'string' ? error : String(error?.message || '');
  return SIGNATURE.test(message);
};

const recentlyRecovered = () => {
  try {
    const last = Number(window.sessionStorage.getItem(GUARD_KEY) || 0);
    return Date.now() - last < GUARD_WINDOW_MS;
  } catch {
    return false;
  }
};

const markRecovered = () => {
  try {
    window.sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // Private mode; the guard just won't persist, which only risks an extra
    // reload rather than none at all.
  }
};

/**
 * Reload to clear a poisoned Firestore client, unless a reload for this exact
 * reason already happened moments ago. Call this from anywhere that has
 * already confirmed `isFirestoreInternalAssertion(error)` is true.
 */
export const recoverFromFirestoreFailure = () => {
  if (recentlyRecovered()) {
    console.error(
      'Firestore internal assertion fired again shortly after a recovery reload — not reloading again to avoid a loop.'
    );
    return;
  }
  console.error('Firestore connection entered a broken internal state; reloading to recover.');
  markRecovered();
  window.location.reload();
};

// 'error' events carry the Error on .error; 'unhandledrejection' events carry
// the rejected value (usually an Error) on .reason. Read whichever this is.
const handleGlobalEvent = (event) => {
  const value = 'reason' in event ? event.reason : event.error;
  if (isFirestoreInternalAssertion(value)) recoverFromFirestoreFailure();
};

/**
 * Call once, as early as possible (main.jsx). Idempotent.
 *
 * This is the safety net for the failure's first appearance — typically
 * inside the SDK's own internal watch-stream callback, before any
 * application code gets a chance to catch it. The service-layer checks
 * (getAllUsers, getAllTasks) are what catch everything downstream of that.
 */
export const installFirestoreRecovery = () => {
  if (typeof window === 'undefined' || window.__firestoreRecoveryInstalled) return;
  window.__firestoreRecoveryInstalled = true;
  window.addEventListener('error', handleGlobalEvent);
  window.addEventListener('unhandledrejection', handleGlobalEvent);
};
