---
name: bank-rate-search
description: Dùng để tra cứu và so sánh lãi suất ngân hàng bằng search và scraping web tự xây, không cần API, rồi tổng hợp kết quả ngắn gọn có nguồn và ưu tiên dữ liệu đúng thời gian. Dùng khi cần tìm lãi suất tiền gửi hoặc tiết kiệm hiện tại, so sánh ngân hàng nào có lãi suất tốt hơn, kiểm tra lãi suất theo kỳ hạn, hoặc truy vấn theo mốc thời gian như hiện tại, trong năm nay, hay từ đầu năm đến nay.
---

# Skill tra cứu lãi suất ngân hàng

**Tên hiển thị:** Tra cứu lãi suất ngân hàng

Dùng skill này để tìm, trích xuất và so sánh lãi suất tiền gửi hoặc tiết kiệm từ web. Workflow hiện tại không dùng API trả phí mà dựa trên tìm kiếm web, xếp hạng nguồn, rồi đọc nội dung từ từng trang phù hợp.

## Dùng khi nào

- Người dùng hỏi lãi suất tiết kiệm hoặc tiền gửi hiện tại
- Người dùng muốn biết ngân hàng nào đang có lãi suất tốt hơn cho một kỳ hạn cụ thể
- Người dùng muốn so sánh tiết kiệm online, tại quầy, hoặc sản phẩm tương tự
- Người dùng hỏi theo mốc thời gian như hiện tại, trong năm nay, hoặc từ đầu năm đến nay

## Công cụ dùng trong skill

- `scripts/web_search.py`
  - Dùng để tìm các nguồn trên web
  - Đây là lớp tìm kiếm nền cho các luồng còn lại

- `scripts/extract_bank_rates.py`
  - Dùng để đọc một nguồn cụ thể và trích xuất các mức lãi suất có khả năng phù hợp
  - Chọn công cụ này khi đã có sẵn một URL hoặc cần xác minh sâu một nguồn

- `scripts/search_bank_rates.py`
  - Dùng cho tra cứu lãi suất hiện tại theo kiểu thông thường
  - Đây là công cụ chính khi cần tìm và tổng hợp nhanh từ nhiều nguồn

- `scripts/search_bank_rates_timeaware.py`
  - Dùng khi câu hỏi nhấn mạnh độ mới của dữ liệu
  - Chọn công cụ này khi cần ưu tiên nguồn thuộc năm hiện tại hoặc rất gần hiện tại

- `references/sources.md`
  - Dùng khi cần xem lại quy tắc ưu tiên nguồn và cách xử lý nguồn phụ

## Workflow chuẩn

### 1. Làm rõ nhu cầu tra cứu

Nếu yêu cầu còn mơ hồ, làm rõ trước:

- sản phẩm online hay tại quầy
- kỳ hạn bao nhiêu tháng
- số tiền có quan trọng không
- nhận lãi cuối kỳ hay định kỳ
- người dùng cần dữ liệu tham khảo nhanh hay cần kiểm tra kỹ hơn

### 2. Tra cứu lãi suất hiện tại

Dùng `search_bank_rates.py` để:

- tìm kiếm web
- xếp hạng kết quả theo độ phù hợp và độ chính thống của nguồn
- mở từng nguồn tốt nhất
- trích xuất các mức lãi suất có khả năng phù hợp

### 3. Tra cứu nhạy thời gian

Nếu câu hỏi nhấn mạnh độ mới của dữ liệu, dùng `search_bank_rates_timeaware.py`. Luồng này phù hợp khi cần ưu tiên kết quả có dấu hiệu thuộc năm hiện tại hoặc rất gần hiện tại.

### 4. Kiểm tra sâu một nguồn cụ thể

Nếu đã có sẵn một trang hoặc cần xác minh thủ công một nguồn, dùng `extract_bank_rates.py`.

## Quy tắc trả lời

- Luôn ghi ngày tra cứu nếu câu hỏi là về dữ liệu hiện tại
- Ưu tiên nguồn chính thức của ngân hàng trước nguồn báo tổng hợp
- Nếu nguồn là nguồn phụ thì phải ghi rõ
- Không khẳng định là “tốt nhất” nếu chưa so từ đủ nhiều nguồn phù hợp
- Nếu dữ liệu chưa rõ độ mới hoặc có điều kiện áp dụng phức tạp, phải nói rõ điều đó
- Khi có điều kiện như chỉ áp dụng online, số tiền tối thiểu, hoặc kỳ hạn giới hạn, cần nêu ngắn gọn

## Mẫu truy vấn gợi ý

- `lai suat tiet kiem online 6 thang ngan hang viet nam`
- `lai suat tiet kiem cao nhat 12 thang site:*.vn`
- `site:vcb.com.vn lãi suất tiền gửi 3 tháng`
- `site:bidv.com.vn biểu lãi suất tiết kiệm online`
- `site:agribank.com.vn lãi suất tiết kiệm`

## Ghi chú

- Đây là workflow scraping và tổng hợp, không phải feed dữ liệu lãi suất chính thức theo API
- Nếu câu hỏi mang tính quyết định tài chính thực tế, nên khuyên người dùng kiểm tra lại trang ngân hàng trước khi hành động
