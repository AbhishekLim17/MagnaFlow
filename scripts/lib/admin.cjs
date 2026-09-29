/**
 * Firebase Admin initialisation shared by the scheduled jobs.
 *
 * Accepts either a whole service-account JSON (FIREBASE_SERVICE_ACCOUNT_JSON, the
 * same secret the hosting deploy uses) or three separate values. Missing
 * credentials fail loudly and specifically rather than producing a confusing
 * Firebase error later.
 *
 * When FIRESTORE_EMULATOR_HOST is set (integration tests) it connects to the
 * emulator with no credential at all, so the jobs can be exercised end to end
 * without touching a real project.
 */
const admin = require('firebase-admin');

function buildCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return admin.credential.cert(JSON.parse(json));
    } catch (error) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON:', error.message);
      process.exit(2);
    }
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
    });
  }

  console.error(
    'No Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred), or\n' +
      'FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
  process.exit(2);
}

/** Initialise the default Admin app and return the firebase-admin module. */
function initAdmin() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-magnaflow' });
  } else {
    admin.initializeApp({ credential: buildCredential() });
  }
  return admin;
}

module.exports = { initAdmin, buildCredential };
