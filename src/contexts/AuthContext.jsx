// AuthContext - Firebase Authentication Integration
// Handles user authentication, session management, and role-based access

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth } from "@/config/firebase";
import { getUserById } from "@/services/userService";
import { withLoginRateLimit } from "@/utils/rateLimiter";
import { isValidEmail } from "@/utils/validation";

const AuthContext = createContext();

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
      
      if (firebaseUser) {
        try {
          // Fetch user data from Firestore
          console.log("� Fetching user data for UID:", firebaseUser.uid);
          const userData = await getUserById(firebaseUser.uid);
          
          if (userData) {
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
    return () => unsubscribe();
  }, []);

  /**
   * Login with email and password (with rate limiting and validation)
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Result object with success status
   */
  const login = async (email, password) => {
    try {
      // Input validation
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
      
      if (!isValidEmail(email)) {
        throw new Error("Invalid email address format");
      }
      
      // Use rate limiter wrapper
      return await withLoginRateLimit(email, async () => {
        // Sign in with Firebase Authentication
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Fetch user data from Firestore
        const userData = await getUserById(userCredential.user.uid);
        
        if (!userData) {
          await signOut(auth);
          throw new Error("User data not found in database");
        }
        
        // Check if user is active
        if (userData.status === 'inactive') {
          await signOut(auth);
          throw new Error("Your account has been deactivated. Please contact administrator.");
        }
        
        return { 
          success: true, 
          user: userData 
        };
      });
      
    } catch (error) {
      // Handle specific Firebase auth errors
      let errorMessage = "Login failed. Please try again.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address format";
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = "This account has been disabled";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed login attempts. Please try again later";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };

  /**
   * Logout current user
   */
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    currentUser: user ? {
      uid: user.id || user.uid, // Use id or fallback to uid
      id: user.id || user.uid,
      displayName: user.name,
      name: user.name,
      email: user.email,
      role: user.role,
    } : null,
    isAuthenticated,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
