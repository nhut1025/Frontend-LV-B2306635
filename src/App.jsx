// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
import ReservationPage from './pages/ReservationPage';
import MyReservationsPage from './pages/MyReservationsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import PendingDepositsPage from './pages/PendingDepositsPage';
import BankSettingsPage from './pages/BankSettingsPage';

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
            path="/dishes/:id"
            element={
              <ProtectedRoute>
                <DishDetailPage />
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
              <ProtectedRoute>
                <TablesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reservations"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <ReservationPage />
              </ProtectedRoute>
            }
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
            path="/bank-settings"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <BankSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/tables" replace />} />
          <Route path="*" element={<Navigate to="/tables" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}