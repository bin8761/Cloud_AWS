# Runbook E2E: Web Admin + Desktop Heartbeat Client

Ngày cập nhật: 2026-05-30

## 1) Mục tiêu

Xác minh end-to-end luồng:

1. Tạo/đăng ký computer trên Web Admin.
2. Kết nối desktop heartbeat client bằng `computerId` + `deviceToken`.
3. Web Admin hiển thị realtime presence `Online/Offline` đúng theo trạng thái kết nối.
4. Kiểm tra reissue token: token cũ bị vô hiệu, token mới hoạt động.

## 2) Điều kiện trước khi chạy

1. Backend chạy tại `http://localhost:3000`.
2. Web Admin chạy và truy cập được trang `Computers` tại `http://localhost:5173/computers`.
3. Desktop client chạy trong thư mục `desktop-client/heartbeat-client`.

Lưu ý dev port hiện tại cho desktop client:

- Renderer desktop client: `http://localhost:5174`.
- Electron dev script đã chờ `tcp:5174`.

## 3) Luồng thao tác chuẩn

### Bước A: Chuẩn bị token trên Web Admin

1. Vào `Computers`.
2. Nếu chưa có máy:
   - bấm `Create computer`,
   - nhập `registrationSecret`, `macAddress`, `displayName`,
   - copy `deviceToken` one-time.
3. Nếu đã có máy:
   - vào detail,
   - bấm `Reissue token`,
   - copy `deviceToken` mới one-time.

### Bước B: Kết nối desktop client

1. Mở app `CloudCMS Heartbeat Client`.
2. Nhập:
   - `Server URL`: `http://localhost:3000`
   - `Computer ID`: id máy trên Web Admin
   - `Device Token`: token vừa copy
3. Bấm `Save` (khuyến nghị).
4. Bấm `Connect`.

Kỳ vọng:

- `Connection state` trên desktop chuyển `Connected`.
- Web Admin hiển thị `Realtime presence: Online`.
- `Last seen` cập nhật theo heartbeat.

### Bước C: Kiểm tra offline/online

1. Trên desktop bấm `Disconnect`.
2. Xác nhận Web Admin chuyển `Offline`.
3. Bấm `Connect` lại.
4. Xác nhận Web Admin về `Online`.

### Bước D: Kiểm tra reissue token

1. Trên Web Admin reissue token cho computer.
2. Trên desktop thử reconnect bằng token cũ -> phải fail (unauthorized/safe error).
3. Dán token mới -> connect thành công.

## 4) Checklist pass nhanh

- [ ] Desktop `Connected` với credential hợp lệ.
- [ ] Web Admin hiển thị `Online` khi desktop connect.
- [ ] Web Admin hiển thị `Offline` khi desktop disconnect.
- [ ] Reissue token làm token cũ không còn dùng được.
- [ ] Token mới connect lại thành công.

## 5) Lỗi thường gặp và cách xử lý

### Lỗi 1: `Port 5173 is already in use`

Nguyên nhân: Web Admin đang dùng `5173`.

Cách xử lý:

1. Desktop renderer dùng `5174` (đã cấu hình).
2. Chạy lại `npm run dev` trong `desktop-client/heartbeat-client`.

### Lỗi 2: Mở desktop app nhưng thấy trang Web Admin Login

Nguyên nhân: Electron dev URL đang trỏ nhầm `http://localhost:5173`.

Cách xử lý:

1. Đảm bảo `src/main/main.ts` dùng `DEV_RENDERER_URL = "http://localhost:5174"`.
2. Dừng toàn bộ process dev, chạy lại `npm run dev`.

### Lỗi 3: Connect fail dù đã nhập token

Nguyên nhân phổ biến:

1. `computerId` sai.
2. Dùng token cũ sau khi reissue.
3. Server URL sai hoặc backend chưa chạy.

Cách xử lý:

1. Reissue token mới trên Web Admin.
2. Dán lại đúng `computerId` + `deviceToken`.
3. Connect lại.

## 6) Ghi chú bảo mật

1. `deviceToken` là secret one-time hiển thị cho operator, cần copy và lưu an toàn.
2. Không chia sẻ token qua chat/log công khai.
3. Sau reissue, token cũ phải xem như đã vô hiệu.
