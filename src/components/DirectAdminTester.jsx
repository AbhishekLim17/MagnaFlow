import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, User, Database, Shield } from 'lucide-react';

const DirectAdminTester = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [currentStep, setCurrentStep] = useState('');

  const addResult = (type, message, details = null) => {
    setResults(prev => [...prev, {
      type,
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  // Direct Firebase operations without AuthContext
  const createAndTestAdmin = async () => {
    setLoading(true);
    clearResults();

    const adminData = {
      email: 'admin@magnetar.com',
      password: 'Admin123456!'
    };

    try {
      setCurrentStep('Step 1: Creating Firebase Auth User');
      addResult('info', 'Creating Firebase Auth user...', adminData.email);

      let userCredential;
      try {
        // Try to create user
        userCredential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
        addResult('success', 'Firebase Auth user created successfully', {
          uid: userCredential.user.uid,
          email: userCredential.user.email
        });
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          addResult('warning', 'User already exists, continuing with existing user');
          // Sign out any current user and sign in with admin
          await signOut(auth);
          userCredential = await signInWithEmailAndPassword(auth, adminData.email, adminData.password);
          addResult('success', 'Signed in with existing user', {
            uid: userCredential.user.uid
          });
        } else {
          throw authError;
        }
      }

      const firebaseUser = userCredential.user;

      setCurrentStep('Step 2: Creating Firestore Document');
      addResult('info', 'Creating Firestore user document...');

      const userDoc = {
        name: 'System Administrator',
        email: adminData.email,
        role: 'admin',
        tier: 'Alpha',
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
      addResult('success', 'Firestore document created', userDoc);

      setCurrentStep('Step 3: Verifying User Document');
      addResult('info', 'Verifying user document exists...');

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        addResult('success', 'User document verified', userData);
        
        if (userData.role === 'admin') {
          addResult('success', 'Admin role confirmed', {
            role: userData.role,
            permissions: userData.permissions
          });
        } else {
          addResult('error', 'Admin role not set correctly', {
            currentRole: userData.role,
            expectedRole: 'admin'
          });
        }
      } else {
        addResult('error', 'User document not found after creation');
      }

      setCurrentStep('Step 4: Testing Authentication State');
      addResult('info', 'Checking current authentication state...');

      // Check if Firebase Auth recognizes the user
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === firebaseUser.uid) {
        addResult('success', 'Authentication state confirmed', {
          uid: currentUser.uid,
          email: currentUser.email,
          emailVerified: currentUser.emailVerified
        });

        setCurrentStep('Step 5: Testing Login Flow');
        addResult('info', 'Testing login flow by signing out and back in...');

        // Sign out and sign back in to test login flow
        await signOut(auth);
        addResult('info', 'Signed out successfully');

        const loginResult = await signInWithEmailAndPassword(auth, adminData.email, adminData.password);
        addResult('success', 'Login test successful', {
          uid: loginResult.user.uid,
          loginTime: new Date().toISOString()
        });

        setCurrentStep('Completed Successfully!');
        addResult('success', '🎉 Admin user is ready! You can now login with these credentials', {
          email: adminData.email,
          password: adminData.password,
          nextStep: 'Go to /login and use these credentials'
        });

      } else {
        addResult('error', 'Authentication state not confirmed');
      }

    } catch (error) {
      addResult('error', `Error in ${currentStep}`, {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  const testDirectLogin = async () => {
    setLoading(true);
    clearResults();

    try {
      addResult('info', 'Testing direct login without creation...');
      
      const loginResult = await signInWithEmailAndPassword(auth, 'admin@magnetar.com', 'Admin123456!');
      addResult('success', 'Direct login successful', {
        uid: loginResult.user.uid,
        email: loginResult.user.email
      });

      // Check if user document exists
      const userDocRef = doc(db, 'users', loginResult.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        addResult('success', 'User document found', userData);
        
        if (userData.role === 'admin') {
          addResult('success', '✅ Admin login is working! You can now access the admin panel');
          addResult('info', 'Try going to /login or directly to /admin');
        } else {
          addResult('warning', 'User exists but role is not admin', {
            currentRole: userData.role
          });
        }
      } else {
        addResult('error', 'User document not found in Firestore');
      }

    } catch (error) {
      addResult('error', 'Direct login failed', {
        code: error.code,
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const checkFirebaseConnection = async () => {
    setLoading(true);
    clearResults();

    try {
      addResult('info', 'Testing Firebase connection...');

      // Test Firestore connection
      const testDoc = doc(db, 'test', 'connection');
      await setDoc(testDoc, { 
        timestamp: new Date(),
        test: 'Firebase connection test'
      });
      addResult('success', 'Firestore connection working');

      // Test Auth connection
      const currentUser = auth.currentUser;
      addResult('success', 'Firebase Auth connection working', {
        currentUser: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email
        } : 'No user signed in'
      });

    } catch (error) {
      addResult('error', 'Firebase connection failed', {
        code: error.code,
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    window.location.href = '/login';
  };

  const goToAdmin = () => {
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Direct Admin Tester (Bypass AuthContext)
          </h1>

          <div className="mb-6 p-4 bg-blue-900 rounded">
            <h2 className="font-semibold mb-2">Admin Credentials</h2>
            <p className="text-sm"><strong>Email:</strong> admin@magnetar.com</p>
            <p className="text-sm"><strong>Password:</strong> Admin123456!</p>
          </div>

          {currentStep && (
            <div className="mb-6 p-4 bg-yellow-900 rounded">
              <p className="font-semibold">Current Step: {currentStep}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Button 
              onClick={createAndTestAdmin}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              {loading ? 'Processing...' : 'Create & Test Admin'}
            </Button>

            <Button 
              onClick={testDirectLogin}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Test Direct Login
            </Button>

            <Button 
              onClick={checkFirebaseConnection}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Test Firebase
            </Button>

            <Button 
              onClick={clearResults}
              disabled={loading}
              variant="outline"
            >
              Clear Results
            </Button>
          </div>

          <div className="flex gap-4 mb-6">
            <Button onClick={goToLogin} variant="secondary">
              Go to Login Page
            </Button>
            <Button onClick={goToAdmin} variant="secondary">
              Go to Admin Panel
            </Button>
          </div>

          {results.length > 0 && (
            <Card className="p-4 bg-gray-700">
              <h2 className="text-lg font-semibold mb-4">Test Results</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className={`p-3 rounded border-l-4 ${
                    result.type === 'success' ? 'bg-green-900 border-green-500' :
                    result.type === 'error' ? 'bg-red-900 border-red-500' :
                    result.type === 'warning' ? 'bg-yellow-900 border-yellow-500' :
                    'bg-blue-900 border-blue-500'
                  }`}>
                    <div className="flex items-start gap-2">
                      {result.type === 'success' && <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />}
                      {result.type === 'error' && <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />}
                      {result.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />}
                      {result.type === 'info' && <Database className="h-4 w-4 text-blue-400 mt-0.5" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{result.message}</span>
                          <span className="text-xs text-gray-400">{result.timestamp}</span>
                        </div>
                        {result.details && (
                          <pre className="text-xs bg-gray-800 p-2 rounded mt-2 overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DirectAdminTester;