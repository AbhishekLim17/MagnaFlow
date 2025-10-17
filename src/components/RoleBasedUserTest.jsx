import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const RoleBasedUserTest = () => {
  const { registerUser, login, logout, user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'password123',
    role: 'staff',
    department: 'Engineering',
    designation: 'Developer',
    tier: 'Junior',
    phone: '+1-555-0123',
    company: 'Magnetar'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createTestUser = async () => {
    setLoading(true);
    try {
      const result = await registerUser(formData);
      setResult(result);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loginTestUser = async () => {
    setLoading(true);
    try {
      const result = await login(formData.email, formData.password);
      setResult(result);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setResult({ success: true, message: 'Logged out successfully' });
  };

  const testUsers = [
    { name: 'Admin Test', email: 'admin.test@magnetar.com', role: 'admin', tier: 'Alpha' },
    { name: 'Manager Test', email: 'manager.test@magnetar.com', role: 'manager', tier: 'Senior' },
    { name: 'Staff Test', email: 'staff.test@magnetar.com', role: 'staff', tier: 'Junior' }
  ];

  const createPredefinedUser = async (userData) => {
    setLoading(true);
    const fullUserData = {
      ...userData,
      password: 'password123',
      department: 'Engineering',
      designation: userData.role === 'admin' ? 'System Admin' : userData.role === 'manager' ? 'Team Lead' : 'Developer',
      phone: '+1-555-0123',
      company: 'Magnetar'
    };
    
    try {
      const result = await registerUser(fullUserData);
      setResult(result);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <h1 className="text-2xl font-bold mb-6">Role-Based User Testing</h1>
          
          {/* Current User Status */}
          <div className="mb-6 p-4 bg-gray-700 rounded">
            <h2 className="text-lg font-semibold mb-2">Current User Status</h2>
            {isAuthenticated ? (
              <div>
                <p><strong>Name:</strong> {user?.name}</p>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Role:</strong> {user?.role}</p>
                <p><strong>Tier:</strong> {user?.tier}</p>
                <p><strong>Department:</strong> {user?.department}</p>
                <Button onClick={handleLogout} variant="destructive" className="mt-2">
                  Logout
                </Button>
              </div>
            ) : (
              <p>Not authenticated</p>
            )}
          </div>

          {/* Quick Test Users */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Create Quick Test Users</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testUsers.map((testUser, index) => (
                <Card key={index} className="p-4 bg-gray-700">
                  <h3 className="font-semibold text-white">{testUser.name}</h3>
                  <p className="text-sm text-gray-300">Role: {testUser.role}</p>
                  <p className="text-sm text-gray-300">Tier: {testUser.tier}</p>
                  <Button 
                    onClick={() => createPredefinedUser(testUser)}
                    disabled={loading}
                    className="mt-2 w-full"
                    size="sm"
                  >
                    Create User
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          {/* Custom User Creation */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Create Custom User</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={formData.tier} onValueChange={(value) => handleInputChange('tier', value)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Intern">Intern</SelectItem>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Mid-Level">Mid-Level</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Principal">Principal</SelectItem>
                    <SelectItem value="Alpha">Alpha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input 
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input 
                  value={formData.designation}
                  onChange={(e) => handleInputChange('designation', e.target.value)}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            
            <div className="flex gap-4 mt-4">
              <Button onClick={createTestUser} disabled={loading}>
                {loading ? 'Creating...' : 'Create User'}
              </Button>
              <Button onClick={loginTestUser} disabled={loading} variant="outline">
                {loading ? 'Logging in...' : 'Login with this User'}
              </Button>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`p-4 rounded ${result.success ? 'bg-green-900' : 'bg-red-900'}`}>
              <h3 className="font-semibold">Result:</h3>
              <p>Success: {result.success ? 'Yes' : 'No'}</p>
              <p>Message: {result.message || result.error}</p>
              {result.user && (
                <div className="mt-2">
                  <p>Created User ID: {result.user.uid}</p>
                  <p>User Role: {result.user.role}</p>
                  <p>User Tier: {result.user.tier}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default RoleBasedUserTest;