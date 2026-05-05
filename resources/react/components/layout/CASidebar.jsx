import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Users, UserCog, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
    { to: '/ca/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ca/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/ca/clients', icon: Users, label: 'Clients' },
    { to: '/ca/staff', icon: UserCog, label: 'Staff' },
    { to: '/ca/settings', icon: Settings, label: 'Settings' },
]

export default function CASidebar() {
    const { logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    return (
        <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-100 flex flex-col z-40 shadow-sm">
            {/* Logo */}
            <div className="px-6 py-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0f1c2e] rounded-xl flex items-center justify-center">
                        <LayoutDashboard size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">CA Office</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Admin Suite</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                ? 'bg-[#EEF4FB] text-[#1F5C99]'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                            }`
                        }
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="px-4 py-6 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition"
                >
                    <LogOut size={18} />
                    Sign Out
                </button>
            </div>
        </aside>
    )
}