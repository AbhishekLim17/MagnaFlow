import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const AuthTest = () => {
  const { user, isAuthenticated, login, registerUser, logout } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Test User');
  const [role, setRole] = useState('staff');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('Developer');
  
  const [result, setResult] = useState(null);

  const handleLogin = async () => {
    const loginResult = await login(email, password);
    setResult(loginResult);
  };

  const handleRegister = async () => {
    const registerResult = await registerUser({
      name,
      email,
      password,
      role,
      department,
      designation,
      phone: '+1-555-0123',
      company: 'Test Company'
    });
    setResult(registerResult);
  };

  const handleLogout = async () => {
    await logout();
    setResult({ success: true, message: 'Logged out' });
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <Card className="max-w-2xl mx-auto p-6 bg-gray-800 text-white">
        <h1 className="text-2xl font-bold mb-6">Authentication Test</h1>
        
        <div className="mb-6 p-4 bg-gray-700 rounded">
          <h2 className="text-lg font-semibold mb-2">Current Auth State</h2>
          <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
          {user && (
            <div>
              <p>User: {user.name} ({user.email})</p>
              <p>Role: {user.role}</p>
              <p>Department: {user.department}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <Input 
              type="password"
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name (for registration)</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-700 border-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <Button onClick={handleLogin} variant="outline">
            Login
          </Button>
          <Button onClick={handleRegister} variant="outline">
            Register User
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            Logout
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded ${result.success ? 'bg-green-900' : 'bg-red-900'}`}>
            <h3 className="font-semibold">Result:</h3>
            <p>Success: {result.success ? 'Yes' : 'No'}</p>
            <p>Message: {result.message || result.error}</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuthTest;