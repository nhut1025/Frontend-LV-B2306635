// src/pages/MyReservationsPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Receipt, UtensilsCrossed, X } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { reservationsApi } from '../api/reservations';
import { billsApi } from '../api/bills';
import { getErrorMessage } from '../api/client';

const STATUS_CONFIG = {
  giu_tam: { label: 'Đang giữ tạm', badge: 'bg-saffron-50 text-saffron-700' },
  da_dat: { label: 'Đã đặt (đã cọc)', badge: 'bg-basil-50 text-basil-700' },
  hoan_thanh: { label: 'Hoàn thành', badge: 'bg-slate-100 text-slate-600' },
  da_huy: { label: 'Đã huỷ', badge: 'bg-slate-100 text-slate-500' },
  qua_han: { label: 'Quá hạn (no-show)', badge: 'bg-clay-50 text-clay-600' },
};
const PAYMENT_LABELS = { tien_mat: 'Tiền mặt', online: 'Chuyển khoản' };
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preorders, setPreorders] = useState({});
  const [billsByReservation, setBillsByReservation] = useState({});
  const [billHistoryError, setBillHistoryError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundDetails, setRefundDetails] = useState({
    refund_bank_code: '',
    refund_account_number: '',
    refund_account_name: '',
  });
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await reservationsApi.listMine();
        const mine = res.data.reservations || [];
        setReservations(mine);
        try {
          const billsRes = await billsApi.listMyHistory();
          const groupedBills = billsRes.data.bills.reduce((grouped, bill) => {
            const reservationBills = grouped[bill.reservation_id] || [];
            reservationBills.push(bill);
            grouped[bill.reservation_id] = reservationBills;
            return grouped;
          }, {});
          setBillsByReservation(groupedBills);
        } catch (billError) {
          setBillHistoryError(getErrorMessage(billError));
        }
        const results = await Promise.all(mine.map(async (reservation) => {
          try {
            const preorderRes = await reservationsApi.getPreorder(reservation.id);
            const preorder = preorderRes.data.preorder || preorderRes.data;
            return [reservation.id, preorder];
          } catch (preorderError) {
            if (preorderError.response?.status === 404) return [reservation.id, null];
            throw preorderError;
          }
        }));
        setPreorders(Object.fromEntries(results.filter(([, preorder]) => preorder)));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function cancelReservation(reservation, details = {}) {
    if (reservation.status === 'da_dat' && !Number(reservation.cancel_refund_eligible)
      && !confirm('Hủy lúc này sẽ mất toàn bộ tiền cọc. Bạn có chắc muốn tiếp tục?')) return;
    if (reservation.status === 'giu_tam'
      && !confirm('Hủy lượt giữ bàn chưa thanh toán? Bàn sẽ được trả lại.')) return;

    setCancellingId(reservation.id);
    setCancelError('');
    setCancelSuccess('');
    try {
      const requestData = reservation.status === 'da_dat' && !Number(reservation.cancel_refund_eligible)
        ? { accept_forfeiture: true }
        : details;
      const response = await reservationsApi.cancelMine(reservation.id, requestData);
      setReservations((current) => current.map((item) => item.id === reservation.id
        ? { ...item, status: 'da_huy', deposit_status: response.data.deposit_status, cancel_refund_eligible: 0 }
        : item));
      setCancelSuccess(response.data.message);
      setCancelTarget(null);
    } catch (err) {
      setCancelError(getErrorMessage(err));
      if (err.response?.status === 409) {
        try {
          const latest = await reservationsApi.listMine();
          const latestReservations = latest.data.reservations || [];
          setReservations(latestReservations);
          const latestTarget = latestReservations.find((item) => item.id === reservation.id);
          if (latestTarget && !Number(latestTarget.cancel_refund_eligible)) setCancelTarget(null);
        } catch (refreshError) {
          setCancelError(`${getErrorMessage(err)} Không thể làm mới trạng thái đơn: ${getErrorMessage(refreshError)}`);
        }
      }
    } finally {
      setCancellingId(null);
    }
  }

  function openCancellation(reservation) {
    setCancelError('');
    if (Number(reservation.cancel_refund_eligible)) {
      setRefundDetails({ refund_bank_code: '', refund_account_number: '', refund_account_name: '' });
      setCancelTarget(reservation);
      return;
    }
    cancelReservation(reservation);
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Đặt bàn của tôi</h1>
          <p className="text-sm text-slate-500">Lịch sử các lần đặt bàn</p>
        </div>
        <Link to="/reservations" className="btn-primary">
          <Plus size={16} />
          Đặt bàn mới
        </Link>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {billHistoryError && <div className="mb-4"><Alert>{billHistoryError}</Alert></div>}
      {cancelSuccess && <div className="mb-4"><Alert type="success">{cancelSuccess}</Alert></div>}
      {cancelError && <div className="mb-4"><Alert type="error">{cancelError}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : reservations.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Bạn chưa có lần đặt bàn nào.</div>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => {
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.giu_tam;
            return (
              <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    #{r.id} — {r.reservation_date} lúc {r.reservation_time}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {r.party_size} khách · Bàn: {r.table_ids || '—'} · SĐT: {r.phone}
                  </p>
                  {(() => {
                    const preorder = preorders[r.id];
                    const items = preorder?.items || preorder?.preorder_items || [];
                    if (!items.length) return null;
                    return (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink"><UtensilsCrossed size={14} />Món đặt trước</p>
                        <ul className="space-y-1 text-sm text-slate-600">
                          {items.map((item, index) => (
                            <li key={item.id || `${item.dish_id}-${index}`}>
                              {item.dish_name || item.name || `Món #${item.dish_id}`} × {item.quantity}
                              {item.note && <span className="text-slate-400"> · {item.note}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  {billsByReservation[r.id]?.length > 0 && (
                    <details className="mt-3 border-t border-slate-100 pt-3">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-basil-700">
                        <Receipt size={14} />
                        Xem bill ({billsByReservation[r.id].length})
                      </summary>
                      <div className="mt-3 space-y-3">
                        {billsByReservation[r.id].map((bill) => (
                          <div key={bill.id} className="rounded-lg border border-slate-200 p-3">
                            <h3 className="mb-3 font-medium text-ink">Chi tiết bill #{bill.id}</h3>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
                              <div>
                                <dt className="text-slate-500">Bàn</dt>
                                <dd className="mt-0.5 font-medium text-ink">{bill.table_number}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">Thanh toán lúc</dt>
                                <dd className="mt-0.5 font-medium text-ink">{formatDateTime(bill.paid_at)}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">Phương thức</dt>
                                <dd className="mt-0.5 font-medium text-ink">{PAYMENT_LABELS[bill.payment_method] || '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">Thu ngân thanh toán</dt>
                                <dd className="mt-0.5 font-medium text-ink">{bill.cashier_name || 'Chưa ghi nhận'}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">Thu ngân nhận cọc</dt>
                                <dd className="mt-0.5 font-medium text-ink">
                                  {bill.deposit_amount > 0 ? bill.deposit_confirmed_by_name || 'Chưa ghi nhận' : 'Không có cọc'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">Mã giao dịch</dt>
                                <dd className="mt-0.5 break-all font-medium text-ink">{bill.payment_code || '—'}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full min-w-[440px] text-xs">
                                <thead className="bg-slate-50 text-left font-medium text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2">Món</th>
                                    <th className="px-3 py-2 text-right">SL</th>
                                    <th className="px-3 py-2 text-right">Đơn giá</th>
                                    <th className="px-3 py-2 text-right">Thành tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bill.items.map((item) => (
                                    <tr key={item.id} className="border-t border-slate-100">
                                      <td className="px-3 py-2 text-ink">
                                        <span className="font-medium">{item.dish_name || `Món #${item.dish_id}`}</span>
                                        {item.note && <span className="mt-0.5 block text-slate-500">{item.note}</span>}
                                      </td>
                                      <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                                      <td className="px-3 py-2 text-right text-slate-600">{money(item.unit_price)}</td>
                                      <td className="px-3 py-2 text-right font-medium text-ink">{money(item.line_total)}</td>
                                    </tr>
                                  ))}
                                  {bill.items.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="px-3 py-3 text-center text-slate-500">
                                        Bill này không có chi tiết món.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <dl className="ml-auto mt-3 max-w-xs space-y-1.5 border-t border-slate-200 pt-3 text-xs">
                              <div className="flex justify-between gap-3 text-slate-600">
                                <dt>Tổng bill</dt><dd>{money(bill.total_amount)}</dd>
                              </div>
                              <div className="flex justify-between gap-3 text-slate-600">
                                <dt>Đã trừ cọc</dt><dd>−{money(bill.deposit_amount)}</dd>
                              </div>
                              <div className="flex justify-between gap-3 font-semibold text-ink">
                                <dt>Thực thu</dt><dd>{money(bill.amount_paid)}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                  {r.deposit_status === 'dang_hoan' && <span className="text-xs text-amber-700">Đang chờ quản lý hoàn cọc</span>}
                  {r.deposit_status === 'da_hoan' && <span className="text-xs text-emerald-700">Đã hoàn cọc</span>}
                  {r.deposit_status === 'mat_coc' && <span className="text-xs text-clay-600">Cọc đã mất</span>}
                  {['giu_tam', 'da_dat'].includes(r.status) && !Number(r.preorder_prepared) && (
                    <button
                      type="button"
                      onClick={() => openCancellation(r)}
                      disabled={cancellingId === r.id}
                      className="btn-secondary text-clay-600"
                    >
                      {cancellingId === r.id ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                      Hủy đặt bàn
                    </button>
                  )}
                  {['giu_tam', 'da_dat'].includes(r.status) && Number(r.preorder_prepared) > 0 && (
                    <span className="max-w-48 text-right text-xs text-slate-500">
                      Không thể hủy vì món đã được đưa vào bill/bếp
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && (
        <Modal title={`Yêu cầu hoàn cọc #${cancelTarget.id}`} onClose={() => setCancelTarget(null)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              cancelReservation(cancelTarget, refundDetails);
            }}
          >
            <p className="text-sm text-slate-600">
              Đơn đủ điều kiện hoàn 100% cọc ({money(cancelTarget.deposit_amount)}). Nhập thông tin tài khoản nhận tiền.
            </p>
            <label className="block">
              <span className="field-label">Ngân hàng</span>
              <input
                required maxLength={20} className="field-input"
                value={refundDetails.refund_bank_code}
                onChange={(event) => setRefundDetails((value) => ({ ...value, refund_bank_code: event.target.value }))}
                placeholder="Ví dụ: Vietcombank"
              />
            </label>
            <label className="block">
              <span className="field-label">Số tài khoản</span>
              <input
                required maxLength={50} className="field-input"
                value={refundDetails.refund_account_number}
                onChange={(event) => setRefundDetails((value) => ({ ...value, refund_account_number: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="field-label">Tên chủ tài khoản</span>
              <input
                required maxLength={100} className="field-input"
                value={refundDetails.refund_account_name}
                onChange={(event) => setRefundDetails((value) => ({ ...value, refund_account_name: event.target.value }))}
              />
            </label>
            {cancelError && <Alert type="error">{cancelError}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCancelTarget(null)}>Đóng</button>
              <button type="submit" disabled={cancellingId === cancelTarget.id} className="btn-primary">
                {cancellingId === cancelTarget.id && <Loader2 size={15} className="animate-spin" />}
                Hủy và gửi yêu cầu hoàn
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
