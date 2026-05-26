# Kế hoạch triển khai: Module Assets & Subscriptions (Người 5)

Kế hoạch này hướng dẫn chi tiết từng bước để hoàn thiện yêu cầu của **Người số 5**:

1. Triển khai chức năng upload và quản lý ảnh màn hình khóa lưu cục bộ (Local Assets) dùng `multer`.
2. Triển khai chức năng quản lý bản quyền (Subscriptions) của từng quán net (Tenant).
3. Tích hợp kiểm tra thời hạn bản quyền và giới hạn số máy khi máy trạm đăng ký/hoạt động.

---

## 1. Cập nhật Cơ sở dữ liệu (Prisma Schema)

### Các mô hình đề xuất

Cần thêm 2 bảng mới `Subscription` và `LockScreenAsset` vào `backend/prisma/schema.prisma` và liên kết với `Tenant`.

```prisma
enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  PENDING
}

// Bảng quản lý bản quyền của từng quán net
model Subscription {
  id           String             @id @default(uuid())
  tenantId     String             @unique // Quan hệ 1-1 với Tenant
  status       SubscriptionStatus @default(ACTIVE)
  maxComputers Int                @default(20) // Giới hạn số máy trạm tối đa
  expiresAt    DateTime           // Ngày hết hạn gói
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  tenant       Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([status, expiresAt])
}

// Bảng quản lý ảnh màn hình khóa lưu cục bộ
model LockScreenAsset {
  id        String   @id @default(uuid())
  tenantId  String   // Thuộc về tenant nào
  fileName  String   // Tên file gốc (ví dụ: wallpaper.png)
  filePath  String   // Đường dẫn file tương đối trên đĩa (ví dụ: public/uploads/lockscreen/xxx.png)
  fileSize  Int      // Kích thước (bytes)
  mimeType  String   // image/png, image/jpeg
  isActive  Boolean  @default(true) // Trạng thái hiển thị trong slideshow
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, isActive])
}
```

### Các bước thực hiện

1. Sửa file `backend/prisma/schema.prisma` thêm 2 Model trên và thêm các liên kết trong `model Tenant`:

   ```prisma
   subscription Subscription?
   assets       LockScreenAsset[]
   ```

2. Người dùng chạy lệnh tạo migration và sinh Prisma Client:

   ```bash
   npx prisma migrate dev --name add_assets_and_subscriptions
   npx prisma generate
   ```

---

## 2. Kế hoạch từng Task triển khai

### Task 1: Cài đặt và cấu hình Multer & static file serving

**Mục tiêu:** Cho phép tải ảnh lên máy cục bộ và cấu hình server Express trả về file tĩnh khi được gọi.

**Các bước thực hiện:**

1. Cài đặt các package cần thiết (Người dùng chạy):

   ```bash
   cd backend
   npm install multer
   npm install --save-dev @types/multer
   ```

2. Tạo file cấu hình upload `backend/src/shared/middleware/upload.middleware.ts`:
   * Sử dụng `multer.diskStorage` lưu file vào `public/uploads/lockscreen/`. Tự động tạo thư mục nếu chưa tồn tại.
   * Tạo tên file ngẫu nhiên để tránh trùng lặp: `tenantId_timestamp_random.ext`.
   * Validate định dạng file: Chỉ chấp nhận `image/jpeg` và `image/png`.
   * Validate dung lượng file: Giới hạn tối đa `5MB` (hoặc cấu hình qua biến môi trường).

3. Cấu hình Express Static Server trong `backend/src/app.ts`:
   * Thêm dòng: `app.use('/uploads/lockscreen', express.static(path.join(__dirname, '../public/uploads/lockscreen')));` để WPF Client và Web Admin truy xuất trực tiếp ảnh qua URL dạng `http://localhost:3000/uploads/lockscreen/xxx.png`.

---

### Task 2: Triển khai Module LockScreen Assets (Quản lý ảnh màn hình chờ)

**Mục tiêu:** Cung cấp API upload, lấy danh sách, kích hoạt/hủy kích hoạt và xóa file ảnh cục bộ theo từng Tenant.

**Cấu trúc thư mục module:**

* `backend/src/modules/assets/assets.routes.ts`
* `backend/src/modules/assets/assets.controller.ts`
* `backend/src/modules/assets/assets.service.ts`
* `backend/src/modules/assets/assets.schema.ts`

**Các API endpoints:**

* `POST /api/assets/upload` (Quyền: `shop_admin`)
  * Sử dụng `upload.single('image')`.
  * Lưu thông tin file vào database bảng `LockScreenAsset` đi kèm `tenantId` lấy từ JWT context.
* `GET /api/assets` (Quyền: `shop_admin` hoặc WPF Client với `deviceToken`)
  * Trả về danh sách ảnh của Tenant. WPF Client chỉ lấy những ảnh có `isActive = true`.
* `PATCH /api/assets/:id/active` (Quyền: `shop_admin`)
  * Đổi trạng thái `isActive` (true/false) của ảnh.
