import React, { useState } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Database, Trash2, RefreshCw } from 'lucide-react';

const FirebaseDataFixer = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [step, setStep] = useState('');

  const addResult = (type, message) => {
    setResults(prev => [...prev, { type, message, timestamp: new Date().toLocaleTimeString() }]);
  };

  const clearAllData = async () => {
    setLoading(true);
    setProgress(0);
    setResults([]);
    setStep('Clearing existing data...');

    try {
      const collections = ['users', 'companies', 'departments', 'designations', 'tasks', 'projects'];
      
      for (let i = 0; i < collections.length; i++) {
        const collectionName = collections[i];
        setStep(`Clearing ${collectionName}...`);
        
        const snapshot = await getDocs(collection(db, collectionName));
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        if (snapshot.docs.length > 0) {
          await batch.commit();
          addResult('success', `Cleared ${snapshot.docs.length} documents from ${collectionName}`);
        } else {
          addResult('info', `${collectionName} was already empty`);
        }
        
        setProgress(((i + 1) / collections.length) * 100);
      }

      addResult('success', 'All existing data cleared successfully');
    } catch (error) {
      addResult('error', `Error clearing data: ${error.message}`);
    } finally {
      setLoading(false);
      setStep('');
      setProgress(0);
    }
  };

  const initializeProperData = async () => {
    setLoading(true);
    setProgress(0);
    setResults([]);
    setStep('Initializing database with proper structure...');

    try {
      // Step 1: Create Companies
      setStep('Creating companies...');
      const companies = [
        {
          id: 'magnetar-corp',
          name: 'Magnetar Corporation',
          email: 'info@magnetar.com',
          phone: '+1-800-MAGNETAR',
          address: '123 Technology Drive, Innovation City, TC 12345',
          industry: 'Technology Solutions',
          status: 'active',
          employeeCount: 0,
          projects: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'tech-solutions',
          name: 'Tech Solutions Inc',
          email: 'contact@techsolutions.com',
          phone: '+1-555-TECH-001',
          address: '456 Business Blvd, Tech City, TC 67890',
          industry: 'Software Development',
          status: 'active',
          employeeCount: 0,
          projects: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const company of companies) {
        await setDoc(doc(db, 'companies', company.id), company);
      }
      addResult('success', `Created ${companies.length} companies`);
      setProgress(20);

      // Step 2: Create Departments
      setStep('Creating departments...');
      const departments = [
        {
          id: 'engineering',
          name: 'Engineering',
          description: 'Software development and technical solutions',
          company: 'magnetar-corp',
          headOfDepartment: null,
          employeeCount: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'marketing',
          name: 'Marketing',
          description: 'Brand promotion and customer engagement',
          company: 'magnetar-corp',
          headOfDepartment: null,
          employeeCount: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'hr',
          name: 'Human Resources',
          description: 'Employee relations and organizational development',
          company: 'magnetar-corp',
          headOfDepartment: null,
          employeeCount: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'administration',
          name: 'Administration',
          description: 'Administrative operations and management',
          company: 'magnetar-corp',
          headOfDepartment: null,
          employeeCount: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const dept of departments) {
        await setDoc(doc(db, 'departments', dept.id), dept);
      }
      addResult('success', `Created ${departments.length} departments`);
      setProgress(40);

      // Step 3: Create Designations
      setStep('Creating designations...');
      const designations = [
        {
          id: 'system-admin',
          title: 'System Administrator',
          department: 'administration',
          level: 'senior',
          description: 'Manages system infrastructure and user access',
          responsibilities: ['System maintenance', 'User management', 'Security oversight'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'software-engineer',
          title: 'Software Engineer',
          department: 'engineering',
          level: 'mid-level',
          description: 'Develops and maintains software applications',
          responsibilities: ['Code development', 'Testing', 'Documentation'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'senior-developer',
          title: 'Senior Developer',
          department: 'engineering',
          level: 'senior',
          description: 'Leads development projects and mentors junior developers',
          responsibilities: ['Project leadership', 'Code review', 'Mentoring'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'marketing-manager',
          title: 'Marketing Manager',
          department: 'marketing',
          level: 'manager',
          description: 'Manages marketing campaigns and strategies',
          responsibilities: ['Campaign management', 'Strategy planning', 'Team coordination'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'hr-specialist',
          title: 'HR Specialist',
          department: 'hr',
          level: 'mid-level',
          description: 'Handles employee relations and HR processes',
          responsibilities: ['Employee onboarding', 'Policy implementation', 'Conflict resolution'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const designation of designations) {
        await setDoc(doc(db, 'designations', designation.id), designation);
      }
      addResult('success', `Created ${designations.length} designations`);
      setProgress(60);

      // Step 4: Create Admin User with Firebase Auth
      setStep('Creating admin user...');
      try {
        const adminEmail = 'admin@magnetar.com';
        const adminPassword = 'Admin123456!';
        
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        const firebaseUser = userCredential.user;

        // Create user document in Firestore
        const adminUserDoc = {
          name: 'System Administrator',
          email: adminEmail,
          role: 'admin',
          tier: 'Alpha',
          department: 'administration',
          designation: 'system-admin',
          company: 'magnetar-corp',
          employeeId: 'EMP001',
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

        await setDoc(doc(db, 'users', firebaseUser.uid), adminUserDoc);
        addResult('success', `Created admin user: ${adminEmail} (Password: ${adminPassword})`);
      } catch (userError) {
        if (userError.code === 'auth/email-already-in-use') {
          addResult('warning', 'Admin user already exists in Firebase Auth');
        } else {
          addResult('error', `Error creating admin user: ${userError.message}`);
        }
      }
      setProgress(80);

      // Step 5: Create Sample Tasks and Projects
      setStep('Creating sample projects and tasks...');
      
      const sampleProject = {
        id: 'project-001',
        name: 'MagnaFlow Portal Development',
        description: 'Development of the company project management portal',
        company: 'magnetar-corp',
        status: 'active',
        priority: 'high',
        startDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        progress: 75,
        assignedDepartments: ['engineering', 'administration'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'projects', sampleProject.id), sampleProject);

      const sampleTasks = [
        {
          id: 'task-001',
          title: 'Setup Firebase Configuration',
          description: 'Configure Firebase authentication and Firestore database',
          project: 'project-001',
          status: 'completed',
          priority: 'high',
          assignedTo: null, // Will be assigned to admin user after creation
          department: 'engineering',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-002',
          title: 'Implement User Management',
          description: 'Create user management system with role-based access control',
          project: 'project-001',
          status: 'in_progress',
          priority: 'high',
          assignedTo: null,
          department: 'engineering',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of sampleTasks) {
        await setDoc(doc(db, 'tasks', task.id), task);
      }

      addResult('success', `Created 1 project and ${sampleTasks.length} tasks`);
      setProgress(100);
      setStep('Database initialization completed!');

      addResult('success', '🎉 Database initialized with proper structure and sample data!');
      addResult('info', 'You can now login with: admin@magnetar.com / Admin123456!');

    } catch (error) {
      addResult('error', `Error initializing database: ${error.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setStep(''), 2000);
    }
  };

  const fixExistingData = async () => {
    setLoading(true);
    setResults([]);
    setStep('Analyzing and fixing existing data...');

    try {
      // Check and fix users collection
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let fixedUsers = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const fixes = {};

        // Fix missing permissions
        if (!userData.permissions) {
          fixes.permissions = {
            canCreateUsers: userData.role === 'admin',
            canEditUsers: ['admin', 'manager'].includes(userData.role),
            canViewAllUsers: ['admin', 'manager'].includes(userData.role),
            canManageProjects: ['admin', 'manager'].includes(userData.role)
          };
        }

        // Fix missing status
        if (!userData.status) {
          fixes.status = 'active';
        }

        // Fix missing company
        if (!userData.company) {
          fixes.company = 'magnetar-corp';
        }

        // Apply fixes if needed
        if (Object.keys(fixes).length > 0) {
          fixes.updatedAt = new Date();
          await setDoc(doc(db, 'users', userDoc.id), { ...userData, ...fixes });
          fixedUsers++;
        }
      }

      if (fixedUsers > 0) {
        addResult('success', `Fixed ${fixedUsers} user documents`);
      } else {
        addResult('info', 'No user fixes needed');
      }

      addResult('success', 'Data analysis and fixes completed');

    } catch (error) {
      addResult('error', `Error fixing data: ${error.message}`);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Firebase Data Fixer
          </h1>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button 
              onClick={fixExistingData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Fix Existing Data
            </Button>
            
            <Button 
              onClick={initializeProperData}
              disabled={loading}
              className="flex items-center gap-2"
              variant="default"
            >
              <CheckCircle className="h-4 w-4" />
              Initialize Fresh Data
            </Button>

            <Button 
              onClick={clearAllData}
              disabled={loading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </Button>
          </div>

          {/* Progress */}
          {loading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">{step}</span>
                <span className="text-sm">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Card className="p-4 bg-gray-700">
              <h2 className="text-lg font-semibold mb-4">Results</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className={`p-2 rounded text-sm flex items-start gap-2 ${
                    result.type === 'success' ? 'bg-green-900' :
                    result.type === 'error' ? 'bg-red-900' :
                    result.type === 'warning' ? 'bg-yellow-900' :
                    'bg-blue-900'
                  }`}>
                    {result.type === 'success' && <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />}
                    {result.type === 'error' && <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />}
                    {result.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />}
                    <div className="flex-1">
                      <div>{result.message}</div>
                      <div className="text-xs opacity-75">{result.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Instructions */}
          <Card className="p-4 bg-gray-700 mt-6">
            <h2 className="text-lg font-semibold mb-2">Instructions</h2>
            <div className="text-sm space-y-2">
              <p><strong>Fix Existing Data:</strong> Analyzes current data and fixes common issues without losing existing records</p>
              <p><strong>Initialize Fresh Data:</strong> Creates a complete database structure with sample data and admin user</p>
              <p><strong>Clear All Data:</strong> ⚠️ Permanently deletes all data from Firestore (use with caution)</p>
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
};

export default FirebaseDataFixer;