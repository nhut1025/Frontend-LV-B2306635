// src/pages/ForgotPasswordPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import Alert from '../components/Alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-porcelain px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <KeyRound size={20} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Quên mật khẩu</h1>
          <p className="text-sm text-slate-500">Nhập email để nhận link đặt lại mật khẩu</p>
        </div>

        <div className="card space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {done ? (
            <Alert type="success">
              Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư nhé.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="ban@example.com"
                />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Đang gửi...' : 'Gửi link đặt lại'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-basil-600 hover:underline">
            Về trang đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
