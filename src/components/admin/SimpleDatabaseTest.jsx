import React from 'react';

const SimpleDatabaseTest = () => {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Database Initializer Test</h1>
        <p className="text-gray-600 mb-6">
          This is a simple test page to verify the routing is working correctly.
        </p>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Status</h2>
          <div className="space-y-2">
            <p>✅ React component loaded successfully</p>
            <p>✅ Basic styling applied</p>
            <p>✅ Page routing working</p>
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Next Steps:</h3>
          <p className="text-blue-700 text-sm">
            If you can see this page, the routing is working correctly. 
            We can then proceed to test the full Database Initializer component.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimpleDatabaseTest;