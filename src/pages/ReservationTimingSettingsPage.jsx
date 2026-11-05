import { useEffect, useState } from 'react';
import { CalendarClock, Clock3, Loader2, Save } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { settingsApi } from '../api/settings';
import { getErrorMessage } from '../api/client';

const DEFAULT_TIMING = {
  reservation_open_time: '07:00',
  reservation_close_time: '21:00',
  reservation_hold_minutes: 15,
  cancellation_deadline_minutes: 45,
  no_show_buffer_minutes: 15,
  reservation_restore_minutes: 30,
  table_transfer_duration_minutes: 120,
  reservation_hold_scan_seconds: 30,
};

const DURATION_FIELDS = [
  {
    name: 'reservation_hold_minutes',
    label: 'Thời gian giữ bàn chờ thanh toán cọc',
    description: 'Hết thời gian này, hệ thống tự nhả bàn chưa thanh toán. Có hiệu lực với lượt giữ mới.',
    min: 1,
    max: 60,
  },
  {
    name: 'cancellation_deadline_minutes',
    label: 'Hạn được hoàn cọc khi khách hủy',
    description: 'Khách hủy trước giờ đặt bàn ít nhất thời gian này thì được xử lý hoàn cọc; 0 phút nghĩa là không cần báo trước.',
    min: 0,
    max: 1440,
  },
  {
    name: 'no_show_buffer_minutes',
    label: 'Thời gian trễ trước khi nhân viên được hủy',
    description: 'Tính từ giờ đặt bàn. Có thể đặt 0 để cho phép hủy ngay tại giờ hẹn.',
    min: 0,
    max: 240,
  },
  {
    name: 'reservation_restore_minutes',
    label: 'Thời hạn khôi phục sau khi nhân viên hủy',
    description: 'Tính từ lúc hủy. Khôi phục vẫn phụ thuộc tiền cọc và tình trạng bàn.',
    min: 1,
    max: 1440,
  },
  {
    name: 'table_transfer_duration_minutes',
    label: 'Thời lượng sử dụng bàn khi kiểm tra chuyển bàn',
    description: 'Khoảng thời gian dùng để kiểm tra lịch đặt bàn bị trùng.',
    min: 15,
    max: 1440,
  },
  {
    name: 'reservation_hold_scan_seconds',
    label: 'Chu kỳ quét bàn giữ tạm hết hạn',
    description: 'Hệ thống kiểm tra bàn chờ cọc hết hạn theo chu kỳ này. Chu kỳ ngắn giúp nhả bàn sát hạn hơn.',
    min: 5,
    max: 300,
    unit: 'giây',
  },
];

export default function ReservationTimingSettingsPage() {
  const [timing, setTiming] = useState(DEFAULT_TIMING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    settingsApi.getReservationTiming()
      .then((response) => setTiming({ ...DEFAULT_TIMING, ...response.data }))
      .catch((requestError) => {
        setLoadFailed(true);
        setError(getErrorMessage(requestError));
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField(name, value) {
    setTiming((current) => ({ ...current, [name]: value }));
    setSuccess('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = {
        ...timing,
        reservation_hold_minutes: Number(timing.reservation_hold_minutes),
        cancellation_deadline_minutes: Number(timing.cancellation_deadline_minutes),
        no_show_buffer_minutes: Number(timing.no_show_buffer_minutes),
        reservation_restore_minutes: Number(timing.reservation_restore_minutes),
        table_transfer_duration_minutes: Number(timing.table_transfer_duration_minutes),
        reservation_hold_scan_seconds: Number(timing.reservation_hold_scan_seconds),
      };
      const response = await settingsApi.updateReservationTiming(payload);
      setTiming({ ...DEFAULT_TIMING, ...response.data.timing });
      setSuccess('Đã lưu cấu hình. Các quy tắc mới áp dụng cho thao tác tiếp theo; hãy tải lại các trang đang mở để cập nhật phần hiển thị.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Thời gian đặt bàn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Điều chỉnh các mốc vận hành tại đây. Cấu hình được lưu trong hệ thống, không cần sửa code hay cấu trúc CSDL.
          </p>
        </div>

        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="card space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <Clock3 size={18} className="text-basil-600" /> Giờ nhận đặt bàn
            </h2>
            <p className="text-sm text-slate-500">Khung giờ này được áp dụng cho biểu mẫu và kiểm tra đặt bàn.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['reservation_open_time', 'Giờ mở nhận đặt bàn'],
                ['reservation_close_time', 'Giờ kết thúc nhận đặt bàn'],
              ].map(([name, label]) => (
                <label key={name}>
                  <span className="field-label">{label}</span>
                  <input
                    type="time"
                    required
                    value={timing[name]}
                    onChange={(event) => updateField(name, event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-basil-400 focus:ring-2 focus:ring-basil-100"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="card space-y-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <CalendarClock size={18} className="text-basil-600" /> Quy tắc thời gian
            </h2>
            {DURATION_FIELDS.map((field) => (
              <label key={field.name} className="block">
                <span className="field-label">{field.label} ({field.unit || 'phút'})</span>
                <input
                  type="number"
                  required
                  min={field.min}
                  max={field.max}
                  step="1"
                  value={timing[field.name]}
                  onChange={(event) => updateField(field.name, event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-basil-400 focus:ring-2 focus:ring-basil-100 sm:max-w-xs"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {field.description} Phạm vi: {field.min}–{field.max} {field.unit || 'phút'}.
                </span>
              </label>
            ))}
          </section>

          <button type="submit" disabled={saving || loadFailed} className="btn-primary w-full sm:w-auto">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu cấu hình thời gian
          </button>
        </form>
      </div>
    </Layout>
  );
}
