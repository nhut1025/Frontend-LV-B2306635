// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// allowedRoles không truyền -> chỉ cần đăng nhập là đủ, không phân biệt role.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porcelain">
        <p className="text-sm text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porcelain px-4">
        <div className="card max-w-md text-center">
          <h1 className="font-display text-xl font-semibold text-ink">Không có quyền truy cập</h1>
          <p className="mt-2 text-sm text-slate-500">
            Trang này chỉ dành cho vai trò: {allowedRoles.join(', ')}. Tài khoản của bạn đang là{' '}
            <span className="font-medium text-ink">{user.role}</span>.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
