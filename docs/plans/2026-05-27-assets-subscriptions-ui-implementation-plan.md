# Kế hoạch Triển khai Giao diện (UI Plan): Assets & Subscriptions

Tài liệu này đề xuất kế hoạch thiết kế và phát triển giao diện người dùng (UI/UX) cho hai tính năng thuộc phạm vi **Người số 5**:
1. **Quản lý Ảnh màn hình khóa (Lock Screen Assets)** dành cho Quản trị viên phòng máy (`shop_admin`).
2. **Quản lý Bản quyền (Subscriptions)** bao gồm trang xem thông tin của Tenant (`shop_admin`/`staff`) và trang quản trị gói dịch vụ của hệ thống (`super_admin`).

---

## 1. Công nghệ & Kiến trúc Frontend đề xuất

* **Framework:** React 19 + Vite 8 + TypeScript.
* **Styling:** TailwindCSS (hoặc Vanilla CSS) kết hợp các Component UI hiện đại (như Radix UI, Lucide Icons cho biểu tượng).
* **Quản lý State & API Call:** Axios (cấu hình interceptor tự động đính kèm JWT Access Token).
* **Routing:** `react-router-dom` (chia quyền Route dựa trên Role của User).

---

## 2. Thiết kế chi tiết các Trang Giao diện

### 2.1. Module 1: Quản lý Ảnh màn hình khóa (Lock Screen Assets)
**Đối tượng:** `shop_admin` (Quán net đăng nhập quản lý slideshow màn hình chờ của máy trạm).
**Đường dẫn đề xuất:** `/admin/lock-screen`

#### A. Các Component trên Giao diện:
1. **Header & Thống kê nhanh:**
   - Tiêu đề: "Quản lý màn hình khóa máy trạm".
   - Mẹo nhỏ/Thông báo: "Ảnh kích hoạt sẽ hiển thị dạng slideshow trên tất cả máy trạm của quán. Hỗ trợ tối đa 5MB mỗi ảnh (JPG, PNG)."
2. **Khu vực tải lên (Upload Zone):**
   - Thiết kế dạng Drag-and-Drop Box (Kéo và thả ảnh vào hoặc click để chọn).
   - Client-side validation: Kiểm tra định dạng (.jpg, .jpeg, .png) và dung lượng tệp (< 5MB) trước khi gửi.
   - Hiển thị thanh tiến trình (Progress Bar) khi đang upload.
3. **Danh sách ảnh (Wallpaper Gallery Grid):**
   - Dạng Grid (3 hoặc 4 cột) hiển thị các thẻ ảnh (Card):
     - **Thumbnail:** Hiển thị hình ảnh thu nhỏ (Load từ URL static `/uploads/lockscreen/{filename}`).
     - **Thông tin tệp:** Tên file gốc, dung lượng (KB/MB), ngày tải lên.
     - **Toggle Switch (Bật/Tắt):** Gọi API `PATCH /api/assets/:id/active` để thay đổi trạng thái `isActive`. Ảnh tắt sẽ không hiển thị trên máy trạm.
     - **Delete Button (Nút xóa):** Click sẽ hiển thị Modal xác nhận xóa, gọi API `DELETE /api/assets/:id`.
4. **Trạng thái trống (Empty State):**
   - Hiển thị hình minh họa và nút "Tải lên ảnh đầu tiên" nếu Tenant chưa có ảnh nào.

#### B. Sơ đồ Giao diện (Mockup Layout):
```text
+---------------------------------------------------------------------------------+
|  MÀN HÌNH KHÓA & SLIDESHOW                                                      |
|  [ Kéo thả ảnh vào đây để tải lên hoặc Click để chọn file ]                     |
|  * Chỉ chấp nhận JPG, PNG dung lượng dưới 5MB.                                  |
+---------------------------------------------------------------------------------+
| Danh sách hình nền:                                                             |
| +-------------------+  +-------------------+  +-------------------+             |
| |    [Thumbnail]    |  |    [Thumbnail]    |  |    [Thumbnail]    |             |
| |                   |  |                   |  |                   |             |
| | name: wall_01.png |  | name: promo.jpg   |  | name: event_bg.png|             |
| | size: 1.2 MB      |  | size: 850 KB      |  | size: 2.1 MB      |             |
| |                   |  |                   |  |                   |             |
| | [x] Hoạt động     |  | [ ] Hoạt động     |  | [x] Hoạt động     |             |
| | [Xóa]             |  | [Xóa]             |  | [Xóa]             |             |
| +-------------------+  +-------------------+  +-------------------+             |
+---------------------------------------------------------------------------------+
```

---

### 2.2. Module 2: Quản lý Bản quyền (Subscriptions)

#### Giao diện A: Dành cho Tenant (`shop_admin` / `staff`)
* **Đường dẫn đề xuất:** `/admin/subscription`
* **Mô tả:** Hiển thị thông số bản quyền hiện tại của phòng máy.
* **Các thành phần giao diện:**
  1. **Thẻ Trạng thái Gói (Subscription Status Card):**
     - Hiển thị tên gói (ví dụ: Standard, Premium).
     - Badge trạng thái nổi bật: `ACTIVE` (Xanh lá), `EXPIRED` (Đỏ), `PENDING` (Vàng).
     - Hạn sử dụng: Ngày hết hạn và đếm ngược số ngày còn lại.
  2. **Thước đo số lượng máy trạm (Computers Limit Progress):**
     - Thanh Progress Bar biểu diễn trực quan tỉ lệ máy đã đăng ký trên tổng số máy cho phép (ví dụ: `15 / 20 máy`).
     - Cảnh báo màu vàng/đỏ nếu số máy đã đạt giới hạn tối đa.
  3. **Banner Cảnh báo:**
     - Nếu gói sắp hết hạn (< 7 ngày) hoặc đã hết hạn, hiển thị Banner cảnh báo ở đầu trang yêu cầu liên hệ Super Admin để gia hạn, tránh gián đoạn dịch vụ máy trạm.

---

#### Giao diện B: Dành cho Quản trị viên Hệ thống (`super_admin`)
* **Đường dẫn đề xuất:** `/super-admin/subscriptions`
* **Mô tả:** Nơi Super Admin xem, cấp mới và gia hạn gói dịch vụ cho tất cả Tenant.
* **Các thành phần giao diện:**
  1. **Bảng danh sách bản quyền (Subscription Table):**
     - Cột: Tên Tenant (Quán net), Mã Tenant, Trạng thái Gói, Số máy tối đa (`maxComputers`), Ngày hết hạn, Ngày cập nhật cuối.
     - Bộ lọc tìm kiếm nhanh theo Tenant Code hoặc lọc theo Trạng thái (ACTIVE, EXPIRED).
  2. **Nút "Cấp Bản quyền" (Create Subscription Modal):**
     - Form chọn Tenant (Dropdown lấy danh sách Tenant chưa có Subscription).
     - Nhập số máy tối đa (`maxComputers`).
     - Chọn ngày hết hạn (`expiresAt`).
     - Chọn trạng thái mặc định (ACTIVE).
  3. **Nút "Gia hạn / Sửa cấu hình" (Update Subscription Modal):**
     - Cho phép đổi trạng thái gói (ACTIVE/SUSPENDED/EXPIRED).
     - Tăng/giảm số máy tối đa.
     - Chọn lại thời gian hết hạn mới để gia hạn.

---

## 3. Các bước Tích hợp API chi tiết

### 3.1. Phía Assets (Ảnh màn hình khóa)
* **API Tải ảnh lên:** `POST /api/assets/upload`
  * Gửi dữ liệu dạng `Multipart/Form-Data` chứa file có field name là `image`.
  * Sau khi thành công, refresh danh sách ảnh.
* **API Lấy danh sách:** `GET /api/assets`
  * Nhận kết quả và set state `assetsList`.
* **API Bật/Tắt:** `PATCH /api/assets/:id/active`
  * Gửi body `{ isActive: boolean }`.
* **API Xóa:** `DELETE /api/assets/:id`
  * Gửi request và cập nhật lại state của danh sách để xóa card khỏi màn hình.

### 3.2. Phía Subscriptions (Bản quyền)
* **API Tenant tự xem:** `GET /api/subscriptions/me`
  * Tải thông tin gói và hiển thị lên màn hình.
* **API Super Admin tạo gói:** `POST /api/subscriptions`
  * Gửi body `{ tenantId, status, maxComputers, expiresAt }`.
* **API Super Admin cập nhật:** `PATCH /api/subscriptions/:id`
  * Gửi body `{ status, maxComputers, expiresAt }`.

---

## 4. Kế hoạch Từng bước Triển khai

1. **Bước 1: Khởi tạo thư mục và routing**
   - Khởi tạo thư mục `web-admin/` bằng React + Vite + TS (nếu chưa có).
   - Thiết lập cấu trúc thư mục components, pages, services API, assets.
   - Thêm các Route `/admin/lock-screen`, `/admin/subscription` (dành cho chủ quán) và `/super-admin/subscriptions` (dành cho admin tổng).
2. **Bước 2: Phát triển giao diện Quản lý Ảnh màn hình khóa**
   - Viết component Upload hình ảnh (kéo thả và validate dung lượng/định dạng tệp).
   - Viết Grid Layout hiển thị các ảnh, kết nối nút Toggle kích hoạt và nút Xóa.
3. **Bước 3: Phát triển giao diện Bản quyền**
   - Thiết kế Card xem thông số gói bản quyền dành cho chủ quán (hiển thị hạn dùng, số máy trạm/giới hạn).
   - Viết giao diện quản trị của Super Admin (Bảng danh sách, form cấp mới và sửa đổi/gia hạn gói).
4. **Bước 4: Kết nối API & Xử lý lỗi**
   - Viết các file API Client bằng Axios trỏ tới Backend API tương ứng.
   - Bắt và xử lý các mã lỗi: `402 Payment Required` (hết hạn/chưa đăng ký bản quyền), `403 Forbidden` (vượt quá giới hạn số máy).
5. **Bước 5: Kiểm thử UI & Tối ưu**
   - Thực hiện kiểm thử thủ công kéo thả file, kiểm tra thông tin hiển thị đúng múi giờ địa phương.
   - Kiểm tra giao diện responsive trên di động (nếu chủ quán truy cập qua điện thoại).
