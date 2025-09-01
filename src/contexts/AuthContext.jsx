import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const defaultAdmin = {
  id: 1,
  email: 'admin@projectflow.com',
  password: 'admin123',
  role: 'admin',
  name: 'Admin User'
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize users in localStorage if not present
    const allUsers = JSON.parse(localStorage.getItem('projectflow_users') || '[]');
    if (allUsers.length === 0) {
      localStorage.setItem('projectflow_users', JSON.stringify([defaultAdmin]));
    }

    // Check for a logged-in user session
    const savedUser = localStorage.getItem('projectflow_user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    const allUsers = JSON.parse(localStorage.getItem('projectflow_users') || '[]');
    const foundUser = allUsers.find(u => u.email === email && u.password === password);
    
    if (foundUser) {
      const userData = { ...foundUser };
      delete userData.password;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('projectflow_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    
    return { success: false, error: 'Invalid credentials' };
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('projectflow_user');
  };

  const registerUser = (userData) => {
    const allUsers = JSON.parse(localStorage.getItem('projectflow_users') || '[]');
    
    if (allUsers.some(u => u.email === userData.email)) {
      return { success: false, error: 'A user with this email already exists.' };
    }

    const newUser = {
      id: Date.now(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role === 'admin' ? 'admin' : 'staff', // Ensure role is either 'admin' or 'staff'
    };

    const updatedUsers = [...allUsers, newUser];
    localStorage.setItem('projectflow_users', JSON.stringify(updatedUsers));

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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};