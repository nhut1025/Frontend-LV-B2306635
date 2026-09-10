// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import Alert from '../components/Alert';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notVerified, setNotVerified] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotVerified(false);
    setResendMsg('');
    setSubmitting(true);

    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || '/tables';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setNotVerified(true);
      }
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      await loginWithGoogle(credentialResponse.credential);
      const redirectTo = location.state?.from?.pathname || '/tables';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleResend() {
    setResendMsg('');
    try {
      await authApi.resendVerification(email);
      setResendMsg('Nếu email tồn tại và chưa xác thực, link mới đã được gửi. Kiểm tra hộp thư nhé.');
    } catch (err) {
      setResendMsg(getErrorMessage(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-porcelain px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <ChefHat size={22} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Đăng nhập</h1>
          <p className="text-sm text-slate-500">Vào hệ thống quản lý quán ăn</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {notVerified && (
            <button type="button" onClick={handleResend} className="text-sm font-medium text-basil-600 underline">
              Gửi lại link xác thực email
            </button>
          )}
          {resendMsg && <Alert type="success">{resendMsg}</Alert>}

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

          <div>
            <label className="field-label" htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder="••••••••"
            />
            <Link to="/forgot-password" className="mt-1.5 inline-block text-xs font-medium text-basil-600 hover:underline">
              Quên mật khẩu?
            </Link>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">hoặc</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Đăng nhập Google thất bại.')}
            />
          </div>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-basil-600 hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}