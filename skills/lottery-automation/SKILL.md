---
name: lottery-automation
description: Dùng khi người dùng hỏi kết quả xổ số, bảng kết quả xổ số, tra cứu kết quả hằng ngày của Miền Bắc, Miền Nam hoặc Miền Trung, dò vé số theo ngày và miền, hoặc khi cần đóng gói, kiểm thử workflow email xổ số chạy định kỳ.
---

# Skill xổ số

**Tên hiển thị:** Xổ số

Dùng skill này cho các workflow xổ số dựa trên script local trong workspace. Skill hiện hỗ trợ lấy bảng kết quả đầy đủ cho cả 3 miền và dò vé cho cả 3 miền bằng script chung. Ngoài ra còn có một script phụ để dò nhanh riêng cho Miền Trung.

## Khi nào dùng

- Người dùng muốn bảng kết quả đầy đủ cho Miền Bắc, Miền Nam hoặc Miền Trung
- Người dùng muốn tra kết quả xổ số của một ngày gần đây cụ thể
- Người dùng muốn dò vé số theo miền và ngày quay
- Người dùng muốn test, đóng gói hoặc vận hành workflow email xổ số chạy định kỳ

## Script chính

- `scripts/lottery_results.py`
  - Lấy và parse bảng kết quả theo miền và mã ngày `DDMMYYYY`
  - Hỗ trợ các miền: `mb`, `mn`, `mt`
  - Trả JSON có cấu trúc theo đài và từng giải

- `scripts/check_lottery_ticket.py`
  - Dò vé cho cả 3 miền: `mb`, `mn`, `mt`
  - Tự gọi lại `lottery_results.py` để lấy dữ liệu có cấu trúc trước khi so khớp
  - Trả JSON gồm danh sách lần khớp, đài, giải và số trúng khớp

- `scripts/check_xsmt_ticket.py`
  - Script phụ để dò nhanh riêng cho Miền Trung
  - Chỉ dùng khi thực sự cần workflow đặc thù cho Miền Trung

## Workflow chuẩn

### 1. Lấy bảng kết quả đầy đủ

Chạy:

```bash
python3 scripts/lottery_results.py --region <mb|mn|mt> --date-token DDMMYYYY
```

Cách dùng:

- `mb` cho Miền Bắc
- `mn` cho Miền Nam
- `mt` cho Miền Trung

Ưu tiên trả kết quả dưới dạng bảng sạch, HTML table hoặc bullet ngắn rõ ràng. Không dựa vào text tổng hợp thô nếu đã có dữ liệu parse có cấu trúc.

### 2. Dò vé cho cả 3 miền

Chạy:

```bash
python3 scripts/check_lottery_ticket.py --region <mb|mn|mt> --date-token DDMMYYYY --ticket <so_ve>
```

Quy tắc so khớp hiện tại của script:

- vé thực được chuẩn hóa theo tối đa 6 chữ số cuối
- nếu người dùng nhập ít hơn 6 số thì coi như nhập phần đuôi vé
- độ dài khớp theo từng giải:
  - giải tám: 2 số
  - giải bảy: 3 số
  - giải sáu: 4 số
  - giải năm: 5 số
  - giải tư: 5 số
  - giải ba: 5 số
  - giải nhì: 5 số
  - giải nhất: 5 số
  - giải đặc biệt: 6 số

Nếu người dùng chưa cung cấp đủ ngày hoặc miền thì phải hỏi lại, không được tự đoán.

Ví dụ:

- `09690 check` → hỏi lại ngày hoặc khoảng ngày và miền cần dò
- `09690 check miền nam` → hỏi lại ngày hoặc khoảng ngày cần dò trong Miền Nam

### 3. Dò nhanh riêng cho Miền Trung

Nếu cần dùng workflow riêng cho Miền Trung, chạy:

```bash
python3 scripts/check_xsmt_ticket.py <ticket> --section-id mt_kqngay_DDMMYYYY
```

Chỉ dùng script này khi thực sự cần logic thao tác theo section Miền Trung. Với nhu cầu dò vé thông thường, ưu tiên `check_lottery_ticket.py` vì nó bao phủ cả 3 miền.

## Quy tắc trả lời

- Ưu tiên dữ liệu parse có cấu trúc thay vì văn bản render thô từ trang
- Nếu trang nguồn chưa có đủ toàn bộ bảng kết quả thì nói rõ là kết quả chưa hoàn chỉnh
- Khi người dùng chỉ hỏi có trúng hay không, trả lời ngắn, rõ, đúng thực tế
- Khi cần email, có thể rút gọn câu chữ nhưng vẫn phải nêu rõ miền, ngày, và kết quả chính

## Workflow gửi email

Khi người dùng muốn gửi kết quả qua email, dùng script:

```bash
python3 skills/maton-mail/scripts/maton_mail.py ...
```

Ưu tiên:

- bảng HTML đầy đủ cho email gửi bảng kết quả
- câu chữ thật ngắn cho email báo trúng hoặc không trúng

## Ghi chú

- Nguồn dữ liệu hiện dựa trên các trang xổ số của xoso.com.vn
- Với job định kỳ, nên test script trực tiếp trước rồi mới nối vào cron
- Nếu cần bao phủ cả 3 miền, không nên mô tả mơ hồ là chỉ dò được Miền Trung
