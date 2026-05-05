import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleRoute from './routes/RoleRoute'

import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/ca/DashboardPage'
import TasksPage from './pages/ca/TasksPage'
import ClientsPage from './pages/ca/ClientsPage'
import StaffPage from './pages/ca/StaffPage'
import SettingsPage from './pages/ca/SettingsPage'
import MyTasksPage from './pages/staff/MyTasksPage'
import ProfilePage from './pages/staff/ProfilePage'

import CASidebar from './components/layout/CASidebar'
import StaffSidebar from './components/layout/StaffSidebar'

function CALayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <CASidebar />
      <main className="flex-1 ml-64 p-8 min-h-screen">{children}</main>
    </div>
  )
}

function StaffLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <StaffSidebar />
      <main className="flex-1 ml-64 p-8 min-h-screen">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* CA Routes */}
          <Route path="/ca/dashboard" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><DashboardPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/tasks" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><TasksPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/clients" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><ClientsPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/staff" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><StaffPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/settings" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><SettingsPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />

          {/* Staff Routes */}
          <Route path="/staff/tasks" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><MyTasksPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/profile" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><ProfilePage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
