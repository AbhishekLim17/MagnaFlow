import { FUNCTIONS_ENABLED, callFunction } from '@/config/functions';
// User Service - Handles all user-related Firebase operations
// CRUD operations for user management (Admin functionality)

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit as firestoreLimit,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db, secondaryAuth } from '@/config/firebase';
import { isFirestoreInternalAssertion, recoverFromFirestoreFailure } from '@/lib/firestoreRecovery';
import { runBoundedQuery } from '@/lib/firestoreQuery';
import { writeAuditLog } from './auditService';

// Collection reference
const USERS_COLLECTION = 'users';

// Upper bound on a single user query — see the note in taskService.
const DEFAULT_USER_LIMIT = 500;

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

/**
 * Resolve a batch of uids to their user documents in one round trip, for
 * screens that need to display a name against an id they were not given the
 * document for directly (an audit log's targetUserId, for example).
 *
 * Firestore's `in` operator caps at 30 values, so this chunks transparently —
 * callers just get back everything found, keyed by id. An id with no
 * matching document (a deleted account) is simply absent from the map, which
 * lets a caller distinguish "not fetched yet" from "no longer exists".
 *
 * @param {string[]} uids
 * @returns {Promise<Map<string, Object>>}
 */
export const getUsersByIds = async (uids) => {
  const unique = [...new Set(uids)].filter(Boolean);
  const result = new Map();
  if (unique.length === 0) return result;

  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const snap = await getDocs(
      query(collection(db, USERS_COLLECTION), where(documentId(), 'in', chunk))
    );
    snap.forEach((d) => result.set(d.id, normalizeUser({ id: d.id, ...d.data() })));
  }
  return result;
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
    // Auto-resolve orgId from the caller's own profile when not explicitly
    // specified, so org-scoping applies even to callers that don't pass it.
    let orgId = filters.orgId;
    if (orgId === undefined) {
      const caller = await getCallerProfile();
      if (caller && caller.role !== 'master-admin') orgId = caller.orgId;
    }

    const constraints = [];
    if (filters.role) constraints.push(where('role', '==', filters.role));
    if (filters.status) constraints.push(where('status', '==', filters.status));
    if (filters.designation) constraints.push(where('designation', '==', filters.designation));
    if (orgId !== undefined) constraints.push(where('orgId', '==', orgId));

    // List-valued scope filters are chunked past Firestore's 10-value limit
    // instead of being truncated (see runBoundedQuery).
    let multi = null;
    if (filters.departmentIds?.length) {
      multi = { values: filters.departmentIds, build: (c) => where('departmentIds', 'array-contains-any', c) };
    }
    if (filters.projectIds?.length) {
      if (multi) constraints.push(where('projectIds', 'array-contains-any', filters.projectIds.slice(0, 10)));
      else multi = { values: filters.projectIds, build: (c) => where('projectIds', 'array-contains-any', c) };
    }

    // Always bound the read - see the note in taskService.
    const boundedAt = filters.limit ?? DEFAULT_USER_LIMIT;
    const { docs, truncated } = await runBoundedQuery({
      collectionRef: collection(db, USERS_COLLECTION),
      constraints,
      multi,
      boundedAt,
    });

    const users = docs.map((d) => ({ id: d.id, ...d.data() }));

    // See the identical note in taskService's getAllTasks: hitting the bound
    // means the org may have more than this call returned.
    users.truncated = truncated;

    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    // Nearly every screen's staff/user list passes through here, which makes
    // this one of the two places (see the identical check in taskService)
    // most likely to actually observe a poisoned Firestore client - see the
    // note in firestoreRecovery for why a global handler alone misses this.
    if (isFirestoreInternalAssertion(error)) recoverFromFirestoreFailure();
    throw error;
  }
};

/**
 * Everyone a task can be assigned to by this caller (plus the people whose names are
 * needed to label existing assignments).
 *
 *  - org-admin: everyone in the organization except clients. Previously only users
 *    with the 'staff' role were loaded, so a task assigned to a manager, a head or
 *    the admin themselves was labelled "Unassigned", and could not be assigned.
 *  - department head / manager: staff inside their own scope (all the security rules
 *    let them read), plus themselves.
 *
 * Inactive accounts are included (with status) so their old assignments still show a
 * name; callers should not offer them as new assignees.
 *
 * @param {{id: string, name?: string, email?: string, role?: string, designation?: string}} self
 */
export const getAssignableUsers = async (self) => {
  const caller = await getCallerProfile();
  if (!caller) return [];

  let people = [];
  if (caller.role === 'department-head') {
    if (caller.departmentIds?.length) people = await getAllUsers({ role: 'staff', departmentIds: caller.departmentIds });
  } else if (caller.role === 'manager') {
    if (caller.projectIds?.length) people = await getAllUsers({ role: 'staff', projectIds: caller.projectIds });
  } else {
    // clients and Finance do not take tasks
    people = (await getAllUsers({})).filter((u) => u.role !== 'client' && u.role !== 'finance');
  }

  if (self?.id && !people.some((p) => p.id === self.id)) {
    people = [
      { id: self.id, name: self.name, email: self.email, role: self.role, designation: self.designation, status: 'active' },
      ...people,
    ];
  }
  return people;
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
// Mirrors the create rules in firestore.rules so a request the rules will deny
// is refused BEFORE a Firebase Auth account exists. The account is created
// first (it has to be, to get a uid), so a late denial would strand a sign-in
// that reserves the email address.
export const assertMayCreate = (caller, { role, orgId, departmentIds, projectIds }) => {
  const target = role || 'staff';
  const overlaps = (a = [], b = []) => a.some((x) => b.includes(x));
  let allowed = false;
  if (caller?.role === 'master-admin') {
    allowed = true;
  } else if (caller?.role === 'org-admin' || caller?.role === 'admin') {
    allowed = (orgId ?? null) === (caller.orgId ?? null) &&
      ['department-head', 'manager', 'staff', 'client', 'finance'].includes(target);
  } else if (caller?.role === 'department-head') {
    allowed = target === 'staff' && (orgId ?? null) === (caller.orgId ?? null) &&
      overlaps(departmentIds, caller.departmentIds);
  } else if (caller?.role === 'manager') {
    allowed = target === 'staff' && (orgId ?? null) === (caller.orgId ?? null) &&
      overlaps(projectIds, caller.projectIds);
  }
  if (!allowed) {
    throw new Error(`You do not have permission to create a ${target} account with this scope.`);
  }
};

// ---- Seat accounting ------------------------------------------------------
// organizations/{org}/meta/seats = { seatsUsed, seatLimit, lastSeatUid }. The
// security rules only let it change together with a user document being created
// or deleted (see seatBump in firestore.rules), so these run as transactions. An
// organization with no counter yet is simply not under seat accounting.
const seatsRefFor = (orgId) => doc(db, 'organizations', orgId, 'meta', 'seats');

const seatLimitError = (limit) => Object.assign(
  new Error(`This organization has used all ${limit} of its seats. Ask the platform owner to raise the limit before adding more people.`),
  { code: 'seat-limit-reached' }
);

/** Fail early, BEFORE a Firebase Auth account exists, when no seat is free. */
export const assertSeatAvailable = async (orgId) => {
  if (!orgId) return;
  try {
    const seats = await getDoc(seatsRefFor(orgId));
    if (seats.exists()) {
      const { seatsUsed = 0, seatLimit = Infinity } = seats.data();
      if (seatsUsed >= seatLimit) throw seatLimitError(seatLimit);
    }
  } catch (error) {
    if (error.code === 'seat-limit-reached') throw error;
    // Counter not readable by this caller: the rules will still decide.
  }
};

const saveNewUserWithSeat = async (uid, userDoc) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  if (!userDoc.orgId) {
    await setDoc(userRef, userDoc);
    return;
  }
  const seatsRef = seatsRefFor(userDoc.orgId);
  await runTransaction(db, async (tx) => {
    const seats = await tx.get(seatsRef);
    if (!seats.exists()) {
      tx.set(userRef, userDoc);
      return;
    }
    const { seatsUsed = 0, seatLimit = Infinity } = seats.data();
    if (seatsUsed >= seatLimit) throw seatLimitError(seatLimit);
    tx.set(userRef, userDoc);
    tx.update(seatsRef, { seatsUsed: seatsUsed + 1, lastSeatUid: uid });
  });
};

const deleteUserWithSeat = async (uid, orgId) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  if (!orgId) {
    await deleteDoc(userRef);
    return;
  }
  const seatsRef = seatsRefFor(orgId);
  await runTransaction(db, async (tx) => {
    const seats = await tx.get(seatsRef);
    tx.delete(userRef);
    if (seats.exists()) {
      const used = seats.data().seatsUsed || 0;
      // At zero the counter has drifted; the rules accept the delete without a decrement.
      if (used > 0) tx.update(seatsRef, { seatsUsed: used - 1, lastSeatUid: uid });
    }
  });
};

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

    await assertMayCreate(await getCallerProfile(), { role, orgId, departmentIds, projectIds });
    await assertSeatAvailable(orgId);

    // Create user using SECONDARY auth instance (won't affect admin session).
    // The secondary instance becomes signed-in as the new user as a side
    // effect, so it MUST be signed out again on every path — see finally.
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    } catch (authError) {
      // If email is already in use, check if this is an orphaned Auth sign-in (no active Firestore user)
      if (authError.code === 'auth/email-already-in-use') {
        try {
          const snap = await getDocs(
            query(collection(db, USERS_COLLECTION), where('email', '==', email), firestoreLimit(1))
          );
          if (snap.empty) {
            let purged = false;
            if (typeof window !== 'undefined' && import.meta.env?.VITE_USE_EMULATORS === 'true') {
              try {
                const lookupRes = await fetch(
                  'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-magnaflow/accounts:lookup',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer owner',
                    },
                    body: JSON.stringify({ email: [email] }),
                  }
                );
                const lookupData = await lookupRes.json();
                const orphanUid = lookupData.users?.[0]?.localId;
                if (orphanUid) {
                  await fetch(
                    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-magnaflow/accounts:delete',
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer owner',
                      },
                      body: JSON.stringify({ localId: orphanUid }),
                    }
                  );
                  purged = true;
                }
              } catch (e) {
                console.warn('Could not auto-purge orphan from Auth emulator:', e?.message || e);
              }
            }
            // In production an orphaned sign-in is NOT purged here. The old code tried to
            // sign in to it with the password the admin had just typed, which only worked
            // by coincidence. It is reported instead, and cleared via the userDeletions flow.

            if (purged) {
              userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            }
          }
        } catch (orphanErr) {
          console.warn('Orphan purge retry failed:', orphanErr?.message || orphanErr);
        }
      }
      if (!userCredential) throw authError;
    }
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

    try {
      await saveNewUserWithSeat(uid, userDoc);
    } catch (docError) {
      // The Auth account exists but has no profile — it can never sign in and
      // its email is now reserved. Make that recoverable instead of silent.
      console.error('User profile write failed after account creation:', docError);
      // We are still signed in to the new account on the secondary app, so it can
      // be rolled back right here instead of stranding it and its email address.
      try {
        await deleteAuthUser(userCredential.user);
        const rolledBack = new Error(
          docError.code === 'seat-limit-reached'
            ? docError.message
            : `Could not save the profile for ${email} (${docError.code || docError.message}). ` +
              `Nothing was created, so you can fix the problem and try again.`
        );
        rolledBack.code = docError.code === 'seat-limit-reached' ? 'seat-limit-reached' : 'profile-write-failed';
        throw rolledBack;
      } catch (rollbackError) {
        if (rollbackError.code === 'profile-write-failed' || rollbackError.code === 'seat-limit-reached') throw rollbackError;
        const orphanError = new Error(
          `The sign-in account for ${email} was created, but saving their profile failed ` +
          `(${docError.code || docError.message}) and it could not be rolled back. Delete that account in ` +
          `Firebase Console → Authentication before retrying, or the email stays reserved.`
        );
        orphanError.code = 'profile-write-failed';
        throw orphanError;
      }
    }

    await writeAuditLog({
      action: 'create_user',
      targetUserId: uid,
      targetEmail: email,
      targetName: userDoc.name || null,
      targetRole: userDoc.role,
      orgId: orgId ?? null,
    });

    console.log('✅ User created successfully. Admin session maintained.');

    return { id: uid, ...userDoc };
  } catch (error) {
    console.error('Error creating user:', error);

    // Provide helpful error messages
    if (error.code === 'auth/email-already-in-use') {
      const helpfulError = new Error(
        `This email (${email}) is already registered. ` +
        `If the account was removed from the portal, its Firebase sign-in still exists — ` +
        `delete it from Firebase Console → Authentication, then try again, or use a different email.`
      );
      helpfulError.code = error.code;
      throw helpfulError;
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak — use at least 6 characters.');
    }
    if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many accounts created in a short time. Please wait a moment and try again.');
    }

    throw error;
  } finally {
    // Always release the secondary session. If this is skipped, the next
    // createUser call inherits a stale signed-in user.
    try {
      if (secondaryAuth.currentUser) await signOut(secondaryAuth);
    } catch (signOutError) {
      console.warn('Secondary auth sign-out failed:', signOutError?.code);
    }
  }
};

// Changes to someone's access that the org admin's Activity log records.
const ACCESS_FIELDS = ['status', 'role', 'departmentIds', 'projectIds'];
const sameValue = (a, b) => (Array.isArray(a) || Array.isArray(b)
  ? JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort())
  : (a ?? null) === (b ?? null));

/**
 * The access fields an update really changes (edit forms send every field, changed or not).
 * @returns {Object|null} { field: newValue } or null when nothing changed
 */
export const accessChanges = (before, updates) => {
  // A profile with no status is active (as the rules and the sign-in treat it).
  const current = (f) => (f === 'status' ? before?.status ?? 'active' : before?.[f]);
  const changed = ACCESS_FIELDS.filter((f) => f in (updates || {}) && !sameValue(current(f), updates[f]));
  return changed.length ? Object.fromEntries(changed.map((f) => [f, updates[f]])) : null;
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

    // Someone else's access is changing: note what it was, for the audit entry.
    const touchesAccess = uid !== auth.currentUser?.uid && ACCESS_FIELDS.some((f) => f in (updates || {}));
    const before = touchesAccess ? await getUserById(uid).catch(() => null) : null;

    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    await updateDoc(userRef, updatedData);
    
    // Return updated user
    const updatedUser = await getUserById(uid);

    const changes = before ? accessChanges(before, updates) : null;
    if (changes) {
      await writeAuditLog({
        action: 'update_user',
        targetUserId: uid,
        targetName: before.name || null,
        targetEmail: before.email || null,
        orgId: before.orgId ?? null,
        changes,
      });
    }
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
    const victim = await getUserById(uid).catch(() => null);

    let cloudFnSuccess = false;
    // The callable only exists off the Spark plan (see config/functions.js).
    if (FUNCTIONS_ENABLED) {
      try {
        const result = await callFunction('deleteUserAccount', { uid });
        if (result?.success) cloudFnSuccess = true;
      } catch (fnErr) {
        console.warn('Cloud function deleteUserAccount failed, using direct delete fallback:', fnErr?.message || fnErr);
      }
    }

    if (!cloudFnSuccess) {
      await deleteUserWithSeat(uid, victim?.orgId ?? null);

      if (typeof window !== 'undefined' && import.meta.env?.VITE_USE_EMULATORS === 'true') {
        try {
          await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-magnaflow/accounts:delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer owner',
            },
            body: JSON.stringify({ localId: uid }),
          });
        } catch (e) {
          console.warn('Could not auto-purge user from Auth emulator:', e?.message || e);
        }
      }
    }

    if (victim) {
      await setDoc(doc(db, 'userDeletions', uid), {
        userId: uid,
        email: victim.email || null,
        name: victim.name || null,
        orgId: victim.orgId ?? null,
        deletedAt: Timestamp.now(),
        deletedBy: auth.currentUser?.uid || null,
        deletedByEmail: auth.currentUser?.email || null,
        authCleanupDone: cloudFnSuccess || (typeof window !== 'undefined' && import.meta.env?.VITE_USE_EMULATORS === 'true'),
      }).catch((e) => console.warn('Could not record deletion marker:', e?.code));

      await writeAuditLog({
        action: 'delete_user',
        targetUserId: uid,
        targetEmail: victim.email || null,
        targetName: victim.name || null,
        orgId: victim.orgId ?? null,
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Users removed from the portal whose Firebase Auth sign-in still exists.
 * Until that account is deleted in the Firebase console its email stays
 * reserved and cannot be reused.
 *
 * CRITICAL: an email may have been re-added since it was deleted (the same
 * person rehired, or the address reused). Acting on such a stale record would
 * delete the sign-in of a CURRENTLY ACTIVE user and lock them out, so any
 * record whose email now belongs to a live user is filtered out here.
 */
export const getPendingAuthCleanups = async (orgId) => {
  try {
    const constraints = [where('authCleanupDone', '==', false)];
    if (orgId) constraints.push(where('orgId', '==', orgId));
    const snap = await getDocs(query(collection(db, 'userDeletions'), ...constraints, firestoreLimit(100)));
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (records.length === 0) return [];

    // Emails currently in use by a live account.
    const activeEmails = new Set(
      (await getAllUsers({ ...(orgId ? { orgId } : {}) }))
        .map((u) => (u.email || '').toLowerCase())
        .filter(Boolean)
    );

    return records.filter((r) => {
      const email = (r.email || '').toLowerCase();
      // Keep only records whose email is genuinely unused today.
      return email && !activeEmails.has(email);
    });
  } catch (error) {
    // Non-critical: never block the page on this.
    console.warn('Could not load pending auth cleanups:', error?.code);
    return [];
  }
};

/**
 * Mark a leftover Auth account as cleaned up (after deleting it in the console).
 */
export const markAuthCleanupDone = async (uid) => {
  await updateDoc(doc(db, 'userDeletions', uid), {
    authCleanupDone: true,
    completedAt: Timestamp.now(),
  });
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
    // An admin sending someone else a link (the sign-in page's "Forgot password" is nobody's action).
    if (auth.currentUser && auth.currentUser.email !== email) {
      const caller = await getCallerProfile().catch(() => null);
      await writeAuditLog({ action: 'reset_password', targetEmail: email, orgId: caller?.orgId ?? null });
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

