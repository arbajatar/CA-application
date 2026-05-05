import { NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, User, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
    { to: '/staff/tasks', icon: ClipboardList, label: 'My Tasks' },
    { to: '/staff/profile', icon: User, label: 'My Profile' },
]

export default function StaffSidebar() {
    const { user, logout } = useAuth()
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
                        <ShieldCheck size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">Staff Portal</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Office Management</p>
                    </div>
                </div>
            </div>

            {/* User card */}
            <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0f1c2e] flex items-center justify-center text-white text-sm font-bold">
                    {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                    <p className="text-xs text-green-500 font-medium">● Online</p>
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
                                ? 'bg-[#0f1c2e] text-white'
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