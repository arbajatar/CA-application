import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Users, UserCog, Settings, LogOut, Menu, Globe, Info, BarChart3, ChevronDown, ChevronUp, Trash2, Database } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../ui/ConfirmDialog'

const navItems = [
    { to: '/ca/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ca/tasks', icon: ClipboardList, label: 'Sheets' },
    { to: '/ca/clients', icon: Users, label: 'Clients' },
    { to: '/ca/staff', icon: UserCog, label: 'Staff' },
    { to: '/ca/portals', icon: Globe, label: 'Portal List' },
    { 
        label: 'Report', 
        icon: BarChart3,
        children: [
            { to: '/ca/reports/team', label: 'Team Report' },
            // { to: '/ca/reports/timesheet', label: 'TimeSheet Report' },
            // { to: '/ca/reports/tasks', label: 'Task Report' },
        ]
    },
    { to: '/ca/settings', icon: Settings, label: 'Settings' },
    { to: '/ca/things-to-know', icon: Info, label: 'Learning Library' },
    { to: '/ca/recycle-bin', icon: Trash2, label: 'Recycle Bin' },
]

export default function CASidebar({ isOpen = true, setIsOpen, isMobileOpen, setIsMobileOpen }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
    const [reportsExpanded, setReportsExpanded] = useState(location.pathname.startsWith('/ca/reports'))

    const isSuperAdmin = user?.role === 'super_admin'
    const activeNavItems = isSuperAdmin
        ? [
            { to: '/backup', icon: Database, label: 'DB Backup & Restore' },
            { to: '/attachment-backup', icon: Database, label: 'Attachment Backup' }
          ]
        : navItems

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
                            <p className="text-sm font-bold text-white whitespace-nowrap">{isSuperAdmin ? 'Super Admin' : 'CA Office'}</p>
                            <p className="text-xs text-slate-400 uppercase tracking-wider whitespace-nowrap">{isSuperAdmin ? 'System Suite' : 'Admin Suite'}</p>
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

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
                {activeNavItems.map((item) => {
                    if (item.children) {
                        const Icon = item.icon
                        const isExpanded = reportsExpanded
                        const hasActiveChild = item.children.some(child => location.pathname === child.to)

                        return (
                            <div key={item.label} className="space-y-1">
                                <button
                                    onClick={() => {
                                        if (!isOpen) {
                                            setIsOpen(true)
                                        }
                                        setReportsExpanded(!reportsExpanded)
                                    }}
                                    className={`flex items-center justify-between w-full py-2.5 rounded-xl text-sm font-medium transition-all ${isOpen ? 'px-4' : 'px-0 justify-center w-10 mx-auto'} ${hasActiveChild
                                        ? 'bg-[#1F5C99] text-white shadow-sm'
                                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} className="shrink-0" />
                                        {isOpen && <span className="whitespace-nowrap">{item.label}</span>}
                                    </div>
                                    {isOpen && (
                                        isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                    )}
                                </button>
                                
                                {isOpen && isExpanded && (
                                    <div className="pl-6 space-y-1 mt-1 transition-all duration-200">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.to}
                                                to={child.to}
                                                onClick={() => setIsMobileOpen?.(false)}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-2.5 py-2 px-4 rounded-xl text-xs font-bold transition-all ${isActive
                                                        ? 'text-white bg-[#1F5C99] shadow-sm'
                                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                    }`
                                                }
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full border border-current shrink-0"></span>
                                                <span className="whitespace-nowrap">{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    }

                    const Icon = item.icon
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileOpen?.(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isOpen ? 'px-4' : 'px-0 justify-center w-10 mx-auto'} ${isActive
                                    ? 'bg-[#1F5C99] text-white shadow-sm'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                }`
                            }
                            title={!isOpen ? item.label : undefined}
                        >
                            <Icon size={18} className="shrink-0" />
                            {(isOpen || (isMobileOpen && window.innerWidth < 1024)) && <span className="whitespace-nowrap">{item.label}</span>}
                        </NavLink>
                    )
                })}
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