import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, Menu } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleRoute from './routes/RoleRoute'
import { Toaster } from 'react-hot-toast'

import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/ca/DashboardPage'
import TasksPage from './pages/ca/TasksPage'
import ClientsPage from './pages/ca/ClientsPage'
import StaffPage from './pages/ca/StaffPage'
import PortalListPage from './pages/ca/PortalListPage'
import SettingsPage from './pages/ca/SettingsPage'
import MyTasksPage from './pages/staff/MyTasksPage'
import ProfilePage from './pages/staff/ProfilePage'

import CASidebar from './components/layout/CASidebar'
import StaffSidebar from './components/layout/StaffSidebar'
import TaskBuilderPage from './pages/ca/TaskBuilderPage'
import TaskDetailPage from './pages/ca/TaskDetailPage'
import ThingsToKnowPage from './pages/common/ThingsToKnowPage'
import ReportsPage from './pages/ca/ReportsPage'
import TeamReportPage from './pages/ca/TeamReportPage'
import RecycleBinPage from './pages/ca/RecycleBinPage'
import SheetLogsPage from './pages/ca/SheetLogsPage'
import BackupPage from './pages/ca/BackupPage'

function CALayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <CASidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/CA_LOGO-png.png" alt="CA Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-gray-900">CA Office</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <Menu size={20} />
          </button>
        </header>

        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} p-2 flex flex-col`}>
          {children}
        </main>
      </div>
    </div>
  )
}

function StaffLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <StaffSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/CA_LOGO-png.png" alt="CA Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-gray-900">Staff Portal</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <Menu size={20} />
          </button>
        </header>

        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} p-2 flex flex-col`}>
          {children}
        </main>
      </div>
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
          <Route path="/ca/tasks/builder" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><TaskBuilderPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/tasks/:id" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><TaskDetailPage /></CALayout>
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
          <Route path="/ca/portals" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><PortalListPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/settings" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><SettingsPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/things-to-know" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><ThingsToKnowPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/reports" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><ReportsPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/reports/team" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><TeamReportPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/reports/:type" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><ReportsPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/ca/recycle-bin" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><RecycleBinPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/logs" element={
            <ProtectedRoute><RoleRoute role="ca">
              <CALayout><SheetLogsPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/backup" element={
            <ProtectedRoute><RoleRoute role="super_admin">
              <CALayout><BackupPage /></CALayout>
            </RoleRoute></ProtectedRoute>
          } />

          {/* Staff Routes */}
          <Route path="/staff/dashboard" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><DashboardPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/tasks" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><MyTasksPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/clients" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><ClientsPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/tasks/builder" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><TaskBuilderPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/tasks/:id" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><TaskDetailPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/reports/team" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><TeamReportPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
           <Route path="/staff/profile" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><ProfilePage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/portals" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><PortalListPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
          <Route path="/staff/things-to-know" element={
            <ProtectedRoute><RoleRoute role="staff">
              <StaffLayout><ThingsToKnowPage /></StaffLayout>
            </RoleRoute></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
      <Toaster 
        position="top-right" 
        containerStyle={{ zIndex: 1000000 }}
        toastOptions={{
          style: { zIndex: 1000000 }
        }} 
      />
    </AuthProvider>
  )
}
