import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Users, UserCog, Settings, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
    { to: '/ca/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ca/tasks', icon: ClipboardList, label: 'Tasks' },
    { to: '/ca/clients', icon: Users, label: 'Clients' },
    { to: '/ca/staff', icon: UserCog, label: 'Staff' },
    { to: '/ca/settings', icon: Settings, label: 'Settings' },
]

export default function CASidebar({ isOpen = true, setIsOpen }) {
    const { logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    return (
        <aside className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-100 flex flex-col z-40 shadow-sm transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
            {/* Logo */}
            <div className={`px-4 py-6 border-b border-gray-100 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} overflow-hidden`}>
                {isOpen && (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#0f1c2e] rounded-xl flex items-center justify-center shrink-0">
                            <LayoutDashboard size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 whitespace-nowrap">CA Office</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">Admin Suite</p>
                        </div>
                    </div>
                )}
                <button 
                    onClick={() => setIsOpen && setIsOpen(!isOpen)} 
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors shrink-0"
                    title="Toggle Menu"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isOpen ? 'px-4' : 'px-0 justify-center w-10 mx-auto'} ${isActive
                                ? 'bg-[#EEF4FB] text-[#1F5C99]'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                            }`
                        }
                        title={!isOpen ? label : undefined}
                    >
                        <Icon size={18} className="shrink-0" />
                        {isOpen && <span className="whitespace-nowrap">{label}</span>}
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
                    {isOpen && <span className="whitespace-nowrap">Sign Out</span>}
                </button>
            </div>
        </aside>
    )
}