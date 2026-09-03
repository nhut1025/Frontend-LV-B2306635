// src/api/client.js
//
// 1 instance axios dùng chung cho toàn app — tự gắn Authorization header
// nếu đã đăng nhập (đọc token từ localStorage), và tự chuyển hướng về trang
// login nếu backend trả 401 (token hết hạn/không hợp lệ).

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const client = axios.create({
  baseURL: API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper rút gọn lấy message lỗi từ response, có fallback.
export function getErrorMessage(err) {
  return err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

export default client;
