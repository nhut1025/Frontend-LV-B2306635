// src/pages/PaymentsPage.jsx
//
// Trang thanh toán bill cho thu_ngan: danh sách bill đang mở (bàn đang ăn). Mở từng bill để xem món,
// số cọc được trừ, rồi xác nhận đã thu tiền (tiền mặt hoặc chuyển khoản VietQR).
// Xác nhận xong, backend tự chốt bill, trừ cọc và trả bàn về trống trong cùng 1 transaction.

import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Clock, Loader2, QrCode } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { billsApi } from '../api/bills';
import { createSocket } from '../api/socket';
import { getErrorMessage } from '../api/client';

const money = (value) => `${Number(value).toLocaleString('vi-VN')}đ`;

const ITEM_STATUS_LABEL = {
  cho_xac_nhan: 'Chờ xác nhận',
  dang_che_bien: 'Đang chế biến',
  san_sang: 'Sẵn sàng',
  da_phuc_vu: 'Đã phục vụ',
};

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function PaymentModal({ billId, onClose, onPaid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [method, setMethod] = useState(null); // null | 'tien_mat' | 'online'
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [choosingMethod, setChoosingMethod] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await billsApi.paymentSummary(billId);
        if (cancelled) return;
        setData(res.data);
        setMethod(res.data.bill.payment_method || null);
        if (res.data.bill.payment_method === 'online' && res.data.summary.amount_due > 0) {
          setQrLoading(true);
          const qrRes = await billsApi.paymentQr(billId);
          if (!cancelled) setQr(qrRes.data);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setQrLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [billId]);

  async function chooseMethod(next) {
    setChoosingMethod(true);
    setError('');
    setQrLoading(next === 'online');
    try {
      const res = await billsApi.requestPayment(billId, next);
      setMethod(next);
      setData((current) => ({
        ...current,
        bill: { ...current.bill, payment_method: next, payment_code: res.data.payment_code },
        summary: res.data.summary,
      }));
      setQr(res.data.qr_url ? {
        amount: res.data.summary.amount_due,
        payment_code: res.data.payment_code,
        qr_url: res.data.qr_url,
      } : null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setChoosingMethod(false);
      setQrLoading(false);
    }
  }

  async function handlePay(paymentMethod) {
    const amountDue = data.summary.amount_due;
    let question;
    if (amountDue === 0) {
      question = 'Xác nhận hoàn tất thanh toán (tiền cọc đã đủ trả bill)?';
    } else if (paymentMethod === 'tien_mat') {
      question = `Xác nhận đã thu đủ ${money(amountDue)} tiền mặt?`;
    } else {
      question = 'Bạn đã kiểm tra app ngân hàng và thấy tiền vào đúng số tiền + nội dung chuyển khoản?';
    }
    if (!window.confirm(question)) return;

    setPaying(true);
    setError('');
    try {
      await billsApi.pay(billId, paymentMethod);
      onPaid(`Bàn ${data.bill.table_number}: đã thanh toán ${money(amountDue)}. Bàn đã về trạng thái trống.`);
    } catch (err) {
      setError(getErrorMessage(err));
      setPaying(false);
    }
  }

  const bill = data?.bill;
  const items = data?.items || [];
  const summary = data?.summary;
  const isOpen = bill?.status === 'mo';
  const canPay = Boolean(summary) && isOpen && items.length > 0 && summary.unserved_count === 0;

  return (
    <Modal title={bill ? `Thanh toán — Bàn ${bill.table_number}` : 'Thanh toán'} onClose={onClose} widthClass="max-w-lg">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-slate-400" size={22} />
        </div>
      ) : !data ? (
        <Alert type="error">{error || 'Không tải được bill.'}</Alert>
      ) : (
        <div className="space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {!isOpen && <Alert type="error">Bill này đã được thanh toán rồi.</Alert>}
          {isOpen && bill.payment_method && (
            <Alert type="info">
              Phương thức đã chọn: {bill.payment_method === 'online' ? 'chuyển khoản' : 'tiền mặt'}. Chỉ xác nhận sau khi đã kiểm tra nhận đủ tiền.
            </Alert>
          )}
          {isOpen && summary.unserved_count > 0 && (
            <Alert type="error">
              Còn {summary.unserved_count} món chưa phục vụ xong, chưa thể thanh toán. Nhờ phục vụ mang món ra trước.
            </Alert>
          )}

          <div className="max-h-56 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {item.quantity}× {item.dish_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {money(item.unit_price)} · {ITEM_STATUS_LABEL[item.status] || item.status}
                    {item.note ? ` · ${item.note}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-ink">{money(Number(item.unit_price) * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Tổng bill</span>
              <span>{money(summary.subtotal)}</span>
            </div>
            {summary.deposit_amount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Đã đặt cọc (trừ vào bill)</span>
                <span>−{money(summary.deposit_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-ink">
              <span>Còn phải thu</span>
              <span>{money(summary.amount_due)}</span>
            </div>
          </div>

          {canPay &&
            (summary.amount_due === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Tiền cọc đã đủ trả bill, không cần thu thêm.</p>
                <button type="button" disabled={paying} onClick={() => handlePay('tien_mat')} className="btn-primary w-full">
                  {paying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Xác nhận hoàn tất thanh toán
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {!bill.payment_method && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-ink">Khách thanh toán tại quầy bằng cách nào?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => chooseMethod('tien_mat')}
                        disabled={choosingMethod}
                        className={method === 'tien_mat' ? 'btn-primary' : 'btn-secondary'}
                      >
                        <Banknote size={16} />
                        Tiền mặt
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseMethod('online')}
                        disabled={choosingMethod}
                        className={method === 'online' ? 'btn-primary' : 'btn-secondary'}
                      >
                        <QrCode size={16} />
                        Chuyển khoản QR
                      </button>
                    </div>
                  </div>
                )}

                {method === 'tien_mat' && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-sm text-slate-600">Thu của khách</p>
                    <p className="font-display text-2xl font-semibold text-ink">{money(summary.amount_due)}</p>
                    <button type="button" disabled={paying} onClick={() => handlePay('tien_mat')} className="btn-primary w-full">
                      {paying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Xác nhận đã nhận tiền mặt
                    </button>
                  </div>
                )}

                {method === 'online' &&
                  (qrLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="animate-spin text-slate-400" size={22} />
                    </div>
                  ) : (
                    qr && (
                      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-center">
                        <img
                          src={qr.qr_url}
                          alt="Mã QR thanh toán bill"
                          className="mx-auto h-56 w-56 rounded-xl border border-slate-200 bg-white"
                        />
                        <p className="text-sm text-slate-600">
                          Số tiền: <span className="font-semibold text-ink">{money(qr.amount)}</span>
                        </p>
                        <p className="text-xs text-slate-400">Nội dung chuyển khoản: {qr.payment_code}</p>
                        <p className="text-xs text-slate-500">
                          Chỉ bấm xác nhận khi đã thấy tiền vào tài khoản đúng số tiền và nội dung.
                        </p>
                        <button type="button" disabled={paying} onClick={() => handlePay('online')} className="btn-primary w-full">
                          {paying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          Xác nhận đã nhận chuyển khoản
                        </button>
                      </div>
                    )
                  ))}
              </div>
            ))}
        </div>
      )}
    </Modal>
  );
}

function BillCard({ bill, onOpen }) {
  const isReady = bill.unserved_count === 0;
  const isPaymentRequested = Boolean(bill.payment_method);
  return (
    <div className="card flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-medium text-ink">
          Bàn {bill.table_number}
          <span className="ml-2 text-sm font-normal text-slate-500">{bill.item_count} món</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Clock size={14} />
            Mở lúc {formatTime(bill.created_at)}
          </span>
          <span>Tổng bill: {money(bill.subtotal)}</span>
          {bill.deposit_amount > 0 && <span>Đã cọc: {money(bill.deposit_amount)}</span>}
        </p>
        <p className="mt-1 text-sm">
          Còn phải thu: <span className="font-semibold text-ink">{money(bill.amount_due)}</span>
        </p>
        {isPaymentRequested && (
          <p className="mt-1 inline-flex rounded-full bg-saffron-50 px-2.5 py-1 text-xs font-medium text-saffron-700">
            Chờ xác nhận đã nhận tiền · {bill.payment_method === 'online' ? 'Chuyển khoản' : 'Tiền mặt'}
          </p>
        )}
        {!isReady && <p className="mt-1 text-xs text-clay-600">Còn {bill.unserved_count} món chưa phục vụ xong</p>}
      </div>
      <button type="button" onClick={() => onOpen(bill.bill_id)} className={isReady ? 'btn-primary' : 'btn-secondary'}>
        {isPaymentRequested ? 'Xác nhận đã nhận tiền' : isReady ? 'Thanh toán tại quầy' : 'Xem bill'}
      </button>
    </div>
  );
}

export default function PaymentsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedBillId, setSelectedBillId] = useState(null);

  const loadBills = useCallback(async () => {
    try {
      const res = await billsApi.payable();
      setBills(res.data.bills || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
    // Tự làm mới mỗi 10 giây để thấy bàn mới ăn xong / món vừa được mang ra.
    const intervalId = setInterval(loadBills, 10000);
    return () => clearInterval(intervalId);
  }, [loadBills]);

  useEffect(() => {
    const socket = createSocket();
    socket.on('cashier:payment-requested', (request) => {
      setNotice(
        `Bàn ${request.table_number}: có yêu cầu thanh toán mới (${request.payment_method === 'online' ? 'chuyển khoản' : 'tiền mặt'}).`
      );
      loadBills();
    });
    return () => socket.disconnect();
  }, [loadBills]);

  function handleOpen(billId) {
    setNotice('');
    setSelectedBillId(billId);
  }

  function handlePaid(message) {
    setSelectedBillId(null);
    setNotice(message);
    loadBills();
  }

  const readyBills = bills.filter((b) => b.unserved_count === 0);
  const waitingBills = bills.filter((b) => b.unserved_count > 0);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Thanh toán bill</h1>
        <p className="text-sm text-slate-500">Nhận yêu cầu từ phục vụ hoặc chọn bill tại quầy, rồi xác nhận đã thu tiền</p>
      </div>

      <div className="mb-4 space-y-2">
        {error && <Alert type="error">{error}</Alert>}
        {notice && <Alert type="success">{notice}</Alert>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : bills.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Hiện không có bàn nào cần thanh toán.</div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Sẵn sàng thanh toán
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{readyBills.length}</span>
            </h2>
            {readyBills.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                Chưa có bàn nào ăn xong.
              </p>
            ) : (
              <div className="space-y-3">
                {readyBills.map((bill) => (
                  <BillCard key={bill.bill_id} bill={bill} onOpen={handleOpen} />
                ))}
              </div>
            )}
          </section>

          {waitingBills.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Đang dùng bữa
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{waitingBills.length}</span>
              </h2>
              <div className="space-y-3">
                {waitingBills.map((bill) => (
                  <BillCard key={bill.bill_id} bill={bill} onOpen={handleOpen} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {selectedBillId && (
        <PaymentModal billId={selectedBillId} onClose={() => setSelectedBillId(null)} onPaid={handlePaid} />
      )}
    </Layout>
  );
}