// src/pages/ResetPasswordPage.jsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import Alert from '../components/Alert';
import { useCustomerTranslation } from '../i18n/useCustomerTranslation';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function ResetPasswordPage() {
  const { t } = useCustomerTranslation();
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
      setError(t('auth.missingResetToken'));
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
      <div className="fixed right-4 top-4 z-40"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-basil-500 text-porcelain">
            <KeyRound size={20} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t('auth.resetTitle')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <Alert type="error">{error}</Alert>}
          {!token && <Alert type="error">{t('auth.resetTokenNotFound')}</Alert>}

          <div>
            <label className="field-label" htmlFor="password">{t('auth.newPassword')}</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
              placeholder={t('auth.passwordMinPlaceholder')}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('auth.saving') : t('auth.resetButton')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-basil-600 hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
