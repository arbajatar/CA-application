import { NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, User, LogOut, ShieldCheck, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
    { to: '/staff/tasks', icon: ClipboardList, label: 'My Tasks' },
    { to: '/staff/profile', icon: User, label: 'My Profile' },
]

export default function StaffSidebar({ isOpen = true, setIsOpen, isMobileOpen, setIsMobileOpen }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
        setIsMobileOpen?.(false)
    }

    const sidebarClasses = `
        fixed top-0 left-0 h-screen bg-white border-r border-gray-100 flex flex-col z-40 shadow-sm transition-all duration-300
        ${isOpen ? 'w-64' : 'w-20'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `

    return (
        <aside className={sidebarClasses}>
            {/* Logo */}
            <div className={`px-4 py-6 border-b border-gray-100 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} overflow-hidden`}>
                {(isOpen || isMobileOpen) && (
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden">
                            <img src="/CA_LOGO-png.png" alt="CA Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 whitespace-nowrap">Staff Portal</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">Office Management</p>
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
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0"
                    title="Toggle Menu"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* User card */}
            {(isOpen || isMobileOpen) ? (
                <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-[#0f1c2e] flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                        <p className="text-xs text-green-500 font-medium">● Online</p>
                    </div>
                </div>
            ) : (
                <div className="mx-auto mt-4 w-10 h-10 rounded-xl bg-[#0f1c2e] flex items-center justify-center text-white text-sm font-bold shrink-0" title={user?.name}>
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
                                ? 'bg-[#0f1c2e] text-white'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
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
            <div className={`px-4 py-6 border-t border-gray-100 flex ${isOpen ? '' : 'justify-center'}`}>
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all ${isOpen ? 'w-full px-4' : 'justify-center px-0 w-10 mx-auto shrink-0'}`}
                    title={!isOpen ? "Sign Out" : undefined}
                >
                    <LogOut size={18} className="shrink-0" />
                    {(isOpen || (isMobileOpen && window.innerWidth < 1024)) && <span className="whitespace-nowrap">Sign Out</span>}
                </button>
            </div>
        </aside>
    )
}