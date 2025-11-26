// Script to clean up duplicate designations in Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDc8uBhC_w4r-tQ8yYpJx2n3tH0XqZ9KfI",
  authDomain: "magnaflow-07sep25.firebaseapp.com",
  projectId: "magnaflow-07sep25",
  storageBucket: "magnaflow-07sep25.firebasestorage.app",
  messagingSenderId: "906955297771",
  appId: "1:906955297771:web:82dfc72dbf5b7c1e4ea0dd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupDuplicateDesignations() {
  try {
    console.log('🔍 Checking for duplicate designations...\n');

    // Get all designations
    const snapshot = await getDocs(collection(db, 'designations'));
    const designations = [];
    
    snapshot.forEach((doc) => {
      designations.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📊 Total designations found: ${designations.length}\n`);

    // Find duplicates
    const seen = new Map();
    const duplicates = [];

    designations.forEach(designation => {
      const nameLower = designation.name.toLowerCase().trim();
      
      if (seen.has(nameLower)) {
        // This is a duplicate
        duplicates.push(designation);
        console.log(`🔴 Duplicate found: "${designation.name}" (ID: ${designation.id})`);
      } else {
        // First occurrence, keep it
        seen.set(nameLower, designation);
        console.log(`✅ Keeping: "${designation.name}" (ID: ${designation.id})`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Total: ${designations.length}`);
    console.log(`   Unique: ${seen.size}`);
    console.log(`   Duplicates: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Database is clean.\n');
      return;
    }

    // Delete duplicates
    console.log('🗑️  Deleting duplicate designations...\n');
    
    for (const duplicate of duplicates) {
      await deleteDoc(doc(db, 'designations', duplicate.id));
      console.log(`   ✅ Deleted: "${duplicate.name}" (ID: ${duplicate.id})`);
    }

    console.log(`\n✅ Cleanup complete! Removed ${duplicates.length} duplicate(s).\n`);
    console.log('📋 Remaining unique designations:');
    seen.forEach((designation, name) => {
      console.log(`   • ${designation.name}`);
    });

  } catch (error) {
    console.error('❌ Error cleaning up duplicates:', error);
  }
}

// Run cleanup
cleanupDuplicateDesignations()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
