import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const AutoAdminCreator = () => {
  const [status, setStatus] = useState('Initializing...');
  const [success, setSuccess] = useState(false);

  const ADMIN_EMAIL = 'abhishek@magnetar.in';
  const ADMIN_PASSWORD = 'Abhishek@1';

  useEffect(() => {
    createAdminUser();
  }, []);

  const createAdminUser = async () => {
    try {
      setStatus('🔥 Creating Firebase Authentication user...');
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        ADMIN_EMAIL,
        ADMIN_PASSWORD
      );
      
      const firebaseUser = userCredential.user;
      setStatus(`✅ Firebase Auth user created with UID: ${firebaseUser.uid}`);

      // Create Firestore document
      setTimeout(() => setStatus(prev => prev + '\n📄 Creating Firestore user document...'), 500);
      
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
      
      setTimeout(() => {
        setStatus(prev => prev + '\n✅ Firestore user document created successfully');
        setTimeout(() => {
          setStatus(prev => prev + '\n\n🎉 ADMIN USER CREATED SUCCESSFULLY!');
          setTimeout(() => {
            setStatus(prev => prev + `\n📧 Email: ${ADMIN_EMAIL}`);
            setTimeout(() => {
              setStatus(prev => prev + `\n🔑 Password: ${ADMIN_PASSWORD}`);
              setTimeout(() => {
                setStatus(prev => prev + '\n👑 Role: Admin (Alpha tier)');
                setTimeout(() => {
                  setStatus(prev => prev + '\n🚀 Ready to login!');
                  setSuccess(true);
                }, 500);
              }, 500);
            }, 500);
          }, 500);
        }, 500);
      }, 1000);

    } catch (error) {
      console.error('❌ Error creating admin:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        setStatus(`⚠️ Email already in use - admin user may already exist\n\n🎉 ADMIN USER READY!\n📧 Email: ${ADMIN_EMAIL}\n🔑 Password: ${ADMIN_PASSWORD}\n👑 Role: Admin (Alpha tier)\n🚀 Ready to login!`);
        setSuccess(true);
      } else {
        setStatus(`❌ Error: ${error.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            🚀 Auto Admin Creator
          </h1>
          <p className="text-xl text-gray-300">Creating your admin user automatically...</p>
        </div>

        <div className="bg-black/50 backdrop-blur-sm p-8 rounded-xl border border-gray-700">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">Process Status</h2>
            <div className="bg-gray-900 p-6 rounded-lg min-h-[200px]">
              <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
                {status}
              </pre>
            </div>
          </div>

          {success && (
            <div className="space-y-4">
              <div className="bg-green-800/30 border border-green-600 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-green-400">✅ Admin User Created!</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Email:</strong> {ADMIN_EMAIL}</p>
                  <p><strong>Password:</strong> {ADMIN_PASSWORD}</p>
                  <p><strong>Role:</strong> Admin (Alpha tier)</p>
                  <p><strong>Company:</strong> Magnetar</p>
                </div>
              </div>

              <div className="bg-blue-800/30 border border-blue-600 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-blue-400">🚀 Next Steps</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Go to the main login page</li>
                  <li>Enter email: {ADMIN_EMAIL}</li>
                  <li>Enter password: {ADMIN_PASSWORD}</li>
                  <li>Click "Sign In"</li>
                  <li>Access your admin dashboard</li>
                </ol>
              </div>

              <div className="text-center">
                <a 
                  href="http://localhost:5173" 
                  className="inline-block bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 px-8 py-3 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105"
                >
                  🏠 Go to Login Page
                </a>
              </div>
            </div>
          )}

          {!success && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
              <p className="mt-4 text-gray-400">Creating admin user...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoAdminCreator;