import { useEffect, useState } from 'react';
import { Banknote, CalendarDays, CreditCard, Loader2, Receipt, RotateCw, Search } from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import { financeApi } from '../api/finance';
import { staffApi } from '../api/staff';
import { tablesApi } from '../api/tables';
import { getErrorMessage } from '../api/client';

const EMPTY_FILTERS = { from: '', to: '', table_id: '', cashier_id: '', payment_method: '' };
const EMPTY_TOTALS = {
  bill_count: 0,
  total_amount: 0,
  deposit_amount: 0,
  collected_amount: 0,
  cash_amount: 0,
  online_amount: 0,
};
const PAYMENT_LABELS = { tien_mat: 'Tiền mặt', online: 'Chuyển khoản' };
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function FinanceBillDetail({ billId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    financeApi
      .getBillDetail(billId)
      .then((res) => {
        if (!cancelled) setData(res.data);
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
    <Modal title={`Chi tiết bill #${billId}`} onClose={onClose} widthClass="max-w-2xl">
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

export default function FinancePage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [bills, setBills] = useState([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [tables, setTables] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBillId, setSelectedBillId] = useState(null);

  async function loadBills(nextFilters = filters) {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== ''));
    try {
      const res = await financeApi.listBills(params);
      setBills(res.data.bills || []);
      setTotals(res.data.totals || EMPTY_TOTALS);
    } catch (err) {
      setBills([]);
      setTotals(EMPTY_TOTALS);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([tablesApi.list(), staffApi.list()])
      .then(([tableRes, staffRes]) => {
        if (cancelled) return;
        setTables(tableRes.data.tables || []);
        setCashiers((staffRes.data.staff || []).filter((staff) => staff.role === 'thu_ngan'));
      })
      .catch(() => {
        // The report remains usable if an optional filter list cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadBills(EMPTY_FILTERS);
  }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function handleFilter(event) {
    event.preventDefault();
    await loadBills(filters);
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Thu chi</h1>
          <p className="text-sm text-slate-500">Theo dõi bill đã thanh toán và người xác nhận</p>
        </div>
        <button type="button" onClick={() => loadBills()} disabled={loading} className="btn-secondary">
          <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      <form onSubmit={handleFilter} className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6">
        <div>
          <label className="field-label" htmlFor="finance-from">Từ ngày</label>
          <input id="finance-from" type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="finance-to">Đến ngày</label>
          <input id="finance-to" type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="finance-table">Bàn</label>
          <select id="finance-table" value={filters.table_id} onChange={(event) => updateFilter('table_id', event.target.value)} className="field-input">
            <option value="">Tất cả bàn</option>
            {tables.map((table) => <option key={table.id} value={table.id}>Bàn {table.table_number}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="finance-cashier">Thu ngân</label>
          <select id="finance-cashier" value={filters.cashier_id} onChange={(event) => updateFilter('cashier_id', event.target.value)} className="field-input">
            <option value="">Tất cả thu ngân</option>
            {cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="finance-method">Phương thức</label>
          <select id="finance-method" value={filters.payment_method} onChange={(event) => updateFilter('payment_method', event.target.value)} className="field-input">
            <option value="">Tất cả</option>
            <option value="tien_mat">Tiền mặt</option>
            <option value="online">Chuyển khoản</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Lọc
          </button>
        </div>
      </form>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500"><Receipt size={16} /> Số bill</div>
          <p className="mt-2 text-xl font-semibold text-ink">{Number(totals.bill_count || 0).toLocaleString('vi-VN')}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500"><Banknote size={16} /> Thực thu</div>
          <p className="mt-2 text-xl font-semibold text-ink">{money(totals.collected_amount)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16} /> Tiền mặt</div>
          <p className="mt-2 text-xl font-semibold text-ink">{money(totals.cash_amount)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500"><CreditCard size={16} /> Chuyển khoản</div>
          <p className="mt-2 text-xl font-semibold text-ink">{money(totals.online_amount)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Bill / giờ thanh toán</th>
              <th className="px-4 py-3">Bàn</th>
              <th className="px-4 py-3 text-right">Tổng bill</th>
              <th className="px-4 py-3 text-right">Đã trừ cọc</th>
              <th className="px-4 py-3 text-right">Thực thu</th>
              <th className="px-4 py-3">Phương thức</th>
              <th className="px-4 py-3">Thu ngân</th>
              <th className="px-4 py-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="px-4 py-12 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" size={22} /></td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-500">Không có bill phù hợp bộ lọc.</td></tr>
            ) : (
              bills.map((bill) => (
                <tr key={bill.bill_id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">#{bill.bill_id}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{formatDateTime(bill.paid_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-ink">{bill.table_number}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{money(bill.total_amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{money(bill.deposit_amount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">{money(bill.collected_amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{PAYMENT_LABELS[bill.payment_method] || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{bill.cashier_name || 'Chưa ghi nhận'}</td>
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
              ))
            )}
          </tbody>
          {!loading && bills.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-ink">
              <tr>
                <td className="px-4 py-3">Tổng cộng ({totals.bill_count || bills.length} bill)</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3 text-right">{money(totals.total_amount)}</td>
                <td className="px-4 py-3 text-right">{money(totals.deposit_amount)}</td>
                <td className="px-4 py-3 text-right">{money(totals.collected_amount)}</td>
                <td className="px-4 py-3" colSpan="3">Tiền mặt {money(totals.cash_amount)} · Chuyển khoản {money(totals.online_amount)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {selectedBillId !== null && <FinanceBillDetail billId={selectedBillId} onClose={() => setSelectedBillId(null)} />}
    </Layout>
  );
}