import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const NavigationTest = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const testRoutes = [
    { path: '/admin', name: 'Admin Dashboard', requiredRole: 'admin' },
    { path: '/manager', name: 'Manager Dashboard', requiredRole: 'manager' },
    { path: '/staff', name: 'Staff Dashboard', requiredRole: 'staff' },
    { path: '/alpha', name: 'Alpha Dashboard', requiredTier: 'Alpha' },
    { path: '/principal', name: 'Principal Dashboard', requiredTier: 'Principal' }
  ];

  const testNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <Card className="max-w-4xl mx-auto p-6 bg-gray-800 text-white">
        <h1 className="text-2xl font-bold mb-6">Navigation & Access Control Test</h1>
        
        {/* Current User Info */}
        <div className="mb-6 p-4 bg-gray-700 rounded">
          <h2 className="text-lg font-semibold mb-2">Current User</h2>
          {isAuthenticated && user ? (
            <div className="space-y-1">
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>Tier:</strong> {user.tier}</p>
              <p><strong>Department:</strong> {user.department}</p>
              <p><strong>Status:</strong> {user.status}</p>
              <p><strong>Permissions:</strong></p>
              <div className="ml-4 text-sm">
                {user.permissions && Object.entries(user.permissions).map(([key, value]) => (
                  <p key={key}>• {key}: {value ? 'Yes' : 'No'}</p>
                ))}
              </div>
            </div>
          ) : (
            <p>Not authenticated</p>
          )}
        </div>

        {/* Navigation Tests */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Test Dashboard Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testRoutes.map((route) => {
              const hasAccess = isAuthenticated && user && (
                (route.requiredRole && user.role === route.requiredRole) ||
                (route.requiredTier && user.tier === route.requiredTier)
              );
              
              return (
                <Card key={route.path} className={`p-4 ${hasAccess ? 'bg-green-900' : 'bg-red-900'}`}>
                  <h3 className="font-semibold text-white">{route.name}</h3>
                  <p className="text-sm text-gray-300 mb-2">
                    Required: {route.requiredRole || route.requiredTier}
                  </p>
                  <p className="text-sm mb-3">
                    Access: {hasAccess ? '✅ Allowed' : '❌ Denied'}
                  </p>
                  <Button 
                    onClick={() => testNavigation(route.path)}
                    size="sm"
                    className="w-full"
                    variant={hasAccess ? "default" : "secondary"}
                  >
                    Test Access
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Direct Navigation Links */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Quick Navigation</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/login')}>Login Page</Button>
            <Button onClick={() => navigate('/role-test')}>Role Test</Button>
            <Button onClick={() => navigate('/create-admin')}>Create Admin</Button>
            <Button onClick={() => navigate('/auth-test')}>Auth Test</Button>
            <Button onClick={() => navigate('/test')}>Firebase Test</Button>
            {isAuthenticated && (
              <Button onClick={handleLogout} variant="destructive">
                Logout
              </Button>
            )}
          </div>
        </div>

        {/* Role Information */}
        <div className="p-4 bg-gray-700 rounded">
          <h2 className="text-lg font-semibold mb-2">Role & Access Information</h2>
          <div className="text-sm space-y-2">
            <div>
              <strong>Admin Role:</strong> Full access to all dashboards and user management
            </div>
            <div>
              <strong>Manager Role:</strong> Access to manager dashboard and team management
            </div>
            <div>
              <strong>Staff Role:</strong> Access to staff dashboard and assigned tasks
            </div>
            <div>
              <strong>Alpha Tier:</strong> Highest level access, system-wide administration
            </div>
            <div>
              <strong>Principal Tier:</strong> High-level access with oversight capabilities
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default NavigationTest;