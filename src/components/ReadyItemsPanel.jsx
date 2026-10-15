// src/components/ReadyItemsPanel.jsx
//
// Dành cho phuc_vu: danh sách món bếp đã nấu xong (san_sang), chờ mang ra bàn.
// Có thông báo realtime (socket.io) khi bếp báo xong món, và nút "Đã mang ra"
// để chuyển món sang da_phuc_vu. Dữ liệu gốc lấy từ REST; socket chỉ cập nhật tức thời.

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Check, Loader2, WifiOff } from 'lucide-react';
import Alert from './Alert';
import { billsApi } from '../api/bills';
import { createSocket } from '../api/socket';
import { getErrorMessage } from '../api/client';

const byCreatedAt = (a, b) => new Date(a.created_at) - new Date(b.created_at);

export default function ReadyItemsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [connected, setConnected] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 6000);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const res = await billsApi.readyItems();
      setItems(res.data.items || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    // Kết nối lại sau khi rớt mạng: tải lại danh sách để không sót món báo xong lúc mất kết nối.
    socket.io.on('reconnect', loadItems);

    socket.on('service:item-ready', (item) => {
      if (!item) return;
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
      showToast(`Bàn ${item.table_number}: ${item.quantity}× ${item.dish_name} đã sẵn sàng, mang ra nhé!`);
    });
    // 1 phục vụ khác đã mang món đó ra -> bỏ khỏi danh sách của mọi người.
    socket.on('service:item-served', ({ id }) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    });

    return () => {
      socket.disconnect();
      clearTimeout(toastTimer.current);
    };
  }, [loadItems, showToast]);

  async function handleServe(item) {
    setBusyId(item.id);
    setError('');
    try {
      await billsApi.serveItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setError(getErrorMessage(err));
      loadItems(); // có thể người khác đã mang món này ra rồi -> đồng bộ lại
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...items].sort(byCreatedAt);

  return (
    <section className="card mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <BellRing size={18} className="text-basil-500" />
          Món chờ mang ra
          <span className="rounded-full bg-basil-50 px-2 py-0.5 text-xs font-medium text-basil-700">{items.length}</span>
        </h2>
        {!connected && (
          <span className="flex items-center gap-1.5 text-xs text-clay-600">
            <WifiOff size={13} />
            Mất kết nối realtime — hãy tải lại trang
          </span>
        )}
      </div>

      <div className="space-y-2">
        {toast && <Alert type="success">{toast}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-slate-400" size={20} />
        </div>
      ) : sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Chưa có món nào chờ mang ra.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {sorted.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  Bàn {item.table_number} · {item.quantity}× {item.dish_name}
                </p>
                {item.note && <p className="truncate text-xs text-slate-500">Ghi chú: {item.note}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleServe(item)}
                disabled={busyId === item.id}
                className="btn-primary shrink-0 px-4 py-2"
              >
                {busyId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Đã mang ra
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}