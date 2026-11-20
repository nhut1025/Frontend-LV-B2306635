// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChefHat } from 'lucide-react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { authApi } from '../api/auth';
import Alert from '../components/Alert';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const { t, language } = useCustomerTranslation();
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
      const loggedInUser = await login(email, password);
      const defaultHome = loggedInUser.role === 'kitchen' ? '/kitchen' : '/tables';
      const redirectTo = location.state?.from?.pathname || defaultHome;
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
      setResendMsg(t('auth.verificationResent'));
    } catch (err) {
      setResendMsg(getErrorMessage(err));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-porcelain px-4">
      <div className="fixed right-4 top-4 z-40"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <ChefHat size={22} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t('auth.loginTitle')}</h1>
          <p className="text-sm text-slate-500">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {notVerified && (
            <button type="button" onClick={handleResend} className="text-sm font-medium text-basil-600 underline">
              {t('auth.resendVerification')}
            </button>
          )}
          {resendMsg && <Alert type="success">{resendMsg}</Alert>}

          <div>
            <label className="field-label" htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">{t('auth.password')}</label>
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
              {t('auth.forgotPassword')}
            </Link>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">{t('auth.or')}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex justify-center">
            <GoogleOAuthProvider
              key={language}
              clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
              locale={language}
            >
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError(t('auth.googleLoginFailed'))}
              />
            </GoogleOAuthProvider>
          </div>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-medium text-basil-600 hover:underline">
            {t('auth.registerNow')}
          </Link>
        </p>
      </div>
    </div>
  );
}