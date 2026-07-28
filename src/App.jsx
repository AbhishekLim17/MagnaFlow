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
import {
  getHomeRoute,
  MASTER_ADMIN_ROLES,
  ORG_ADMIN_ROLES,
  DEPARTMENT_HEAD_ROLES,
  MANAGER_ROLES,
  STAFF_ROLES,
} from "@/config/roleRoutes";
import LoadingSpinner from "@/components/LoadingSpinner";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import StaffDashboard from "@/pages/StaffDashboard";
import MasterAdminDashboard from "@/components/admin/MasterAdminDashboard";
import ScopedDashboard from "@/pages/ScopedDashboard";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  // Wait for Firebase to resolve the session before deciding to redirect,
  // otherwise a hard refresh bounces authenticated users to /login.
  if (loading) {
    return <LoadingSpinner size="large" className="min-h-screen" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  return children;
}

function AppRoutes() {
  const { isAuthenticated, user, loading } = useAuth();

  // Don't render routes until the auth state is known.
  if (loading) {
    return <LoadingSpinner size="large" className="min-h-screen" />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={getHomeRoute(user.role)} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/master/*"
        element={
          <ProtectedRoute allowedRoles={MASTER_ADMIN_ROLES}>
            <MasterAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={ORG_ADMIN_ROLES}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/department/*"
        element={
          <ProtectedRoute allowedRoles={DEPARTMENT_HEAD_ROLES}>
            <ScopedDashboard scope="department" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager/*"
        element={
          <ProtectedRoute allowedRoles={MANAGER_ROLES}>
            <ScopedDashboard scope="project" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/*"
        element={
          <ProtectedRoute allowedRoles={STAFF_ROLES}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <Navigate
            to={isAuthenticated ? getHomeRoute(user.role) : "/login"}
            replace
          />
        }
      />
      {/* Catch-all: send unknown URLs to a sensible home instead of a blank screen. */}
      <Route
        path="*"
        element={
          <Navigate
            to={isAuthenticated ? getHomeRoute(user.role) : "/login"}
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