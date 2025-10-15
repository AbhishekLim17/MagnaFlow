import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const defaultAdmin = {
  id: 1,
  email: "admin@projectflow.com",
  password: "admin123",
  role: "admin",
  name: "Admin User",
};

const defaultStaff = {
  id: 2,
  email: "staff@projectflow.com",
  password: "staff123",
  role: "staff",
  name: "Staff User",
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🚀 AuthProvider useEffect running");
    console.log("🌐 localStorage available:", typeof Storage !== "undefined");
    console.log("🌐 Window location:", window.location.href);

    // Initialize users in localStorage if not present
    const rawData = localStorage.getItem("projectflow_users");
    console.log("💾 Raw localStorage projectflow_users:", rawData);

    let allUsers;
    try {
      allUsers = JSON.parse(rawData || "[]");
      console.log("👥 Parsed users on init:", allUsers);
      console.log("👥 Number of users found:", allUsers.length);
    } catch (error) {
      console.error("❌ Error parsing localStorage:", error);
      allUsers = [];
    }

    if (allUsers.length === 0) {
      console.log("⚠️  No users found, initializing with default users");
      console.log("👤 Default admin:", defaultAdmin);
      console.log("👤 Default staff:", defaultStaff);

      allUsers = [defaultAdmin, defaultStaff];
      const jsonString = JSON.stringify(allUsers);
      console.log("💾 Storing users as JSON:", jsonString);

      localStorage.setItem("projectflow_users", jsonString);

      // Verify storage
      const verifyData = localStorage.getItem("projectflow_users");
      console.log("✅ Verification - stored data:", verifyData);
      console.log("✅ Users initialized successfully:", allUsers);
    } else {
      // Check if both admin and staff users exist, if not, reinitialize
      const hasAdmin = allUsers.some(
        (u) => u.email === "admin@projectflow.com"
      );
      const hasStaff = allUsers.some(
        (u) => u.email === "staff@projectflow.com"
      );

      console.log("👤 Has Admin user:", hasAdmin);
      console.log("👤 Has Staff user:", hasStaff);

      if (!hasAdmin || !hasStaff) {
        console.log(
          "⚠️  Missing users detected, reinitializing with complete user set"
        );
        allUsers = [defaultAdmin, defaultStaff];
        const jsonString = JSON.stringify(allUsers);
        console.log("💾 Storing complete user set:", jsonString);

        localStorage.setItem("projectflow_users", jsonString);

        // Verify storage
        const verifyData = localStorage.getItem("projectflow_users");
        console.log("✅ Verification - complete data stored:", verifyData);
      }
    }

    // Check for a logged-in user session
    const savedUser = localStorage.getItem("projectflow_user");
    console.log("👤 Saved user session:", savedUser);

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        console.log("👤 Restoring user session:", userData);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("❌ Error parsing saved user:", error);
      }
    }

    console.log("✅ AuthProvider initialization complete");
    setLoading(false);
  }, []);

  const login = (email, password) => {
    console.log("🔐 LOGIN FUNCTION CALLED");
    console.log("📧 Input email:", `"${email}"`);
    console.log("🔑 Input password:", `"${password}"`);
    console.log("📏 Email length:", email?.length);
    console.log("📏 Password length:", password?.length);

    // Check localStorage first
    const rawUsersData = localStorage.getItem("projectflow_users");
    console.log("💾 Raw localStorage data:", rawUsersData);

    let allUsers;
    try {
      allUsers = JSON.parse(rawUsersData || "[]");
      console.log("👥 Parsed users:", allUsers);
      console.log("👥 Number of users:", allUsers.length);
    } catch (error) {
      console.error("❌ Error parsing users from localStorage:", error);
      allUsers = [];
    }

    // If no users or incomplete users, force reinitialize
    const hasAdmin = allUsers.some((u) => u.email === "admin@projectflow.com");
    const hasStaff = allUsers.some((u) => u.email === "staff@projectflow.com");

    if (allUsers.length === 0 || !hasAdmin || !hasStaff) {
      console.log("⚠️  Incomplete users found, force reinitializing...");
      console.log("👤 Has admin:", hasAdmin);
      console.log("👤 Has staff:", hasStaff);

      allUsers = [defaultAdmin, defaultStaff];
      localStorage.setItem("projectflow_users", JSON.stringify(allUsers));
      console.log("✅ Users reinitialized:", allUsers);
    }

    // Trim inputs to avoid whitespace issues
    const trimmedEmail = email?.trim();
    const trimmedPassword = password?.trim();

    console.log("🧹 Trimmed email:", `"${trimmedEmail}"`);
    console.log("🧹 Trimmed password:", `"${trimmedPassword}"`);

    // Check each user individually
    console.log("🔍 Checking each user:");
    allUsers.forEach((user, index) => {
      console.log(`👤 User ${index + 1}:`, {
        id: user.id,
        email: `"${user.email}"`,
        password: `"${user.password}"`,
        role: user.role,
        name: user.name,
      });
      console.log(
        `📧 Email match: ${user.email?.trim()} === ${trimmedEmail} = ${
          user.email?.trim() === trimmedEmail
        }`
      );
      console.log(
        `🔑 Password match: ${user.password?.trim()} === ${trimmedPassword} = ${
          user.password?.trim() === trimmedPassword
        }`
      );
      console.log(
        `✅ Both match: ${
          user.email?.trim() === trimmedEmail &&
          user.password?.trim() === trimmedPassword
        }`
      );
    });

    const foundUser = allUsers.find(
      (u) =>
        u.email?.trim() === trimmedEmail &&
        u.password?.trim() === trimmedPassword
    );

    console.log("🎯 Found user result:", foundUser);

    if (foundUser) {
      const userData = { ...foundUser };
      delete userData.password;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem("projectflow_user", JSON.stringify(userData));
      console.log("✅ Login successful for:", userData);
      return { success: true, user: userData };
    }

    console.log("❌ Login failed - no matching user found");
    return { success: false, error: "Invalid credentials" };
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("projectflow_user");
  };

  const registerUser = (userData) => {
    const allUsers = JSON.parse(
      localStorage.getItem("projectflow_users") || "[]"
    );

    if (allUsers.some((u) => u.email === userData.email)) {
      return {
        success: false,
        error: "A user with this email already exists.",
      };
    }

    const newUser = {
      id: Date.now(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role === "admin" ? "admin" : "staff", // Ensure role is either 'admin' or 'staff'
    };

    const updatedUsers = [...allUsers, newUser];
    localStorage.setItem("projectflow_users", JSON.stringify(updatedUsers));

    return { success: true, user: newUser };
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    registerUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
