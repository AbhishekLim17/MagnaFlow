// Cloud Functions gateway.
//
// This project runs on the Firebase Spark plan, where Cloud Functions cannot be
// deployed, so none of the callables in functions/index.js exist in production.
// Calling them anyway cost every login and every user deletion a failed network
// round trip plus console noise, and pulled the whole firebase/functions SDK
// into the initial bundle for nothing.
//
// Everything now goes through here. Calls are skipped unless the deployment
// explicitly opts in (VITE_FUNCTIONS_ENABLED=true, e.g. after moving to Blaze),
// and the SDK is loaded lazily so a Spark build never downloads it.
export const FUNCTIONS_ENABLED = import.meta.env.VITE_FUNCTIONS_ENABLED === 'true';

/**
 * Invoke a callable function and return its `data`.
 * Only call this behind a FUNCTIONS_ENABLED check.
 */
export const callFunction = async (name, payload) => {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const result = await httpsCallable(getFunctions(), name)(payload);
  return result.data;
};
