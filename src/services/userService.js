// User Service - Handles all user-related Firebase operations
// CRUD operations for user management (Admin functionality)

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  deleteUser as deleteAuthUser,
  signOut,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db, secondaryAuth } from '@/config/firebase';

// Collection reference
const USERS_COLLECTION = 'users';

/**
 * Get user data by UID
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} User data or null
 */
export const getUserById = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

/**
 * Get all users from Firestore
 * @param {Object} filters - Optional filters (role, status, designation)
 * @returns {Promise<Array>} Array of user objects
 */
export const getAllUsers = async (filters = {}) => {
  try {
    let q = collection(db, USERS_COLLECTION);
    
    // Apply filters if provided
    const constraints = [];
    if (filters.role) {
      constraints.push(where('role', '==', filters.role));
    }
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.designation) {
      constraints.push(where('designation', '==', filters.designation));
    }
    
    // Only add ordering if no filters (to avoid index requirement)
    // If filters exist, we'll sort in memory
    if (constraints.length === 0) {
      constraints.push(orderBy('createdAt', 'desc'));
    }
    
    if (constraints.length > 0) {
      q = query(collection(db, USERS_COLLECTION), ...constraints);
    }
    
    const snapshot = await getDocs(q);
    const users = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort in memory if filters were applied
    if (filters.role || filters.status || filters.designation) {
      users.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
    }
    
    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

/**
 * Get all staff members (non-admin users)
 * @returns {Promise<Array>} Array of staff users
 */
export const getAllStaff = async () => {
  try {
    return await getAllUsers({ role: 'staff' });
  } catch (error) {
    console.error('Error getting staff:', error);
    throw error;
  }
};

/**
 * Create a new user (Authentication + Firestore)
 * Admin function to add new staff members
 * @param {Object} userData - User data (name, email, password, role, designation, status)
 * @returns {Promise<Object>} Created user data
 */
/**
 * Create a new user (Authentication + Firestore)
 * Admin function to add new staff members
 * Uses secondary Firebase auth instance to prevent admin logout
 * @param {Object} userData - User data (name, email, password, role, designation, status)
 * @returns {Promise<Object>} Created user data
 */
export const createUser = async (userData) => {
  try {
    const { email, password, name, role, designation, status } = userData;
    
    // Verify admin is logged in
    const currentAdmin = auth.currentUser;
    if (!currentAdmin) {
      throw new Error('You must be logged in as an admin to create users.');
    }
    
    // Create user using SECONDARY auth instance (won't affect admin session)
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    
    // Create user document in Firestore
    const userDoc = {
      name: name || '',
      email: email,
      role: role || 'staff',
      designation: designation || '',
      status: status || 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    await setDoc(doc(db, USERS_COLLECTION, uid), userDoc);
    
    // Sign out from secondary auth (cleanup)
    await signOut(secondaryAuth);
    
    console.log('✅ User created successfully. Admin session maintained.');
    
    return { id: uid, ...userDoc };
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Provide helpful error messages
    if (error.code === 'auth/email-already-in-use') {
      const helpfulError = new Error(
        `❌ Email already registered: ${email}\n\n` +
        `This email exists in Firebase Authentication but may have been deleted from your portal.\n\n` +
        `📋 TO FIX:\n` +
        `1. Go to Firebase Console: https://console.firebase.google.com/project/magnaflow-07sep25/authentication/users\n` +
        `2. Search for: ${email}\n` +
        `3. Click the ⋮ menu → Delete account\n` +
        `4. Try adding this user again\n\n` +
        `💡 TIP: Check Admin Dashboard → System tab for pending deletions.`
      );
      helpfulError.code = error.code;
      throw helpfulError;
    }
    
    throw error;
  }
};

/**
 * Update user information
 * @param {string} uid - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user data
 */
export const updateUser = async (uid, updates) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    await updateDoc(userRef, updatedData);
    
    // Return updated user
    const updatedUser = await getUserById(uid);
    return updatedUser;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Delete user (Firestore + creates marker for manual Firebase Auth cleanup)
 * @param {string} uid - User ID
 * @returns {Promise<void>}
 */
export const deleteUser = async (uid) => {
  try {
    // Get user data before deletion
    const userData = await getUserById(uid);
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, USERS_COLLECTION, uid));
    
    // Create deletion marker for manual Firebase Auth cleanup
    await setDoc(doc(db, 'userDeletions', uid), {
      userId: uid,
      email: userData.email,
      name: userData.name,
      deletedAt: Timestamp.now(),
      deletedBy: auth.currentUser?.email || 'unknown',
      completed: false,
      instructions: 'Go to Firebase Console → Authentication → Search email → Delete account'
    });
    
    console.log('✅ User deleted from Firestore. Manual Firebase Auth cleanup required.');
    console.log('📋 Check Admin Dashboard → System tab for deletion instructions.');
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Deactivate user account
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Updated user data
 */
export const deactivateUser = async (uid) => {
  try {
    return await updateUser(uid, { status: 'inactive' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    throw error;
  }
};

/**
 * Activate user account
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Updated user data
 */
export const activateUser = async (uid) => {
  try {
    return await updateUser(uid, { status: 'active' });
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
};

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User data or null
 */
export const getUserByEmail = async (email) => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', email)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

/**
 * Send password reset email to user
 * @param {string} email - User email address
 * @returns {Promise<void>}
 */
export const resetUserPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Get all pending user deletions (users deleted from portal but not from Firebase Auth)
 * @returns {Promise<Array>} Array of pending deletions
 */
export const getPendingDeletions = async () => {
  try {
    const q = query(
      collection(db, 'userDeletions'),
      where('completed', '==', false),
      orderBy('deletedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const deletions = [];
    snapshot.forEach((doc) => {
      deletions.push({ id: doc.id, ...doc.data() });
    });
    return deletions;
  } catch (error) {
    console.error('Error getting pending deletions:', error);
    // Return empty array if collection doesn't exist yet
    return [];
  }
};

/**
 * Mark a deletion as completed (after manual Firebase Auth cleanup)
 * @param {string} deletionId - Deletion marker document ID
 * @returns {Promise<void>}
 */
export const markDeletionCompleted = async (deletionId) => {
  try {
    await updateDoc(doc(db, 'userDeletions', deletionId), {
      completed: true,
      completedAt: Timestamp.now(),
      completedBy: auth.currentUser?.email || 'unknown'
    });
    console.log('✅ Deletion marked as completed:', deletionId);
  } catch (error) {
    console.error('Error marking deletion completed:', error);
    throw error;
  }
};
