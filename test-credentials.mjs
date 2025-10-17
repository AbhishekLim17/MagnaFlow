// Test different credential combinations
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

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

const testCredentials = [
  { email: 'abhishek@magnetar.in', password: 'Abhishek@1' },
  { email: 'abhishek@magnetar.in', password: 'Abhishek@123' },
  { email: 'abhishek@magnetar.in', password: 'abhishek@1' },
  { email: 'abhishek@magnetar.in', password: 'Abhishek1' },
  { email: 'admin@magnetar.com', password: 'Admin123456!' },
  { email: 'admin@magnetar.in', password: 'Admin123456!' }
];

async function testCredential(email, password) {
  try {
    console.log(`\n🔐 Testing: ${email} / ${password}`);
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ SUCCESS! Login worked!');
    console.log('User UID:', result.user.uid);
    console.log('User Email:', result.user.email);
    return { success: true, user: result.user };
  } catch (error) {
    console.log('❌ Failed:', error.code);
    return { success: false, error: error.code };
  }
}

async function testAllCredentials() {
  console.log('🧪 Testing all credential combinations...');
  
  for (const cred of testCredentials) {
    const result = await testCredential(cred.email, cred.password);
    if (result.success) {
      console.log('\n🎉 FOUND WORKING CREDENTIALS!');
      console.log(`Email: ${cred.email}`);
      console.log(`Password: ${cred.password}`);
      break;
    }
  }
  
  console.log('\n📧 If no credentials work, you can send a password reset email...');
  try {
    await sendPasswordResetEmail(auth, 'abhishek@magnetar.in');
    console.log('✅ Password reset email sent to abhishek@magnetar.in');
  } catch (error) {
    console.log('❌ Password reset failed:', error.code);
  }
}

testAllCredentials();