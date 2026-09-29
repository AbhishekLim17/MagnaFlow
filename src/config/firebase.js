// Firebase Configuration and Initialization
// This file sets up Firebase services: Authentication and Firestore Database

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// Firebase project configuration - Using environment variables
// These credentials connect your app to your Firebase project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// App Check (optional, free on the Spark plan). It makes Firebase reject requests that
// did not come from this app running in a real browser, which is what blunts scripted
// abuse of the project (signup/login floods, bulk reads with a copied web config). It
// is inert unless VITE_APPCHECK_SITE_KEY (a public reCAPTCHA v3 site key) is set, and it
// only takes effect once enforcement is switched on in the Firebase console - see
// docs/APP_CHECK_SETUP.md. Local dev uses a debug token instead of reCAPTCHA.
const APP_CHECK_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY;
const enableAppCheck = (firebaseApp) => {
  if (!APP_CHECK_KEY || import.meta.env.VITE_USE_EMULATORS === 'true') return;
  if (import.meta.env.DEV) {
    // `true` makes the SDK print a debug token to register in the console.
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(APP_CHECK_KEY),
    isTokenAutoRefreshEnabled: true,
  });
};

// Initialize Firebase app instance
const app = initializeApp(firebaseConfig);
enableAppCheck(app);

// Initialize Firebase Authentication
// Used for user login, logout, and session management
export const auth = getAuth(app);

// Initialize Firestore Database
// Used for storing users, tasks, designations, and other data
export const db = getFirestore(app);

// Secondary Firebase app for creating users without affecting admin session
// This allows admins to create staff accounts without being logged out
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
enableAppCheck(secondaryApp);
export const secondaryAuth = getAuth(secondaryApp);

// Local emulators, opt-in via VITE_USE_EMULATORS=true.
//
// This exists so the app can be driven against seeded data covering every
// role. Production only ever holds accounts for the roles that happen to be
// staffed, so four of the five dashboards were unreachable for testing without
// creating real users in the live project.
//
// Guarded on the flag, so a normal build cannot accidentally point at
// localhost — the flag is absent from .env.production and from CI.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.info('🧪 Firebase pointed at local emulators');
}

export default app;
