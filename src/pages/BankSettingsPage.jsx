// src/pages/BankSettingsPage.jsx
import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { settingsApi } from '../api/settings';
import { getErrorMessage } from '../api/client';

// Danh sách rút gọn các ngân hàng phổ biến — đủ dùng cho phạm vi đồ án.
// Mã BIN theo chuẩn VietQR/Napas.
const BANKS = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970426', name: 'MSB' },
  { bin: '970443', name: 'SHB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970437', name: 'HDBank' },
];

export default function BankSettingsPage() {
  const [form, setForm] = useState({ bank_bin: '', account_number: '', account_name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    settingsApi
      .getBank()
      .then((res) => setForm(res.data.bank))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await settingsApi.updateBank(form);
      setSuccess('Đã lưu cấu hình tài khoản ngân hàng.');
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
        <h1 className="font-display text-2xl font-semibold text-ink">Tài khoản nhận cọc</h1>
        <p className="text-sm text-slate-500">
          Dùng để tạo mã VietQR cho khách quét chuyển khoản cọc khi đặt bàn
        </p>
      </div>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

      <form onSubmit={handleSubmit} className="card max-w-md space-y-4">
        <div>
          <label className="field-label">Ngân hàng</label>
          <select
            required
            value={form.bank_bin}
            onChange={(e) => updateForm('bank_bin', e.target.value)}
            className="field-input"
          >
            <option value="" disabled>
              — Chọn ngân hàng —
            </option>
            {BANKS.map((b) => (
              <option key={b.bin} value={b.bin}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Số tài khoản</label>
          <input
            required
            value={form.account_number}
            onChange={(e) => updateForm('account_number', e.target.value)}
            className="field-input"
            placeholder="0123456789"
          />
        </div>

        <div>
          <label className="field-label">Tên chủ tài khoản</label>
          <input
            required
            value={form.account_name}
            onChange={(e) => updateForm('account_name', e.target.value.toUpperCase())}
            className="field-input"
            placeholder="NGUYEN VAN A (không dấu, in hoa)"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Lưu cấu hình
        </button>
      </form>
    </Layout>
  );
}