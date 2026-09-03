// src/pages/ResetPasswordPage.jsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import Alert from '../components/Alert';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Thiếu token trong đường dẫn. Hãy mở lại link từ email.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      navigate('/login', { replace: true, state: { resetSuccess: true } });
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
          <h1 className="font-display text-2xl font-semibold text-ink">Đặt lại mật khẩu</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {!token && <Alert type="error">Không tìm thấy token trong đường dẫn.</Alert>}

          <div>
            <label className="field-label" htmlFor="password">Mật khẩu mới</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-basil-600 hover:underline">
            Về trang đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
