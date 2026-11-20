// src/components/Layout.jsx
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Grid3x3, LogOut, ChefHat, UserRound, Users2, Receipt, Landmark, Flame, Banknote, PhoneCall, Tags, Leaf, Star, MessageSquareText, X, Clock3, CalendarClock, MessageCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reservationsApi } from '../api/reservations';
import { billsApi } from '../api/bills';
import { createSocket } from '../api/socket';
import { chatApi } from '../api/chat';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import LanguageSwitcher from './LanguageSwitcher';

const navItems = [
  { to: '/dishes', key: 'dishes', label: 'Món ăn', icon: UtensilsCrossed, roles: null },
  { to: '/restaurant-reviews', key: 'reviews', label: 'Đánh giá quán', icon: Star, roles: null },
  { to: '/manage-reviews', label: 'Quản lý đánh giá', icon: MessageSquareText, roles: ['manager'] },
  { to: '/categories', label: 'Danh mục món', icon: Tags, roles: ['manager'] },
  { to: '/ingredients', label: 'Nguyên liệu', icon: Leaf, roles: ['manager'] },
  { to: '/tables', key: 'tables', label: 'Bàn & đặt bàn', icon: Grid3x3, roles: ['customer'] },
  { to: '/my-reservations', key: 'myReservations', label: 'Lịch sử đặt bàn', icon: CalendarClock, roles: ['customer'] },
  { to: '/chat', key: 'chat', label: 'Chat với quán', icon: MessageCircle, roles: ['customer'], badge: 'chat' },
  { to: '/chat', label: 'Tin nhắn', icon: MessageCircle, roles: ['thu_ngan'], badge: 'chat' },
  { to: '/tables', label: 'Sơ đồ bàn', icon: Grid3x3, roles: ['phuc_vu', 'thu_ngan', 'manager'] },
  { to: '/kitchen', label: 'Màn hình bếp', icon: Flame, roles: ['kitchen'] },
  { to: '/profile', key: 'profile', label: 'Hồ sơ cá nhân', icon: UserRound, roles: null },
  { to: '/staff', label: 'Nhân sự', icon: Users2, roles: ['manager'] },
  { to: '/pending-deposits', label: 'Cọc chờ xác nhận', icon: Receipt, roles: ['thu_ngan'], badge: 'deposits' },
  { to: '/pending-refunds', label: 'Hoàn cọc', icon: Receipt, roles: ['manager'], badge: 'refunds' },
  { to: '/pending-preorders', label: 'Món đặt trước', icon: PhoneCall, roles: ['thu_ngan'], badge: 'preorders' },
  { to: '/payments', label: 'Thanh toán bill', icon: Banknote, roles: ['thu_ngan'], badge: 'bills' },
  { to: '/payment-history', label: 'Lịch sử giao dịch', icon: Receipt, roles: ['thu_ngan'] },
  { to: '/finance', label: 'Thu chi', icon: Banknote, roles: ['manager'] },
  { to: '/top-selling-dishes', label: 'Món bán chạy', icon: TrendingUp, roles: ['manager'] },
  { to: '/bank-settings', label: 'Tài khoản nhận cọc', icon: Landmark, roles: ['manager'] },
  { to: '/reservation-timing', label: 'Thời gian đặt bàn', icon: Clock3, roles: ['manager'] },
];

