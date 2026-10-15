// src/api/socket.js
//
// Tạo kết nối socket.io kèm JWT (backend bắt buộc có token mới cho kết nối).
// Mỗi trang tự tạo socket khi mở và tự disconnect khi rời trang — không dùng chung 1 socket toàn app
// để tránh sót kết nối khi đăng xuất / đổi tài khoản.

import { io } from 'socket.io-client';

// Suy ra địa chỉ server từ VITE_API_URL (bỏ đuôi /api) nên không cần thêm biến môi trường mới.
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

export function createSocket() {
  return io(SOCKET_URL, { auth: { token: localStorage.getItem('token') } });
}