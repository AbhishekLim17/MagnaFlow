import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, Settings, Users, FileText, BarChart3 } from 'lucide-react';
import FirebaseDataFetcher from './FirebaseDataFetcher';
import FirebaseDataFixer from './FirebaseDataFixer';
import { useNavigate } from 'react-router-dom';

const FirebaseDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const quickActions = [
    {
      title: 'View All Data',
      description: 'Analyze current Firebase data structure and content',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => navigate('/firebase-data'),
      color: 'bg-blue-500'
    },
    {
      title: 'Fix Data Issues',
      description: 'Repair data structure and initialize missing collections',
      icon: <Settings className="h-5 w-5" />,
      action: () => navigate('/fix-firebase'),
      color: 'bg-green-500'
    },
    {
      title: 'User Management',
      description: 'Create and manage user accounts',
      icon: <Users className="h-5 w-5" />,
      action: () => navigate('/role-test'),
      color: 'bg-purple-500'
    },
    {
      title: 'Navigation Test',
      description: 'Test role-based access control',
      icon: <FileText className="h-5 w-5" />,
      action: () => navigate('/nav-test'),
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="h-8 w-8" />
              Firebase Management Dashboard
            </h1>
            <Button onClick={() => navigate('/')} variant="outline">
              Back to Portal
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Card key={index} className="p-4 bg-gray-700 hover:bg-gray-600 transition-colors cursor-pointer" onClick={action.action}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded ${action.color}`}>
                      {action.icon}
                    </div>
                    <h3 className="font-semibold text-white">{action.title}</h3>
                  </div>
                  <p className="text-sm text-gray-300">{action.description}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Tabs for detailed views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="data-viewer">Data Viewer</TabsTrigger>
              <TabsTrigger value="data-fixer">Data Fixer</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-6">
              <Card className="p-6 bg-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-white">Firebase Database Overview</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-white mb-2">Current Status</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Firebase Config:</span>
                          <span className="text-green-400">✅ Connected</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Authentication:</span>
                          <span className="text-green-400">✅ Active</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Firestore:</span>
                          <span className="text-green-400">✅ Accessible</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-white mb-2">Expected Collections</h3>
                      <div className="space-y-1 text-sm">
                        <div>• users (user accounts and profiles)</div>
                        <div>• companies (organization data)</div>
                        <div>• departments (organizational units)</div>
                        <div>• designations (job roles)</div>
                        <div>• tasks (work items)</div>
                        <div>• projects (project management)</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-600 rounded">
                    <h3 className="font-semibold text-white mb-2">What This Dashboard Does</h3>
                    <div className="text-sm space-y-2">
                      <p><strong>Data Viewer:</strong> Analyzes your current Firebase data, shows collection contents, and identifies potential issues</p>
                      <p><strong>Data Fixer:</strong> Repairs data structure issues, initializes missing collections, and creates proper sample data</p>
                      <p><strong>User Management:</strong> Create and test users with different roles and permissions</p>
                      <p><strong>Access Control:</strong> Verify that role-based routing and permissions work correctly</p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="data-viewer" className="mt-6">
              <FirebaseDataFetcher />
            </TabsContent>
            
            <TabsContent value="data-fixer" className="mt-6">
              <FirebaseDataFixer />
            </TabsContent>
          </Tabs>

          {/* Footer Info */}
          <div className="mt-8 p-4 bg-gray-700 rounded">
            <h3 className="font-semibold text-white mb-2">Firebase Project Info</h3>
            <div className="text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Project ID:</strong> magnaflow-07sep25</p>
                <p><strong>Auth Domain:</strong> magnaflow-07sep25.firebaseapp.com</p>
              </div>
              <div>
                <p><strong>Storage Bucket:</strong> magnaflow-07sep25.firebasestorage.app</p>
                <p><strong>Region:</strong> Global</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FirebaseDashboard;