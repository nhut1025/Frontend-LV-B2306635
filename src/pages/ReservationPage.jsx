// src/pages/ReservationPage.jsx
//
// Luồng: nhập party_size/ngày/giờ/SĐT -> "Tìm bàn trống" gọi suggest-tables
// -> hiện gợi ý (1 bàn hoặc tổ hợp nhiều bàn ghép) -> "Giữ bàn" tạo hold (giu_tam)
// -> đếm ngược 3 phút. Thanh toán cọc thực sự sẽ nối tiếp ở Phase 3.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, Loader2, Clock, CheckCircle2, History } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { reservationsApi } from '../api/reservations';
import { getErrorMessage } from '../api/client';

const emptyForm = { party_size: '', reservation_date: '', reservation_time: '', phone: '' };

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ReservationPage() {
  const [form, setForm] = useState(emptyForm);
  const [suggestion, setSuggestion] = useState(null); // { tables, is_combined, total_capacity }
  const [searching, setSearching] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hold, setHold] = useState(null); // { reservation_id, hold_minutes }
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [error, setError] = useState('');
  const expiryRef = useRef(null);

  useEffect(() => {
    if (!hold) return undefined;
    expiryRef.current = Date.now() + hold.hold_minutes * 60 * 1000;

    const tick = () => {
      const diff = Math.max(0, Math.round((expiryRef.current - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [hold]);

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setSuggestion(null);
    if (!form.party_size || Number(form.party_size) <= 0) {
      setError('Vui lòng nhập số khách hợp lệ.');
      return;
    }
    setSearching(true);
    try {
      const res = await reservationsApi.suggestTables(Number(form.party_size));
      setSuggestion(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirmHold() {
    if (!suggestion) return;
    if (!form.reservation_date || !form.reservation_time || !form.phone) {
      setError('Vui lòng nhập đầy đủ ngày, giờ và số điện thoại.');
      return;
    }
    setError('');
    setHolding(true);
    try {
      const res = await reservationsApi.createHold({
        party_size: Number(form.party_size),
        reservation_date: form.reservation_date,
        reservation_time: form.reservation_time,
        phone: form.phone,
        table_ids: suggestion.tables.map((t) => t.id),
      });
      setHold(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
      // Bàn có thể vừa bị người khác giữ mất -> xoá gợi ý cũ để khách tìm lại
      setSuggestion(null);
    } finally {
      setHolding(false);
    }
  }

  function handleReset() {
    setForm(emptyForm);
    setSuggestion(null);
    setHold(null);
    setRemainingSeconds(null);
    setError('');
  }

  const expired = hold && remainingSeconds === 0;

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Đặt bàn</h1>
          <p className="text-sm text-slate-500">Chọn số khách, ngày giờ — hệ thống sẽ gợi ý bàn phù hợp</p>
        </div>
        <Link to="/my-reservations" className="btn-secondary">
          <History size={16} />
          Đặt bàn của tôi
        </Link>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {!hold && (
        <form onSubmit={handleSearch} className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Số lượng khách</label>
            <input
              type="number"
              min="1"
              required
              value={form.party_size}
              onChange={(e) => updateForm('party_size', e.target.value)}
              className="field-input"
              placeholder="4"
            />
          </div>
          <div>
            <label className="field-label">Số điện thoại</label>
            <input
              required
              value={form.phone}
              onChange={(e) => updateForm('phone', e.target.value)}
              className="field-input"
              placeholder="09xxxxxxxx"
            />
          </div>
          <div>
            <label className="field-label">Ngày</label>
            <input
              type="date"
              required
              value={form.reservation_date}
              onChange={(e) => updateForm('reservation_date', e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Giờ</label>
            <input
              type="time"
              required
              value={form.reservation_time}
              onChange={(e) => updateForm('reservation_time', e.target.value)}
              className="field-input"
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={searching} className="btn-primary w-full sm:w-auto">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Tìm bàn trống
            </button>
          </div>
        </form>
      )}

      {suggestion && !hold && (
        <div className="card mt-5">
          <h2 className="font-display text-base font-semibold text-ink">
            {suggestion.is_combined ? 'Đề xuất ghép nhiều bàn' : 'Đề xuất bàn'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tổng sức chứa {suggestion.total_capacity} chỗ cho {form.party_size} khách.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {suggestion.tables.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl border border-basil-200 bg-basil-50 px-4 py-2.5">
                <span className="font-mono text-sm font-semibold text-ink">{t.table_number}</span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={12} />
                  {t.capacity}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={handleConfirmHold} disabled={holding} className="btn-primary">
              {holding ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Giữ bàn này
            </button>
            <button onClick={() => setSuggestion(null)} className="btn-secondary">
              Tìm lại
            </button>
          </div>
        </div>
      )}

      {hold && !expired && (
        <div className="card mt-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-saffron-50 text-saffron-600">
            <Clock size={24} />
          </div>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Đang giữ bàn cho bạn</h2>
          <p className="mt-1 text-sm text-slate-500">
            Mã đặt bàn #{hold.reservation_id}. Vui lòng hoàn tất cọc trước khi hết thời gian giữ.
          </p>
          <p className="mt-4 font-mono text-3xl font-semibold text-saffron-600">
            {remainingSeconds !== null ? formatCountdown(remainingSeconds) : '--:--'}
          </p>
          <p className="mt-4 text-xs text-slate-400">
            Bước thanh toán cọc 50.000đ sẽ được bổ sung ở phần tiếp theo.
          </p>
        </div>
      )}

      {expired && (
        <div className="card mt-5 text-center">
          <Alert type="error">Đã hết thời gian giữ bàn. Bàn đã được trả về trạng thái trống.</Alert>
          <button onClick={handleReset} className="btn-primary mt-4">
            Đặt bàn lại
          </button>
        </div>
      )}
    </Layout>
  );
}
