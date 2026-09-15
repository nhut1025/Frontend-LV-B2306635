// src/pages/PendingDepositsPage.jsx
import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Users, Phone } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { reservationsApi } from '../api/reservations';
import { getErrorMessage } from '../api/client';

export default function PendingDepositsPage() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  async function load() {
    try {
      const res = await reservationsApi.listPendingDeposits();
      setPending(res.data.pending);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Tự làm mới mỗi 10 giây — danh sách này cần cập nhật nhanh vì mỗi đơn chỉ có 3 phút
    const intervalId = setInterval(load, 10000);
    return () => clearInterval(intervalId);
  }, []);

  async function handleConfirm(reservationId) {
    if (!confirm('Xác nhận đã nhận được tiền cọc cho đơn này?')) return;
    setConfirmingId(reservationId);
    setError('');
    try {
      await reservationsApi.confirmDeposit(reservationId);
      setPending((prev) => prev.filter((p) => p.reservation_id !== reservationId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Cọc chờ xác nhận</h1>
        <p className="text-sm text-slate-500">Kiểm tra tài khoản ngân hàng rồi xác nhận từng đơn</p>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : pending.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Hiện không có đơn nào đang chờ xác nhận cọc.</div>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.reservation_id} className="card flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-ink">
                  {p.customer_name} — Bàn {p.table_numbers || '—'}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {p.party_size} khách
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone size={14} />
                    {p.phone}
                  </span>
                  <span>
                    {p.reservation_date} lúc {p.reservation_time}
                  </span>
                </p>
                <p className="mt-1 text-sm">
                  Số tiền: <span className="font-semibold text-ink">{Number(p.amount).toLocaleString('vi-VN')}đ</span>
                  {' · '}Nội dung: <span className="font-mono text-xs">{p.transaction_code}</span>
                </p>
              </div>
              <button
                onClick={() => handleConfirm(p.reservation_id)}
                disabled={confirmingId === p.reservation_id}
                className="btn-primary"
              >
                {confirmingId === p.reservation_id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Xác nhận đã nhận cọc
              </button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}