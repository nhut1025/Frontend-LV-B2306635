import { useEffect, useState } from 'react';
import { Banknote, Loader2, QrCode } from 'lucide-react';
import Alert from './Alert';
import Modal from './Modal';
import { billsApi } from '../api/bills';
import { getErrorMessage } from '../api/client';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const PAYMENT_LABELS = { tien_mat: 'Tiền mặt', online: 'Chuyển khoản' };

function readSavedRequest(billId) {
  try {
    const saved = sessionStorage.getItem(`payment-request-${billId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function WaiterPaymentModal({ table, bill, items, onClose }) {
  const [method, setMethod] = useState(bill.payment_method || '');
  const [request, setRequest] = useState(() => readSavedRequest(bill.id));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const unservedCount = items.filter((item) => item.status !== 'da_phuc_vu').length;
  const waitingForCashier = Boolean(bill.payment_method || request);

  useEffect(() => {
    if (request?.payment_method !== bill.payment_method) setRequest(null);
  }, [bill.payment_method, request?.payment_method]);

  async function chooseMethod(paymentMethod) {
    setSending(true);
    setError('');
    try {
      const res = await billsApi.requestPayment(bill.id, paymentMethod);
      setMethod(paymentMethod);
      setRequest(res.data);
      sessionStorage.setItem(`payment-request-${bill.id}`, JSON.stringify(res.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const summary = request?.summary;
  const displayMethod = method || bill.payment_method;

  return (
    <Modal title={`Thanh toán — Bàn ${table.table_number}`} onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        {unservedCount > 0 && (
          <Alert type="error">
            Còn {unservedCount} món chưa phục vụ xong. Mang đủ món ra bàn trước khi gửi yêu cầu thanh toán.
          </Alert>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink">{item.quantity}× {item.dish_name}</p>
                <p className="text-xs text-slate-500">
                  {money(item.unit_price)} · {item.status === 'da_phuc_vu' ? 'Đã phục vụ' : 'Chưa phục vụ'}
                </p>
              </div>
              <span className="shrink-0 font-medium text-ink">{money(Number(item.unit_price) * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-ink">
          <span>Tạm tính</span><span>{money(summary?.subtotal ?? subtotal)}</span>
        </div>
        {summary && (
          <div className="space-y-1 text-sm text-slate-600">
            {summary.deposit_amount > 0 && (
              <div className="flex justify-between"><span>Đã trừ cọc</span><span>−{money(summary.deposit_amount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-ink">
              <span>Còn phải thu</span><span>{money(summary.amount_due)}</span>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {waitingForCashier ? 'Đổi phương thức nếu khách yêu cầu' : 'Khách muốn thanh toán bằng cách nào?'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={sending || unservedCount > 0 || (Boolean(request) && displayMethod === 'tien_mat')}
              onClick={() => chooseMethod('tien_mat')}
              className={displayMethod === 'tien_mat' ? 'btn-primary' : 'btn-secondary'}
            >
              {sending && method === 'tien_mat' ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
              Tiền mặt
            </button>
            <button
              type="button"
              disabled={sending || unservedCount > 0 || (Boolean(request) && displayMethod === 'online')}
              onClick={() => chooseMethod('online')}
              className={displayMethod === 'online' ? 'btn-primary' : 'btn-secondary'}
            >
              {sending && method === 'online' ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
              Chuyển khoản
            </button>
          </div>
        </div>

        {request && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            {request.qr_url ? (
              <div className="space-y-2 text-center">
                <img src={request.qr_url} alt="Mã QR thanh toán" className="mx-auto h-56 w-56 border border-slate-200 bg-white" />
                <p className="text-sm text-slate-600">
                  Số tiền: <strong className="text-ink">{money(summary?.amount_due)}</strong>
                </p>
                <p className="text-xs text-slate-500">Nội dung chuyển khoản: {request.payment_code}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                Phương thức: <strong>{PAYMENT_LABELS[request.payment_method] || 'Tiền mặt'}</strong>
                {summary && <span> · Số tiền cần thu: <strong>{money(summary.amount_due)}</strong></span>}
              </div>
            )}
            <div className="rounded-xl border border-saffron-200 bg-saffron-50 px-3.5 py-3 text-sm text-saffron-800">
              Đã gửi yêu cầu cho thu ngân. Chỉ cho khách rời đi sau khi thu ngân xác nhận đã nhận tiền.
            </div>
          </div>
        )}

        <button type="button" onClick={onClose} className="btn-secondary w-full">Đóng</button>
      </div>
    </Modal>
  );
}