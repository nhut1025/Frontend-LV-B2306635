// src/components/Layout.jsx
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Grid3x3, LogOut, ChefHat, UserRound, Users2, Receipt, Landmark, Flame, Banknote, PhoneCall, Tags, Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reservationsApi } from '../api/reservations';
import { billsApi } from '../api/bills';

const navItems = [
  { to: '/dishes', label: 'Món ăn', icon: UtensilsCrossed, roles: null },
  { to: '/categories', label: 'Danh mục món', icon: Tags, roles: ['manager'] },
  { to: '/ingredients', label: 'Nguyên liệu', icon: Leaf, roles: ['manager'] },
  { to: '/tables', label: 'Bàn & đặt bàn', icon: Grid3x3, roles: ['customer'] },
  { to: '/tables', label: 'Sơ đồ bàn', icon: Grid3x3, roles: ['phuc_vu', 'thu_ngan', 'manager'] },
  { to: '/kitchen', label: 'Màn hình bếp', icon: Flame, roles: ['kitchen'] },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: UserRound, roles: null },
  { to: '/staff', label: 'Nhân sự', icon: Users2, roles: ['manager'] },
  { to: '/pending-deposits', label: 'Cọc chờ xác nhận', icon: Receipt, roles: ['thu_ngan'], badge: 'deposits' },
  { to: '/pending-preorders', label: 'Món đặt trước', icon: PhoneCall, roles: ['thu_ngan'], badge: 'preorders' },
  { to: '/payments', label: 'Thanh toán bill', icon: Banknote, roles: ['thu_ngan'], badge: 'bills' },
  { to: '/finance', label: 'Doanh thu', icon: Banknote, roles: ['manager'] },
  { to: '/bank-settings', label: 'Tài khoản nhận cọc', icon: Landmark, roles: ['manager'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ deposits: 0, preorders: 0, bills: 0 });

  // Huy hiệu số đếm cho thu_ngan — tự làm mới mỗi 10 giây, hiện ở mọi trang để không bỏ sót việc:
  //  - deposits: số cọc đang chờ xác nhận
  //  - bills: số bàn đã ăn xong, sẵn sàng thanh toán
  useEffect(() => {
    if (user?.role !== 'thu_ngan') return undefined;

    async function loadCount() {
      // allSettled: 1 API lỗi tạm thời thì giữ nguyên số cũ, không ảnh hưởng số còn lại (và không làm phiền người dùng)
      const [deposits, bills, preorders] = await Promise.allSettled([
        reservationsApi.listPendingDeposits(),
        billsApi.payable(),
        reservationsApi.listPendingPreorders(),
      ]);
      setCounts((prev) => ({
        deposits: deposits.status === 'fulfilled' ? deposits.value.data.pending.length : prev.deposits,
        preorders: preorders.status === 'fulfilled' ? (preorders.value.data.preorders || []).length : prev.preorders,
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
    <div className="flex h-screen overflow-hidden bg-porcelain">
      <aside className="flex h-screen w-16 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-2 py-4 md:w-64 md:px-5 md:py-6">
        <div className="mb-8 flex shrink-0 items-center justify-center gap-2 px-1 md:justify-start">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <ChefHat size={18} />
          </div>
          <span className="hidden font-display text-lg font-semibold text-ink md:inline">Quán Ăn</span>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {visibleItems.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                `flex items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium transition-colors md:justify-between md:px-3.5 ${
                  isActive ? 'bg-basil-50 text-basil-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <span className="flex items-center gap-0 md:gap-3">
                <Icon size={18} />
                <span className="hidden md:inline">{label}</span>
              </span>
              {badge && counts[badge] > 0 && (
                <span className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-clay-500 px-1.5 text-xs font-semibold text-white md:flex">
                  {counts[badge]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 shrink-0 border-t border-slate-100 pt-4">
          <p className="hidden px-1 text-sm font-medium text-ink md:block">{user?.full_name}</p>
          <p className="hidden px-1 text-xs text-slate-400 md:block">{user?.role}</p>
          <button
            onClick={handleLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium text-clay-500 hover:bg-clay-50 md:justify-start md:px-3.5"
          >
            <LogOut size={16} />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="h-screen min-w-0 flex-1 overflow-y-auto px-3 py-4 md:px-8 md:py-8">{children}</main>
    </div>
  );
}