* `DELETE /api/assets/:id` (Quyền: `shop_admin`)
  * Kiểm tra ảnh thuộc về tenant của admin đó.
  * Xóa bản ghi trong database.
  * Xóa file vật lý trên ổ cứng sử dụng module `fs.promises.unlink`.

---

### Task 3: Triển khai Module Subscriptions (Quản lý Bản quyền)

**Mục tiêu:** Quản lý thời hạn hoạt động và giới hạn thiết bị tối đa cho mỗi quán net.

**Cấu trúc thư mục module:**

* `backend/src/modules/subscriptions/subscriptions.routes.ts`
* `backend/src/modules/subscriptions/subscriptions.controller.ts`
* `backend/src/modules/subscriptions/subscriptions.service.ts`
* `backend/src/modules/subscriptions/subscriptions.schema.ts`

**Các API endpoints:**

* `GET /api/subscriptions/me` (Quyền: `shop_admin`, `staff`)
  * Lấy thông tin bản quyền hiện tại của Tenant (trạng thái, ngày hết hạn, giới hạn máy).
* `POST /api/subscriptions` (Quyền: `super_admin`)
  * Tạo mới hoặc cấp gói bản quyền ban đầu cho một Tenant.
* `PATCH /api/subscriptions/:id` (Quyền: `super_admin`)
  * Gia hạn hoặc thay đổi cấu hình số máy tối đa (`maxComputers`), đổi trạng thái (`ACTIVE`, `SUSPENDED`, `EXPIRED`).

---

### Task 4: Tích hợp logic chặn máy trạm quá hạn bản quyền (Subscription Guard)

**Mục tiêu:** Ngăn chặn máy trạm đăng ký hoặc kết nối nếu gói dịch vụ của Tenant đã hết hạn hoặc quá giới hạn số máy.

**Các bước thực hiện:**

1. Tạo một helper service kiểm tra bản quyền `backend/src/modules/subscriptions/subscriptions.guard.ts`:
   * Nhận vào `tenantId`.
   * Lấy thông tin `Subscription` của tenant.
   * Nếu không tìm thấy hoặc trạng thái khác `ACTIVE`, hoặc thời gian hiện tại > `expiresAt`, ném ra lỗi `402 Payment Required` (hoặc `403 Forbidden` kèm mã lỗi thích hợp).

2. Tích hợp kiểm tra vào luồng **Đăng ký máy trạm** (`POST /api/computers/register`):
   * Đếm tổng số máy trạm hiện có của Tenant (`Computer.count`).
   * So sánh với `maxComputers` trong Subscription. Nếu số lượng bằng hoặc vượt quá, từ chối đăng ký mới (trả về lỗi `403` hoặc `409` vượt quá giới hạn).

3. Tích hợp kiểm tra vào luồng **Heartbeat / Socket kết nối**:
   * Kiểm tra định kỳ hoặc tại thời điểm kết nối, nếu Tenant hết hạn bản quyền thì không cho phép máy trạm hoạt động.

---

### Task 5: Viết Kiểm thử tự động (Vitest & Supertest)

**Mục tiêu:** Đảm bảo mã nguồn hoạt động chính xác và không bị lỗi hồi quy (regression).

**Các file kiểm thử:**

1. `backend/tests/assets/assets.api.test.ts`:
   * Test upload file ảnh giả lập thành công bằng Supertest `.attach()`.
   * Test lỗi định dạng file không được phép (ví dụ: upload tệp `.txt`).
   * Test xóa ảnh và xác nhận tệp tin biến mất khỏi đĩa cứng (mocking `fs.promises.unlink`).
   * Test cô lập tenant (Tenant A không được phép xóa/sửa ảnh của Tenant B).

2. `backend/tests/subscriptions/subscriptions.api.test.ts`:
   * Test `shop_admin` xem được gói dịch vụ của mình.
   * Test `super_admin` tạo và thay đổi gói dịch vụ thành công.
   * Test chặn đăng ký máy trạm mới khi vượt quá giới hạn `maxComputers`.
   * Test máy trạm bị từ chối kết nối khi Subscription bị đổi trạng thái sang `EXPIRED`.

---

## 3. Kế hoạch tuần tự triển khai code

Bạn có thể tự làm hoặc nhờ tôi hỗ trợ viết mã nguồn theo các bước sau:

1. **Bước 1**: Cập nhật file `prisma/schema.prisma` và tạo migrations.
2. **Bước 2**: Viết middleware upload và mount static file serving trong `app.ts`.
3. **Bước 3**: Tạo module `assets` (service, controller, routes) và viết các API quản lý ảnh.
4. **Bước 4**: Tạo module `subscriptions` (service, controller, routes, guard).
5. **Bước 5**: Tích hợp kiểm tra hạn bản quyền vào module `computers` hiện có.
6. **Bước 6**: Chạy kiểm thử tự động toàn bộ module vừa viết để đảm bảo chất lượng.
