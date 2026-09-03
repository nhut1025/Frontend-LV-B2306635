// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, MailCheck } from 'lucide-react';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import Alert from '../components/Alert';

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.register(form);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porcelain px-4">
        <div className="card max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-basil-50 text-basil-600">
            <MailCheck size={22} />
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">Kiểm tra email của bạn</h1>
          <p className="mt-2 text-sm text-slate-500">
            Mình đã gửi link xác thực tới <span className="font-medium text-ink">{form.email}</span>. Bấm vào link đó
            trước khi đăng nhập.
          </p>
          <Link to="/login" className="btn-primary mt-5 w-full">
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-porcelain px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <ChefHat size={22} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Tạo tài khoản</h1>
          <p className="text-sm text-slate-500">Đăng ký để đặt bàn và gọi món</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label className="field-label" htmlFor="full_name">Họ tên</label>
            <input
              id="full_name"
              required
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              className="field-input"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="field-input"
              placeholder="ban@example.com"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="phone">Số điện thoại</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="field-input"
              placeholder="09xxxxxxxx"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="field-input"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-basil-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
