// src/pages/MyReservationsPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Receipt, Star, ThumbsDown, ThumbsUp, UtensilsCrossed, X } from 'lucide-react';
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
const CANCELLER_LABELS = { customer: 'Bạn', staff: 'Nhân viên' };
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
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    rating: 0,
    food_rating: 0,
    service_rating: 0,
    ambience_rating: 0,
    comment: '',
    itemFeedback: {},
  });
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [savingReview, setSavingReview] = useState(false);

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
        ? {
          ...item,
          status: 'da_huy',
          deposit_status: response.data.deposit_status,
          cancelled_by: response.data.cancelled_by,
          cancelled_at: response.data.cancelled_at,
          cancel_refund_eligible: 0,
        }
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

  function openBillReview(bill) {
    setReviewError('');
    setReviewSuccess('');
    setReviewTarget(bill);
    setReviewForm({
      rating: bill.review?.rating || 0,
      food_rating: bill.review?.food_rating || 0,
      service_rating: bill.review?.service_rating || 0,
      ambience_rating: bill.review?.ambience_rating || 0,
      comment: bill.review?.comment || '',
      itemFeedback: Object.fromEntries(
        bill.items.map((item) => [item.id, item.review_sentiment || ''])
      ),
    });
  }

  async function submitBillReview(event) {
    event.preventDefault();
    if (!reviewTarget) return;
    if (!Number.isInteger(reviewForm.rating) || reviewForm.rating < 1 || reviewForm.rating > 5) {
      setReviewError('Vui lòng chấm từ 1 đến 5 sao cho bill.');
      return;
    }
    if (['food_rating', 'service_rating', 'ambience_rating'].some(
      (key) => !Number.isInteger(reviewForm[key]) || reviewForm[key] < 1 || reviewForm[key] > 5
    )) {
      setReviewError('Vui lòng chấm điểm món ăn, phục vụ và không gian từ 1 đến 5 sao.');
      return;
    }
    const itemFeedback = reviewTarget.items.map((item) => ({
      bill_item_id: item.id,
      sentiment: reviewForm.itemFeedback[item.id],
    }));
    if (itemFeedback.some((item) => !['like', 'dislike'].includes(item.sentiment))) {
      setReviewError('Vui lòng chọn thích hoặc không thích cho từng món trong bill.');
      return;
    }

    setSavingReview(true);
    setReviewError('');
    setReviewSuccess('');
    const payload = {
      rating: reviewForm.rating,
      food_rating: reviewForm.food_rating,
      service_rating: reviewForm.service_rating,
      ambience_rating: reviewForm.ambience_rating,
      comment: reviewForm.comment,
      item_feedback: itemFeedback,
    };
    try {
      const request = reviewTarget.review
        ? billsApi.updateReview(reviewTarget.id, payload)
        : billsApi.createReview(reviewTarget.id, payload);
      const response = await request;
      const review = response.data.review;
      const feedbackByItemId = Object.fromEntries(
        review.item_feedback.map((item) => [item.bill_item_id, item.sentiment])
      );
      setBillsByReservation((current) => ({
        ...current,
        [reviewTarget.reservation_id]: (current[reviewTarget.reservation_id] || []).map((bill) => (
          bill.id === reviewTarget.id
            ? {
              ...bill,
              review,
              items: bill.items.map((item) => ({
                ...item,
                review_sentiment: feedbackByItemId[item.id],
              })),
            }
            : bill
        )),
      }));
      setReviewTarget(null);
      setReviewSuccess(response.data.message);
    } catch (err) {
      setReviewError(getErrorMessage(err));
    } finally {
      setSavingReview(false);
    }
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
      {reviewSuccess && <div className="mb-4"><Alert type="success">{reviewSuccess}</Alert></div>}

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
            const isNoShow = r.status === 'qua_han'
              || (r.status === 'da_huy' && r.cancelled_by === 'staff' && r.deposit_status === 'mat_coc');
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
                                        {item.accepted_by_name && (
                                          <span className="mt-0.5 block text-slate-500">
                                            Người nhận món: {item.accepted_by_name}
                                          </span>
                                        )}
                                        {item.review_sentiment && (
                                          <span className="mt-0.5 block text-slate-500">
                                            Bạn đã {item.review_sentiment === 'like' ? 'thích' : 'không thích'} món này
                                          </span>
                                        )}
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
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                              {bill.review ? (
                                <div className="text-sm text-slate-600">
                                  <p className="flex items-center gap-1 text-amber-600" aria-label={`${bill.review.rating} trên 5 sao`}>
                                    {Array.from({ length: 5 }, (_, index) => (
                                      <Star key={index} size={15} fill={index < bill.review.rating ? 'currentColor' : 'none'} />
                                    ))}
                                    <span className="ml-1 text-xs text-slate-500">{bill.review.rating}/5</span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Món ăn {bill.review.food_rating || '—'}/5 · Phục vụ {bill.review.service_rating || '—'}/5 · Không gian {bill.review.ambience_rating || '—'}/5
                                  </p>
                                  <p className="mt-1 line-clamp-2">{bill.review.comment}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">Chưa đánh giá bill này</p>
                              )}
                              <button type="button" className="btn-secondary" onClick={() => openBillReview(bill)}>
                                {bill.review ? 'Sửa đánh giá' : 'Đánh giá bill'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${isNoShow ? STATUS_CONFIG.qua_han.badge : cfg.badge}`}>
                    {isNoShow ? 'Khách không đến (no-show)' : cfg.label}
                  </span>
                  {r.status === 'da_huy' && (
                    <div className="max-w-xs text-right text-xs text-slate-500">
                      <p>Hủy bởi: {CANCELLER_LABELS[r.cancelled_by] || 'Hệ thống'}</p>
                      <p>Hủy lúc: {formatDateTime(r.cancelled_at)}</p>
                    </div>
                  )}
                  {r.deposit_status === 'da_hoan' && (
                    <span className="text-xs text-emerald-700">
                      Đã hoàn cọc {money(r.deposit_amount)}
                      {r.refunded_at ? ` lúc ${formatDateTime(r.refunded_at)}` : ''}
                    </span>
                  )}
                  {r.deposit_status === 'mat_coc' && (
                    <span className="max-w-xs text-right text-xs text-clay-600">
                      {isNoShow
                        ? `Không hoàn cọc — mất cọc ${money(r.deposit_amount)} do khách không đến`
                        : `Không hoàn cọc — đã mất cọc ${money(r.deposit_amount)}`}
                      {r.forfeited_at ? ` lúc ${formatDateTime(r.forfeited_at)}` : ''}
                    </span>
                  )}
                  {r.status === 'da_huy' && r.deposit_status === 'dang_hoan' && (
                    <span className="max-w-xs text-right text-xs text-amber-700">
                      Đơn đủ điều kiện hoàn cọc {money(r.deposit_amount)}; đang chờ quản lý xử lý
                    </span>
                  )}
                  {r.status === 'da_huy' && r.deposit_status === 'da_huy' && (
                    <span className="max-w-xs text-right text-xs text-slate-500">
                      Không phát sinh hoàn cọc — lượt giữ chưa thanh toán
                    </span>
                  )}
                  {r.status === 'da_huy' && !r.deposit_status && (
                    <span className="max-w-xs text-right text-xs text-slate-500">Không có khoản cọc cần hoàn</span>
                  )}
                  {r.deposit_status === 'hoan_that_bai' && (
                    <span className="max-w-xs text-right text-xs text-red-700">
                      Hoàn cọc chưa thành công; vui lòng liên hệ quán
                    </span>
                  )}
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
              Đơn đủ điều kiện hoàn 100% cọc. Nhập thông tin tài khoản nhận tiền.
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
      {reviewTarget && (
        <Modal
          title={`${reviewTarget.review ? 'Sửa đánh giá' : 'Đánh giá'} bill #${reviewTarget.id}`}
          onClose={() => {
            if (!savingReview) setReviewTarget(null);
          }}
          widthClass="max-w-2xl"
        >
          <form className="space-y-5" onSubmit={submitBillReview}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Đánh giá tổng thể bill</legend>
              <div className="flex gap-1" role="radiogroup" aria-label="Đánh giá từ 1 đến 5 sao">
                {Array.from({ length: 5 }, (_, index) => {
                  const rating = index + 1;
                  return (
                    <button
                      key={rating}
                      type="button"
                      role="radio"
                      aria-checked={reviewForm.rating === rating}
                      aria-label={`${rating} sao`}
                      onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                      className="rounded p-1 text-amber-500 hover:bg-amber-50"
                    >
                      <Star size={28} fill={rating <= reviewForm.rating ? 'currentColor' : 'none'} />
                    </button>
                  );
                })}
                <span className="self-center text-sm text-slate-500">
                  {reviewForm.rating ? `${reviewForm.rating}/5` : 'Chọn số sao'}
                </span>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-ink">Đánh giá theo từng khía cạnh</legend>
              {[
                ['food_rating', 'Món ăn'],
                ['service_rating', 'Phục vụ'],
                ['ambience_rating', 'Không gian'],
              ].map(([key, label]) => (
                <div key={key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-slate-700">{label}</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, index) => {
                      const rating = index + 1;
                      return (
                        <button
                          key={rating}
                          type="button"
                          aria-label={`${label}: ${rating} sao`}
                          aria-pressed={reviewForm[key] === rating}
                          onClick={() => setReviewForm((current) => ({ ...current, [key]: rating }))}
                          className="rounded p-1 text-amber-500 hover:bg-amber-50"
                        >
                          <Star size={21} fill={rating <= reviewForm[key] ? 'currentColor' : 'none'} />
                        </button>
                      );
                    })}
                    <span className="ml-1 w-10 text-right text-xs text-slate-500">
                      {reviewForm[key] ? `${reviewForm[key]}/5` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-ink">Bạn cảm nhận thế nào về từng món?</legend>
              {reviewTarget.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <span className="text-sm font-medium text-ink">
                    {item.dish_name || `Món #${item.dish_id}`} × {item.quantity}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-pressed={reviewForm.itemFeedback[item.id] === 'like'}
                      onClick={() => setReviewForm((current) => ({
                        ...current,
                        itemFeedback: { ...current.itemFeedback, [item.id]: 'like' },
                      }))}
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
                        reviewForm.itemFeedback[item.id] === 'like'
                          ? 'border-basil-500 bg-basil-50 text-basil-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <ThumbsUp size={15} /> Thích
                    </button>
                    <button
                      type="button"
                      aria-pressed={reviewForm.itemFeedback[item.id] === 'dislike'}
                      onClick={() => setReviewForm((current) => ({
                        ...current,
                        itemFeedback: { ...current.itemFeedback, [item.id]: 'dislike' },
                      }))}
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
                        reviewForm.itemFeedback[item.id] === 'dislike'
                          ? 'border-clay-500 bg-clay-50 text-clay-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <ThumbsDown size={15} /> Không thích
                    </button>
                  </div>
                </div>
              ))}
            </fieldset>

            <label className="block">
              <span className="field-label">Bình luận</span>
              <textarea
                required
                minLength={1}
                maxLength={2000}
                rows={4}
                className="field-input"
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                placeholder="Chia sẻ trải nghiệm của bạn về bill..."
              />
              <span className="mt-1 block text-right text-xs text-slate-400">{reviewForm.comment.length}/2000</span>
            </label>
            {reviewError && <Alert type="error">{reviewError}</Alert>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={savingReview}
                onClick={() => setReviewTarget(null)}
              >
                Đóng
              </button>
              <button type="submit" className="btn-primary" disabled={savingReview}>
                {savingReview && <Loader2 size={15} className="animate-spin" />}
                {reviewTarget.review ? 'Lưu chỉnh sửa' : 'Gửi đánh giá'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
