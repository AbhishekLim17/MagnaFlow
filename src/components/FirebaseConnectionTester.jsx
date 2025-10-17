import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { auth, db } from '../firebase-config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useToast } from './ui/use-toast';

const FirebaseConnectionTester = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [testEmail, setTestEmail] = useState('abhishek@magnetar.in');
  const [testPassword, setTestPassword] = useState('Abhishek@1');
  const { toast } = useToast();

  const addResult = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, { message, type, timestamp }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Test Firebase configuration
  const testFirebaseConfig = () => {
    addResult('🔧 Testing Firebase Configuration...', 'info');
    
    try {
      if (!auth) {
        addResult('❌ Firebase Auth is not initialized', 'error');
        return false;
      }
      addResult('✅ Firebase Auth initialized successfully', 'success');
      
      if (!db) {
        addResult('❌ Firestore is not initialized', 'error');
        return false;
      }
      addResult('✅ Firestore initialized successfully', 'success');
      
      addResult(`🔑 Auth instance: ${auth.app.name}`, 'info');
      addResult(`📄 Database instance: ${db.app.name}`, 'info');
      
      return true;
    } catch (error) {
      addResult(`💥 Configuration error: ${error.message}`, 'error');
      return false;
    }
  };

  // Test Firestore connection
  const testFirestoreConnection = async () => {
    addResult('📊 Testing Firestore Connection...', 'info');
    
    try {
      const testDocRef = doc(db, 'test', 'connection');
      const testDoc = await getDoc(testDocRef);
      addResult('✅ Firestore read operation successful', 'success');
      
      // Try to write a test document
      await setDoc(testDocRef, {
        timestamp: new Date(),
        test: 'connection'
      });
      addResult('✅ Firestore write operation successful', 'success');
      
      return true;
    } catch (error) {
      addResult(`❌ Firestore connection failed: ${error.message}`, 'error');
      return false;
    }
  };

  // Test authentication with existing user
  const testAuthentication = async () => {
    addResult(`🔐 Testing Authentication with ${testEmail}...`, 'info');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
      addResult('✅ Authentication successful!', 'success');
      addResult(`👤 User UID: ${userCredential.user.uid}`, 'success');
      addResult(`📧 User Email: ${userCredential.user.email}`, 'success');
      
      // Check if user document exists in Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        addResult('✅ User document found in Firestore', 'success');
        const userData = userDoc.data();
        addResult(`👤 Name: ${userData.name}`, 'info');
        addResult(`🎯 Role: ${userData.role}`, 'info');
        addResult(`🏢 Department: ${userData.department}`, 'info');
      } else {
        addResult('⚠️ User document not found in Firestore', 'warning');
      }
      
      return true;
    } catch (error) {
      addResult(`❌ Authentication failed: ${error.message}`, 'error');
      addResult(`🔍 Error code: ${error.code}`, 'error');
      return false;
    }
  };

  // Test user creation
  const testUserCreation = async () => {
    const timestamp = Date.now();
    const newTestEmail = `test${timestamp}@magnetar.com`;
    const newTestPassword = 'TestPassword123!';
    
    addResult(`👤 Testing User Creation with ${newTestEmail}...`, 'info');
    
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, newTestEmail, newTestPassword);
      addResult('✅ Firebase Auth user created successfully', 'success');
      
      // Create Firestore document
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userData = {
        name: 'Test User',
        email: newTestEmail,
        role: 'staff',
        department: 'technical_submission',
        tier: 'Junior',
        companyId: 'magnetar-default',
        createdAt: new Date(),
        status: 'active'
      };
      
      await setDoc(userDocRef, userData);
      addResult('✅ User document created in Firestore', 'success');
      addResult(`📧 Created user: ${newTestEmail}`, 'success');
      
      return true;
    } catch (error) {
      addResult(`❌ User creation failed: ${error.message}`, 'error');
      addResult(`🔍 Error code: ${error.code}`, 'error');
      return false;
    }
  };

  // Test Firestore collections
  const testCollections = async () => {
    addResult('📚 Testing Firestore Collections...', 'info');
    
    try {
      const collections = ['users', 'tasks', 'departments', 'companies'];
      
      for (const collectionName of collections) {
        try {
          const querySnapshot = await getDocs(collection(db, collectionName));
          addResult(`📁 ${collectionName}: ${querySnapshot.size} documents`, 'info');
        } catch (error) {
          addResult(`❌ Failed to read ${collectionName}: ${error.message}`, 'error');
        }
      }
      
      return true;
    } catch (error) {
      addResult(`❌ Collections test failed: ${error.message}`, 'error');
      return false;
    }
  };

  // Run comprehensive test
  const runComprehensiveTest = async () => {
    setIsLoading(true);
    clearResults();
    
    addResult('🚀 Starting Comprehensive Firebase Test...', 'info');
    
    try {
      // Test 1: Configuration
      const configOk = testFirebaseConfig();
      if (!configOk) {
        addResult('❌ Configuration test failed - stopping tests', 'error');
        return;
      }
      
      // Test 2: Firestore Connection
      const firestoreOk = await testFirestoreConnection();
      if (!firestoreOk) {
        addResult('❌ Firestore connection test failed', 'error');
      }
      
      // Test 3: Collections
      await testCollections();
      
      // Test 4: Authentication
      const authOk = await testAuthentication();
      if (!authOk) {
        addResult('⚠️ Authentication test failed - check credentials', 'warning');
      }
      
      // Test 5: User Creation
      const creationOk = await testUserCreation();
      if (!creationOk) {
        addResult('❌ User creation test failed', 'error');
      }
      
      addResult('🏁 Comprehensive test completed!', 'info');
      
    } catch (error) {
      addResult(`💥 Test suite error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getResultColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto">
        <Card className="glass-effect p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">Firebase Connection Tester</h1>
            <p className="text-gray-300">Comprehensive Firebase & Authentication Testing</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <Label htmlFor="testEmail" className="text-gray-300">Test Email</Label>
              <Input
                id="testEmail"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="testPassword" className="text-gray-300">Test Password</Label>
              <Input
                id="testPassword"
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex gap-4 mb-6 justify-center flex-wrap">
            <Button 
              onClick={runComprehensiveTest} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Running Tests...' : 'Run All Tests'}
            </Button>
            <Button 
              onClick={testAuthentication} 
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              Test Login Only
            </Button>
            <Button 
              onClick={testUserCreation} 
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Test User Creation Only
            </Button>
            <Button 
              onClick={clearResults} 
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Clear Results
            </Button>
          </div>

          <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-3">Test Results:</h3>
            {testResults.length === 0 ? (
              <p className="text-gray-400">No test results yet. Click "Run All Tests" to start.</p>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {testResults.map((result, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-20">{result.timestamp}</span>
                    <span className={getResultColor(result.type)}>
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg">
            <h4 className="text-white font-semibold mb-2">What this tests:</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Firebase configuration and initialization</li>
              <li>• Firestore database connection and permissions</li>
              <li>• User authentication with existing credentials</li>
              <li>• New user creation and document storage</li>
              <li>• Collection access and document reading</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FirebaseConnectionTester;