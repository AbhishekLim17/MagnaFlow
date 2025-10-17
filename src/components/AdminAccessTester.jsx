import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, User, LogIn, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AdminAccessTester = () => {
  const [testResults, setTestResults] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const addResult = (type, message, details = null) => {
    setTestResults(prev => [...prev, {
      type,
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const testAdminFlow = async () => {
    setLoading(true);
    setTestResults([]);

    const adminCredentials = {
      email: 'admin@magnetar.com',
      password: 'Admin123456!'
    };

    try {
      // Step 1: Test Firebase Auth Login
      addResult('info', 'Testing Firebase Authentication...');
      
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        adminCredentials.email, 
        adminCredentials.password
      );
      
      addResult('success', 'Firebase Auth: Login successful', {
        uid: userCredential.user.uid,
        email: userCredential.user.email
      });

      // Step 2: Check Firestore user document
      addResult('info', 'Checking Firestore user document...');
      
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        addResult('success', 'Firestore Document: Found', userData);

        // Step 3: Check admin role
        if (userData.role === 'admin') {
          addResult('success', 'Admin Role: Verified', {
            role: userData.role,
            tier: userData.tier,
            permissions: userData.permissions
          });

          // Step 4: Test direct admin page access
          addResult('info', 'Testing direct admin page access...');
          
          // Wait a moment for auth context to update
          setTimeout(() => {
            navigate('/admin');
          }, 1000);

        } else {
          addResult('error', 'Admin Role: Missing or incorrect', {
            currentRole: userData.role,
            expectedRole: 'admin'
          });
        }
      } else {
        addResult('error', 'Firestore Document: Not found', {
          uid: userCredential.user.uid,
          suggestion: 'User document missing in Firestore'
        });
      }

    } catch (error) {
      addResult('error', 'Authentication failed', {
        code: error.code,
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectAdminAccess = () => {
    addResult('info', 'Attempting direct admin page access...');
    navigate('/admin');
  };

  const handleLogout = async () => {
    await logout();
    addResult('success', 'Logged out successfully');
  };

  const checkCurrentAuthState = () => {
    addResult('info', 'Current Authentication State', {
      isAuthenticated,
      user: user ? {
        name: user.name,
        email: user.email,
        role: user.role,
        tier: user.tier,
        uid: user.uid
      } : null
    });
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Admin Access Tester
          </h1>

          {/* Current Auth State */}
          <Card className="p-4 bg-gray-700 mb-6">
            <h2 className="text-lg font-semibold mb-2">Current Authentication State</h2>
            {isAuthenticated && user ? (
              <div className="space-y-1">
                <p><strong>Name:</strong> {user.name}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Role:</strong> <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></p>
                <p><strong>Tier:</strong> {user.tier}</p>
                <p><strong>UID:</strong> {user.uid}</p>
              </div>
            ) : (
              <p className="text-gray-300">Not authenticated</p>
            )}
          </Card>

          {/* Test Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Button 
              onClick={testAdminFlow}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              {loading ? 'Testing...' : 'Test Admin Login'}
            </Button>

            <Button 
              onClick={testDirectAdminAccess}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Direct Admin Access
            </Button>

            <Button 
              onClick={checkCurrentAuthState}
              variant="outline"
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Check Auth State
            </Button>

            {isAuthenticated && (
              <Button 
                onClick={handleLogout}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            )}
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <Card className="p-4 bg-gray-700">
              <h2 className="text-lg font-semibold mb-4">Test Results</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className={`p-3 rounded border-l-4 ${
                    result.type === 'success' ? 'bg-green-900 border-green-500' :
                    result.type === 'error' ? 'bg-red-900 border-red-500' :
                    'bg-blue-900 border-blue-500'
                  }`}>
                    <div className="flex items-start gap-2">
                      {result.type === 'success' && <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />}
                      {result.type === 'error' && <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />}
                      {result.type === 'info' && <User className="h-4 w-4 text-blue-400 mt-0.5" />}
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

          {/* Quick Links */}
          <Card className="p-4 bg-gray-700">
            <h3 className="font-semibold mb-2">Quick Links</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/simple-admin')}>
                Create Admin
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/login')}>
                Login Page
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/debug-admin')}>
                Debug Login
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                Home
              </Button>
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
};

export default AdminAccessTester;