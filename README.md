# Frontend — Phase 0 + Phase 1

React (Vite) + Tailwind CSS. Đã cài đặt sẵn: đăng nhập/đăng ký, xác thực email,
quên/đặt lại mật khẩu, trang quản lý món ăn, trang sơ đồ bàn.

## 1. Cài đặt

Giải nén, mở terminal tại thư mục `quan-an-frontend`:

```bash
npm install
```

## 2. Cấu hình

Đổi tên `.env.example` thành `.env`. Mặc định đã trỏ đúng về backend chạy ở
`http://localhost:3000/api` — nếu backend bạn chạy port khác thì sửa lại.

## 3. Chạy

```bash
npm run dev
```

Mở `http://localhost:5173`.

**Quan trọng:** backend phải đang chạy (`npm run dev` ở thư mục Backend) thì
frontend mới gọi API được. Chạy song song 2 terminal — 1 cho Backend, 1 cho
Frontend này.

## 4. Các trang đã có

| Route | Mô tả | Quyền |
|---|---|---|
| `/login` | Đăng nhập | Ai cũng vào được |
| `/register` | Đăng ký | Ai cũng vào được |
| `/verify-email?token=...` | Xác thực email (link trong email trỏ tới đây) | Ai cũng vào được |
| `/forgot-password` | Yêu cầu link đặt lại mật khẩu | Ai cũng vào được |
| `/reset-password?token=...` | Đặt mật khẩu mới | Ai cũng vào được |
| `/dishes` | Quản lý món ăn + nguyên liệu | Đăng nhập, role `manager`/`staff`/`kitchen` |
| `/tables` | Sơ đồ bàn | Đăng nhập (mọi role) |

`manager` thấy đầy đủ nút Thêm/Sửa/Xoá món, bàn, nguyên liệu.
`staff`/`kitchen` chỉ xem + được bật/tắt "còn hàng/hết hàng" của món (đúng
theo Phần 0.3/0.4 trong tài liệu).
`customer` hiện chưa vào được `/dishes` (route đó dành cho vận hành nội bộ) —
trang menu công khai cho khách sẽ làm ở phase sau khi có giao diện đặt bàn.

## 5. Đồng bộ `FRONTEND_VERIFY_EMAIL_URL` / `FRONTEND_RESET_PASSWORD_URL` bên Backend

Backend cần trỏ đúng 2 biến này về đúng cổng frontend (`5173`), để link trong
email bấm vào mới vào đúng trang xác thực/đặt lại mật khẩu. Kiểm tra `.env`
bên Backend có đúng chưa:

```
FRONTEND_VERIFY_EMAIL_URL=http://localhost:5173/verify-email
FRONTEND_RESET_PASSWORD_URL=http://localhost:5173/reset-password
```

Nếu trước đây bạn để giá trị này chưa đúng (VD chưa có `FRONTEND_RESET_PASSWORD_URL`),
thêm/sửa lại 2 dòng trên trong `.env` Backend rồi restart server.

## 6. Cấu trúc thư mục

```
src/
├── api/           # Các hàm gọi API (axios), 1 file theo mỗi nhóm resource
├── components/    # Layout, Modal, Alert, ProtectedRoute — dùng chung nhiều trang
├── context/        # AuthContext — trạng thái đăng nhập toàn app
└── pages/          # 1 file = 1 trang/route
```

Khi làm Phase 2 (đặt bàn) trở đi, chỉ cần thêm file mới trong `api/` và
`pages/`, gắn thêm route trong `App.jsx` — không cần đổi cấu trúc.
