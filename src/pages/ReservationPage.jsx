// src/pages/ReservationPage.jsx
//
// Luồng: nhập party_size/ngày/giờ/SĐT -> "Tìm bàn trống" gọi suggest-tables
// -> hiện gợi ý (1 bàn hoặc tổ hợp nhiều bàn ghép) -> "Giữ bàn" tạo hold (giu_tam)
// -> hiện mã QR cọc, đếm ngược 3 phút, tự kiểm tra định kỳ xem thu ngân đã xác nhận chưa.

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
  const [suggestion, setSuggestion] = useState(null);
  const [searching, setSearching] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hold, setHold] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [depositQr, setDepositQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
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

  useEffect(() => {
    if (!hold) return;
    setQrLoading(true);
    reservationsApi
      .getDepositQr(hold.reservation_id)
      .then((res) => setDepositQr(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setQrLoading(false));
  }, [hold]);

  useEffect(() => {
    if (!hold || confirmed || remainingSeconds === 0) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const res = await reservationsApi.getById(hold.reservation_id);
        if (res.data.reservation.status === 'da_dat') {
          setConfirmed(true);
        }
      } catch {
        // bỏ qua lỗi tạm thời khi poll, không làm phiền người dùng
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [hold, confirmed, remainingSeconds]);

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
    setDepositQr(null);
    setConfirmed(false);
    setError('');
  }

  const expired = hold && !confirmed && remainingSeconds === 0;

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

      {hold && !expired && !confirmed && (
        <div className="card mt-5 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">Quét mã để thanh toán cọc</h2>
          <p className="mt-1 text-sm text-slate-500">Mã đặt bàn #{hold.reservation_id}</p>

          {qrLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : depositQr ? (
            <>
              <img
                src={depositQr.qr_url}
                alt="Mã QR chuyển khoản cọc"
                className="mx-auto mt-4 h-56 w-56 rounded-xl border border-slate-200"
              />
              <p className="mt-3 text-sm text-slate-600">
                Số tiền: <span className="font-semibold text-ink">{Number(depositQr.amount).toLocaleString('vi-VN')}đ</span>
              </p>
              <p className="text-xs text-slate-400">Nội dung chuyển khoản: {depositQr.transaction_code}</p>
            </>
          ) : (
            <p className="mt-4 text-sm text-clay-500">Chưa lấy được mã QR, thử tải lại trang.</p>
          )}

          <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-saffron-50 px-4 py-2 text-saffron-700">
            <Clock size={16} />
            <span className="font-mono text-lg font-semibold">
              {remainingSeconds !== null ? formatCountdown(remainingSeconds) : '--:--'}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Sau khi chuyển khoản nếu không thấy bàn được xác nhận hãy liên hệ với quán để được hỗ trợ. <br/>
            "Chuyển tiền cần có hình ảnh chuyển tiền làm minh chứng khi có vấn đề xảy ra"
          </p>
        </div>
      )}

      {confirmed && (
        <div className="card mt-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-basil-50 text-basil-600">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">Đặt bàn thành công!</h2>
          <p className="mt-1 text-sm text-slate-500">Cọc đã được xác nhận. Hẹn gặp bạn tại quán.</p>
          <button onClick={handleReset} className="btn-secondary mt-4">
            Đặt bàn khác
          </button>
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