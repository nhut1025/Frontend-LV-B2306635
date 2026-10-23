import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Phone, RefreshCw, Users, UtensilsCrossed } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { reservationsApi } from '../api/reservations';
import { getErrorMessage } from '../api/client';

const CONTACT_STATUS = {
  cho_lien_he: 'Chờ liên hệ',
  da_xac_nhan: 'Khách đã đồng ý',
  khong_nghe_may: 'Không nghe máy',
  tu_choi: 'Khách từ chối',
};

const PREPARATION_STATUS = {
  cho_xac_nhan: 'Chưa xác nhận làm món',
  da_dua_vao_bill: 'Đã đưa vào bill',
};

export default function PendingPreordersPage() {
  const [preorders, setPreorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionKey, setActionKey] = useState('');

  async function loadPreorders(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await reservationsApi.listPendingPreorders();
      setPreorders(res.data.preorders || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreorders();
  }, []);

  async function handleContact(reservationId, result) {
    const key = `${reservationId}-${result}`;
    setActionKey(key);
    setError('');
    setSuccess('');
    try {
      await reservationsApi.updatePreorderContact(reservationId, result);
      setSuccess('Đã cập nhật kết quả liên hệ.');
      await loadPreorders(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionKey('');
    }
  }

  async function handlePrepare(reservationId) {
    setActionKey(`${reservationId}-prepare`);
    setError('');
    setSuccess('');
    try {
      const res = await reservationsApi.preparePreorder(reservationId);
      setSuccess(res.data.already_prepared
        ? `Món đã được đưa vào bill #${res.data.bill_id}.`
        : `Đã xác nhận làm món và đưa vào bill #${res.data.bill_id}.`);
      await loadPreorders(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionKey('');
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Món đặt trước chờ xử lý</h1>
          <p className="text-sm text-slate-500">Gọi khách xác nhận trước khi đưa món vào bill và gửi xuống bếp.</p>
        </div>
        <button type="button" onClick={() => loadPreorders()} disabled={loading} className="btn-secondary">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
      ) : preorders.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Hiện không có món đặt trước nào chờ xử lý.</div>
      ) : (
        <div className="space-y-4">
          {preorders.map((preorder) => {
            const reservationId = preorder.reservation_id || preorder.id;
            const contactStatus = preorder.contact_status;
            const preparationStatus = preorder.preparation_status;
            const items = preorder.items || preorder.preorder_items || [];
            const busy = actionKey.startsWith(`${reservationId}-`);
            const canUpdateContact = contactStatus !== 'da_xac_nhan' && preparationStatus !== 'da_dua_vao_bill';
            const canPrepare = contactStatus === 'da_xac_nhan' && preparationStatus === 'cho_xac_nhan';

            return (
              <article key={reservationId} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-ink">{preorder.customer_name || preorder.full_name || 'Khách đặt bàn'} — Đặt bàn #{reservationId}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Phone size={14} />{preorder.phone || '—'}</span>
                      <span className="flex items-center gap-1"><Users size={14} />{preorder.party_size} khách</span>
                      <span>{preorder.reservation_date || '—'} lúc {preorder.reservation_time?.slice(0, 5) || '—'}</span>
                      <span>Bàn {preorder.table_numbers || preorder.table_ids || '—'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-saffron-50 px-3 py-1 font-medium text-saffron-700">
                      {CONTACT_STATUS[contactStatus] || contactStatus || CONTACT_STATUS.cho_lien_he}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                      {PREPARATION_STATUS[preparationStatus] || preparationStatus || PREPARATION_STATUS.cho_xac_nhan}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink"><UtensilsCrossed size={15} />Món đã đặt</h3>
                  {items.length ? (
                    <ul className="space-y-1 text-sm text-slate-600">
                      {items.map((item, index) => (
                        <li key={item.id || `${item.dish_id}-${index}`}>
                          {item.dish_name || item.name || `Món #${item.dish_id}`} × {item.quantity}
                          {item.note && <span className="text-slate-400"> · {item.note}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-500">Không có chi tiết món trong đơn này.</p>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleContact(reservationId, 'da_xac_nhan')}
                    disabled={busy || !canUpdateContact}
                    className="btn-primary"
                  >
                    {actionKey === `${reservationId}-da_xac_nhan` ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Khách đồng ý
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContact(reservationId, 'khong_nghe_may')}
                    disabled={busy || !canUpdateContact}
                    className="btn-secondary"
                  >
                    {actionKey === `${reservationId}-khong_nghe_may` && <Loader2 size={16} className="animate-spin" />}
                    Không nghe máy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContact(reservationId, 'tu_choi')}
                    disabled={busy || !canUpdateContact}
                    className="btn-secondary text-clay-600"
                  >
                    {actionKey === `${reservationId}-tu_choi` && <Loader2 size={16} className="animate-spin" />}
                    Khách từ chối
                  </button>
                  {canPrepare && (
                    <button
                      type="button"
                      onClick={() => handlePrepare(reservationId)}
                      disabled={busy}
                      className="btn-primary"
                    >
                      {actionKey === `${reservationId}-prepare` ? <Loader2 size={16} className="animate-spin" /> : <UtensilsCrossed size={16} />}
                      Xác nhận làm món
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
