// AuthContext - Firebase Authentication Integration
// Handles user authentication, session management, and role-based access

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "@/config/firebase";
import { getUserById, clearCallerProfileCache } from "@/services/userService";
import { getOrganizationById } from "@/services/organizationService";
import { isValidEmail } from "@/utils/validation";
import { toUserMessage } from "@/lib/errorMessages";
import { safeUnsubscribe } from '@/lib/safeUnsubscribe';

const AuthContext = createContext();

// A master-admin can suspend an organization; suspension must actually block
// its members. Enforced at login/session-restore (one org read) rather than in
// Firestore rules (which would cost an extra read on every operation). Fails
// open on a read error so a transient Firestore glitch can't lock everyone out
// — data access itself is still governed by the security rules regardless.
const orgIsSuspended = async (orgId) => {
  if (!orgId) return false;
  try {
    const org = await getOrganizationById(orgId);
    return org?.status === 'suspended';
  } catch {
    return false;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Monitor Firebase auth state changes
  useEffect(() => {
    console.log("🚀 AuthProvider: Setting up auth state listener");
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("� Auth state changed:", firebaseUser ? "User logged in" : "User logged out");

      // The signed-in identity may have changed (login, logout, or an
      // impersonation session swap) — drop any cached org profile so the next
      // scoped query resolves against the new user, never the previous one.
      clearCallerProfileCache();

      if (firebaseUser) {
        try {
          // Fetch user data from Firestore
          console.log("� Fetching user data for UID:", firebaseUser.uid);
          const userData = await getUserById(firebaseUser.uid);
          
          if (userData && await orgIsSuspended(userData.orgId)) {
            console.warn("⚠️  Organization suspended — signing out");
            await signOut(auth);
            setUser(null);
            setIsAuthenticated(false);
          } else if (userData) {
            console.log("✅ User data loaded:", userData);
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            console.warn("⚠️  User document not found in Firestore");
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error("❌ Error fetching user data:", error);
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        console.log("👤 No user logged in");
        setUser(null);
        setIsAuthenticated(false);
      }
      
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => safeUnsubscribe(unsubscribe);
  }, []);

  /**
   * Login with email and password (with rate limiting and validation)
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Result object with success status
   */
  const login = async (email, password) => {
    try {
      if (!email || !password) throw new Error("Email and password are required");
      if (!isValidEmail(email)) throw new Error("Invalid email address format");

      // Server-side rate limit check (defense-in-depth against brute force).
      // The rate limiter must NEVER be able to lock out all logins: if the
      // check itself can't run (function not deployed, unavailable, internal
      // error, timeout, cold-start), we proceed to normal Firebase Auth, which
      // still fully validates credentials. Only an actual "blocked" verdict
      // stops the login.
      let limitResult = null;
      try {
        const functions = getFunctions();
        const checkLimit = httpsCallable(functions, 'checkLoginRateLimit');
        limitResult = (await checkLimit({ email })).data;
      } catch (limitError) {
        console.warn('Login rate-limit check unavailable, proceeding without it:', limitError?.code || limitError?.message);
      }
      if (limitResult && limitResult.allowed === false) {
        const resetTime = limitResult.blockedUntil
          ? new Date(limitResult.blockedUntil).toLocaleTimeString()
          : 'later';
        throw new Error(`Too many failed attempts. Try again after ${resetTime}`);
      }

      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Clear rate limit attempts on success
      try {
        const functions = getFunctions();
        const clearAttempts = httpsCallable(functions, 'clearLoginAttempts');
        await clearAttempts({ email });
      } catch (_) { /* non-critical */ }

      // Fetch user data from Firestore
      const userData = await getUserById(userCredential.user.uid);
      if (!userData) {
        await signOut(auth);
        throw new Error("User data not found in database");
      }
      if (userData.status === 'inactive') {
        await signOut(auth);
        throw new Error("Your account has been deactivated. Please contact administrator.");
      }
      if (await orgIsSuspended(userData.orgId)) {
        await signOut(auth);
        throw new Error("Your organization has been suspended. Please contact support.");
      }
      
      return { success: true, user: userData };
      
    } catch (error) {
      // This list used to be maintained by hand here and had fallen behind the
      // SDK: it had no case for auth/invalid-credential, which is what recent
      // Firebase returns for a wrong password, so the final `error.message`
      // branch showed the user the literal string
      // "Firebase: Error (auth/invalid-credential)."
      console.error('❌ Login failed:', error?.code || error);
      return { success: false, error: toUserMessage(error, 'Login failed. Please try again.') };
    }
  };

  /**
   * Logout current user
   */
  const logout = async () => {
    await signOut(auth);

    // Hard navigation rather than a client-side route change.
    //
    // Signing out tears down the Firestore listeners while the SDK's async
    // queue is mid-flight, and the queue does not recover: the next getDoc
    // throws
    //
    //   FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)
    //
    // so signing back in as anyone — including the same person — fails until
    // the tab is reloaded. Reproduced on every logout-then-login cycle.
    // Replacing the document drops the poisoned client entirely, which is
    // free here because sign-out is a terminal action with no state to keep.
    // replace() rather than assign() so Back cannot return to the signed-in
    // screens of the account that just left.
    window.location.replace('/login');
  };

  // Memoized so its identity only changes when the underlying user changes.
  // Consumers put `currentUser` in useEffect dependency arrays (NotificationBell
  // subscribes a Firestore listener on it); rebuilding this object on every
  // render made those effects re-run constantly, tearing down and re-creating
  // listeners and producing spurious permission-denied errors mid-teardown.
  const currentUser = useMemo(() => (
    user
      ? {
          uid: user.id || user.uid, // Use id or fallback to uid
          id: user.id || user.uid,
          displayName: user.name,
          name: user.name,
          email: user.email,
          role: user.role,
          orgId: user.orgId ?? null,
          departmentIds: user.departmentIds ?? [],
          projectIds: user.projectIds ?? [],
        }
      : null
  ), [user]);

  const value = useMemo(() => ({
    user,
    currentUser,
    isAuthenticated,
    loading,
    login,
    logout,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, currentUser, isAuthenticated, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
