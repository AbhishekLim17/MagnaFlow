
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase-config';

const DatabaseChecker = () => {
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  const addStatus = (message, type = 'info') => {
    setStatus(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const checkDatabase = async () => {
    setLoading(true);
    setStatus([]);
    
    try {
      addStatus('🔍 Checking database status...', 'info');

      // Check if Alpha user exists
      const alphaQuery = query(
        collection(db, 'users'), 
        where('email', '==', 'alpha@magnetar.com')
      );
      const alphaSnapshot = await getDocs(alphaQuery);
      
      if (!alphaSnapshot.empty) {
        const alphaUser = alphaSnapshot.docs[0].data();
        addStatus(`✅ Alpha user found: ${alphaUser.name} (${alphaUser.email})`, 'success');
        addStatus(`   📧 Email: ${alphaUser.email}`, 'info');
        addStatus(`   🔑 Tier: ${alphaUser.tier}`, 'info');
        addStatus(`   💼 Role: ${alphaUser.role}`, 'info');
        addStatus(`   📱 Status: ${alphaUser.status}`, 'info');
      } else {
        addStatus('❌ Alpha user NOT found in database', 'error');
      }

      // Check companies
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      addStatus(`🏢 Companies found: ${companiesSnapshot.size}`, companiesSnapshot.size > 0 ? 'success' : 'warning');
      
      companiesSnapshot.forEach((doc) => {
        const company = doc.data();
        addStatus(`   • ${company.name} (${company.industry})`, 'info');
      });

      // Check principal users
      const principalQuery = query(
        collection(db, 'users'), 
        where('tier', '==', 'Principal')
      );
      const principalSnapshot = await getDocs(principalQuery);
      addStatus(`👥 Principal users found: ${principalSnapshot.size}`, principalSnapshot.size > 0 ? 'success' : 'warning');
      
      principalSnapshot.forEach((doc) => {
        const principal = doc.data();
        addStatus(`   • ${principal.name} (${principal.email})`, 'info');
      });

      // Check departments
      const deptSnapshot = await getDocs(collection(db, 'departments'));
      addStatus(`🏛️ Departments found: ${deptSnapshot.size}`, deptSnapshot.size > 0 ? 'success' : 'warning');

      // Check designations  
      const designationSnapshot = await getDocs(collection(db, 'designations'));
      addStatus(`🎯 Designations found: ${designationSnapshot.size}`, designationSnapshot.size > 0 ? 'success' : 'warning');

      addStatus('✅ Database check completed', 'success');

    } catch (error) {
      console.error('Database check error:', error);
      addStatus(`❌ Error checking database: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDatabase();
  }, []);

  const getStatusColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-700';
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Database Status Checker
            </h1>
            <button 
              onClick={checkDatabase}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:bg-gray-400"
            >
              {loading ? 'Checking...' : 'Refresh Check'}
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium mb-3">🔐 Expected Alpha Credentials:</h3>
            <div className="text-sm space-y-1">
              <p><strong>Email:</strong> alpha@magnetar.com</p>
              <p><strong>Password:</strong> Alpha123!@#</p>
              <p><strong>Tier:</strong> Alpha</p>
              <p><strong>Role:</strong> admin</p>
            </div>
          </div>

          {/* Status Log */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="font-medium mb-3">Database Check Results</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {status.length === 0 && loading && (
                <div className="text-gray-500 text-sm">Checking database...</div>
              )}
              {status.map((item, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-400 text-xs mt-1 w-16">{item.timestamp}</span>
                  <span className={`${getStatusColor(item.type)} flex-1`}>{item.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>💡 Tip:</strong> If Alpha user is not found, go to 
              <a href="/init-database" className="underline mx-1">Database Initializer</a>
              to create the required accounts and data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseChecker;