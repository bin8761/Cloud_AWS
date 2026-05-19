Backend foundation
Setup project, Express, Prisma schema, env, health check.

Auth + Tenant
Vì mọi thứ sau đều phụ thuộc user, role và tenantId.

Computer registration + heartbeat
Để client PC có thể đăng ký máy và báo online/offline.

Socket.IO realtime
Để web admin và client bắt đầu giao tiếp realtime.

Session + Usage
Luồng nghiệp vụ lõi: mở phiên, đóng phiên, ghi usage.

Web Admin tích hợp dần
Không chờ backend xong hết mới làm web. Web nên tích hợp từng API khi backend có.

Client PC tích hợp dần
Sau khi có computer register, heartbeat, socket, session API thì client làm thật.

URL rules, lock-screen/slideshow, license
Là các module mở rộng sau khi core flow chạy được.

AWS staging
Không để cuối kỳ. Nên deploy lần đầu khoảng sau khi có auth + computer heartbeat, tức tầm phase 3.

Logging, security hardening, testing, polish
Làm xen kẽ, nhưng đẩy mạnh ở giai đoạn sau.

