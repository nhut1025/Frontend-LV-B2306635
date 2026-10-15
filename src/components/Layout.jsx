// src/components/Layout.jsx
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Grid3x3, LogOut, ChefHat, UserRound, CalendarPlus, Users2, Receipt, Landmark, Flame, Banknote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reservationsApi } from '../api/reservations';
import { billsApi } from '../api/bills';

const navItems = [
  { to: '/dishes', label: 'Món ăn', icon: UtensilsCrossed, roles: null },
  { to: '/tables', label: 'Sơ đồ bàn', icon: Grid3x3, roles: ['customer', 'phuc_vu', 'thu_ngan', 'manager'] },
  { to: '/kitchen', label: 'Màn hình bếp', icon: Flame, roles: ['kitchen'] },
  { to: '/reservations', label: 'Đặt bàn', icon: CalendarPlus, roles: ['customer'] },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: UserRound, roles: null },
  { to: '/staff', label: 'Nhân sự', icon: Users2, roles: ['manager'] },
  { to: '/pending-deposits', label: 'Cọc chờ xác nhận', icon: Receipt, roles: ['thu_ngan'], badge: 'deposits' },
  { to: '/payments', label: 'Thanh toán bill', icon: Banknote, roles: ['thu_ngan'], badge: 'bills' },
  { to: '/bank-settings', label: 'Tài khoản nhận cọc', icon: Landmark, roles: ['manager'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ deposits: 0, bills: 0 });

  // Huy hiệu số đếm cho thu_ngan — tự làm mới mỗi 10 giây, hiện ở mọi trang để không bỏ sót việc:
  //  - deposits: số cọc đang chờ xác nhận
  //  - bills: số bàn đã ăn xong, sẵn sàng thanh toán
  useEffect(() => {
    if (user?.role !== 'thu_ngan') return undefined;

    async function loadCount() {
      // allSettled: 1 API lỗi tạm thời thì giữ nguyên số cũ, không ảnh hưởng số còn lại (và không làm phiền người dùng)
      const [deposits, bills] = await Promise.allSettled([
        reservationsApi.listPendingDeposits(),
        billsApi.payable(),
      ]);
      setCounts((prev) => ({
        deposits: deposits.status === 'fulfilled' ? deposits.value.data.pending.length : prev.deposits,
        bills:
          bills.status === 'fulfilled'
            ? bills.value.data.bills.filter((b) => b.unserved_count === 0).length
            : prev.bills,
      }));
    }

    loadCount();
    const intervalId = setInterval(loadCount, 10000);
    return () => clearInterval(intervalId);
  }, [user?.role]);

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
          {visibleItems.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-basil-50 text-basil-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon size={18} />
                {label}
              </span>
              {badge && counts[badge] > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-500 px-1.5 text-xs font-semibold text-white">
                  {counts[badge]}
                </span>
              )}
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