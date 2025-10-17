import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'react-hot-toast';
import { 
  Database, 
  Users, 
  Building2, 
  Briefcase, 
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';

const DatabaseInitializer = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  // Sample data for initialization
  const sampleData = {
    alphaUser: {
      name: 'Alpha Administrator',
      email: 'alpha@magnetar.com',
      password: 'Alpha123!@#',
      tier: 'Alpha',
      role: 'admin',
      department: 'Administration',
      designation: 'Portal Owner',
      phone: '+1-800-MAGNETAR',
      status: 'active'
    },
    companies: [
      {
        name: 'TechCorp Solutions',
        email: 'info@techcorp.com',
        phone: '+1-555-TECH-001',
        address: '123 Technology Drive, Silicon Valley, CA',
        industry: 'Technology'
      },
      {
        name: 'Digital Innovations Inc',
        email: 'contact@digitalinnovations.com',
        phone: '+1-555-DIGI-002',
        address: '456 Innovation Blvd, Austin, TX',
        industry: 'Digital Marketing'
      },
      {
        name: 'FinanceFlow Systems',
        email: 'hello@financeflow.com',
        phone: '+1-555-FIN-003',
        address: '789 Financial Center, New York, NY',
        industry: 'Financial Services'
      }
    ],
    principals: [
      {
        name: 'John Smith',
        email: 'john.smith@techcorp.com',
        password: 'Principal123!',
        tier: 'Principal',
        role: 'admin',
        department: 'Executive',
        designation: 'CEO',
        phone: '+1-555-001-CEO'
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@digitalinnovations.com',
        password: 'Principal123!',
        tier: 'Principal',
        role: 'admin',
        department: 'Executive',
        designation: 'Founder & CEO',
        phone: '+1-555-002-CEO'
      },
      {
        name: 'Michael Chen',
        email: 'michael.chen@financeflow.com',
        password: 'Principal123!',
        tier: 'Principal',
        role: 'admin',
        department: 'Executive',
        designation: 'President',
        phone: '+1-555-003-CEO'
      }
    ],
    departments: [
      // TechCorp Departments
      { name: 'Engineering', companyId: 'company-1', description: 'Software Development' },
      { name: 'Product', companyId: 'company-1', description: 'Product Management' },
      { name: 'Sales', companyId: 'company-1', description: 'Sales & Business Development' },
      
      // Digital Innovations Departments  
      { name: 'Marketing', companyId: 'company-2', description: 'Digital Marketing' },
      { name: 'Creative', companyId: 'company-2', description: 'Creative & Design' },
      { name: 'Analytics', companyId: 'company-2', description: 'Data Analytics' },
      
      // FinanceFlow Departments
      { name: 'Finance', companyId: 'company-3', description: 'Financial Services' },
      { name: 'Operations', companyId: 'company-3', description: 'Operations Management' },
      { name: 'Compliance', companyId: 'company-3', description: 'Regulatory Compliance' }
    ],
    designations: [
      // Engineering Designations
      { title: 'Senior Software Engineer', department: 'Engineering', companyId: 'company-1', level: 'Senior' },
      { title: 'Software Engineer', department: 'Engineering', companyId: 'company-1', level: 'Mid-Level' },
      { title: 'Junior Developer', department: 'Engineering', companyId: 'company-1', level: 'Junior' },
      
      // Marketing Designations
      { title: 'Marketing Manager', department: 'Marketing', companyId: 'company-2', level: 'Senior' },
      { title: 'Digital Marketing Specialist', department: 'Marketing', companyId: 'company-2', level: 'Mid-Level' },
      
      // Finance Designations
      { title: 'Financial Analyst', department: 'Finance', companyId: 'company-3', level: 'Mid-Level' },
      { title: 'Senior Financial Advisor', department: 'Finance', companyId: 'company-3', level: 'Senior' }
    ]
  };

  const addStatus = (message, type = 'info') => {
    setInitializationStatus(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  const clearDatabase = async () => {
    try {
      addStatus('🧹 Clearing existing data...', 'info');

      // Collections to clear
      const collections = ['users', 'companies', 'departments', 'designations', 'performanceReports'];
      
      for (const collectionName of collections) {
        const snapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        addStatus(`✅ Cleared ${collectionName} collection`, 'success');
      }
    } catch (error) {
      addStatus(`❌ Error clearing database: ${error.message}`, 'error');
      throw error;
    }
  };

  const createAuthUser = async (email, password, userData, userId) => {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create Firestore user document
      await setDoc(doc(db, 'users', userId), {
        ...userData,
        uid: userCredential.user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return userCredential.user.uid;
    } catch (error) {
      addStatus(`❌ Error creating user ${email}: ${error.message}`, 'error');
      throw error;
    }
  };

  const initializeDatabase = async () => {
    setIsInitializing(true);
    setInitializationStatus([]);
    setIsComplete(false);

    try {
      addStatus('🚀 Starting database initialization...', 'info');

      // Step 1: Clear existing data
      await clearDatabase();

      // Step 2: Create Alpha User
      addStatus('👑 Creating Alpha user...', 'info');
      const { password, ...alphaUserData } = sampleData.alphaUser;
      await createAuthUser(
        sampleData.alphaUser.email, 
        password, 
        alphaUserData, 
        'alpha-user-1'
      );
      addStatus('✅ Alpha user created successfully', 'success');

      // Step 3: Create Companies
      addStatus('🏢 Creating companies...', 'info');
      for (let i = 0; i < sampleData.companies.length; i++) {
        const companyData = {
          ...sampleData.companies[i],
          status: 'active',
          employeeCount: 0,
          projects: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'companies', `company-${i + 1}`), companyData);
        addStatus(`✅ Created company: ${companyData.name}`, 'success');
      }

      // Step 4: Create Principal Users
      addStatus('👥 Creating Principal users...', 'info');
      for (let i = 0; i < sampleData.principals.length; i++) {
        const { password, ...principalData } = sampleData.principals[i];
        await createAuthUser(
          sampleData.principals[i].email,
          password,
          principalData,
          `principal-${i + 1}`
        );
        addStatus(`✅ Created principal: ${principalData.name}`, 'success');
      }

      // Step 5: Create Departments
      addStatus('🏬 Creating departments...', 'info');
      for (let i = 0; i < sampleData.departments.length; i++) {
        const deptData = {
          ...sampleData.departments[i],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'departments', `dept-${i + 1}`), deptData);
      }
      addStatus('✅ All departments created', 'success');

      // Step 6: Create Designations
      addStatus('💼 Creating designations...', 'info');
      for (let i = 0; i < sampleData.designations.length; i++) {
        const designationData = {
          ...sampleData.designations[i],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'designations', `designation-${i + 1}`), designationData);
      }
      addStatus('✅ All designations created', 'success');

      // Step 7: Create sample performance reports
      addStatus('📊 Creating sample performance reports...', 'info');
      const sampleReports = [
        {
          title: 'Q3 Performance Review',
          employeeId: 'principal-1',
          employeeName: 'John Smith',
          companyId: 'company-1',
          score: 9.2,
          period: 'Q3 2025',
          status: 'completed',
          feedback: 'Excellent leadership and company growth',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          title: 'Leadership Assessment',
          employeeId: 'principal-2',
          employeeName: 'Sarah Johnson',
          companyId: 'company-2',
          score: 8.8,
          period: 'Q3 2025',
          status: 'completed',
          feedback: 'Strong innovation and team management',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (let i = 0; i < sampleReports.length; i++) {
        await setDoc(doc(db, 'performanceReports', `report-${i + 1}`), sampleReports[i]);
      }
      addStatus('✅ Sample performance reports created', 'success');

      addStatus('🎉 Database initialization completed successfully!', 'success');
      setIsComplete(true);
      
      toast.success('Database initialized successfully!');

    } catch (error) {
      console.error('Database initialization error:', error);
      addStatus(`❌ Fatal error: ${error.message}`, 'error');
      toast.error('Database initialization failed');
    } finally {
      setIsInitializing(false);
    }
  };

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Settings className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Initializer
          </CardTitle>
          <p className="text-gray-600">
            Initialize your MagnaFlow database with sample data including Alpha user, companies, and principals.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Sample Data Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium">Alpha User</p>
                <p className="text-sm text-gray-600">1 Portal Owner</p>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <Building2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium">Companies</p>
                <p className="text-sm text-gray-600">3 Sample Companies</p>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="font-medium">Principals</p>
                <p className="text-sm text-gray-600">3 Company Owners</p>
              </CardContent>
            </Card>
            
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4 text-center">
                <Briefcase className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="font-medium">Structure</p>
                <p className="text-sm text-gray-600">Depts & Designations</p>
              </CardContent>
            </Card>
          </div>

          {/* Test Accounts Info */}
          <Card className="bg-gray-50">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>

          {/* Initialize Button */}
          <div className="text-center">
            <Button 
              onClick={initializeDatabase}
              disabled={isInitializing}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3"
              size="lg"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initializing Database...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Initialize Database
                </>
              )}
            </Button>
          </div>

          {/* Status Log */}
          {initializationStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Initialization Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {initializationStatus.map((status, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      {getStatusIcon(status.type)}
                      <span className="text-gray-500 text-xs">{status.timestamp}</span>
                      <span className={
                        status.type === 'error' ? 'text-red-600' :
                        status.type === 'success' ? 'text-green-600' :
                        'text-gray-700'
                      }>
                        {status.message}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          {isComplete && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-green-700">
                  <CheckCircle className="w-6 h-6" />
                  <div>
                    <p className="font-medium">Database Initialization Complete! 🎉</p>
                    <p className="text-sm mt-1">
                      You can now login with the Alpha account (alpha@magnetar.com) to access the portal owner dashboard.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseInitializer;