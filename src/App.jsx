// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DishesPage from './pages/DishesPage';
import DishDetailPage from './pages/DishDetailPage';
import TablesPage from './pages/TablesPage';
import ProfilePage from './pages/ProfilePage';
import MyReservationsPage from './pages/MyReservationsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import PendingDepositsPage from './pages/PendingDepositsPage';
import PendingRefundsPage from './pages/PendingRefundsPage';
import PendingPreordersPage from './pages/PendingPreordersPage';
import BankSettingsPage from './pages/BankSettingsPage';
import KitchenPage from './pages/KitchenPage';
import PaymentsPage from './pages/PaymentsPage';
import FinancePage from './pages/FinancePage';
import CategoriesPage from './pages/CategoriesPage';
import IngredientsPage from './pages/IngredientsPage';

// Trang chủ mặc định theo vai trò: bếp vào thẳng màn hình bếp, các vai trò khác vào sơ đồ bàn.
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user?.role === 'kitchen' ? '/kitchen' : '/tables'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/dishes"
            element={
              <ProtectedRoute>
                <DishesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dishes/category/:categoryId"
            element={
              <ProtectedRoute>
                <DishesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dishes/:id"
            element={
              <ProtectedRoute>
                <DishDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/categories"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ingredients"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <IngredientsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tables"
            element={
              <ProtectedRoute allowedRoles={['customer', 'phuc_vu', 'thu_ngan', 'manager']}>
                <TablesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reservations"
            element={<Navigate to="/tables" replace />}
          />

          <Route
            path="/my-reservations"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <MyReservationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <StaffManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pending-deposits"
            element={
              <ProtectedRoute allowedRoles={['thu_ngan']}>
                <PendingDepositsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pending-refunds"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <PendingRefundsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pending-preorders"
            element={
              <ProtectedRoute allowedRoles={['thu_ngan']}>
                <PendingPreordersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/bank-settings"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <BankSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payments"
            element={
              <ProtectedRoute allowedRoles={['thu_ngan']}>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/finance"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <FinancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/kitchen"
            element={
              <ProtectedRoute allowedRoles={['kitchen']}>
                <KitchenPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}