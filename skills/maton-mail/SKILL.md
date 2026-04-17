---
name: maton-mail
description: Dùng để kết nối và thao tác mail qua Maton API, ưu tiên các flow OAuth được Maton quản lý như connect Gmail, đọc email, gửi email và đồng bộ tài khoản nếu Maton đã xử lý OAuth hộ. Dùng khi người dùng nhắc tới Maton API, muốn kết nối Gmail một chạm qua Maton, hoặc muốn một skill tái sử dụng cho các thao tác mail do Maton quản lý.
---

# Skill Maton Mail

**Tên hiển thị:** Maton Mail

Dùng skill này khi cần thao tác email thông qua Maton API, đặc biệt là các workflow Gmail hoặc Google Workspace đã được Maton đứng giữa xử lý OAuth và gateway. Skill này phù hợp cho các job gửi mail tự động, kiểm tra kết nối hoặc dựng payload gửi mail qua Gmail API proxy.

## Khi nào dùng

- Người dùng muốn gửi email qua Maton
- Người dùng muốn kiểm tra kết nối Gmail hoặc Google Workspace qua Maton
- Người dùng muốn tạo workflow mail tái sử dụng dựa trên Maton API
- Có script local hoặc automation đang phụ thuộc vào Maton gateway

## Thành phần chính

- `scripts/maton_mail.py`
  - Script helper cho Maton Gmail
  - Hỗ trợ các lệnh: `connections`, `connect-url`, `list-messages`, `send`
  - Có fallback lấy API key từ biến môi trường hoặc file local

- `references/maton-notes.md`
  - Lưu endpoint đã xác minh và các ghi chú tích hợp

## Cách script hoạt động

Script hiện dùng các base URL cố định:

- `https://ctrl.maton.ai`
- `https://gateway.maton.ai/google-mail`

Cơ chế xác thực:

- ưu tiên `--api-key`
- sau đó tới biến môi trường `MATON_API_KEY`
- sau đó thử đọc từ các file local như `~/.maton_api_key`, `.maton_api_key`, hoặc `secrets/maton_api_key.txt`

## Workflow chuẩn

### 1. Kiểm tra connection hiện có

Chạy:

```bash
python3 scripts/maton_mail.py connections
```

Dùng để xem các connection đang active cho app `google-mail`.

### 2. Tạo connect URL

Chạy:

```bash
python3 scripts/maton_mail.py connect-url
```

Nếu cần redirect URI cụ thể:

```bash
python3 scripts/maton_mail.py connect-url --redirect-uri https://example.com/callback
```

### 3. Liệt kê message

Chạy:

```bash
python3 scripts/maton_mail.py list-messages --max-results 10
```

### 4. Gửi email

Chạy:

```bash
python3 scripts/maton_mail.py send --to user@example.com --subject "Tiêu đề"
```

Có thể dùng:

- `--body` cho text ngắn
- `--body-file` để lấy nội dung text từ file
- `--html-file` để gửi HTML body
- `--from` nếu cần chỉ định địa chỉ gửi
- `--dry-run` để xem trước payload mà chưa gửi thật

Script sẽ dựng MIME email, base64-url encode thành trường `raw`, rồi gửi tới endpoint:

```text
gmail/v1/users/me/messages/send
```

## Quy tắc sử dụng

- Chỉ dùng khi workflow thực sự nhắm vào Maton API, không tự suy diễn endpoint nếu chưa xác minh
- Ưu tiên request gọn và đủ thông tin, tránh spam endpoint
- Nếu cần thăm dò tích hợp, nên bắt đầu bằng kiểm tra connection hoặc `--dry-run`
- Không gửi mail thật nếu chưa chắc API key, endpoint hoặc payload đang đúng

## Ghi chú

- Script này đang phục vụ tốt cho các job gửi email HTML tự động trong workspace
- Nếu Maton thay đổi endpoint hoặc cách auth, cần cập nhật lại cả script lẫn `references/maton-notes.md`
