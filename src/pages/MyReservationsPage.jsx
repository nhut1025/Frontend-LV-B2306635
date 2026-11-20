// src/pages/MyReservationsPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Receipt, Star, ThumbsDown, ThumbsUp, UtensilsCrossed, X } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import { reservationsApi } from '../api/reservations';
import { billsApi } from '../api/bills';
import { usersApi } from '../api/users';
import { getErrorMessage } from '../api/client';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import { formatCurrency, formatDate, formatDateTime } from '../i18n/formatters';

const STATUS_CONFIG = {
  giu_tam: { key: 'giu_tam', badge: 'bg-saffron-50 text-saffron-700' },
  da_dat: { key: 'da_dat', badge: 'bg-basil-50 text-basil-700' },
  hoan_thanh: { key: 'hoan_thanh', badge: 'bg-slate-100 text-slate-600' },
  da_huy: { key: 'da_huy', badge: 'bg-slate-100 text-slate-500' },
  qua_han: { key: 'qua_han', badge: 'bg-clay-50 text-clay-600' },
};

export default function MyReservationsPage() {
  const { t, locale } = useCustomerTranslation();
  const money = (value) => formatCurrency(value, locale);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preorders, setPreorders] = useState({});
  const [billsByReservation, setBillsByReservation] = useState({});
  const [billHistoryError, setBillHistoryError] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundDetails, setRefundDetails] = useState({
    refund_bank_account_id: '',
  });
  const [refundBankAccounts, setRefundBankAccounts] = useState([]);
  const [loadingRefundBankAccounts, setLoadingRefundBankAccounts] = useState(false);
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
      && !confirm(t('myReservations.forfeitConfirm'))) return;
    if (reservation.status === 'giu_tam'
      && !confirm(t('myReservations.holdCancelConfirm'))) return;

    setCancellingId(reservation.id);
    setCancelError('');
    setCancelSuccess('');
    try {
      const requestData = reservation.status !== 'da_dat'
        ? {}
        : !Number(reservation.cancel_refund_eligible)
          ? { accept_forfeiture: true }
          : { refund_bank_account_id: Number(details.refund_bank_account_id) };
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
          setCancelError(`${getErrorMessage(err)} ${t('myReservations.refreshStatusError')}: ${getErrorMessage(refreshError)}`);
        }
      }
    } finally {
      setCancellingId(null);
    }
  }

  async function openCancellation(reservation) {
    setCancelError('');
    if (Number(reservation.cancel_refund_eligible)) {
      setCancelTarget(reservation);
      setRefundBankAccounts([]);
      setRefundDetails({ refund_bank_account_id: '' });
      setLoadingRefundBankAccounts(true);
      try {
        const response = await usersApi.listRefundBankAccounts();
        const accounts = response.data.accounts || [];
        setRefundBankAccounts(accounts);
        const defaultAccount = accounts.find((account) => Boolean(account.is_default)) || accounts[0];
        setRefundDetails({ refund_bank_account_id: defaultAccount ? String(defaultAccount.id) : '' });
      } catch (err) {
        setCancelError(getErrorMessage(err));
      } finally {
        setLoadingRefundBankAccounts(false);
      }
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
      setReviewError(t('myReservations.reviewOverallRequired'));
      return;
    }
    if (['food_rating', 'service_rating', 'ambience_rating'].some(
      (key) => !Number.isInteger(reviewForm[key]) || reviewForm[key] < 1 || reviewForm[key] > 5
    )) {
      setReviewError(t('myReservations.reviewCategoriesRequired'));
      return;
    }
    const itemFeedback = reviewTarget.items.map((item) => ({
      bill_item_id: item.id,
      sentiment: reviewForm.itemFeedback[item.id],
    }));
    if (itemFeedback.some((item) => !['like', 'dislike'].includes(item.sentiment))) {
      setReviewError(t('myReservations.reviewItemsRequired'));
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
          <h1 className="font-display text-2xl font-semibold text-ink">{t('myReservations.title')}</h1>
          <p className="text-sm text-slate-500">{t('myReservations.history')}</p>
        </div>
        <Link to="/reservations" className="btn-primary">
          <Plus size={16} />
          {t('myReservations.newReservation')}
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
        <div className="card text-center text-sm text-slate-500">{t('myReservations.empty')}</div>
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
                    #{r.id} — {t('myReservations.reservationLine', {
                      date: formatDate(r.reservation_date, locale),
                      time: r.reservation_time,
                    })}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {t('myReservations.reservationDetails', {
                      guests: t('myReservations.guests', { count: r.party_size }),
                      tables: r.table_ids || '—',
                      phone: r.phone,
                    })}
                  </p>
                  {(() => {
                    const preorder = preorders[r.id];
                    const items = preorder?.items || preorder?.preorder_items || [];
                    if (!items.length) return null;
                    return (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink"><UtensilsCrossed size={14} />{t('myReservations.preorder')}</p>
                        <ul className="space-y-1 text-sm text-slate-600">
                          {items.map((item, index) => (
                            <li key={item.id || `${item.dish_id}-${index}`}>
                              {item.dish_name || item.name || t('myReservations.dishFallback', { id: item.dish_id })} × {item.quantity}
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
                        {t('myReservations.viewBill', { count: billsByReservation[r.id].length })}
                      </summary>
                      <div className="mt-3 space-y-3">
                        {billsByReservation[r.id].map((bill) => (
                          <div key={bill.id} className="rounded-lg border border-slate-200 p-3">
                            <h3 className="mb-3 font-medium text-ink">{t('myReservations.billDetails', { id: bill.id })}</h3>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
                              <div>
                                <dt className="text-slate-500">{t('myReservations.table')}</dt>
                                <dd className="mt-0.5 font-medium text-ink">{bill.table_number}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">{t('myReservations.paidAt')}</dt>
                                <dd className="mt-0.5 font-medium text-ink">{formatDateTime(bill.paid_at, locale)}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">{t('myReservations.paymentMethod')}</dt>
                                <dd className="mt-0.5 font-medium text-ink">
                                  {bill.payment_method ? t(`myReservations.paymentMethods.${bill.payment_method}`, { defaultValue: bill.payment_method }) : '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">{t('myReservations.cashierPaid')}</dt>
                                <dd className="mt-0.5 font-medium text-ink">{bill.cashier_name || t('myReservations.notRecorded')}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">{t('myReservations.cashierDeposit')}</dt>
                                <dd className="mt-0.5 font-medium text-ink">
                                  {bill.deposit_amount > 0 ? bill.deposit_confirmed_by_name || t('myReservations.notRecorded') : t('myReservations.noDeposit')}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500">{t('myReservations.transactionCode')}</dt>
                                <dd className="mt-0.5 break-all font-medium text-ink">{bill.payment_code || '—'}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full min-w-[440px] text-xs">
                                <thead className="bg-slate-50 text-left font-medium text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2">{t('myReservations.dish')}</th>
                                    <th className="px-3 py-2 text-right">{t('myReservations.quantity')}</th>
                                    <th className="px-3 py-2 text-right">{t('myReservations.unitPrice')}</th>
                                    <th className="px-3 py-2 text-right">{t('myReservations.lineTotal')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bill.items.map((item) => (
                                    <tr key={item.id} className="border-t border-slate-100">
                                      <td className="px-3 py-2 text-ink">
                                        <span className="font-medium">{item.dish_name || t('myReservations.dishFallback', { id: item.dish_id })}</span>
                                        {item.note && <span className="mt-0.5 block text-slate-500">{item.note}</span>}
                                        {item.accepted_by_name && (
                                          <span className="mt-0.5 block text-slate-500">
                                            {t('myReservations.acceptedBy')}: {item.accepted_by_name}
                                          </span>
                                        )}
                                        {item.review_sentiment && (
                                          <span className="mt-0.5 block text-slate-500">
                                            {t(item.review_sentiment === 'like' ? 'myReservations.youLiked' : 'myReservations.youDisliked')}
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
                                        {t('myReservations.billNoItems')}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <dl className="ml-auto mt-3 max-w-xs space-y-1.5 border-t border-slate-200 pt-3 text-xs">
                              <div className="flex justify-between gap-3 text-slate-600">
                                <dt>{t('myReservations.billTotal')}</dt><dd>{money(bill.total_amount)}</dd>
                              </div>
                              <div className="flex justify-between gap-3 text-slate-600">
                                <dt>{t('myReservations.depositDeducted')}</dt><dd>−{money(bill.deposit_amount)}</dd>
                              </div>
                              <div className="flex justify-between gap-3 font-semibold text-ink">
                                <dt>{t('myReservations.amountPaid')}</dt><dd>{money(bill.amount_paid)}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                              {bill.review ? (
                                <div className="text-sm text-slate-600">
                                  <p className="flex items-center gap-1 text-amber-600" aria-label={t('myReservations.ratingLabel', { count: bill.review.rating })}>
                                    {Array.from({ length: 5 }, (_, index) => (
                                      <Star key={index} size={15} fill={index < bill.review.rating ? 'currentColor' : 'none'} />
                                    ))}
                                    <span className="ml-1 text-xs text-slate-500">{bill.review.rating}/5</span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {t('myReservations.reviewBreakdown', {
                                      food: bill.review.food_rating || '—',
                                      service: bill.review.service_rating || '—',
                                      ambience: bill.review.ambience_rating || '—',
                                    })}
                                  </p>
                                  <p className="mt-1 line-clamp-2">{bill.review.comment}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">{t('myReservations.noBillReview')}</p>
                              )}
                              <button type="button" className="btn-secondary" onClick={() => openBillReview(bill)}>
                                {t(bill.review ? 'myReservations.editReview' : 'myReservations.reviewBill')}
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
                    {isNoShow ? t('myReservations.noShow') : t(`myReservations.statuses.${cfg.key}`)}
                  </span>
                  {r.status === 'da_huy' && (
                    <div className="max-w-xs text-right text-xs text-slate-500">
                      <p>{t('myReservations.cancelledBy')}: {t(`myReservations.${r.cancelled_by === 'customer' ? 'you' : r.cancelled_by === 'staff' ? 'staff' : 'system'}`)}</p>
                      <p>{t('myReservations.cancelledAt')}: {formatDateTime(r.cancelled_at, locale)}</p>
                    </div>
                  )}
                  {r.deposit_status === 'da_hoan' && (
                    <span className="text-xs text-emerald-700">
                      {t('myReservations.refunded', { amount: money(r.deposit_amount) })}
                      {r.refunded_at ? ` ${t('myReservations.atTime', { time: formatDateTime(r.refunded_at, locale) })}` : ''}
                    </span>
                  )}
                  {r.deposit_status === 'mat_coc' && (
                    <span className="max-w-xs text-right text-xs text-clay-600">
                      {isNoShow
                        ? t('myReservations.forfeitedNoShow', { amount: money(r.deposit_amount) })
                        : t('myReservations.forfeited', { amount: money(r.deposit_amount) })}
                      {r.forfeited_at ? ` ${t('myReservations.atTime', { time: formatDateTime(r.forfeited_at, locale) })}` : ''}
                    </span>
                  )}
                  {r.status === 'da_huy' && r.deposit_status === 'dang_hoan' && (
                    <span className="max-w-xs text-right text-xs text-amber-700">
                      {t('myReservations.refundPending', { amount: money(r.deposit_amount) })}
                    </span>
                  )}
                  {r.status === 'da_huy' && r.deposit_status === 'da_huy' && (
                    <span className="max-w-xs text-right text-xs text-slate-500">
                      {t('myReservations.unpaidHoldCancelled')}
                    </span>
                  )}
                  {r.status === 'da_huy' && !r.deposit_status && (
                    <span className="max-w-xs text-right text-xs text-slate-500">{t('myReservations.noRefundNeeded')}</span>
                  )}
                  {r.deposit_status === 'hoan_that_bai' && (
                    <span className="max-w-xs text-right text-xs text-red-700">
                      {t('myReservations.refundFailed')}
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
                      {t('myReservations.cancelReservation')}
                    </button>
                  )}
                  {['giu_tam', 'da_dat'].includes(r.status) && Number(r.preorder_prepared) > 0 && (
                    <span className="max-w-48 text-right text-xs text-slate-500">
                      {t('myReservations.cannotCancelPreorder')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && (
        <Modal title={t('myReservations.refundRequest', { id: cancelTarget.id })} onClose={() => setCancelTarget(null)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!refundDetails.refund_bank_account_id) {
                setCancelError(t('myReservations.selectRefundAccount'));
                return;
              }
              cancelReservation(cancelTarget, refundDetails);
            }}
          >
            <p className="text-sm text-slate-600">
              {t('myReservations.refundInstructions')}
            </p>
            {loadingRefundBankAccounts ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-slate-400" size={20} />
              </div>
            ) : refundBankAccounts.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="field-label">{t('myReservations.chooseRefundAccount')}</legend>
                {refundBankAccounts.map((account) => (
                  <label
                    key={account.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      refundDetails.refund_bank_account_id === String(account.id)
                        ? 'border-basil-400 bg-basil-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="refund_bank_account_id"
                      required
                      value={account.id}
                      checked={refundDetails.refund_bank_account_id === String(account.id)}
                      onChange={(event) => setRefundDetails({ refund_bank_account_id: event.target.value })}
                      className="mt-1 text-basil-600 focus:ring-basil-500"
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium text-ink">
                        {account.bank_code}
                        {Boolean(account.is_default) && (
                          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-basil-700">
                            {t('myReservations.defaultRefundAccount')}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-slate-600">
                        {account.account_number} · {account.account_name}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                <p>{t('myReservations.noRefundAccounts')}</p>
                <Link
                  to="/profile"
                  onClick={() => setCancelTarget(null)}
                  className="mt-2 inline-flex font-medium text-basil-700 hover:text-basil-800"
                >
                  {t('myReservations.addRefundAccount')}
                </Link>
              </div>
            )}
            {cancelError && <Alert type="error">{cancelError}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCancelTarget(null)}>{t('myReservations.close')}</button>
              <button
                type="submit"
                disabled={loadingRefundBankAccounts || refundBankAccounts.length === 0 || cancellingId === cancelTarget.id}
                className="btn-primary"
              >
                {cancellingId === cancelTarget.id && <Loader2 size={15} className="animate-spin" />}
                {t('myReservations.cancelAndRefund')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {reviewTarget && (
        <Modal
          title={t('myReservations.reviewTitle', {
            action: t(reviewTarget.review ? 'myReservations.editReview' : 'myReservations.reviewBill'),
            id: reviewTarget.id,
          })}
          onClose={() => {
            if (!savingReview) setReviewTarget(null);
          }}
          widthClass="max-w-2xl"
        >
          <form className="space-y-5" onSubmit={submitBillReview}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">{t('myReservations.reviewOverall')}</legend>
              <div className="flex gap-1" role="radiogroup" aria-label={t('myReservations.ratingRange')}>
                {Array.from({ length: 5 }, (_, index) => {
                  const rating = index + 1;
                  return (
                    <button
                      key={rating}
                      type="button"
                      role="radio"
                      aria-checked={reviewForm.rating === rating}
                      aria-label={t('myReservations.stars', { count: rating })}
                      onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                      className="rounded p-1 text-amber-500 hover:bg-amber-50"
                    >
                      <Star size={28} fill={rating <= reviewForm.rating ? 'currentColor' : 'none'} />
                    </button>
                  );
                })}
                <span className="self-center text-sm text-slate-500">
                  {reviewForm.rating ? `${reviewForm.rating}/5` : t('myReservations.chooseRating')}
                </span>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-ink">{t('myReservations.reviewAspects')}</legend>
              {[
                ['food_rating', t('myReservations.food')],
                ['service_rating', t('myReservations.service')],
                ['ambience_rating', t('myReservations.ambience')],
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
              <legend className="mb-2 text-sm font-medium text-ink">{t('myReservations.reviewEachDish')}</legend>
              {reviewTarget.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <span className="text-sm font-medium text-ink">
                    {item.dish_name || t('myReservations.dishFallback', { id: item.dish_id })} × {item.quantity}
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
                      <ThumbsUp size={15} /> {t('myReservations.like')}
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
                      <ThumbsDown size={15} /> {t('myReservations.dislike')}
                    </button>
                  </div>
                </div>
              ))}
            </fieldset>

            <label className="block">
              <span className="field-label">{t('myReservations.comment')}</span>
              <textarea
                required
                minLength={1}
                maxLength={2000}
                rows={4}
                className="field-input"
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                placeholder={t('myReservations.commentPlaceholder')}
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
                {t('myReservations.close')}
              </button>
              <button type="submit" className="btn-primary" disabled={savingReview}>
                {savingReview && <Loader2 size={15} className="animate-spin" />}
                {t(reviewTarget.review ? 'myReservations.saveChanges' : 'myReservations.sendReview')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
