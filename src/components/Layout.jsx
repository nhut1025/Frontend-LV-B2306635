// src/components/Layout.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Grid3x3, LogOut, ChefHat, UserRound, CalendarPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dishes', label: 'Món ăn', icon: UtensilsCrossed, roles: null },
  { to: '/tables', label: 'Sơ đồ bàn', icon: Grid3x3, roles: null }, // ai đăng nhập cũng xem được
  { to: '/reservations', label: 'Đặt bàn', icon: CalendarPlus, roles: ['customer'] },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: UserRound, roles: null },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-porcelain">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6">
        <div className="mb-8 flex items-center gap-2 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <ChefHat size={18} />
          </div>
          <span className="font-display text-lg font-semibold text-ink">Quán Ăn</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-basil-50 text-basil-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="px-1 text-sm font-medium text-ink">{user?.full_name}</p>
          <p className="px-1 text-xs text-slate-400">{user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-clay-500 hover:bg-clay-50"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
