import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Users, FileText, AlertCircle, CheckCircle } from 'lucide-react';

const FirebaseDataFetcher = () => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResults, setAnalysisResults] = useState({});

  // Fetch data from all collections
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const collections = [
        'users',
        'companies', 
        'departments',
        'designations',
        'tasks',
        'projects',
        'notifications'
      ];

      const fetchedData = {};
      const analysis = {};

      for (const collectionName of collections) {
        try {
          console.log(`Fetching ${collectionName}...`);
          const collectionRef = collection(db, collectionName);
          const snapshot = await getDocs(collectionRef);
          
          const docs = [];
          snapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() });
          });

          fetchedData[collectionName] = docs;
          analysis[collectionName] = {
            count: docs.length,
            status: docs.length > 0 ? 'has_data' : 'empty',
            sampleDoc: docs[0] || null,
            issues: analyzeCollection(collectionName, docs)
          };
          
          console.log(`${collectionName}: ${docs.length} documents`);
        } catch (collectionError) {
          console.error(`Error fetching ${collectionName}:`, collectionError);
          fetchedData[collectionName] = [];
          analysis[collectionName] = {
            count: 0,
            status: 'error',
            error: collectionError.message,
            issues: []
          };
        }
      }

      setData(fetchedData);
      setAnalysisResults(analysis);

    } catch (err) {
      console.error('Error fetching Firebase data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Analyze collection for common issues
  const analyzeCollection = (collectionName, docs) => {
    const issues = [];

    if (docs.length === 0) {
      issues.push({ type: 'warning', message: 'Collection is empty' });
      return issues;
    }

    // Check for required fields based on collection type
    const requiredFields = {
      users: ['name', 'email', 'role'],
      companies: ['name', 'email'],
      departments: ['name', 'company'],
      designations: ['title', 'department'],
      tasks: ['title', 'status', 'assignedTo'],
      projects: ['name', 'status', 'company']
    };

    const required = requiredFields[collectionName] || [];
    
    docs.forEach((doc, index) => {
      required.forEach(field => {
        if (!doc[field]) {
          issues.push({
            type: 'error',
            message: `Document ${doc.id} missing required field: ${field}`
          });
        }
      });

      // Check for data type issues
      if (collectionName === 'users') {
        if (doc.role && !['admin', 'manager', 'staff'].includes(doc.role)) {
          issues.push({
            type: 'warning',
            message: `User ${doc.id} has invalid role: ${doc.role}`
          });
        }
        if (doc.email && !doc.email.includes('@')) {
          issues.push({
            type: 'error',
            message: `User ${doc.id} has invalid email format: ${doc.email}`
          });
        }
      }
    });

    return issues;
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'has_data': return 'bg-green-500';
      case 'empty': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'has_data': return 'Has Data';
      case 'empty': return 'Empty';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="p-6 bg-gray-800 text-white">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6" />
              Firebase Data Analysis
            </h1>
            <Button onClick={fetchAllData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Fetching...' : 'Refresh Data'}
            </Button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900 rounded flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Error: {error}</span>
            </div>
          )}

          {/* Collections Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {Object.entries(analysisResults).map(([collectionName, analysis]) => (
              <Card key={collectionName} className="p-4 bg-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white capitalize">{collectionName}</h3>
                  <Badge className={getStatusColor(analysis.status)}>
                    {getStatusText(analysis.status)}
                  </Badge>
                </div>
                <p className="text-sm text-gray-300 mb-2">
                  Documents: {analysis.count}
                </p>
                {analysis.issues && analysis.issues.length > 0 && (
                  <div className="text-sm">
                    <p className="text-red-400">Issues: {analysis.issues.length}</p>
                  </div>
                )}
                {analysis.error && (
                  <p className="text-sm text-red-400">Error: {analysis.error}</p>
                )}
              </Card>
            ))}
          </div>

          {/* Detailed Analysis */}
          {Object.entries(analysisResults).map(([collectionName, analysis]) => (
            <Card key={`${collectionName}-detail`} className="p-6 bg-gray-700 mb-4">
              <h2 className="text-xl font-semibold text-white mb-4 capitalize flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {collectionName} Collection
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Collection Info */}
                <div>
                  <h3 className="font-semibold text-white mb-2">Collection Info</h3>
                  <div className="space-y-1 text-sm">
                    <p>Document Count: <span className="text-blue-400">{analysis.count}</span></p>
                    <p>Status: <span className={`px-2 py-1 rounded text-xs ${getStatusColor(analysis.status)}`}>
                      {getStatusText(analysis.status)}
                    </span></p>
                  </div>

                  {/* Sample Document */}
                  {analysis.sampleDoc && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-white mb-2">Sample Document Structure:</h4>
                      <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(analysis.sampleDoc, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Issues */}
                <div>
                  <h3 className="font-semibold text-white mb-2">Issues Found</h3>
                  {analysis.issues && analysis.issues.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {analysis.issues.map((issue, index) => (
                        <div key={index} className={`p-2 rounded text-sm flex items-start gap-2 ${
                          issue.type === 'error' ? 'bg-red-900' : 'bg-yellow-900'
                        }`}>
                          {issue.type === 'error' ? 
                            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" /> :
                            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                          }
                          <span>{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>No issues found</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {/* Raw Data Display */}
          <Card className="p-6 bg-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Raw Data Summary</h2>
            <div className="text-sm">
              {Object.entries(data).map(([collectionName, docs]) => (
                <div key={collectionName} className="mb-4">
                  <h3 className="font-semibold text-white capitalize">{collectionName} ({docs.length} docs)</h3>
                  {docs.length > 0 && (
                    <div className="ml-4 mt-2">
                      {docs.slice(0, 3).map((doc, index) => (
                        <div key={index} className="text-xs text-gray-300 mb-1">
                          {doc.id}: {doc.name || doc.title || doc.email || 'No name field'}
                        </div>
                      ))}
                      {docs.length > 3 && (
                        <div className="text-xs text-gray-400">... and {docs.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
};

export default FirebaseDataFetcher;