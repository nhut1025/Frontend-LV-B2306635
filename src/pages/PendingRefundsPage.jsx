import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCw } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { reservationsApi } from '../api/reservations';
import { createSocket } from '../api/socket';
import { getErrorMessage } from '../api/client';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

export default function PendingRefundsPage() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  async function load() {
    try {
      const response = await reservationsApi.listPendingRefunds();
      setPending(response.data.pending || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 15000);
    const socket = createSocket();
    socket.on('refund:requested', load);
    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, []);

  async function handleConfirm(reservationId) {
    if (!confirm('Chỉ xác nhận sau khi đã chuyển khoản hoàn tiền cho khách. Bạn đã chuyển chưa?')) return;
    setConfirmingId(reservationId);
    setError('');
    setSuccess('');
    try {
      await reservationsApi.confirmRefund(reservationId);
      setPending((current) => current.filter((item) => item.reservation_id !== reservationId));
      setSuccess(`Đã ghi nhận hoàn cọc cho đặt bàn #${reservationId}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Yêu cầu hoàn cọc</h1>
          <p className="text-sm text-slate-500">Chuyển khoản thủ công rồi xác nhận để ghi nhận hoàn tiền.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary">
          <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
      ) : pending.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Hiện không có yêu cầu hoàn cọc nào.</div>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => (
            <article key={item.reservation_id} className="card flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-medium text-ink">
                  {item.customer_name} · Đặt bàn #{item.reservation_id} · Bàn {item.table_numbers || '—'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {item.reservation_date} lúc {String(item.reservation_time).slice(0, 5)} · {item.party_size} khách · {item.phone}
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">Hoàn: {money(item.amount)}</p>
                <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
                  <div><dt className="inline text-slate-400">Ngân hàng: </dt><dd className="inline">{item.refund_bank_code}</dd></div>
                  <div><dt className="inline text-slate-400">Số tài khoản: </dt><dd className="inline">{item.refund_account_number}</dd></div>
                  <div><dt className="inline text-slate-400">Chủ tài khoản: </dt><dd className="inline">{item.refund_account_name}</dd></div>
                </dl>
              </div>
              <button
                type="button"
                onClick={() => handleConfirm(item.reservation_id)}
                disabled={confirmingId === item.reservation_id}
                className="btn-primary"
              >
                {confirmingId === item.reservation_id
                  ? <Loader2 size={16} className="animate-spin" />
                  : <CheckCircle2 size={16} />}
                Xác nhận đã hoàn tiền
              </button>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}
