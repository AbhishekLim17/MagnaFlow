// Create a fresh admin user with known credentials
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
const db = getFirestore(app);

// Use a different email to avoid conflicts
const NEW_ADMIN_EMAIL = 'admin@magnetar.test';
const NEW_ADMIN_PASSWORD = 'AdminTest123!';

async function createFreshAdmin() {
  try {
    console.log('🔥 Creating fresh admin user...');
    console.log(`Email: ${NEW_ADMIN_EMAIL}`);
    console.log(`Password: ${NEW_ADMIN_PASSWORD}`);
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      NEW_ADMIN_EMAIL,
      NEW_ADMIN_PASSWORD
    );
    
    const firebaseUser = userCredential.user;
    console.log('✅ Firebase Auth user created with UID:', firebaseUser.uid);

    // Create Firestore document
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const adminUserData = {
      name: 'Test Admin',
      displayName: 'Test Administrator',
      email: NEW_ADMIN_EMAIL,
      role: 'admin',
      department: 'IT',
      designation: 'System Administrator',
      tier: 'Alpha',
      employeeId: 'ADMIN001',
      joiningDate: new Date(),
      phone: '+1234567890',
      company: 'Magnetar',
      companyId: 'magnetar-default',
      status: 'active',
      permissions: {
        canCreateUsers: true,
        canEditUsers: true,
        canViewAllUsers: true,
        canManageProjects: true,
        canAccessAllDepartments: true
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    
    await setDoc(userDocRef, adminUserData);
    console.log('✅ User document created successfully in Firestore');
    
    // Test login immediately
    console.log('\n🧪 Testing login with new credentials...');
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const testLogin = await signInWithEmailAndPassword(auth, NEW_ADMIN_EMAIL, NEW_ADMIN_PASSWORD);
    console.log('✅ Login test successful!');
    console.log('UID:', testLogin.user.uid);
    
    console.log('\n🎉 SUCCESS! Use these credentials to login:');
    console.log(`Email: ${NEW_ADMIN_EMAIL}`);
    console.log(`Password: ${NEW_ADMIN_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

createFreshAdmin();