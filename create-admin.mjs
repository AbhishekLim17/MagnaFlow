// Direct admin creation script
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRyUccKpfACAxlqZrFQDxtXbvmrIhDuJA",
  authDomain: "magnaflow-07sep25.firebaseapp.com",
  projectId: "magnaflow-07sep25",
  storageBucket: "magnaflow-07sep25.firebasestorage.app",
  messagingSenderId: "130194515342",
  appId: "1:130194515342:web:4d2595334ace93aa0270df",
  measurementId: "G-QQ838JFSWP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'abhishek@magnetar.in';
const ADMIN_PASSWORD = 'Abhishek@1';

async function createAdminUser() {
  try {
    console.log('🔥 Creating Firebase Authentication user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    );
    
    const firebaseUser = userCredential.user;
    console.log('✅ Firebase Auth user created with UID:', firebaseUser.uid);

    // Create Firestore document
    console.log('📄 Creating Firestore user document...');
    
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const adminUserData = {
      name: 'Abhishek',
      displayName: 'Abhishek Kumar',
      email: ADMIN_EMAIL,
      role: 'admin',
      department: 'IT',
      designation: 'System Administrator',
      tier: 'Alpha',
      employeeId: 'ADM001',
      joiningDate: new Date(),
      reportingTo: null,
      phone: '+91-9876543210',
      company: 'Magnetar',
      status: 'active',
      permissions: {
        canCreateUsers: true,
        canEditUsers: true,
        canDeleteUsers: true,
        canViewAllUsers: true,
        canManageRoles: true,
        canManagePermissions: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewAllProjects: true,
        canManageProjects: true,
        canAssignTasks: true,
        canManageSystem: true,
        canViewSystemLogs: true,
        canManageDatabase: true,
        canManageBackups: true,
        canManageSettings: true,
        canViewAllData: true,
        canExportData: true,
        canImportData: true,
        canManageReports: true,
        canManageDepartments: true,
        canViewAllDepartments: true,
        canManageDesignations: true,
        canViewFinancials: true,
        canManageBudgets: true,
        canApproveExpenses: true
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    await setDoc(userDocRef, adminUserData);
    console.log('✅ Firestore user document created successfully');

    console.log('\n🎉 ADMIN USER CREATED SUCCESSFULLY!');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    console.log('👑 Role: Admin (Alpha tier)');
    console.log('🚀 Ready to login!');

    return { success: true, uid: firebaseUser.uid };

  } catch (error) {
    console.error('❌ Error creating admin:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️ Email already in use - admin user may already exist');
      console.log('Try logging in with the credentials:', ADMIN_EMAIL, '/', ADMIN_PASSWORD);
    }
    
    return { success: false, error: error.message };
  }
}

// Run the function
createAdminUser();