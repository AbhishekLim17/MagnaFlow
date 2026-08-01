// Firebase Configuration and Initialization
// This file sets up Firebase services: Authentication and Firestore Database

import { initializeApp } from 'firebase/app';
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

// Initialize Firebase app instance
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
// Used for user login, logout, and session management
export const auth = getAuth(app);

// Initialize Firestore Database
// Used for storing users, tasks, designations, and other data
export const db = getFirestore(app);

// Secondary Firebase app for creating users without affecting admin session
// This allows admins to create staff accounts without being logged out
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
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
