// src/api/auth.js
import client from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  googleLogin: (idToken) => client.post('/auth/google', { idToken }),
  me: () => client.get('/auth/me'),
  verifyEmail: (token) => client.get('/auth/verify-email', { params: { token } }),
  resendVerification: (email) => client.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => client.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => client.post('/auth/reset-password', { token, password }),
};