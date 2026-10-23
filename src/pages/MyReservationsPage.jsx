// src/pages/MyReservationsPage.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, UtensilsCrossed } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { reservationsApi } from '../api/reservations';
import { getErrorMessage } from '../api/client';

const STATUS_CONFIG = {
  giu_tam: { label: 'Đang giữ tạm', badge: 'bg-saffron-50 text-saffron-700' },
  da_dat: { label: 'Đã đặt (đã cọc)', badge: 'bg-basil-50 text-basil-700' },
  hoan_thanh: { label: 'Hoàn thành', badge: 'bg-slate-100 text-slate-600' },
  da_huy: { label: 'Đã huỷ', badge: 'bg-slate-100 text-slate-500' },
  qua_han: { label: 'Quá hạn (no-show)', badge: 'bg-clay-50 text-clay-600' },
};

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preorders, setPreorders] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const res = await reservationsApi.listMine();
        const mine = res.data.reservations || [];
        setReservations(mine);
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
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
