// src/pages/KitchenPage.jsx
//
// Màn hình bếp (KDS): hiển thị mọi món đang chờ nấu / đang nấu của TẤT CẢ các bàn.
// Dữ liệu gốc lấy từ REST (kitchen-queue); socket.io chỉ là lớp cập nhật tức thời.
// Nếu mất kết nối realtime thì tải lại trang vẫn đúng (CSDL là nguồn dữ liệu chính).

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Flame, Ban, Wifi, WifiOff, Clock, History, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { billsApi } from '../api/bills';
import { dishesApi } from '../api/dishes';
import { createSocket } from '../api/socket';
import { getErrorMessage } from '../api/client';

const QUEUE_STATUSES = ['cho_xac_nhan', 'dang_che_bien'];
const LATE_AFTER_MINUTES = 15;

const byCreatedAt = (a, b) => new Date(a.created_at) - new Date(b.created_at);

function minutesSince(dateString, now) {
  return Math.max(0, Math.floor((now - new Date(dateString).getTime()) / 60000));
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(String(dateString).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? String(dateString) : date.toLocaleString('vi-VN');
}

function KitchenCard({ item, now, busy, onAdvance, onOutOfStock }) {
  const minutes = minutesSince(item.created_at, now);
  const isLate = minutes >= LATE_AFTER_MINUTES;

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="font-display text-lg font-semibold text-ink">
          {item.quantity}× {item.dish_name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
          Bàn {item.table_number}
          <span className="text-slate-300">·</span>
          <span className={`flex items-center gap-1 ${isLate ? 'font-semibold text-clay-500' : ''}`}>
            <Clock size={13} />
            {minutes} phút trước
          </span>
        </p>
      </div>

      {item.note && (
        <p className="rounded-xl bg-clay-50 px-3 py-2 text-sm text-clay-600">Ghi chú: {item.note}</p>
      )}
      {item.accepted_by_name && (
        <p className="text-sm text-slate-600">Người nhận món: {item.accepted_by_name}</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => onAdvance(item)} disabled={busy} className="btn-primary flex-1">
          {busy && <Loader2 size={16} className="animate-spin" />}
          {item.status === 'cho_xac_nhan' ? 'Nhận món' : 'Xong món'}
        </button>
        <button
          type="button"
          onClick={() => onOutOfStock(item)}
          disabled={busy}
          className="btn-secondary px-3"
          title="Báo hết món"
          aria-label="Báo hết món"
        >
          <Ban size={16} />
        </button>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const [queue, setQueue] = useState([]);
  const [view, setView] = useState('queue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [historyTableNumber, setHistoryTableNumber] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalItems, setHistoryTotalItems] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);

  const loadQueue = useCallback(async () => {
    try {
      const res = await billsApi.kitchenQueue();
      setQueue(res.data.queue || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (page, tableNumber) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const params = { page };
      if (tableNumber) params.table_number = tableNumber;
      const res = await billsApi.kitchenHistory(params);
      setHistory(res.data.history || []);
      setHistoryTotalItems(Number(res.data.total_items) || 0);
      setHistoryTotalPages(Number(res.data.total_pages) || 0);
    } catch (err) {
      setHistory([]);
      setHistoryTotalItems(0);
      setHistoryTotalPages(0);
      setHistoryError(getErrorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'history') loadHistory(historyPage, historyTableNumber);
  }, [view, historyPage, historyTableNumber, loadHistory]);

  // Áp 1 món (mới / vừa cập nhật) vào danh sách: còn thuộc hàng đợi bếp thì thêm/thay, ngược lại thì loại bỏ.
  const applyItem = useCallback((item) => {
    if (!item) return;
    setQueue((prev) => {
      const without = prev.filter((i) => i.id !== item.id);
      if (!QUEUE_STATUSES.includes(item.status)) return without;
      return [...without, item];
    });
  }, []);

  useEffect(() => {
    loadQueue();

    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    // Kết nối lại sau khi rớt mạng: tải lại hàng đợi để không sót món phát sinh lúc mất kết nối.
    socket.io.on('reconnect', loadQueue);

    socket.on('kitchen:item-added', applyItem);
    socket.on('kitchen:item-updated', applyItem);
    socket.on('kitchen:item-removed', ({ id }) => {
      setQueue((prev) => prev.filter((i) => i.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [loadQueue, applyItem]);

  // Làm mới nhãn "x phút trước" mỗi 30 giây.
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, []);

  async function handleAdvance(item) {
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const res = await billsApi.advanceItem(item.id, item.status);
      applyItem(res.data.item || { ...item, status: res.data.status });
    } catch (err) {
      setError(getErrorMessage(err));
      loadQueue(); // trạng thái có thể đã đổi do người khác thao tác -> đồng bộ lại
    } finally {
      setBusyId(null);
    }
  }

  async function handleOutOfStock(item) {
    const confirmed = window.confirm(
      `Đánh dấu "${item.dish_name}" đã hết? Phục vụ sẽ không thêm được món này vào bill nữa.`
    );
    if (!confirmed) return;

    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      await dishesApi.toggleAvailability(item.dish_id, false);
      setNotice(`Đã đánh dấu "${item.dish_name}" hết món.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function handleHistorySearch(event) {
    event.preventDefault();
    setHistoryTableNumber(tableSearch.trim());
    setHistoryPage(1);
  }

  const waiting = queue.filter((i) => i.status === 'cho_xac_nhan').sort(byCreatedAt);
  const cooking = queue.filter((i) => i.status === 'dang_che_bien').sort(byCreatedAt);

  const columns = [
    { key: 'waiting', title: 'Chờ nhận', items: waiting },
    { key: 'cooking', title: 'Đang chế biến', items: cooking },
  ];

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
            <Flame size={22} className="text-basil-500" />
            Màn hình bếp
          </h1>
          <p className="mt-1 text-sm text-slate-500">Món từ tất cả các bàn, xếp theo thứ tự gọi trước — nấu trước.</p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            connected ? 'bg-basil-50 text-basil-700' : 'bg-clay-50 text-clay-600'
          }`}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'Realtime đang bật' : 'Mất kết nối realtime — hãy tải lại trang'}
        </span>
      </div>

      <div className="mb-4 space-y-2">
        {error && <Alert type="error">{error}</Alert>}
        {notice && <Alert type="success">{notice}</Alert>}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('queue')}
          aria-pressed={view === 'queue'}
          className={view === 'queue' ? 'btn-primary' : 'btn-secondary'}
        >
          Hàng đợi bếp
        </button>
        <button
          type="button"
          onClick={() => setView('history')}
          aria-pressed={view === 'history'}
          className={view === 'history' ? 'btn-primary' : 'btn-secondary'}
        >
          <History size={16} />
          Lịch sử đã làm
        </button>
      </div>

      {view === 'history' ? (
        <section>
          <div className="mb-4">
            <h2 className="font-display text-xl font-semibold text-ink">Lịch sử món đã làm</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gồm món đã nấu xong hoặc đã phục vụ, tên người nhận món và số bàn.
            </p>
          </div>

          <form onSubmit={handleHistorySearch} className="mb-4 flex flex-wrap items-end gap-2">
            <label className="min-w-52 flex-1 text-sm font-medium text-slate-600">
              Tra cứu theo số bàn
              <input
                type="text"
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                maxLength={10}
                className="input mt-1 w-full"
                placeholder="Nhập đúng số bàn"
              />
            </label>
            <button type="submit" className="btn-primary">
              <Search size={16} />
              Tìm
            </button>
          </form>

          <div className="mb-3 space-y-2">
            {historyError && <Alert type="error">{historyError}</Alert>}
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={26} />
            </div>
          ) : !historyError && history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              {historyTableNumber
                ? `Chưa có món nào trong lịch sử của bàn ${historyTableNumber}.`
                : 'Chưa có món nào được ghi nhận là đã làm.'}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {history.map((item) => (
                  <article key={item.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                    <div>
                      <p className="font-display text-lg font-semibold text-ink">
                        {item.quantity}× {item.dish_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Bàn {item.table_number}
                        <span className="mx-2 text-slate-300">·</span>
                        Người nhận/làm món: {item.accepted_by_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.ready_at
                          ? `Hoàn tất: ${formatDateTime(item.ready_at)}`
                          : `Món cũ · Gọi lúc ${formatDateTime(item.created_at)} (chưa lưu giờ hoàn tất)`}
                      </p>
                      {item.note && <p className="mt-2 text-sm text-slate-500">Ghi chú: {item.note}</p>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.status === 'da_phuc_vu'
                        ? 'bg-basil-50 text-basil-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {item.status === 'da_phuc_vu' ? 'Đã phục vụ' : 'Chờ phục vụ'}
                    </span>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>{historyTotalItems} món · Trang {historyPage} / {Math.max(historyTotalPages, 1)}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((page) => page - 1)}
                    disabled={historyPage <= 1}
                    className="btn-secondary px-3"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryPage((page) => page + 1)}
                    disabled={historyPage >= historyTotalPages}
                    className="btn-secondary px-3"
                    aria-label="Trang sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={26} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {columns.map((col) => (
            <section key={col.key}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {col.title}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{col.items.length}</span>
              </h2>
              <div className="space-y-3">
                {col.items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                    Không có món nào.
                  </p>
                ) : (
                  col.items.map((item) => (
                    <KitchenCard
                      key={item.id}
                      item={item}
                      now={now}
                      busy={busyId === item.id}
                      onAdvance={handleAdvance}
                      onOutOfStock={handleOutOfStock}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </Layout>
  );
}