export default function Layout({ children, flushTop = false }) {
  const { user, logout } = useAuth();
  const isCustomerFacing = !user || user.role === 'customer';
  const { t } = useCustomerTranslation(isCustomerFacing);
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ deposits: 0, preorders: 0, bills: 0, refunds: 0, chat: 0 });
  const [refundCountError, setRefundCountError] = useState('');
  const [depositLateNotice, setDepositLateNotice] = useState('');

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
    const socket = createSocket();
    socket.on('cashier:deposit-confirmed', loadCount);
    socket.on('cashier:deposit-late-payment', (payment) => {
      const code = payment.transaction_code || `COC${payment.reservation_id}`;
      const amount = Number(payment.transfer_amount).toLocaleString('vi-VN');
      setDepositLateNotice(
        `SePay đã nhận ${amount}đ (${code}) nhưng chưa thể xác nhận cọc cho đặt bàn #${payment.reservation_id}. ` +
        'Vui lòng kiểm tra giao dịch và xử lý hoặc hoàn tiền thủ công.'
      );
      loadCount();
    });
    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'manager') return undefined;

    async function loadRefundCount() {
      try {
        const response = await reservationsApi.listPendingRefunds();
        setCounts((current) => ({ ...current, refunds: response.data.pending.length }));
        setRefundCountError('');
      } catch (err) {
        const message = err.response?.data?.message || err.message;
        console.error('Không thể cập nhật số yêu cầu hoàn cọc:', message);
        setRefundCountError(message);
      }
    }

    loadRefundCount();
    const intervalId = setInterval(loadRefundCount, 15000);
    const socket = createSocket();
    socket.on('refund:requested', loadRefundCount);
    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'customer' && user?.role !== 'thu_ngan') return undefined;

    async function loadChatCount() {
      try {
        const response = await chatApi.unreadCount();
        setCounts((current) => ({ ...current, chat: response.data.unread_count }));
      } catch (err) {
        console.error('Không thể cập nhật số tin nhắn chưa đọc:', err.message);
      }
    }

    loadChatCount();
    const intervalId = setInterval(loadChatCount, 15000);
    const socket = createSocket();
    ['chat:conversation-new', 'chat:assigned', 'chat:message-new', 'chat:read', 'chat:closed'].forEach((event) => {
      socket.on(event, loadChatCount);
    });
    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [user?.role]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleItems = user
    ? navItems.filter((item) => !item.roles || item.roles.includes(user.role))
    : navItems.filter((item) => (
      ['/dishes', '/restaurant-reviews'].includes(item.to)
      || (item.to === '/tables' && item.roles?.includes('customer'))
    ));

  return (
    <div className="flex h-screen overflow-hidden bg-porcelain">
      <aside className="flex h-screen w-16 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-2 py-4 md:w-64 md:px-5 md:py-6">
        <div className="mb-8 flex shrink-0 items-center justify-center gap-2 px-1 md:justify-start">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <ChefHat size={18} />
          </div>
          <span className="hidden font-display text-lg font-semibold text-ink md:inline">
            {isCustomerFacing ? t('navigation.brand') : 'Quán Ăn'}
          </span>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {visibleItems.map(({ to, key, label, icon: Icon, badge }) => {
            const translatedLabel = isCustomerFacing && key
              ? t(`navigation.${!user && key === 'tables' ? 'tableMap' : key}`)
              : !user && to === '/tables' ? 'Sơ đồ bàn' : label;
            return (
            <NavLink
              key={to}
              to={to}
              aria-label={translatedLabel}
              title={translatedLabel}
              className={({ isActive }) =>
                `flex items-center justify-center rounded-xl px-2 py-2.5 text-sm font-medium transition-colors md:justify-between md:px-3.5 ${
                  isActive ? 'bg-basil-50 text-basil-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <span className="flex items-center gap-0 md:gap-3">
                <Icon size={18} />
                <span className="hidden md:inline">{translatedLabel}</span>
              </span>
              {badge && counts[badge] > 0 && (
                <span className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-clay-500 px-1.5 text-xs font-semibold text-white md:flex">
                  {counts[badge]}
                </span>
              )}
            </NavLink>
            );
          })}
        </nav>

        <div className="mt-6 shrink-0 border-t border-slate-100 pt-4">
          {isCustomerFacing && (
            <div className="mb-2">
              <LanguageSwitcher className="w-full" />
            </div>
          )}
          {user ? (
            <>
              <p className="hidden px-1 text-sm font-medium text-ink md:block">{user.full_name}</p>
              <p className="hidden px-1 text-xs text-slate-400 md:block">{user.role}</p>
              <button
                onClick={handleLogout}
                aria-label={isCustomerFacing ? t('navigation.logout') : 'Đăng xuất'}
                title={isCustomerFacing ? t('navigation.logout') : 'Đăng xuất'}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium text-clay-500 hover:bg-clay-50 md:justify-start md:px-3.5"
              >
                <LogOut size={16} />
                <span className="hidden md:inline">
                  {isCustomerFacing ? t('navigation.logout') : 'Đăng xuất'}
                </span>
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              aria-label={t('navigation.login')}
              title={t('navigation.login')}
              className="flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-medium text-basil-700 hover:bg-basil-50 md:justify-start md:px-3.5"
            >
              <UserRound size={16} />
              <span className="hidden md:inline">{isCustomerFacing ? t('navigation.login') : 'Đăng nhập'}</span>
            </NavLink>
          )}
        </div>
      </aside>

      <main
        className={`h-screen min-w-0 flex-1 overflow-y-auto px-3 pb-4 md:px-8 md:pb-8 ${
          flushTop ? 'pt-0 md:pt-0' : 'pt-4 md:pt-8'
        }`}
      >
        {children}
      </main>
      {user?.role === 'manager' && (counts.refunds > 0 || refundCountError) && (
        <div
          role={refundCountError ? 'alert' : 'status'}
          className={`fixed right-4 top-4 z-50 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            refundCountError
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-clay-200 bg-white text-ink'
          }`}
        >
          <span>
            {refundCountError
              ? `Chưa tải được yêu cầu hoàn cọc: ${refundCountError}`
              : `Có ${counts.refunds} yêu cầu hoàn cọc đang chờ xử lý.`}
          </span>
          <NavLink to="/pending-refunds" className="shrink-0 font-semibold text-basil-700 underline">
            Mở danh sách
          </NavLink>
        </div>
      )}
      {depositLateNotice && (
        <div role="alert" className="fixed right-4 top-20 z-50 flex max-w-lg items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
          <span>{depositLateNotice}</span>
          <NavLink
            to="/pending-deposits"
            onClick={() => setDepositLateNotice('')}
            className="shrink-0 font-semibold underline"
          >
            Xử lý
          </NavLink>
          <button
            type="button"
            onClick={() => setDepositLateNotice('')}
            aria-label="Đóng thông báo"
            className="shrink-0 hover:opacity-70"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}