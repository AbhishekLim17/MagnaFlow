import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

const ComprehensiveDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addDiagnostic = (test, status, message, details = null) => {
    setDiagnostics(prev => [...prev, { test, status, message, details, timestamp: new Date().toLocaleTimeString() }]);
  };

  const clearDiagnostics = () => {
    setDiagnostics([]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    clearDiagnostics();
    
    addDiagnostic('System Check', 'info', 'Starting comprehensive diagnostic...');

    // 1. Check if we're in browser environment
    try {
      addDiagnostic('Environment', 'info', 'Checking environment...');
      if (typeof window === 'undefined') {
        addDiagnostic('Environment', 'error', 'Not running in browser environment');
        return;
      }
      addDiagnostic('Environment', 'success', 'Browser environment confirmed');
      
      // 2. Check network connectivity
      addDiagnostic('Network', 'info', 'Checking network connectivity...');
      if (!navigator.onLine) {
        addDiagnostic('Network', 'error', 'No internet connection detected');
        return;
      }
      addDiagnostic('Network', 'success', 'Internet connection available');

      // 3. Test Firebase modules import
      addDiagnostic('Firebase Imports', 'info', 'Testing Firebase module imports...');
      try {
        const { auth, db } = await import('../firebase-config');
        if (auth && db) {
          addDiagnostic('Firebase Imports', 'success', 'Firebase modules imported successfully');
          addDiagnostic('Firebase Config', 'info', `Auth Domain: ${auth.config.authDomain}`);
          addDiagnostic('Firebase Config', 'info', `Project ID: ${auth.config.projectId}`);
        } else {
          addDiagnostic('Firebase Imports', 'error', 'Firebase modules not properly initialized');
        }
      } catch (error) {
        addDiagnostic('Firebase Imports', 'error', `Failed to import Firebase: ${error.message}`);
      }

      // 4. Test Firebase Auth methods
      addDiagnostic('Firebase Auth', 'info', 'Testing Firebase Auth methods...');
      try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        if (typeof signInWithEmailAndPassword === 'function') {
          addDiagnostic('Firebase Auth', 'success', 'Firebase Auth methods available');
        } else {
          addDiagnostic('Firebase Auth', 'error', 'Firebase Auth methods not available');
        }
      } catch (error) {
        addDiagnostic('Firebase Auth', 'error', `Firebase Auth import failed: ${error.message}`);
      }

      // 5. Test Firestore methods
      addDiagnostic('Firestore', 'info', 'Testing Firestore methods...');
      try {
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        if (typeof doc === 'function' && typeof getDoc === 'function') {
          addDiagnostic('Firestore', 'success', 'Firestore methods available');
        } else {
          addDiagnostic('Firestore', 'error', 'Firestore methods not available');
        }
      } catch (error) {
        addDiagnostic('Firestore', 'error', `Firestore import failed: ${error.message}`);
      }

      // 6. Test Firebase connectivity
      addDiagnostic('Firebase Connection', 'info', 'Testing Firebase project connectivity...');
      try {
        const response = await fetch('https://magnaflow-07sep25.firebaseapp.com', { 
          method: 'HEAD',
          mode: 'no-cors' 
        });
        addDiagnostic('Firebase Connection', 'success', 'Firebase project is reachable');
      } catch (error) {
        addDiagnostic('Firebase Connection', 'warning', `Firebase project connectivity test failed: ${error.message}`);
      }

      // 7. Test Auth Domain connectivity
      addDiagnostic('Auth Domain', 'info', 'Testing Auth Domain connectivity...');
      try {
        const response = await fetch('https://magnaflow-07sep25.firebaseapp.com', { 
          method: 'HEAD',
          mode: 'no-cors'
        });
        addDiagnostic('Auth Domain', 'success', 'Auth domain is reachable');
      } catch (error) {
        addDiagnostic('Auth Domain', 'warning', `Auth domain connectivity test failed: ${error.message}`);
      }

      // 8. Test localStorage availability
      addDiagnostic('Local Storage', 'info', 'Testing localStorage availability...');
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        addDiagnostic('Local Storage', 'success', 'localStorage is available');
      } catch (error) {
        addDiagnostic('Local Storage', 'error', `localStorage not available: ${error.message}`);
      }

      // 9. Test if the user already exists in Firebase Auth
      addDiagnostic('Existing User Check', 'info', 'Checking if admin user exists...');
      try {
        const { auth } = await import('../firebase-config');
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        
        const testCredential = await signInWithEmailAndPassword(auth, 'abhishek@magnetar.in', 'Abhishek@1');
        addDiagnostic('Existing User Check', 'success', 'Admin user exists and credentials work!');
        addDiagnostic('User Details', 'info', `UID: ${testCredential.user.uid}`);
        addDiagnostic('User Details', 'info', `Email: ${testCredential.user.email}`);
        addDiagnostic('User Details', 'info', `Email Verified: ${testCredential.user.emailVerified}`);
        
        // Test Firestore user document
        const { db } = await import('../firebase-config');
        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', testCredential.user.uid));
        
        if (userDoc.exists()) {
          addDiagnostic('User Document', 'success', 'User document exists in Firestore');
          const userData = userDoc.data();
          addDiagnostic('User Data', 'info', `Name: ${userData.name}`);
          addDiagnostic('User Data', 'info', `Role: ${userData.role}`);
          addDiagnostic('User Data', 'info', `Tier: ${userData.tier}`);
        } else {
          addDiagnostic('User Document', 'error', 'User document not found in Firestore');
        }
        
      } catch (error) {
        addDiagnostic('Existing User Check', 'error', `Login test failed: ${error.message}`);
        addDiagnostic('Error Details', 'error', `Error code: ${error.code}`);
        
        if (error.code === 'auth/user-not-found') {
          addDiagnostic('Solution', 'info', 'User does not exist - need to create admin user');
        } else if (error.code === 'auth/wrong-password') {
          addDiagnostic('Solution', 'info', 'User exists but password is incorrect');
        } else if (error.code === 'auth/invalid-email') {
          addDiagnostic('Solution', 'info', 'Email format is invalid');
        }
      }

    } catch (error) {
      addDiagnostic('System Error', 'error', `Unexpected error: ${error.message}`);
    } finally {
      setIsRunning(false);
      addDiagnostic('Complete', 'info', 'Diagnostic complete!');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="glass-effect p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">Comprehensive Diagnostic</h1>
            <p className="text-gray-300">Complete system and authentication diagnosis</p>
          </div>

          <div className="flex gap-4 mb-6 justify-center">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? 'Running Diagnostics...' : 'Run Full Diagnostic'}
            </Button>
            <Button 
              onClick={clearDiagnostics} 
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Clear Results
            </Button>
          </div>

          <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-3">Diagnostic Results:</h3>
            {diagnostics.length === 0 ? (
              <p className="text-gray-400">No diagnostics run yet. Click "Run Full Diagnostic" to start.</p>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {diagnostics.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-20">{item.timestamp}</span>
                    <span className="min-w-4">{getStatusIcon(item.status)}</span>
                    <span className="text-white min-w-32">[{item.test}]</span>
                    <span className={getStatusColor(item.status)}>
                      {item.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg">
            <h4 className="text-white font-semibold mb-2">This diagnostic checks:</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Environment and network connectivity</li>
              <li>• Firebase module imports and configuration</li>
              <li>• Firebase project connectivity</li>
              <li>• Authentication methods availability</li>
              <li>• Existing user verification and login test</li>
              <li>• Firestore document access</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ComprehensiveDiagnostic;