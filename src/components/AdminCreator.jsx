import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const AdminCreator = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const createAdminUser = async () => {
    setLoading(true);
    setStatus('Creating admin user...');
    
    try {
      // Create admin user in Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        'abhishek@magnetar.in',
        'Abhishek@1'
      );
      
      const firebaseUser = userCredential.user;
      setStatus(`Admin user created in Auth with UID: ${firebaseUser.uid}`);
      
      // Create admin user document in Firestore
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const adminDoc = {
        name: 'Abhishek',
        email: 'abhishek@magnetar.in',
        role: 'admin',
        department: 'IT',
        designation: 'System Administrator',
        tier: 'Alpha',
        employeeId: 'ADMIN001',
        joiningDate: new Date(),
        reportingTo: null,
        phone: '+1-555-0123',
        company: 'Magnetar',
        status: 'active',
        permissions: {
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canViewAllUsers: true,
          canManageProjects: true,
          canManageRoles: true,
          canViewAllData: true,
          canManageSystem: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      
      await setDoc(userDocRef, adminDoc);
      setStatus('✅ Admin user created successfully! You can now login with abhishek@magnetar.in / Abhishek@1');
      
    } catch (error) {
      console.error('Error creating admin:', error);
      if (error.code === 'auth/email-already-in-use') {
        setStatus('ℹ️ Admin user already exists! Try logging in with abhishek@magnetar.in / Abhishek@1!');
      } else {
        setStatus(`❌ Error: ${error.message}`);
      }
    }
    setLoading(false);
  };

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testing Firebase connection...');
    
    try {
      // Test Firestore connection
      const testDoc = doc(db, 'test', 'connection');
      await setDoc(testDoc, { timestamp: new Date(), test: true });
      setStatus('✅ Firebase connection is working!');
    } catch (error) {
      setStatus(`❌ Firebase connection failed: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">🔧 MagnaFlow Admin Creator</h1>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Firebase Status</h2>
          <div className="space-y-4">
            <button 
              onClick={testConnection}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mr-4 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Firebase Connection'}
            </button>
            
            <button 
              onClick={createAdminUser}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Admin User'}
            </button>
          </div>
          
          {status && (
            <div className="mt-4 p-4 bg-gray-700 rounded">
              <p className="whitespace-pre-wrap">{status}</p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">📋 Admin Credentials</h2>
          <div className="space-y-2">
            <p><strong>Email:</strong> abhishek@magnetar.in</p>
            <p><strong>Password:</strong> Abhishek@1</p>
            <p><strong>Role:</strong> Admin (Alpha tier)</p>
            <p><strong>Permissions:</strong> Full system access</p>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mt-6">
          <h2 className="text-xl font-semibold mb-4">🚀 Next Steps</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Click "Test Firebase Connection" to verify connectivity</li>
            <li>Click "Create Admin User" to set up the admin account</li>
            <li>Go back to the main login page</li>
            <li>Use the admin credentials to login</li>
            <li>You should be redirected to the admin dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AdminCreator;