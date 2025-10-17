import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/firebase-config';
import { 
  CheckCircle, 
  XCircle, 
  User, 
  Database, 
  Shield, 
  Navigation,
  Smartphone,
  Settings
} from 'lucide-react';

const AdminTester = () => {
  const { user, isAuthenticated, login, registerUser } = useAuth();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [testEmail, setTestEmail] = useState('test@magnetar.com');
  const [testPassword, setTestPassword] = useState('Test123456!');

  const runTest = async (testName, testFunction) => {
    try {
      setTestResults(prev => ({ ...prev, [testName]: 'running' }));
      const result = await testFunction();
      setTestResults(prev => ({ ...prev, [testName]: result ? 'passed' : 'failed' }));
      return result;
    } catch (error) {
      console.error(`Test ${testName} failed:`, error);
      setTestResults(prev => ({ ...prev, [testName]: 'failed' }));
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});

    // Test 1: Authentication Check
    await runTest('auth', async () => {
      return isAuthenticated && user !== null;
    });

    // Test 2: Database Connection
    await runTest('database', async () => {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.size >= 0; // Should not throw error
    });

    // Test 3: User Permissions
    await runTest('permissions', async () => {
      return user?.role === 'admin' && user?.permissions?.canCreateUsers === true;
    });

    // Test 4: Navigation Structure
    await runTest('navigation', async () => {
      const navItems = ['dashboard', 'users', 'staff', 'tasks', 'reports'];
      return navItems.every(item => document.querySelector(`[data-nav="${item}"]`) !== null);
    });

    // Test 5: Mobile Responsiveness
    await runTest('mobile', async () => {
      const mobileMenu = document.querySelector('[data-mobile-menu]');
      return mobileMenu !== null;
    });

    // Test 6: UI Components
    await runTest('components', async () => {
      const essentialComponents = [
        document.querySelector('.glass-effect'),
        document.querySelector('[role="button"]'),
        document.querySelector('[role="dialog"]')
      ];
      return essentialComponents.some(comp => comp !== null);
    });

    setIsRunning(false);
    
    toast({
      title: "Tests Completed",
      description: "Check results above for detailed information",
    });
  };

  const createTestUser = async () => {
    try {
      const result = await registerUser({
        name: 'Test User',
        email: testEmail,
        password: testPassword,
        role: 'staff',
        department: 'IT',
        designation: 'Tester',
        tier: 'Junior'
      });

      if (result.success) {
        toast({
          title: "Test user created successfully",
          description: `Email: ${testEmail}, Password: ${testPassword}`,
        });
      } else {
        toast({
          title: "Failed to create test user",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error creating test user",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const testLogin = async () => {
    try {
      const result = await login(testEmail, testPassword);
      if (result.success) {
        toast({
          title: "Test login successful",
          description: "Login functionality is working",
        });
      } else {
        toast({
          title: "Test login failed",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Login test error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <div className="w-5 h-5 border-2 border-gray-500 rounded-full" />;
    }
  };

  const testSuites = [
    { id: 'auth', name: 'Authentication', icon: Shield, description: 'User authentication and session management' },
    { id: 'database', name: 'Database Connection', icon: Database, description: 'Firebase Firestore connectivity' },
    { id: 'permissions', name: 'User Permissions', icon: User, description: 'Role-based access control' },
    { id: 'navigation', name: 'Navigation', icon: Navigation, description: 'App routing and navigation' },
    { id: 'mobile', name: 'Mobile Support', icon: Smartphone, description: 'Mobile responsiveness' },
    { id: 'components', name: 'UI Components', icon: Settings, description: 'UI component functionality' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen p-8 bg-gradient-to-br from-slate-900 to-indigo-900"
    >
      <div className="max-w-4xl mx-auto">
        <Card className="glass-effect p-8 mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-4">MagnaFlow Admin System Tester</h1>
          <p className="text-gray-300 mb-6">
            Comprehensive testing suite for the MagnaFlow admin system functionality.
          </p>

          <div className="flex flex-wrap gap-4 mb-8">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Button>
            <Button 
              onClick={createTestUser} 
              variant="outline"
            >
              Create Test User
            </Button>
            <Button 
              onClick={testLogin} 
              variant="outline"
            >
              Test Login
            </Button>
          </div>

          <div className="grid gap-4 mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Test Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="testEmail">Test Email</Label>
                <Input
                  id="testEmail"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="testPassword">Test Password</Label>
                <Input
                  id="testPassword"
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-effect p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Test Results</h2>
          
          <div className="grid gap-4">
            {testSuites.map((suite) => (
              <div
                key={suite.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center space-x-4">
                  <suite.icon className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="font-medium text-white">{suite.name}</h3>
                    <p className="text-gray-400 text-sm">{suite.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(testResults[suite.id])}
                  <Badge 
                    variant={
                      testResults[suite.id] === 'passed' ? 'default' :
                      testResults[suite.id] === 'failed' ? 'destructive' :
                      testResults[suite.id] === 'running' ? 'secondary' : 'outline'
                    }
                  >
                    {testResults[suite.id] || 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {user && (
            <div className="mt-8 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <h3 className="text-lg font-semibold text-green-400 mb-2">Current User Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Name:</span>
                  <span className="text-white ml-2">{user.name || user.displayName}</span>
                </div>
                <div>
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white ml-2">{user.email}</span>
                </div>
                <div>
                  <span className="text-gray-400">Role:</span>
                  <span className="text-white ml-2">{user.role}</span>
                </div>
                <div>
                  <span className="text-gray-400">Tier:</span>
                  <span className="text-white ml-2">{user.tier}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
};

export default AdminTester;