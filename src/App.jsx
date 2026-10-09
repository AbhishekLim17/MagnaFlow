import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DesignationsProvider } from "@/contexts/DesignationsContext";
import { TasksProvider } from "@/contexts/TasksContext";
import {
  getHomeRoute,
  MASTER_ADMIN_ROLES,
  ORG_ADMIN_ROLES,
  DEPARTMENT_HEAD_ROLES,
  MANAGER_ROLES,
  STAFF_ROLES,
  CLIENT_ROLES,
  FINANCE_ROLES,
} from "@/config/roleRoutes";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import LoginPage from "@/pages/LoginPage";
import SessionProblem from "@/components/shared/SessionProblem";
import { ConfirmProvider } from "@/components/shared/ConfirmDialog";

// Dashboards are code-split: a signed-in user only downloads the one for their
// own role, instead of all five plus their charting/PDF dependencies up front.
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const StaffDashboard = lazy(() => import("@/pages/StaffDashboard"));
const MasterAdminDashboard = lazy(
  () => import("@/components/admin/MasterAdminDashboard"),
);
const ScopedDashboard = lazy(() => import("@/pages/ScopedDashboard"));
const ClientPortal = lazy(() => import("@/pages/ClientPortal"));
const FinanceDashboard = lazy(() => import("@/pages/FinanceDashboard"));

const FullPageLoader = () => (
  <LoadingSpinner size="large" className="min-h-screen" />
);

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  // Wait for Firebase to resolve the session before deciding to redirect,
  // otherwise a hard refresh bounces authenticated users to /login.
  if (loading) {
    return <FullPageLoader />;
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
  const { isAuthenticated, user, loading, sessionProblem } = useAuth();
  // Redirects keep the query, so a link like /?task=<id> (from an email) survives signing in.
  const { search } = useLocation();

  // Don't render routes until the auth state is known.
  if (loading) {
    return <FullPageLoader />;
  }

  // Signed in, but the profile could not be loaded: say so (and offer a retry)
  // rather than dropping the person on the login page.
  if (sessionProblem) {
    return <SessionProblem />;
  }

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={{ pathname: getHomeRoute(user.role), search }} replace />
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
          path="/finance/*"
          element={
            <ProtectedRoute allowedRoles={FINANCE_ROLES}>
              <FinanceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/*"
          element={
            <ProtectedRoute allowedRoles={CLIENT_ROLES}>
              <ClientPortal />
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
              to={{ pathname: isAuthenticated ? getHomeRoute(user.role) : "/login", search }}
              replace
            />
          }
        />
        {/* Catch-all: send unknown URLs to a sensible home instead of a blank screen. */}
        <Route
          path="*"
          element={
            <Navigate
              to={{ pathname: isAuthenticated ? getHomeRoute(user.role) : "/login", search }}
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <AuthProvider>
            <TasksProvider>
              <DesignationsProvider>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <Helmet>
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
                  <ConfirmProvider>
                    <div className="min-h-screen">
                      <AppRoutes />
                      <Toaster />
                    </div>
                  </ConfirmProvider>
                </Router>
              </DesignationsProvider>
            </TasksProvider>
          </AuthProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;

