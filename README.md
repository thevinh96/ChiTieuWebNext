# ChiTieuWeb

Ứng dụng quản lý thu chi cá nhân dùng **Next.js** ở frontend, **Express.js** làm API và **Supabase Auth + PostgreSQL** làm đăng nhập/lưu trữ. Dự án này nằm riêng để giữ nguyên ứng dụng ASP.NET hiện có trong `../ChiTieuWeb`.

## Thiết lập Supabase

1. Tạo project Supabase và lấy **Project URL** cùng **publishable key** trong phần API Keys.
2. Mở SQL Editor, chạy file [`supabase/migrations/20261108000000_initial_schema.sql`](supabase/migrations/20261108000000_initial_schema.sql).
3. Migration bật RLS, tạo chính sách theo `user_id` và chỉ cấp quyền Data API cho người dùng đã đăng nhập.
4. Để bật Ví, Ngân sách và giao dịch gắn với ví, tiếp tục chạy [`supabase/migrations/20261110000000_wallets_budgets.sql`](supabase/migrations/20261110000000_wallets_budgets.sql). Migration này tạo ví mặc định cho tài khoản hiện có và mới, giữ lại giao dịch cũ bằng cách gắn chúng vào ví mặc định.
5. Sao chép `backend/.env.example` thành `backend/.env`, rồi điền `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`.
6. Sao chép `frontend/.env.local.example` thành `frontend/.env.local`, điền cùng URL và publishable key.
7. Trong Supabase Auth → URL Configuration, đặt Site URL là `http://localhost:3000` và thêm `http://localhost:3000/**` vào Redirect URLs. Khi deploy, đổi Site URL sang domain thật và thêm domain đó vào Redirect URLs.

Không đưa secret/service-role key vào frontend hay GitHub. Frontend dùng publishable key cùng phiên đăng nhập; Express xác thực token và chuyển tiếp token đó tới Data API để chính sách RLS lọc dữ liệu.

Các giao dịch trong `backend/data/transactions.json` từ bản demo cũ không tự nhập vào Supabase. Hãy xuất/nhập dữ liệu cần giữ trước khi chuyển hẳn sang bản mới.

## Chạy local

Cần Node.js 24.x và npm.

```bash
npm install
npm run dev
```

Frontend chạy ở [http://localhost:3000](http://localhost:3000), API chạy ở cổng `4000`. Tạo tài khoản hoặc đăng nhập trong màn hình đầu tiên. Nếu Supabase yêu cầu xác nhận email, mở email để xác nhận trước khi đăng nhập.

## Deploy Hostinger

Frontend và API là hai workspace trong cùng monorepo; Hostinger triển khai chúng thành hai Node.js app riêng từ cùng GitHub repository.

- Frontend: Root directory `frontend`, framework Next.js, build `npm run build`; đặt `API_URL` trỏ tới URL backend cùng `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- API: Root directory `backend`, framework Express.js, start command `npm start`; cấu hình `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FRONTEND_URL`.
- Kết nối domain chính tới frontend và có thể dùng `api.tenmiencuaban.com` cho backend. Cập nhật `API_URL` của frontend theo URL API.
- Chọn Node.js 24.x trong Hostinger. Sau khi liên kết GitHub và bật tự deploy, các lần push lên branch đã chọn sẽ build lại ứng dụng.

Hostinger có Supabase Database Connect wizard; wizard đặt các biến kết nối nhưng không tự sửa code. Hãy kiểm tra tên biến trong hPanel và điền các biến đúng như dự án đang dùng.

## API

- `GET /api/health` — kiểm tra API, không cần đăng nhập.
- `GET /api/categories` — danh mục, cần bearer token Supabase.
- `GET /api/transactions?type=all|income|expense` — giao dịch của người đang đăng nhập.
- `POST`, `PATCH`, `DELETE /api/transactions` — thêm, sửa, xóa giao dịch của tài khoản hiện tại.
- `GET`, `POST`, `PATCH`, `DELETE /api/wallets` — quản lý ví; không xóa được ví còn giao dịch.
- `GET`, `POST`, `PATCH`, `DELETE /api/budgets` — quản lý ngân sách theo danh mục/tháng.
- `GET /api/summary` — tổng thu chi của tài khoản hiện tại.
