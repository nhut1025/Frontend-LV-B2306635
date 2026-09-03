// src/pages/VerifyEmailPage.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Thiếu token xác thực trong đường dẫn.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err));
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-porcelain px-4">
      <div className="card max-w-sm text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-3 animate-spin text-slate-400" size={28} />
            <p className="text-sm text-slate-500">Đang xác thực...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-3 text-basil-500" size={32} />
            <h1 className="font-display text-lg font-semibold text-ink">Xác thực thành công</h1>
            <p className="mt-2 text-sm text-slate-500">{message}</p>
            <Link to="/login" className="btn-primary mt-5 w-full">
              Đăng nhập ngay
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto mb-3 text-clay-500" size={32} />
            <h1 className="font-display text-lg font-semibold text-ink">Không xác thực được</h1>
            <p className="mt-2 text-sm text-slate-500">{message}</p>
            <Link to="/login" className="btn-secondary mt-5 w-full">
              Về trang đăng nhập
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
