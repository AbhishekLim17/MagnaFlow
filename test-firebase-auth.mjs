// Quick Firebase Auth Test
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCRyUccKpfACAxlqZrFQDxtXbvmrIhDuJA",
  authDomain: "magnaflow-07sep25.firebaseapp.com",
  projectId: "magnaflow-07sep25",
  storageBucket: "magnaflow-07sep25.firebasestorage.app",
  messagingSenderId: "130194515342",
  appId: "1:130194515342:web:4d2595334ace93aa0270df",
  measurementId: "G-QQ838JFSWP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testLogin() {
  try {
    console.log('🔐 Testing Firebase Auth connection...');
    console.log('Auth instance:', auth);
    console.log('Project ID:', auth.config.projectId);
    
    const result = await signInWithEmailAndPassword(auth, 'abhishek@magnetar.in', 'Abhishek@1');
    console.log('✅ Login successful!');
    console.log('User UID:', result.user.uid);
    console.log('User Email:', result.user.email);
    console.log('Email Verified:', result.user.emailVerified);
    
    return { success: true, user: result.user };
  } catch (error) {
    console.error('❌ Login failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    return { success: false, error: error.message, code: error.code };
  }
}

// Test immediately when script loads
testLogin();