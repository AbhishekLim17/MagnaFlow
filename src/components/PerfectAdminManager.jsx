import React, { useState } from 'react';
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const PerfectAdminManager = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [step, setStep] = useState(1);

  const NEW_ADMIN_EMAIL = 'abhishek@magnetar.in';
  const NEW_ADMIN_PASSWORD = 'Abhishek@1';

  const logStatus = (message) => {
    setStatus(prev => prev + '\n' + `[${new Date().toLocaleTimeString()}] ${message}`);
    console.log(message);
  };

  // Step 1: Check existing users
  const checkExistingUsers = async () => {
    setLoading(true);
    setStatus('🔍 Checking existing users...\n');
    
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        usersList.push(userData);
      });
      
      setUsers(usersList);
      logStatus(`Found ${usersList.length} users in Firestore`);
      
      const adminUsers = usersList.filter(user => user.role === 'admin');
      logStatus(`Found ${adminUsers.length} admin users:`);
      adminUsers.forEach(admin => {
        logStatus(`  - ${admin.email} (ID: ${admin.id})`);
      });
      
      setStep(2);
    } catch (error) {
      logStatus(`❌ Error checking users: ${error.message}`);
    }
    setLoading(false);
  };

  // Step 2: Remove existing admin users
  const removeExistingAdmins = async () => {
    setLoading(true);
    logStatus('\n🗑️ Removing existing admin users...');
    
    try {
      const adminUsers = users.filter(user => user.role === 'admin');
      
      for (const admin of adminUsers) {
        try {
          // Delete from Firestore
          await deleteDoc(doc(db, 'users', admin.id));
          logStatus(`✅ Removed admin from Firestore: ${admin.email}`);
        } catch (error) {
          logStatus(`❌ Error removing admin from Firestore: ${admin.email} - ${error.message}`);
        }
      }
      
      logStatus('✅ All admin users removed from Firestore');
      setStep(3);
    } catch (error) {
      logStatus(`❌ Error removing admins: ${error.message}`);
    }
    setLoading(false);
  };

  // Step 3: Create new admin user
  const createNewAdmin = async () => {
    setLoading(true);
    logStatus('\n👑 Creating new admin user...');
    
    try {
      // Create admin user in Authentication
      logStatus(`Creating Firebase Auth user: ${NEW_ADMIN_EMAIL}`);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        NEW_ADMIN_EMAIL,
        NEW_ADMIN_PASSWORD
      );
      
      const firebaseUser = userCredential.user;
      logStatus(`✅ Firebase Auth user created with UID: ${firebaseUser.uid}`);
      
      // Create comprehensive admin user document in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const adminDoc = {
        name: 'Abhishek',
        displayName: 'Abhishek (Admin)',
        email: NEW_ADMIN_EMAIL,
        role: 'admin',
        department: 'IT Administration',
        designation: 'System Administrator',
        tier: 'Alpha',
        employeeId: 'ADM001',
        joiningDate: new Date(),
        reportingTo: null,
        phone: '+91-9876543210',
        company: 'Magnetar',
        status: 'active',
        permissions: {
          // User Management
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canViewAllUsers: true,
          canManageRoles: true,
          canManagePermissions: true,
          
          // Project Management
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewAllProjects: true,
          canManageProjects: true,
          canAssignTasks: true,
          
          // System Administration
          canManageSystem: true,
          canViewSystemLogs: true,
          canManageDatabase: true,
          canManageBackups: true,
          canManageSettings: true,
          
          // Data Access
          canViewAllData: true,
          canExportData: true,
          canImportData: true,
          canManageReports: true,
          
          // Department Management
          canManageDepartments: true,
          canViewAllDepartments: true,
          canManageDesignations: true,
          
          // Financial
          canViewFinancials: true,
          canManageBudgets: true,
          canApproveExpenses: true
        },
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'Asia/Kolkata',
          emailNotifications: true,
          smsNotifications: false
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: null,
          loginCount: 0,
          isActive: true,
          emailVerified: true,
          accountSetupComplete: true
        }
      };
      
      await setDoc(userDocRef, adminDoc);
      logStatus('✅ Admin user document created in Firestore');
      
      // Verify the creation
      logStatus('\n🔍 Verifying admin user creation...');
      const verifyDoc = await getDocs(query(collection(db, 'users'), where('email', '==', NEW_ADMIN_EMAIL)));
      if (!verifyDoc.empty) {
        logStatus('✅ Admin user verified in Firestore');
      } else {
        logStatus('❌ Admin user not found in verification');
      }
      
      setStep(4);
      logStatus('\n🎉 NEW ADMIN USER CREATED SUCCESSFULLY!');
      logStatus(`📧 Email: ${NEW_ADMIN_EMAIL}`);
      logStatus(`🔑 Password: ${NEW_ADMIN_PASSWORD}`);
      logStatus(`👑 Role: Admin (Alpha tier)`);
      logStatus(`🏢 Company: Magnetar`);
      logStatus('\n✅ Ready to login!');
      
    } catch (error) {
      logStatus(`❌ Error creating admin: ${error.message}`);
      if (error.code === 'auth/email-already-in-use') {
        logStatus('ℹ️ Email already in use. Trying to update existing user...');
        await updateExistingUserToAdmin();
      }
    }
    setLoading(false);
  };

  // Helper function to update existing user to admin
  const updateExistingUserToAdmin = async () => {
    try {
      // Find user by email in Firestore
      const usersQuery = query(collection(db, 'users'), where('email', '==', NEW_ADMIN_EMAIL));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;
        
        // Update to admin role
        const adminUpdate = {
          role: 'admin',
          tier: 'Alpha',
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
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, 'users', userId), adminUpdate, { merge: true });
        logStatus('✅ Updated existing user to admin role');
        setStep(4);
      } else {
        logStatus('❌ User not found in Firestore');
      }
    } catch (error) {
      logStatus(`❌ Error updating user to admin: ${error.message}`);
    }
  };

  // Step 4: Test login
  const testAdminLogin = async () => {
    setLoading(true);
    logStatus('\n🧪 Testing admin login...');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, NEW_ADMIN_EMAIL, NEW_ADMIN_PASSWORD);
      logStatus('✅ Login successful!');
      logStatus(`Logged in as: ${userCredential.user.email}`);
      logStatus(`UID: ${userCredential.user.uid}`);
      
      // Sign out to not interfere with main app
      await auth.signOut();
      logStatus('✅ Signed out from test');
      
      logStatus('\n🎯 ADMIN SETUP COMPLETE!');
      logStatus('You can now use the login page with the new credentials.');
      
    } catch (error) {
      logStatus(`❌ Login test failed: ${error.message}`);
    }
    setLoading(false);
  };

  const resetProcess = () => {
    setStatus('');
    setUsers([]);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          🎯 Perfect Admin Manager
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Control Panel */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">🎮 Control Panel</h2>
            
            <div className="space-y-4">
              {step >= 1 && (
                <button 
                  onClick={checkExistingUsers}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {step === 1 ? '🔍 Step 1: Check Existing Users' : '✅ Step 1: Users Checked'}
                </button>
              )}
              
              {step >= 2 && (
                <button 
                  onClick={removeExistingAdmins}
                  disabled={loading || step < 2}
                  className="w-full bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {step === 2 ? '🗑️ Step 2: Remove Old Admins' : '✅ Step 2: Admins Removed'}
                </button>
              )}
              
              {step >= 3 && (
                <button 
                  onClick={createNewAdmin}
                  disabled={loading || step < 3}
                  className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {step === 3 ? '👑 Step 3: Create New Admin' : '✅ Step 3: Admin Created'}
                </button>
              )}
              
              {step >= 4 && (
                <button 
                  onClick={testAdminLogin}
                  disabled={loading || step < 4}
                  className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg disabled:opacity-50 transition-colors"
                >
                  🧪 Step 4: Test Login
                </button>
              )}
              
              <button 
                onClick={resetProcess}
                disabled={loading}
                className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-3 rounded-lg disabled:opacity-50 transition-colors"
              >
                🔄 Reset Process
              </button>
            </div>

            {/* New Admin Credentials */}
            <div className="mt-8 bg-gradient-to-r from-green-800 to-blue-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🔑 New Admin Credentials</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> {NEW_ADMIN_EMAIL}</p>
                <p><strong>Password:</strong> {NEW_ADMIN_PASSWORD}</p>
                <p><strong>Role:</strong> Admin (Alpha tier)</p>
                <p><strong>Company:</strong> Magnetar</p>
              </div>
            </div>
          </div>

          {/* Status Log */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-6">📋 Process Log</h2>
            <div className="bg-black p-4 rounded-lg h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
                {status || 'Ready to start admin management process...\n\nClick "Step 1: Check Existing Users" to begin.'}
              </pre>
            </div>
            
            {loading && (
              <div className="mt-4 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <span className="ml-2">Processing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Access Links */}
        <div className="mt-8 bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-xl font-semibold mb-4">🚀 Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a 
              href="http://localhost:5176" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg text-center transition-colors"
            >
              🏠 Main Login Page
            </a>
            <a 
              href="http://localhost:5176/admin-debug" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg text-center transition-colors"
            >
              🛠️ Debug Panel
            </a>
            <a 
              href="https://console.firebase.google.com/project/magnaflow-07sep25" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-orange-600 hover:bg-orange-700 px-4 py-3 rounded-lg text-center transition-colors"
            >
              🔥 Firebase Console
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfectAdminManager;