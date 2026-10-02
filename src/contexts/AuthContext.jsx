// AuthContext - Firebase Authentication Integration
// Handles user authentication, session management, and role-based access

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { FUNCTIONS_ENABLED, callFunction } from "@/config/functions";
import { auth } from "@/config/firebase";
import { getUserById, clearCallerProfileCache } from "@/services/userService";
import { getOrganizationById } from "@/services/organizationService";
import { isValidEmail } from "@/utils/validation";
import { toUserMessage, isTransientError } from "@/lib/errorMessages";
import { safeUnsubscribe } from '@/lib/safeUnsubscribe';

const AuthContext = createContext();

// A master-admin can suspend an organization; suspension must actually block
// its members. Enforced at login/session-restore (one org read) rather than in
// Firestore rules (which would cost an extra read on every operation). Fails
// open on a read error so a transient Firestore glitch can't lock everyone out
// â€” data access itself is still governed by the security rules regardless.
// What the login page says when someone was signed out without asking to be.
const SIGNED_OUT_NOTICES = {
  inactive: 'Your account has been deactivated. Please contact your administrator.',
  suspended: 'Your organization has been suspended. Please contact support.',
};

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
  // While login() is running it validates the account itself and then sets the
  // session. The auth listener would otherwise race it: it fires the instant
  // signInWithEmailAndPassword resolves and could briefly authenticate an
  // account login() is about to reject (deactivated, org suspended).
  const loginInFlight = useRef(false);

  // Why a signed-in browser could not be turned into a session, so the app can say so
  // instead of silently showing the login page (which looked like being logged out for
  // no reason whenever the connection blipped during a refresh).
  //   kind: 'unreachable' (try again) | 'no-profile' | 'failed'
  const [sessionProblem, setSessionProblem] = useState(null);
  // A sign-out the user did not ask for (deactivated, organization suspended), shown
  // on the login page.
  const [notice, setNotice] = useState(null);

  // Turn the Firebase user into an app session. Only a definite "no" signs the person
  // out; being unable to ask does not.
  const loadSession = useCallback(async (firebaseUser) => {
    try {
      const userData = await getUserById(firebaseUser.uid);

      if (!userData) {
        setSessionProblem({ kind: 'no-profile' });
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      if (userData.status === 'inactive') {
        // A restored session must honour deactivation too, not only the login form.
        await signOut(auth);
        setNotice(SIGNED_OUT_NOTICES.inactive);
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      if (await orgIsSuspended(userData.orgId)) {
        await signOut(auth);
        setNotice(SIGNED_OUT_NOTICES.suspended);
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      setSessionProblem(null);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUser(null);
      setIsAuthenticated(false);
      setSessionProblem({
        kind: isTransientError(error) ? 'unreachable' : 'failed',
        message: toUserMessage(error),
      });
    }
  }, []);

  // Monitor Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // The signed-in identity may have changed (login, logout, or an
      // impersonation session swap) - drop any cached org profile so the next
      // scoped query resolves against the new user, never the previous one.
      clearCallerProfileCache();

      if (firebaseUser && loginInFlight.current) return;

      if (firebaseUser) {
        await loadSession(firebaseUser);
      } else {
        setSessionProblem(null);
        setUser(null);
        setIsAuthenticated(false);
      }

      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => safeUnsubscribe(unsubscribe);
  }, [loadSession]);

  /** Try again after a session problem (the Try again button, or the network coming back). */
  const retrySession = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setSessionProblem(null);
      return;
    }
    setLoading(true);
    clearCallerProfileCache();
    await loadSession(firebaseUser);
    setLoading(false);
  }, [loadSession]);

  /**
   * Login with email and password (with rate limiting and validation)
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Result object with success status
   */
  const login = async (email, password) => {
    try {
      loginInFlight.current = true;
      setNotice(null);
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
        // Only when Cloud Functions exist (see config/functions.js); on Spark this is skipped.
        if (FUNCTIONS_ENABLED) limitResult = await callFunction('checkLoginRateLimit', { email });
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
      if (FUNCTIONS_ENABLED) {
        try {
          await callFunction('clearLoginAttempts', { email });
        } catch (_) { /* non-critical */ }
      }

      // Fetch user data from Firestore
      const userData = await getUserById(userCredential.user.uid);
      if (!userData) {
        await signOut(auth);
        throw new Error("No active profile found for this account. If you were recently removed, please contact your administrator.");
      }
      if (userData.status === 'inactive') {
        await signOut(auth);
        throw new Error("Your account has been deactivated. Please contact administrator.");
      }
      if (await orgIsSuspended(userData.orgId)) {
        await signOut(auth);
        throw new Error("Your organization has been suspended. Please contact support.");
      }
      
      setUser(userData);
      setIsAuthenticated(true);
      return { success: true, user: userData };
      
    } catch (error) {
      // This list used to be maintained by hand here and had fallen behind the
      // SDK: it had no case for auth/invalid-credential, which is what recent
      // Firebase returns for a wrong password, so the final `error.message`
      // branch showed the user the literal string
      // "Firebase: Error (auth/invalid-credential)."
      console.error('âŒ Login failed:', error?.code || error);
      return { success: false, error: toUserMessage(error, 'Login failed. Please try again.') };
    } finally {
      loginInFlight.current = false;
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
    // so signing back in as anyone â€” including the same person â€” fails until
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
    sessionProblem,
    retrySession,
    notice,
  }), [user, currentUser, isAuthenticated, loading, sessionProblem, retrySession, notice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
