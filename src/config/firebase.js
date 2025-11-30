// Firebase Configuration and Initialization
// This file sets up Firebase services: Authentication and Firestore Database

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export default app;
