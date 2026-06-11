import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Users, User, LogOut, ShieldCheck, Menu, Info, Globe, BarChart3 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../ui/ConfirmDialog'

const navItems = [
    { to: '/staff/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/staff/tasks', icon: ClipboardList, label: 'My Sheets' },
    { to: '/staff/clients', icon: Users, label: 'Clients' },
    { to: '/staff/reports/team', icon: BarChart3, label: 'Team Report' },
    { to: '/staff/portals', icon: Globe, label: 'Portal List' },
    { to: '/staff/profile', icon: User, label: 'My Profile' },
    { to: '/staff/things-to-know', icon: Info, label: 'Learning Library' },
]

export default function StaffSidebar({ isOpen = true, setIsOpen, isMobileOpen, setIsMobileOpen }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

    const handleLogout = async () => {
        setLogoutConfirmOpen(false)
        await logout()
        navigate('/login')
        setIsMobileOpen?.(false)
    }

    const sidebarClasses = `
        fixed top-0 left-0 h-screen bg-[#0f1c2e] border-r border-[#1e2e42] flex flex-col z-40 shadow-[4px_0_24px_rgba(15,28,46,0.03)] transition-all duration-300
        ${isOpen ? 'w-64' : 'w-20'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `

    return (
        <aside className={sidebarClasses}>
            {/* Logo */}
            <div className={`px-4 py-3.5 border-b border-[#1e2e42] flex items-center ${isOpen ? 'justify-between' : 'justify-center'} overflow-hidden`}>
                {(isOpen || isMobileOpen) && (
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden bg-white rounded-xl p-1">
                            <img src="/CA_LOGO-png.png" alt="CA Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white whitespace-nowrap">Staff Portal</p>
                            <p className="text-xs text-slate-400 uppercase tracking-wider whitespace-nowrap">Office Management</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => {
                        if (window.innerWidth < 1024) {
                            setIsMobileOpen?.(false)
                        } else {
                            setIsOpen && setIsOpen(!isOpen)
                        }
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Toggle Menu"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* User card */}
            {(isOpen || isMobileOpen) ? (
                <div className="mx-4 mt-4 p-3 bg-white/5 rounded-xl flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-[#1F5C99] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                        <p className="text-xs text-green-400 font-medium">● Online</p>
                    </div>
                </div>
            ) : (
                <div className="mx-auto mt-4 w-10 h-10 rounded-xl bg-[#1F5C99] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm" title={user?.name}>
                    {user?.name?.[0]?.toUpperCase()}
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onClick={() => setIsMobileOpen?.(false)}
                        className={({ isActive }) =>
                            `flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isOpen ? 'px-4' : 'px-0 justify-center w-10 mx-auto'} ${isActive
                                ? 'bg-[#1F5C99] text-white shadow-sm'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`
                        }
                        title={!isOpen ? label : undefined}
                    >
                        <Icon size={18} className="shrink-0" />
                        {(isOpen || (isMobileOpen && window.innerWidth < 1024)) && <span className="whitespace-nowrap">{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className={`px-4 py-3 flex flex-col ${isOpen ? '' : 'items-center justify-center'}`}>
                <div className={`h-[1px] bg-slate-800 mx-auto mb-3 transition-all ${isOpen ? 'w-4/5' : 'w-10'}`}></div>
                <button
                    onClick={() => setLogoutConfirmOpen(true)}
                    className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/20 transition-all ${isOpen ? 'w-full px-4' : 'justify-center px-0 w-10 mx-auto shrink-0'}`}
                    title={!isOpen ? "Sign Out" : undefined}
                >
                    <LogOut size={18} className="shrink-0" />
                    {(isOpen || (isMobileOpen && window.innerWidth < 1024)) && <span className="whitespace-nowrap">Sign Out</span>}
                </button>
            </div>

            <ConfirmDialog
                open={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={handleLogout}
                title="Sign Out"
                message="Are you sure you want to sign out of your account?"
                confirmLabel="Sign Out"
                danger
            />
        </aside>
    )
}