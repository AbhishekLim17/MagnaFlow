import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './ui/use-toast';

const UserCreationTester = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const { registerUser } = useAuth();
  const { toast } = useToast();

  const addResult = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, { message, type, timestamp }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testUserCreation = async () => {
    setIsCreating(true);
    clearResults();
    
    addResult('🧪 Starting user creation test...', 'info');
    
    try {
      // Generate unique email to avoid conflicts
      const timestamp = Date.now();
      const testEmail = `test${timestamp}@magnetar.com`;
      
      const testUserData = {
        name: 'Test User',
        email: testEmail,
        password: 'TestPassword123!',
        role: 'staff',
        department: 'technical_submission',
        designation: 'Engineer',
        tier: 'Junior',
        employeeId: `EMP${timestamp}`,
        phone: '+1234567890',
        reportingTo: 'Test Manager',
        companyId: 'magnetar-default'
      };
      
      addResult(`📋 Test data prepared: ${testUserData.name} (${testUserData.email})`, 'info');
      addResult('🚀 Calling registerUser...', 'info');
      
      const result = await registerUser(testUserData);
      
      if (result.success) {
        addResult('✅ User creation successful!', 'success');
        addResult(`📝 User ID: ${result.user.uid}`, 'success');
        addResult(`📧 Email: ${result.user.email}`, 'success');
        addResult(`👤 Role: ${result.user.role}`, 'success');
        addResult(`🏢 Department: ${result.user.department}`, 'success');
        toast({
          title: "Success",
          description: "Test user created successfully!",
        });
      } else {
        addResult(`❌ User creation failed: ${result.error}`, 'error');
        toast({
          title: "Test Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      addResult(`💥 Exception occurred: ${error.message}`, 'error');
      console.error('Test error:', error);
      toast({
        title: "Test Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
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
      <div className="max-w-4xl mx-auto">
        <Card className="glass-effect p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">User Creation Tester</h1>
            <p className="text-gray-300">Test the user registration functionality</p>
          </div>

          <div className="flex gap-4 mb-6 justify-center">
            <Button 
              onClick={testUserCreation} 
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? 'Creating User...' : 'Test User Creation'}
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
              <p className="text-gray-400">No test results yet. Click "Test User Creation" to start.</p>
            ) : (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 min-w-20">{result.timestamp}</span>
                    <span className={`text-sm ${getResultColor(result.type)}`}>
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg">
            <h4 className="text-white font-semibold mb-2">How this test works:</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Creates a test user with unique email address</li>
              <li>• Tests all required fields and validation</li>
              <li>• Shows detailed logging of the creation process</li>
              <li>• Helps identify where user creation might be failing</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UserCreationTester;