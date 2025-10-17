import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CreateAdminUser = () => {
  const [email, setEmail] = useState('admin@magnetar.com');
  const [password, setPassword] = useState('admin123456');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const createAdmin = async () => {
    setLoading(true);
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: 'Admin User',
        email: email,
        role: 'admin',
        tier: 'Alpha',
        department: 'Administration',
        designation: 'System Administrator',
        phone: '+1-555-ADMIN',
        company: 'Magnetar',
        status: 'active',
        permissions: {
          canCreateUsers: true,
          canEditUsers: true,
          canViewAllUsers: true,
          canManageProjects: true,
          canAccessAllDepartments: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      });

      setResult({ success: true, message: 'Admin user created successfully!' });
    } catch (error) {
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900 flex items-center justify-center">
      <Card className="max-w-md mx-auto p-6 bg-gray-800 text-white">
        <h1 className="text-2xl font-bold mb-6">Create Admin User</h1>
        
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
        </div>

        <Button 
          onClick={createAdmin} 
          disabled={loading}
          className="w-full mb-4"
        >
          {loading ? 'Creating...' : 'Create Admin User'}
        </Button>

        {result && (
          <div className={`p-4 rounded ${result.success ? 'bg-green-900' : 'bg-red-900'}`}>
            <p>{result.message}</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CreateAdminUser;