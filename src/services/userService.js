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
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db, secondaryAuth } from '@/config/firebase';

// Collection reference
const USERS_COLLECTION = 'users';

// Cached lookup of the signed-in caller's own user doc (orgId/departmentIds/
// projectIds/role). Firestore rules require org-scoped queries/writes for
// org-admin+ roles once a second org exists, but pre-existing components
// (StaffManagementNew, TaskManagementNew, PerformanceReports, etc.) call
// getAllUsers/createUser without ever thinking about orgId. Rather than
// touching every call site, reads/writes that don't explicitly specify orgId
// auto-resolve it from the caller's own profile here, so those components
// keep working unmodified while still being correctly org-scoped. Legacy
// 'admin' accounts (created before this feature existed) have no orgId, so
// this resolves to null for them — same as before, unchanged behavior.
let _cachedCallerProfile = null;
export const getCallerProfile = async () => {
  if (!auth.currentUser) return null;
  if (_cachedCallerProfile?.uid === auth.currentUser.uid) return _cachedCallerProfile;
  const snap = await getDoc(doc(db, USERS_COLLECTION, auth.currentUser.uid));
  const data = snap.exists() ? snap.data() : {};
  _cachedCallerProfile = {
    uid: auth.currentUser.uid,
    orgId: data.orgId ?? null,
    departmentIds: data.departmentIds ?? [],
    projectIds: data.projectIds ?? [],
    role: data.role ?? null,
  };
  return _cachedCallerProfile;
};

// Invalidate the cache on logout / session switch so a subsequent sign-in
// never consults the previous user's org scope.
export const clearCallerProfileCache = () => { _cachedCallerProfile = null; };

/**
 * Get user data by UID
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} User data or null
 */
export const getUserById = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (userDoc.exists()) {
      return normalizeUser({ id: userDoc.id, ...userDoc.data() });
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Role is matched by exact string throughout the app (routing, rules, context).
// Manually bootstrapped accounts (the first master-admin, etc.) are created by
// hand in the Firebase console, where a stray leading/trailing space in the
// role silently sends the user to a blank screen. Trim it defensively on read.
const normalizeUser = (user) => {
  if (user && typeof user.role === 'string') {
    user.role = user.role.trim();
  }
  return user;
};

/**
 * Get all users from Firestore
 * @param {Object} filters - Optional filters (role, status, designation, orgId,
 *   departmentIds (array, matches users whose departmentIds overlaps any of these),
 *   projectIds (array, matches users whose projectIds overlaps any of these))
 * @returns {Promise<Array>} Array of user objects
 */
export const getAllUsers = async (filters = {}) => {
  try {
    let q = collection(db, USERS_COLLECTION);

    // Auto-resolve orgId from the caller's own profile when not explicitly
    // specified, so org-scoping applies even to callers that don't pass it.
    let orgId = filters.orgId;
    if (orgId === undefined) {
      const caller = await getCallerProfile();
      if (caller && caller.role !== 'master-admin') orgId = caller.orgId;
    }

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
    if (orgId !== undefined) {
      constraints.push(where('orgId', '==', orgId));
    }
    if (filters.departmentIds?.length) {
      constraints.push(where('departmentIds', 'array-contains-any', filters.departmentIds.slice(0, 10)));
    }
    if (filters.projectIds?.length) {
      constraints.push(where('projectIds', 'array-contains-any', filters.projectIds.slice(0, 10)));
    }

    // Only add ordering if no filters (to avoid index requirement)
    // If filters exist, we'll sort in memory
    let hasOrderBy = false;
    if (constraints.length === 0) {
      constraints.push(orderBy('createdAt', 'desc'));
      hasOrderBy = true;
    }

    if (constraints.length > 0) {
      q = query(collection(db, USERS_COLLECTION), ...constraints);
    }

    const snapshot = await getDocs(q);
    const users = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });

    // Sort in memory if we didn't use orderBy
    if (!hasOrderBy) {
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
 * Uses secondary Firebase auth instance to prevent admin logout
 * @param {Object} userData - User data (name, email, password, role, designation, status)
 * @returns {Promise<Object>} Created user data
 */
export const createUser = async (userData) => {
  let { email, password, name, role, designation, status, orgId, departmentIds, projectIds } = userData;
  try {

    // Verify admin is logged in
    const currentAdmin = auth.currentUser;
    if (!currentAdmin) {
      throw new Error('You must be logged in as an admin to create users.');
    }

    // Auto-stamp orgId from the creating user's own org when not explicitly
    // provided, so pre-existing callers (StaffManagementNew, etc.) that don't
    // know about orgId still create correctly-scoped docs.
    if (orgId === undefined) {
      const caller = await getCallerProfile();
      if (caller && caller.role !== 'master-admin') orgId = caller.orgId;
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
      ...(orgId !== undefined && { orgId }),
      ...(departmentIds !== undefined && { departmentIds }),
      ...(projectIds !== undefined && { projectIds }),
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
 * Delete a user's Firestore record. Security rules restrict this to the user's
 * own org-admin / master-admin. Deleting the underlying Firebase Auth account
 * requires the Admin SDK (Cloud Functions / Blaze plan), which isn't available
 * on this project — so the Auth account remains and must be removed manually in
 * the Firebase console if you want to free up the email address. The user is
 * effectively locked out regardless, since login requires a matching Firestore
 * doc (which is now gone).
 * @param {string} uid - User ID
 * @returns {Promise<void>}
 */
export const deleteUser = async (uid) => {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, uid));
    console.log('✅ User record removed. (Auth account cleanup is manual on the free plan.)');
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

