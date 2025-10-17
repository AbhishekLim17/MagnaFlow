// createAdmin.js - Node.js script to create admin user directly

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK
const serviceAccount = {
  "type": "service_account",
  "project_id": "magnaflow-07sep25",
  "private_key_id": "your_private_key_id",
  "private_key": "your_private_key",
  "client_email": "your_client_email",
  "client_id": "your_client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your_cert_url"
};

// For now, let's create a simpler solution using the web SDK
console.log('Firebase Admin SDK setup required for direct admin creation.');
console.log('Instead, let\'s use the web interface to create admin user.');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=== MagnaFlow Admin User Creation ===');
console.log('We need to create an admin user manually in Firebase Console:');
console.log('\n1. Go to: https://console.firebase.google.com/project/magnaflow-07sep25/firestore');
console.log('2. Create a new document in "users" collection');
console.log('3. Use the following structure:');
console.log('\nDocument ID: (auto-generate or use custom)');
console.log('Fields:');
console.log('  email: "admin@magnaflow.com" (string)');
console.log('  role: "admin" (string)');
console.log('  tier: "Alpha" (string)');
console.log('  permissions: {');
console.log('    canCreateUsers: true (boolean)');
console.log('    canDeleteUsers: true (boolean)');
console.log('    canManageRoles: true (boolean)');
console.log('    canViewAllData: true (boolean)');
console.log('  }');
console.log('  createdAt: (current timestamp)');
console.log('  displayName: "Administrator" (string)');

rl.question('\nHave you created the Firestore document? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    console.log('\n=== Next Steps ===');
    console.log('1. Go to Firebase Authentication console');
    console.log('2. Click "Add user"');
    console.log('3. Email: admin@magnaflow.com');
    console.log('4. Password: (set a secure password)');
    console.log('5. Make sure the email matches the Firestore document');
    console.log('\nAdmin user will be ready to login!');
  } else {
    console.log('Please create the Firestore document first, then run this script again.');
  }
  rl.close();
});