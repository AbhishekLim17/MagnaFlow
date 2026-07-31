// Records unhandled UI errors to Firestore so production failures are visible
// without a third-party service.
//
// This is deliberately modest compared with a real error tracker: no stack
// grouping, no alerting, no release tracking, no source maps. It answers
// "is anything breaking for users, and roughly where" — which previously
// nothing did, since errors only reached the user's own browser console.

import { addDoc, collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';

const COLLECTION = 'error_logs';

// Don't let one broken render fill the collection with thousands of copies of
// the same failure (and burn the Spark plan's write quota).
const MAX_PER_SESSION = 10;
const DEDUPE_WINDOW_MS = 60_000;
let sessionCount = 0;
const recentlyLogged = new Map(); // message -> timestamp

/**
 * @param {Error} error
 * @param {Object} [context] e.g. { componentStack }
 */
export const logError = async (error, context = {}) => {
  try {
    const message = String(error?.message || error || 'Unknown error');

    if (sessionCount >= MAX_PER_SESSION) return;
    const last = recentlyLogged.get(message);
    if (last && Date.now() - last < DEDUPE_WINDOW_MS) return;
    recentlyLogged.set(message, Date.now());
    sessionCount++;

    await addDoc(collection(db, COLLECTION), {
      message: message.slice(0, 1000),
      // Stacks can be enormous; keep enough to locate the fault.
      stack: String(error?.stack || '').slice(0, 4000),
      componentStack: String(context.componentStack || '').slice(0, 4000),
      url: typeof window !== 'undefined' ? window.location.href : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      userId: auth.currentUser?.uid || null,
      userEmail: auth.currentUser?.email || null,
      createdAt: Timestamp.now(),
    });
  } catch (loggingError) {
    // Never throw from the error path — this runs inside the ErrorBoundary,
    // and failing here would replace the recovery screen with a blank page.
    console.error('Could not record error log:', loggingError?.code || loggingError?.message);
  }
};

/**
 * Most recent errors, newest first. Master-admin only (enforced by rules).
 */
export const getErrorLogs = async (max = 100) => {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn('Could not load error logs:', error?.code);
    return [];
  }
};
