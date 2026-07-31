// Turns an error into something a user can act on.
//
// Firebase throws messages written for developers — "Firebase: Error
// (auth/invalid-credential)." or "Missing or insufficient permissions." —
// and the app was passing those straight into toasts. They tell a user
// nothing, and the raw ones leak internals (rule shape, collection names).
//
// Every message below says what happened AND what to do next.

const AUTH_MESSAGES = {
  // Modern Firebase returns invalid-credential for both a wrong password and
  // an unknown email when email-enumeration protection is on, so the older
  // codes still appear on some projects and both must be handled.
  'auth/invalid-credential': 'Incorrect email or password. Please check and try again.',
  'auth/wrong-password': 'Incorrect email or password. Please check and try again.',
  'auth/user-not-found': 'Incorrect email or password. Please check and try again.',
  'auth/invalid-email': "That doesn't look like a valid email address.",
  'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
  'auth/too-many-requests': 'Too many failed attempts. Wait a few minutes and try again.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/requires-recent-login': 'For security, please sign out and sign in again before making this change.',
  'auth/network-request-failed': 'Cannot reach the server. Check your internet connection.',
  'auth/operation-not-allowed': 'This sign-in method is turned off for this project.',
  'auth/invalid-api-key': 'The app is misconfigured and cannot reach its server. Contact support.',
  'auth/internal-error': 'The sign-in service had a problem. Please try again.',
};

const FIRESTORE_MESSAGES = {
  'permission-denied': "You don't have permission to do that.",
  unauthenticated: 'Your session has expired. Please sign in again.',
  unavailable: 'Cannot reach the server. Check your internet connection and try again.',
  'deadline-exceeded': 'The server took too long to respond. Please try again.',
  cancelled: 'The request was cancelled. Please try again.',
  'not-found': 'That item no longer exists — it may have been deleted.',
  'already-exists': 'That item already exists.',
  'resource-exhausted': 'The app has hit its usage limit for now. Try again later.',
  'failed-precondition': 'That could not be completed in the current state. Refresh and try again.',
  aborted: 'Someone else changed this at the same time. Refresh and try again.',
  internal: 'The server hit an unexpected problem. Please try again.',
};

const MESSAGES = { ...AUTH_MESSAGES, ...FIRESTORE_MESSAGES };

// Codes that mean "the user or their connection did something", not "the app
// is broken". These are normal operation and must not be written to the error
// log — a wrong password is not an incident, and logging every one would bury
// real failures and burn the Spark plan's write quota.
const EXPECTED_CODES = new Set([
  ...Object.keys(AUTH_MESSAGES),
  'permission-denied',
  'unauthenticated',
  'unavailable',
  'not-found',
  'already-exists',
  'cancelled',
  'deadline-exceeded',
]);

const GENERIC = 'Something went wrong. Please try again.';

const getCode = (error) => (typeof error?.code === 'string' ? error.code : '');

/**
 * True when the error is ordinary (bad password, offline, denied) rather than
 * a sign the app itself is broken.
 */
export const isExpectedError = (error) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return EXPECTED_CODES.has(getCode(error));
};

/**
 * A user-facing sentence for any error.
 *
 * Falls back to a generic message rather than the raw text: an unrecognised
 * error is by definition one whose wording we have not vetted, and Firebase's
 * default wording is the thing this function exists to keep off the screen.
 *
 * @param {unknown} error
 * @param {string} [fallback] shown when the error has no code we recognise
 */
export const toUserMessage = (error, fallback = GENERIC) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try again — your changes weren't saved.";
  }

  const known = MESSAGES[getCode(error)];
  if (known) return known;

  // Errors the app itself threw (`throw new Error("Email is required")`) are
  // already written for a user, so they are shown as-is. Anything carrying a
  // Firebase code or its "Firebase:" prefix is not.
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  if (message && !getCode(error) && !message.startsWith('Firebase:')) {
    return message;
  }

  return fallback;
};
