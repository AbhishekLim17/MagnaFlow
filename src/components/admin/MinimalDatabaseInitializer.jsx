import React, { useState } from 'react';
import { collection, doc, setDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';

const DatabaseInitializer = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [status, setStatus] = useState([]);

  const addStatus = (message) => {
    setStatus(prev => [...prev, { message, timestamp: new Date().toLocaleTimeString() }]);
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    setStatus([]);
    
    try {
      addStatus('🚀 Starting database initialization...');

      // Step 1: Clear existing data
      addStatus('🧹 Clearing existing data...');
      const collections = ['companies', 'users', 'departments', 'designations'];
      
      for (const collectionName of collections) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        
        querySnapshot.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        
        if (!querySnapshot.empty) {
          await batch.commit();
        }
      }
      addStatus('✅ Existing data cleared');

      // Step 2: Create Alpha Authentication User
      addStatus('👑 Creating Alpha authentication user...');
      try {
        const alphaUserCredential = await createUserWithEmailAndPassword(
          auth, 
          'alpha@magnetar.com', 
          'Alpha123!@#'
        );
        addStatus('✅ Alpha authentication user created');
        
        // Step 3: Create Alpha user document
        const alphaUserDoc = {
          uid: alphaUserCredential.user.uid,
          name: 'Alpha Administrator',
          email: 'alpha@magnetar.com',
          tier: 'Alpha',
          role: 'admin',
          department: 'Administration',
          designation: 'Portal Owner',
          phone: '+1-800-MAGNETAR',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', alphaUserCredential.user.uid), alphaUserDoc);
        addStatus('✅ Alpha user document created');
        
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          addStatus('⚠️ Alpha user already exists, skipping authentication creation');
        } else {
          throw authError;
        }
      }

      // Step 4: Create Companies
      addStatus('🏢 Creating sample companies...');
      const companies = [
        {
          id: 'techcorp-solutions',
          name: 'TechCorp Solutions',
          email: 'info@techcorp.com',
          phone: '+1-555-TECH-001',
          address: '123 Technology Drive, Silicon Valley, CA',
          industry: 'Technology',
          status: 'active',
          employeeCount: 0,
          projects: 0,
          principalEmail: 'john.smith@techcorp.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'digital-innovations',
          name: 'Digital Innovations Inc',
          email: 'contact@digitalinnovations.com', 
          phone: '+1-555-DIGI-002',
          address: '456 Innovation Blvd, Austin, TX',
          industry: 'Digital Marketing',
          status: 'active',
          employeeCount: 0,
          projects: 0,
          principalEmail: 'sarah.johnson@digitalinnovations.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'financeflow-corp',
          name: 'FinanceFlow Corp',
          email: 'hello@financeflow.com',
          phone: '+1-555-FINANCE',
          address: '789 Finance Street, New York, NY',
          industry: 'Financial Services',
          status: 'active',
          employeeCount: 0,
          projects: 0,
          principalEmail: 'michael.chen@financeflow.com',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const company of companies) {
        await setDoc(doc(db, 'companies', company.id), company);
      }
      addStatus('✅ Sample companies created');

      // Step 5: Create Principal Users
      addStatus('👥 Creating principal users...');
      const principals = [
        {
          name: 'John Smith',
          email: 'john.smith@techcorp.com',
          password: 'Principal123!',
          companyId: 'techcorp-solutions',
          phone: '+1-555-001-0001'
        },
        {
          name: 'Sarah Johnson',
          email: 'sarah.johnson@digitalinnovations.com',
          password: 'Principal123!',
          companyId: 'digital-innovations',
          phone: '+1-555-002-0001'
        },
        {
          name: 'Michael Chen',
          email: 'michael.chen@financeflow.com',
          password: 'Principal123!',
          companyId: 'financeflow-corp',
          phone: '+1-555-003-0001'
        }
      ];

      for (const principal of principals) {
        try {
          const principalCredential = await createUserWithEmailAndPassword(
            auth,
            principal.email,
            principal.password
          );

          const principalDoc = {
            uid: principalCredential.user.uid,
            name: principal.name,
            email: principal.email,
            tier: 'Principal',
            role: 'admin',
            companyId: principal.companyId,
            department: 'Management',
            designation: 'Company Owner',
            phone: principal.phone,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'users', principalCredential.user.uid), principalDoc);
          
        } catch (authError) {
          if (authError.code === 'auth/email-already-in-use') {
            addStatus(`⚠️ Principal ${principal.email} already exists`);
          } else {
            throw authError;
          }
        }
      }
      addStatus('✅ Principal users created');

      // Step 6: Create Departments
      addStatus('🏛️ Creating departments...');
      const departments = [
        { id: 'management', name: 'Management', description: 'Executive and management roles' },
        { id: 'hr', name: 'Human Resources', description: 'HR and people operations' },
        { id: 'finance', name: 'Finance', description: 'Financial and accounting operations' },
        { id: 'it', name: 'Information Technology', description: 'IT and technical operations' },
        { id: 'sales', name: 'Sales', description: 'Sales and business development' },
        { id: 'marketing', name: 'Marketing', description: 'Marketing and communications' },
        { id: 'operations', name: 'Operations', description: 'Day-to-day operations' }
      ];

      for (const dept of departments) {
        await setDoc(doc(db, 'departments', dept.id), {
          ...dept,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      addStatus('✅ Departments created');

      // Step 7: Create Designations
      addStatus('🎯 Creating designations...');
      const designations = [
        { id: 'ceo', name: 'Chief Executive Officer', level: 'Executive', departmentId: 'management' },
        { id: 'manager', name: 'Manager', level: 'Management', departmentId: 'management' },
        { id: 'team-lead', name: 'Team Lead', level: 'Leadership', departmentId: 'management' },
        { id: 'senior-staff', name: 'Senior Staff', level: 'Senior', departmentId: 'operations' },
        { id: 'staff', name: 'Staff', level: 'Standard', departmentId: 'operations' },
        { id: 'intern', name: 'Intern', level: 'Entry', departmentId: 'operations' }
      ];

      for (const designation of designations) {
        await setDoc(doc(db, 'designations', designation.id), {
          ...designation,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      addStatus('✅ Designations created');

      addStatus('🎉 Database initialization completed successfully!');
      addStatus('📋 You can now log in with the following accounts:');
      addStatus('   👑 Alpha: alpha@magnetar.com (Password: Alpha123!@#)');
      addStatus('   🏢 Principals: Check the account list above');
      
    } catch (error) {
      console.error('Error initializing database:', error);
      addStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Database Initializer
          </h1>
          <p className="text-gray-600 mb-6">
            Initialize your MagnaFlow database with sample data.
          </p>

          {/* Sample Data Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="w-8 h-8 bg-blue-600 rounded mx-auto mb-2"></div>
              <p className="font-medium">Alpha User</p>
              <p className="text-sm text-gray-600">1 Portal Owner</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="w-8 h-8 bg-green-600 rounded mx-auto mb-2"></div>
              <p className="font-medium">Companies</p>
              <p className="text-sm text-gray-600">3 Sample Companies</p>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="w-8 h-8 bg-purple-600 rounded mx-auto mb-2"></div>
              <p className="font-medium">Principals</p>
              <p className="text-sm text-gray-600">3 Company Owners</p>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <div className="w-8 h-8 bg-orange-600 rounded mx-auto mb-2"></div>
              <p className="font-medium">Structure</p>
              <p className="text-sm text-gray-600">Depts & Designations</p>
            </div>
          </div>

          {/* Test Accounts Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium mb-3">📝 Test Accounts That Will Be Created:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-blue-600">👑 Alpha Account:</p>
                <p>Email: alpha@magnetar.com</p>
                <p>Password: Alpha123!@#</p>
                <p>Access: Portal Owner Dashboard</p>
              </div>
              <div>
                <p className="font-medium text-green-600">🏢 Principal Accounts:</p>
                <p>john.smith@techcorp.com (Principal123!)</p>
                <p>sarah.johnson@digitalinnovations.com (Principal123!)</p>
                <p>michael.chen@financeflow.com (Principal123!)</p>
              </div>
            </div>
          </div>

          {/* Initialize Button */}
          <div className="text-center mb-6">
            <button 
              onClick={handleInitialize}
              disabled={isInitializing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium disabled:bg-gray-400"
            >
              {isInitializing ? 'Initializing Database...' : 'Initialize Firebase Database'}
            </button>
          </div>

          {/* Status Log */}
          {status.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium mb-3">Initialization Status</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {status.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500 text-xs">{item.timestamp}</span>
                    <span className="text-gray-700">{item.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              <strong>✅ Firebase Integration:</strong> This initializer is now fully connected to Firebase. 
              It will create real authentication users and Firestore database entries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseInitializer;