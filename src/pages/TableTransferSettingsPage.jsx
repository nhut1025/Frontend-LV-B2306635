import { useEffect, useState } from 'react';
import { Clock3, Loader2, Save } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { settingsApi } from '../api/settings';
import { getErrorMessage } from '../api/client';

export default function TableTransferSettingsPage() {
  const [durationMinutes, setDurationMinutes] = useState('120');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    settingsApi
      .getTableTransferDuration()
      .then((response) => setDurationMinutes(String(response.data.duration_minutes)))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await settingsApi.updateTableTransferDuration(Number(durationMinutes));
      setDurationMinutes(String(response.data.duration_minutes));
      setSuccess('Đã lưu thời lượng sử dụng bàn.');
    } catch (err) {
      setError(getErrorMessage(err));
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Thời lượng sử dụng bàn</h1>
        <p className="text-sm text-slate-500">
          Khoảng thời gian dùng để kiểm tra lịch đặt bị trùng khi chuyển khách sang bàn khác
        </p>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

      <form onSubmit={handleSubmit} className="card max-w-md space-y-4">
        <div>
          <label htmlFor="table-transfer-duration" className="field-label">Thời lượng (phút)</label>
          <div className="reservation-input-wrap">
            <Clock3 size={16} />
            <input
              id="table-transfer-duration"
              type="number"
              min="15"
              max="1440"
              step="1"
              required
              value={durationMinutes}
              onChange={(event) => {
                setDurationMinutes(event.target.value);
                setSuccess('');
              }}
              className="w-full bg-transparent outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Nhập số nguyên từ 15 đến 1440 phút.</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Lưu cấu hình
        </button>
      </form>
    </Layout>
  );
}
