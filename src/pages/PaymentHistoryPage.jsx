import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CreditCard, Loader2, Receipt, Search } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { financeApi } from '../api/finance';
import { getErrorMessage } from '../api/client';

const EMPTY_FILTERS = { from: '', to: '', search: '', payment_method: '' };
const PAYMENT_LABELS = { tien_mat: 'Tiền mặt', online: 'Chuyển khoản' };
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function PaymentHistoryDetail({ billId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    financeApi
      .getPaymentHistoryDetail(billId)
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [billId]);

  const bill = data?.bill;

  return (
    <Modal title={`Chi tiết bill${bill ? ` — Bàn ${bill.table_number}` : ''}`} onClose={onClose} widthClass="max-w-2xl">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-slate-400" size={22} />
        </div>
      ) : error ? (
        <Alert type="error">{error}</Alert>
      ) : bill ? (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Mã bill</dt>
              <dd className="mt-0.5 font-medium text-ink">#{bill.bill_id}</dd>
            </div>
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
              <dt className="text-slate-500">Người xác nhận</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {bill.cashier_name || (bill.payment_method === 'online' ? 'SePay tự động' : 'Chưa ghi nhận')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Mã chuyển khoản</dt>
              <dd className="mt-0.5 break-all font-medium text-ink">{bill.payment_code || '—'}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Món</th>
                  <th className="px-3 py-2.5 text-right">SL</th>
                  <th className="px-3 py-2.5 text-right">Đơn giá</th>
                  <th className="px-3 py-2.5 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 text-ink">
                      <span className="font-medium">{item.dish_name || `Món #${item.dish_id}`}</span>
                      {item.note && <span className="mt-0.5 block text-xs text-slate-500">{item.note}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{money(item.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink">{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto max-w-xs space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between gap-3 text-slate-600">
              <dt>Tổng bill</dt><dd>{money(bill.total_amount)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-slate-600">
              <dt>Đã trừ cọc</dt><dd>−{money(bill.deposit_amount)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold text-ink">
              <dt>Thực thu</dt><dd>{money(bill.collected_amount)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Modal>
  );
}

export default function PaymentHistoryPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [bills, setBills] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBillId, setSelectedBillId] = useState(null);

  const loadHistory = useCallback(async (nextFilters, nextPage) => {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(
      Object.entries({ ...nextFilters, page: nextPage }).filter(([, value]) => value !== '')
    );
    try {
      const response = await financeApi.listPaymentHistory(params);
      setBills(response.data.bills || []);
      setHasMore(Boolean(response.data.has_more));
    } catch (err) {
      setBills([]);
      setHasMore(false);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(EMPTY_FILTERS, 1);
  }, [loadHistory]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleSearch(event) {
    event.preventDefault();
    setAppliedFilters(filters);
    setPage(1);
    loadHistory(filters, 1);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    loadHistory(appliedFilters, nextPage);
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Lịch sử giao dịch</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tra cứu bill đã thanh toán theo thời gian, bàn, mã bill hoặc mã chuyển khoản để hỗ trợ khách hàng.
        </p>
      </div>

      <form onSubmit={handleSearch} className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="field-label" htmlFor="payment-history-from">Từ ngày</label>
          <input
            id="payment-history-from"
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="payment-history-to">Đến ngày</label>
          <input
            id="payment-history-to"
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="payment-history-search">Từ khóa</label>
          <input
            id="payment-history-search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder="Mã bill, mã chuyển khoản, số bàn"
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="payment-history-method">Phương thức</label>
          <select
            id="payment-history-method"
            value={filters.payment_method}
            onChange={(event) => updateFilter('payment_method', event.target.value)}
            className="field-input"
          >
            <option value="">Tất cả</option>
            <option value="tien_mat">Tiền mặt</option>
            <option value="online">Chuyển khoản</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Tra cứu
          </button>
        </div>
      </form>

      {error && <Alert type="error">{error}</Alert>}
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <CreditCard size={17} className="mt-0.5 shrink-0" />
        <p>
          Lịch sử này ghi nhận thanh toán theo bill. Mã tham chiếu riêng của giao dịch ngân hàng/SePay hiện chưa được lưu.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Thanh toán lúc</th>
              <th className="px-4 py-3">Mã bill</th>
              <th className="px-4 py-3">Bàn</th>
              <th className="px-4 py-3 text-right">Tổng bill</th>
              <th className="px-4 py-3 text-right">Đã trừ cọc</th>
              <th className="px-4 py-3 text-right">Thực thu</th>
              <th className="px-4 py-3">Phương thức</th>
              <th className="px-4 py-3">Người xác nhận</th>
              <th className="px-4 py-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="px-4 py-12 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" size={22} /></td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan="9" className="px-4 py-10 text-center text-slate-500">Không có giao dịch phù hợp.</td></tr>
            ) : bills.map((bill) => (
              <tr key={bill.bill_id} className="border-t border-slate-100 hover:bg-slate-50/70">
                <td className="px-4 py-3 text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatDateTime(bill.paid_at)}</span>
                </td>
                <td className="px-4 py-3 font-medium text-ink">#{bill.bill_id}</td>
                <td className="px-4 py-3 text-ink">{bill.table_number}</td>
                <td className="px-4 py-3 text-right text-slate-700">{money(bill.total_amount)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{money(bill.deposit_amount)}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">{money(bill.collected_amount)}</td>
                <td className="px-4 py-3 text-slate-600">{PAYMENT_LABELS[bill.payment_method] || '—'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {bill.cashier_name || (bill.payment_method === 'online' ? 'SePay tự động' : 'Chưa ghi nhận')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedBillId(bill.bill_id)}
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                    aria-label={`Xem chi tiết bill ${bill.bill_id}`}
                    title="Xem chi tiết"
                  >
                    <Receipt size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">Trang {page}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => changePage(page - 1)} disabled={page === 1 || loading} className="btn-secondary">
            <ChevronLeft size={16} /> Trước
          </button>
          <button type="button" onClick={() => changePage(page + 1)} disabled={!hasMore || loading} className="btn-secondary">
            Sau <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {selectedBillId !== null && (
        <PaymentHistoryDetail billId={selectedBillId} onClose={() => setSelectedBillId(null)} />
      )}
    </Layout>
  );
}
