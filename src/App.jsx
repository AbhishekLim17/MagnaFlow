import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Helmet } from "react-helmet";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DesignationsProvider } from "@/contexts/DesignationsContext";
import { TasksProvider } from "@/contexts/TasksContext";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import StaffDashboard from "@/pages/StaffDashboard";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate to={user.role === "admin" ? "/admin" : "/staff"} replace />
    );
  }

  return children;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate
              to={user.role === "admin" ? "/admin" : "/staff"}
              replace
            />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={["staff"]}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <Navigate
            to={
              isAuthenticated
                ? user.role === "admin"
                  ? "/admin"
                  : "/staff"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <TasksProvider>
        <DesignationsProvider>
          <Router>
            <Helmet>
              <title>MagnaFlow - Role-Based Project & Task Management</title>
              <meta
                name="description"
                content="Streamline your project management with role-based access, task tracking, and performance analytics."
              />
              <meta
                property="og:title"
                content="MagnaFlow - Role-Based Project & Task Management"
              />
              <meta
                property="og:description"
                content="Streamline your project management with role-based access, task tracking, and performance analytics."
              />
            </Helmet>
            <div className="min-h-screen">
              <AppRoutes />
              <Toaster />
            </div>
          </Router>
        </DesignationsProvider>
      </TasksProvider>
    </AuthProvider>
  );
}

export default App;
