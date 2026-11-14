import { useEffect, useState } from 'react';
import { Award, Loader2, RefreshCw, TrendingUp, UtensilsCrossed } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { financeApi } from '../api/finance';
import { getErrorMessage } from '../api/client';

const PERIODS = [
  { value: 'day', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'three_months', label: '3 tháng gần nhất' },
  { value: 'all', label: 'Tất cả' },
];

const EMPTY_TOTALS = { quantity_sold: 0, dish_count: 0 };
const formatQuantity = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function TopSellingDishesPage() {
  const [period, setPeriod] = useState('month');
  const [dishes, setDishes] = useState([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadRanking() {
      setLoading(true);
      setError('');
      try {
        const response = await financeApi.listTopSellingDishes(period);
        if (!active) return;
        setDishes(response.data.dishes || []);
        setTotals(response.data.totals || EMPTY_TOTALS);
      } catch (requestError) {
        if (!active) return;
        setDishes([]);
        setTotals(EMPTY_TOTALS);
        setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadRanking();
    return () => { active = false; };
  }, [period, reloadKey]);

  const topDish = dishes[0];
  const periodLabel = PERIODS.find((item) => item.value === period)?.label || '';

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-basil-700">Khu vực quản lý</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Món ăn bán chạy</h1>
            <p className="mt-1 text-sm text-slate-500">
              Xếp hạng theo tổng số lượng món trong bill đã thanh toán.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={loading}
            className="btn-secondary"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </header>

        <section aria-label="Lọc khoảng thời gian">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={period === item.value}
                onClick={() => setPeriod(item.value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  period === item.value
                    ? 'border-basil-600 bg-basil-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-basil-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1"><Alert type="error">{error}</Alert></div>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-secondary">
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-16">
            <Loader2 className="animate-spin text-slate-400" size={26} />
          </div>
        ) : !error && (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <article className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-basil-700 to-emerald-800 p-5 text-white shadow-sm">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
                  <TrendingUp size={23} />
                </span>
                <div>
                  <p className="text-sm text-basil-100">Tổng số món đã bán · {periodLabel}</p>
                  <p className="mt-1 text-3xl font-semibold">{formatQuantity(totals.quantity_sold)}</p>
                </div>
              </article>
              <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-basil-50 text-basil-700">
                  <UtensilsCrossed size={22} />
                </span>
                <div>
                  <p className="text-sm text-slate-500">Số món có phát sinh bán</p>
                  <p className="mt-1 text-3xl font-semibold text-ink">{formatQuantity(totals.dish_count)}</p>
                </div>
              </article>
            </section>

            {topDish && (
              <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
                <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                  {topDish.image_url ? (
                    <img
                      src={topDish.image_url}
                      alt={topDish.dish_name}
                      className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24"
                    />
                  ) : (
                    <span className="grid h-20 w-20 place-items-center rounded-xl bg-white text-amber-600 sm:h-24 sm:w-24">
                      <Award size={32} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                      <Award size={15} /> Bán chạy nhất · {periodLabel}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">{topDish.dish_name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{topDish.category}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-2xl font-bold text-amber-900">{formatQuantity(topDish.quantity_sold)}</span>
                    <span className="text-sm text-amber-800">phần đã bán</span>
                  </p>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-display text-lg font-semibold text-ink">Bảng xếp hạng</h2>
                <p className="mt-1 text-sm text-slate-500">{periodLabel} · Sắp xếp theo số lượng bán giảm dần</p>
              </div>
              {dishes.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  Chưa có món nào được bán trong khoảng thời gian này.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-20 px-5 py-3">Hạng</th>
                        <th className="px-5 py-3">Món ăn</th>
                        <th className="px-5 py-3">Danh mục</th>
                        <th className="px-5 py-3 text-right">Số lượng bán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dishes.map((dish, index) => (
                        <tr key={dish.dish_id} className="border-t border-slate-100">
                          <td className="px-5 py-3.5 font-semibold text-slate-600">#{index + 1}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {dish.image_url ? (
                                <img src={dish.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                              ) : (
                                <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-400">
                                  <UtensilsCrossed size={17} />
                                </span>
                              )}
                              <span className="font-medium text-ink">{dish.dish_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">{dish.category}</td>
                          <td className="px-5 py-3.5 text-right font-semibold text-ink">
                            {formatQuantity(dish.quantity_sold)} phần
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
