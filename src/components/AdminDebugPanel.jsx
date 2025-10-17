import React, { useState } from 'react';
import { getAuth, listUsers } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';

const AdminDebugPanel = () => {
  const [firestoreUsers, setFirestoreUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchFirestoreUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const usersCol = collection(db, 'users');
      const usersSnap = await getDocs(usersCol);
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirestoreUsers(users);
    } catch (err) {
      setError('Error fetching Firestore users: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">🛠️ Admin Debug Panel</h1>
        <button
          onClick={fetchFirestoreUsers}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mb-4"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Fetch Firestore Users'}
        </button>
        {error && <div className="bg-red-700 p-2 rounded mb-2">{error}</div>}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="font-semibold mb-2">Firestore Users</h2>
          <pre className="text-xs overflow-x-auto max-h-96">{JSON.stringify(firestoreUsers, null, 2)}</pre>
        </div>
        <div className="mt-6 text-yellow-300 text-sm">
          <p>Note: Firebase Authentication users cannot be listed from the client for security reasons. Please check the Firebase Console for Auth users.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDebugPanel;
