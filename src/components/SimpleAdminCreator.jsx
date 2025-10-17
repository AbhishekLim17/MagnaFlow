import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, User } from 'lucide-react';

const SimpleAdminCreator = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const createAdminUser = async () => {
    setLoading(true);
    setResult(null);

    const adminData = {
      email: 'admin@magnetar.com',
      password: 'Admin123456!',
      name: 'System Administrator',
      role: 'admin',
      tier: 'Alpha'
    };

    try {
      console.log('Creating admin user...');
      
      // Step 1: Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        adminData.email, 
        adminData.password
      );
      const firebaseUser = userCredential.user;
      
      console.log('Firebase user created:', firebaseUser.uid);

      // Step 2: Create Firestore document
      const userDoc = {
        name: adminData.name,
        email: adminData.email,
        role: adminData.role,
        tier: adminData.tier,
        department: 'Administration',
        designation: 'System Administrator',
        company: 'magnetar-corp',
        employeeId: 'ADMIN001',
        phone: '+1-555-ADMIN',
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

      await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
      console.log('Firestore document created');

      // Step 3: Sign out the newly created user so we can test login
      await signOut(auth);
      console.log('Signed out admin user');

      setResult({
        success: true,
        message: 'Admin user created successfully!',
        credentials: {
          email: adminData.email,
          password: adminData.password,
          uid: firebaseUser.uid
        }
      });

    } catch (error) {
      console.error('Error creating admin user:', error);
      
      let errorMessage = 'Failed to create admin user';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Admin user already exists with this email';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format';
      } else {
        errorMessage = `Error: ${error.message}`;
      }

      setResult({
        success: false,
        message: errorMessage,
        error: error
      });
    } finally {
      setLoading(false);
    }
  };

  const testLogin = () => {
    // Redirect to login page
    window.location.href = '/login';
  };

  const testDebugger = () => {
    window.location.href = '/debug-admin';
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900 flex items-center justify-center">
      <Card className="max-w-md mx-auto p-6 bg-gray-800 text-white">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <User className="h-6 w-6" />
          Simple Admin Creator
        </h1>

        <div className="space-y-4">
          <div className="p-4 bg-gray-700 rounded">
            <h2 className="font-semibold mb-2">Admin Credentials</h2>
            <p className="text-sm"><strong>Email:</strong> admin@magnetar.com</p>
            <p className="text-sm"><strong>Password:</strong> Admin123456!</p>
          </div>

          <Button 
            onClick={createAdminUser}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating Admin User...' : 'Create Admin User'}
          </Button>

          {result && (
            <div className={`p-4 rounded flex items-start gap-2 ${
              result.success ? 'bg-green-900' : 'bg-red-900'
            }`}>
              {result.success ? 
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" /> :
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
              }
              <div>
                <p className="font-semibold">{result.success ? 'Success!' : 'Error!'}</p>
                <p className="text-sm">{result.message}</p>
                {result.credentials && (
                  <div className="mt-2 text-xs">
                    <p>UID: {result.credentials.uid}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={testLogin}
              variant="outline"
              className="flex-1"
            >
              Test Login
            </Button>
            <Button 
              onClick={testDebugger}
              variant="outline"
              className="flex-1"
            >
              Debug Login
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SimpleAdminCreator;