import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import AdminDashboard from '../pages/AdminDashboard'
import ManagerDashboard from '../pages/ManagerDashboard'
import StaffDashboard from '../pages/StaffDashboard'
import { useAuth } from '../contexts/AuthContext'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route 
          path="/admin/*" 
          element={
            user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/manager/*" 
          element={
            user?.role === 'manager' ? <ManagerDashboard /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/staff/*" 
          element={
            user?.role === 'staff' ? <StaffDashboard /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/" 
          element={
            user ? 
              <Navigate to={
                user.role === 'admin' ? '/admin' : 
                user.role === 'manager' ? '/manager' : '/staff'
              } replace /> :
              <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </Router>
  )
}

export default App