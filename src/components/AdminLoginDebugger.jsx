import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, User, Database } from 'lucide-react';

const AdminLoginDebugger = () => {
  const [email, setEmail] = useState('admin@magnetar.com');
  const [password, setPassword] = useState('Admin123456!');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const addResult = (type, title, details) => {
    setResults(prev => [...prev, { 
      type, 
      title, 
      details, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const debugAdminLogin = async () => {
    setLoading(true);
    setResults([]);

    try {
      // Step 1: Check if admin user exists in Firebase Auth
      addResult('info', 'Step 1: Testing Firebase Authentication', 'Attempting to sign in with provided credentials...');
      
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        addResult('success', 'Firebase Auth: SUCCESS', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
          creationTime: firebaseUser.metadata.creationTime
        });

        // Step 2: Check if user document exists in Firestore
        addResult('info', 'Step 2: Checking Firestore User Document', 'Looking for user document in Firestore...');
        
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          addResult('success', 'Firestore Document: FOUND', {
            documentId: firebaseUser.uid,
            userData: userData
          });

          // Step 3: Verify admin role and permissions
          addResult('info', 'Step 3: Verifying Admin Role', 'Checking role and permissions...');
          
          if (userData.role === 'admin') {
            addResult('success', 'Admin Role: VERIFIED', {
              role: userData.role,
              tier: userData.tier,
              permissions: userData.permissions
            });
          } else {
            addResult('error', 'Admin Role: MISSING', {
              currentRole: userData.role,
              expectedRole: 'admin',
              solution: 'User document needs role field set to "admin"'
            });
          }

        } else {
          addResult('error', 'Firestore Document: NOT FOUND', {
            uid: firebaseUser.uid,
            solution: 'User document needs to be created in Firestore'
          });
        }

        // Step 4: Check routing logic
        addResult('info', 'Step 4: Simulating Routing Logic', 'Testing where user would be redirected...');
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          let redirectPath = '/login';
          
          if (userData.tier === 'Alpha') redirectPath = '/alpha';
          else if (userData.tier === 'Principal') redirectPath = '/principal';
          else if (userData.role === 'admin') redirectPath = '/admin';
          else if (userData.role === 'manager') redirectPath = '/manager';
          else redirectPath = '/staff';

          addResult('success', 'Routing Logic: CALCULATED', {
            expectedRedirect: redirectPath,
            userTier: userData.tier,
            userRole: userData.role
          });
        }

      } catch (authError) {
        addResult('error', 'Firebase Auth: FAILED', {
          errorCode: authError.code,
          errorMessage: authError.message,
          possibleCauses: [
            'User does not exist in Firebase Auth',
            'Incorrect password',
            'Network connectivity issues',
            'Firebase configuration problems'
          ]
        });
      }

      // Step 5: Check all users in Firestore
      addResult('info', 'Step 5: Scanning All Users', 'Checking what users exist in Firestore...');
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const allUsers = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        allUsers.push({
          id: doc.id,
          email: userData.email,
          role: userData.role,
          tier: userData.tier,
          name: userData.name
        });
      });

      if (allUsers.length > 0) {
        addResult('success', 'All Users in Firestore', {
          totalUsers: allUsers.length,
          users: allUsers,
          adminUsers: allUsers.filter(u => u.role === 'admin')
        });
      } else {
        addResult('warning', 'No Users Found in Firestore', {
          suggestion: 'Database needs to be initialized with admin user'
        });
      }

    } catch (error) {
      addResult('error', 'Debug Process Failed', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      setLoading(false);
    }
  };

  const createAdminUser = async () => {
    setLoading(true);
    try {
      addResult('info', 'Creating Admin User', 'Setting up admin user with proper credentials...');
      
      // This will use the existing CreateAdminUser logic
      const response = await fetch('/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      addResult('success', 'Admin User Creation Initiated', 'Check the Create Admin page for results');
    } catch (error) {
      addResult('error', 'Admin Creation Failed', { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-400" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      default: return <Database className="h-5 w-5 text-blue-400" />;
    }
  };

  const getStatusColor = (type) => {
    switch (type) {
      case 'success': return 'bg-green-900 border-green-700';
      case 'error': return 'bg-red-900 border-red-700';
      case 'warning': return 'bg-yellow-900 border-yellow-700';
      default: return 'bg-blue-900 border-blue-700';
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <User className="h-6 w-6" />
            Admin Login Debugger
          </h1>

          {/* Test Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Admin Email</label>
              <Input 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-700 border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Admin Password</label>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700 border-gray-600"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={debugAdminLogin}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              {loading ? 'Debugging...' : 'Debug Admin Login'}
            </Button>
            <Button 
              onClick={() => window.open('/create-admin', '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Create Admin User
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Debug Results</h2>
              {results.map((result, index) => (
                <Card key={index} className={`p-4 border ${getStatusColor(result.type)}`}>
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white">{result.title}</h3>
                        <Badge variant={result.type === 'success' ? 'default' : 'destructive'}>
                          {result.type.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-400">{result.timestamp}</span>
                      </div>
                      {typeof result.details === 'string' ? (
                        <p className="text-sm text-gray-300">{result.details}</p>
                      ) : (
                        <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto max-h-32">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Instructions */}
          <Card className="p-4 bg-gray-700 mt-6">
            <h3 className="font-semibold mb-2">Troubleshooting Steps</h3>
            <div className="text-sm space-y-2">
              <p><strong>1. Firebase Auth Issue:</strong> User might not exist in Firebase Authentication</p>
              <p><strong>2. Firestore Issue:</strong> User document might be missing in Firestore</p>
              <p><strong>3. Role Issue:</strong> User might not have admin role assigned</p>
              <p><strong>4. Routing Issue:</strong> App might not be redirecting to admin panel correctly</p>
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
};

export default AdminLoginDebugger;