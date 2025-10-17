import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Database } from 'lucide-react';

// Direct import to test Firebase connection
import { auth, db } from '@/firebase-config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const FirebaseConnectionTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (type, message, details = null) => {
    setTestResults(prev => [...prev, {
      type,
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const testFirebaseConfig = () => {
    addResult('info', 'Testing Firebase Configuration');
    
    try {
      // Check if Firebase objects exist
      if (auth) {
        addResult('success', 'Firebase Auth imported successfully', {
          authApp: auth.app.name,
          config: auth.config
        });
      } else {
        addResult('error', 'Firebase Auth import failed');
      }

      if (db) {
        addResult('success', 'Firestore imported successfully', {
          dbApp: db.app.name
        });
      } else {
        addResult('error', 'Firestore import failed');
      }

      // Test current auth state
      const currentUser = auth.currentUser;
      addResult('info', 'Current Auth State', {
        currentUser: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email
        } : 'No user signed in'
      });

    } catch (error) {
      addResult('error', 'Firebase config test failed', {
        error: error.message
      });
    }
  };

  const testBasicAuth = async () => {
    setLoading(true);
    try {
      addResult('info', 'Testing basic authentication...');

      // Try to sign in with test credentials
      const testEmail = 'admin@magnetar.com';
      const testPassword = 'Admin123456!';

      try {
        const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
        addResult('success', 'Authentication successful!', {
          uid: userCredential.user.uid,
          email: userCredential.user.email
        });

        // Check for Firestore document
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          addResult('success', 'User document found in Firestore', userDoc.data());
        } else {
          addResult('warning', 'User authenticated but no Firestore document');
        }

      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          addResult('warning', 'User not found - need to create admin user');
        } else if (authError.code === 'auth/wrong-password') {
          addResult('warning', 'Wrong password - user exists but password incorrect');
        } else {
          addResult('error', 'Authentication failed', {
            code: authError.code,
            message: authError.message
          });
        }
      }

    } catch (error) {
      addResult('error', 'Basic auth test failed', {
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const createAdminDirectly = async () => {
    setLoading(true);
    try {
      addResult('info', 'Creating admin user directly...');

      const adminEmail = 'admin@magnetar.com';
      const adminPassword = 'Admin123456!';

      try {
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        addResult('success', 'Firebase Auth user created', {
          uid: userCredential.user.uid
        });

        // Create Firestore document
        const adminDoc = {
          name: 'System Administrator',
          email: adminEmail,
          role: 'admin',
          tier: 'Alpha',
          department: 'Administration',
          designation: 'System Administrator',
          status: 'active',
          permissions: {
            canCreateUsers: true,
            canEditUsers: true,
            canViewAllUsers: true,
            canManageProjects: true
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await setDoc(doc(db, 'users', userCredential.user.uid), adminDoc);
        addResult('success', 'Admin user document created in Firestore', adminDoc);

        addResult('success', '✅ Admin user ready! Try logging in now');

      } catch (createError) {
        if (createError.code === 'auth/email-already-in-use') {
          addResult('warning', 'Admin user already exists - that\'s good!');
        } else {
          addResult('error', 'Failed to create admin user', {
            code: createError.code,
            message: createError.message
          });
        }
      }

    } catch (error) {
      addResult('error', 'Admin creation failed', {
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testFirebaseConfig();
  }, []);

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Firebase Connection Test
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button 
              onClick={testFirebaseConfig}
              variant="outline"
            >
              Test Config
            </Button>
            <Button 
              onClick={testBasicAuth}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test Auth'}
            </Button>
            <Button 
              onClick={createAdminDirectly}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Admin'}
            </Button>
          </div>

          <div className="flex gap-4 mb-6">
            <Button 
              onClick={() => window.open('/login', '_blank')}
              variant="secondary"
            >
              Open Login Page
            </Button>
            <Button 
              onClick={() => window.open('/admin', '_blank')}
              variant="secondary"
            >
              Try Admin Panel
            </Button>
          </div>

          {testResults.length > 0 && (
            <Card className="p-4 bg-gray-700">
              <h2 className="text-lg font-semibold mb-4">Test Results</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className={`p-3 rounded ${
                    result.type === 'success' ? 'bg-green-900' :
                    result.type === 'error' ? 'bg-red-900' :
                    result.type === 'warning' ? 'bg-yellow-900' :
                    'bg-blue-900'
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

          <Card className="p-4 bg-gray-700">
            <h3 className="font-semibold mb-2">Expected Admin Credentials</h3>
            <p className="text-sm"><strong>Email:</strong> admin@magnetar.com</p>
            <p className="text-sm"><strong>Password:</strong> Admin123456!</p>
            <p className="text-sm text-gray-400 mt-2">
              After creating the admin user, you should be able to login with these credentials
            </p>
          </Card>
        </Card>
      </div>
    </div>
  );
};

export default FirebaseConnectionTest;