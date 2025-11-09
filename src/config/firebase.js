// Firebase Configuration and Initialization
// This file sets up Firebase services: Authentication and Firestore Database

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase project configuration
// These credentials connect your app to your Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyCRyUccKpfACAxlqZrFQDxtXbvmrIhDuJA",
  authDomain: "magnaflow-07sep25.firebaseapp.com",
  projectId: "magnaflow-07sep25",
  storageBucket: "magnaflow-07sep25.firebasestorage.app",
  messagingSenderId: "130194515342",
  appId: "1:130194515342:web:4d2595334ace93aa0270df",
  measurementId: "G-QQ838JFSWP"
};

// Initialize Firebase app instance
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
// Used for user login, logout, and session management
export const auth = getAuth(app);

// Initialize Firestore Database
// Used for storing users, tasks, designations, and other data
export const db = getFirestore(app);

export default app;
