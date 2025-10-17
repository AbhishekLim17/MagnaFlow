import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';

const UserCreationTest = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { registerUser } = useAuth();
  const { toast } = useToast();

  const createTestUser = async () => {
    setIsCreating(true);
    
    const testUserData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'staff',
      department: 'sales',
      tier: 'Junior'
    };

    try {
      console.log('About to create test user:', testUserData);
      const result = await registerUser(testUserData);
      
      console.log('Registration result:', result);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Test user created successfully!"
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create test user",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Test user creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-white mb-4">User Creation Test</h3>
      <Button 
        onClick={createTestUser}
        disabled={isCreating}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {isCreating ? 'Creating...' : 'Create Test User'}
      </Button>
    </div>
  );
};

export default UserCreationTest;