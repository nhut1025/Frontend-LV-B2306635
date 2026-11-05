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
import PublicTablesPage from './pages/PublicTablesPage';
import ProfilePage from './pages/ProfilePage';
import MyReservationsPage from './pages/MyReservationsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import PendingDepositsPage from './pages/PendingDepositsPage';
import PendingRefundsPage from './pages/PendingRefundsPage';
import PendingPreordersPage from './pages/PendingPreordersPage';
import BankSettingsPage from './pages/BankSettingsPage';
import ReservationTimingSettingsPage from './pages/ReservationTimingSettingsPage';
import KitchenPage from './pages/KitchenPage';
import PaymentsPage from './pages/PaymentsPage';
import FinancePage from './pages/FinancePage';
import CategoriesPage from './pages/CategoriesPage';
import IngredientsPage from './pages/IngredientsPage';
import RestaurantReviewsPage from './pages/RestaurantReviewsPage';
import ManagerReviewsPage from './pages/ManagerReviewsPage';
import PublicHomePage from './pages/PublicHomePage';
import ChatPage from './pages/ChatPage';

// Người chưa đăng nhập xem trang giới thiệu; nhân viên đã đăng nhập vào đúng màn hình vận hành.
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <PublicHomePage />;
  return <Navigate to={user.role === 'kitchen' ? '/kitchen' : '/tables'} replace />;
}

function TablesRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <PublicTablesPage />;
  return (
    <ProtectedRoute allowedRoles={['customer', 'phuc_vu', 'thu_ngan', 'manager']}>
      <TablesPage />
    </ProtectedRoute>
  );
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
            element={<DishesPage />}
          />

          <Route
            path="/restaurant-reviews"
            element={<RestaurantReviewsPage />}
          />

          <Route
            path="/manage-reviews"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ManagerReviewsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dishes/category/:categoryId"
            element={<DishesPage />}
          />

          <Route
            path="/dishes/:id"
            element={<DishDetailPage />}
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
            path="/chat"
            element={
              <ProtectedRoute allowedRoles={['customer', 'thu_ngan']}>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tables"
            element={<TablesRoute />}
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
            path="/reservation-timing"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ReservationTimingSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/table-transfer-settings"
            element={<Navigate to="/reservation-timing" replace />}
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