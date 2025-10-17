import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const DirectAdminSetup = () => {
  const [status, setStatus] = useState('Ready to create admin user...');
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAIL = 'abhishek@magnetar.in';
  const ADMIN_PASSWORD = 'Abhishek@1';

  const createAdminDirectly = async () => {
    setLoading(true);
    setStatus('Creating admin user...\n');

    try {
      // Step 1: Create Firebase Auth user
      console.log('Creating Firebase Auth user...');
      setStatus(prev => prev + '🔥 Creating Firebase Authentication user...\n');
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        ADMIN_EMAIL,
        ADMIN_PASSWORD
      );
      
      const firebaseUser = userCredential.user;
      setStatus(prev => prev + `✅ Firebase Auth user created with UID: ${firebaseUser.uid}\n`);

      // Step 2: Create Firestore document
      console.log('Creating Firestore document...');
      setStatus(prev => prev + '📄 Creating Firestore user document...\n');
      
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
      setStatus(prev => prev + '✅ Firestore user document created successfully\n');

      // Step 3: Test login immediately
      setStatus(prev => prev + '🧪 Testing login...\n');
      
      // Sign out first to test fresh login
      await auth.signOut();
      
      // Test login
      const testCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      setStatus(prev => prev + `✅ Login test successful! User: ${testCredential.user.email}\n`);
      
      // Sign out again to not interfere with main app
      await auth.signOut();
      
      setStatus(prev => prev + '\n🎉 ADMIN USER SETUP COMPLETE!\n');
      setStatus(prev => prev + `📧 Email: ${ADMIN_EMAIL}\n`);
      setStatus(prev => prev + `🔑 Password: ${ADMIN_PASSWORD}\n`);
      setStatus(prev => prev + '🚀 You can now login on the main page!\n');

    } catch (error) {
      console.error('Error creating admin:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        setStatus(prev => prev + '⚠️ Email already in use. Checking if user exists in Firestore...\n');
        
        try {
          // Check if user exists in Firestore
          const usersCollection = collection(db, 'users');
          const usersSnapshot = await getDocs(usersCollection);
          let userFound = false;
          
          usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.email === ADMIN_EMAIL) {
              userFound = true;
              setStatus(prev => prev + `✅ User found in Firestore with ID: ${doc.id}\n`);
              
              // Update to admin if not already
              if (userData.role !== 'admin') {
                setStatus(prev => prev + '🔄 Updating user to admin role...\n');
                // Update user to admin role
                const updateData = {
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
                
                setDoc(doc(db, 'users', doc.id), updateData, { merge: true });
                setStatus(prev => prev + '✅ User updated to admin role\n');
              }
            }
          });
          
          if (userFound) {
            setStatus(prev => prev + '\n🎉 ADMIN USER IS READY!\n');
            setStatus(prev => prev + `📧 Email: ${ADMIN_EMAIL}\n`);
            setStatus(prev => prev + `🔑 Password: ${ADMIN_PASSWORD}\n`);
            setStatus(prev => prev + '🚀 You can now login on the main page!\n');
          } else {
            setStatus(prev => prev + '❌ User not found in Firestore. Please try again.\n');
          }
          
        } catch (firestoreError) {
          setStatus(prev => prev + `❌ Error checking Firestore: ${firestoreError.message}\n`);
        }
      } else {
        setStatus(prev => prev + `❌ Error: ${error.message}\n`);
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-400">
          🚀 Direct Admin Setup
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Admin Credentials</h2>
          <div className="bg-gray-700 p-4 rounded">
            <p><strong>Email:</strong> {ADMIN_EMAIL}</p>
            <p><strong>Password:</strong> {ADMIN_PASSWORD}</p>
            <p><strong>Role:</strong> Admin (Alpha tier)</p>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <button 
            onClick={createAdminDirectly}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '🔄 Creating Admin...' : '🚀 Create Admin User Now'}
          </button>
        </div>

        <div className="bg-black p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Process Log:</h3>
          <pre className="text-green-400 text-sm whitespace-pre-wrap overflow-y-auto max-h-96">
            {status}
          </pre>
        </div>

        <div className="mt-6 bg-blue-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">After Admin Creation:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to the main login page: <a href="http://localhost:5173" target="_blank" className="text-blue-300 underline">http://localhost:5173</a></li>
            <li>Use email: {ADMIN_EMAIL}</li>
            <li>Use password: {ADMIN_PASSWORD}</li>
            <li>Click "Sign In"</li>
            <li>You should be redirected to the admin dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DirectAdminSetup;