---
name: invest-channel-advisor
description: Dùng để so sánh các kênh đầu tư như gửi ngân hàng, mua vàng, chứng khoán và tài sản tương tự bằng web search, tổng hợp tín hiệu thị trường gần đây, rồi đưa ra nhận định có điều kiện thay vì khẳng định chắc chắn. Dùng khi người dùng hỏi nên để tiền vào đâu lúc này, gửi ngân hàng, vàng hay chứng khoán tốt hơn, hoặc muốn một bản so sánh nhanh các kênh đầu tư có căn cứ.
---

# Skill so sánh kênh đầu tư

**Tên hiển thị:** So sánh kênh đầu tư

Dùng skill này để so sánh nhanh các kênh đầu tư phổ biến dựa trên tín hiệu gần đây. Skill này phù hợp cho các câu hỏi kiểu nên chọn gửi ngân hàng, vàng hay chứng khoán, nhưng phải giữ giọng điệu thận trọng và không giả làm tư vấn tài chính cá nhân có cấp phép.

## Khi nào dùng

- Người dùng hỏi nên để tiền vào đâu lúc này
- Người dùng muốn so sánh gửi ngân hàng, vàng và chứng khoán
- Người dùng muốn một bản đánh giá nhanh có căn cứ, có điều kiện và có nêu rủi ro
- Người dùng cần một góc nhìn ngắn hạn hoặc trung hạn thay vì phân tích đầu tư chuyên sâu

## Thành phần chính

- `scripts/compare_channels.py`
  - Tạo bảng JSON so sánh mẫu cho 3 kênh mặc định: gửi ngân hàng, vàng, chứng khoán
  - Có thể nhận thêm `--signals-file` để đưa tín hiệu hiện tại vào từng kênh

- `references/checklist.md`
  - Checklist giúp giữ phép so sánh nhất quán và có kỷ luật

## Workflow chuẩn

### 1. Làm rõ bối cảnh người dùng

Nếu thiếu dữ kiện, hỏi hoặc tự ghi rõ giả định tối thiểu về:

- thời gian nắm giữ
- mức chịu rủi ro
- ưu tiên an toàn vốn hay tăng trưởng
- có cần thanh khoản cao không

### 2. Thu thập tín hiệu mới

Dùng web search hoặc nguồn hiện có để lấy tín hiệu gần đây cho từng kênh. Với bối cảnh Việt Nam, thông thường nên bao phủ ít nhất:

- tiền gửi ngân hàng
- vàng
- chứng khoán

### 3. Tạo bảng so sánh nền

Nếu cần một khung so sánh có cấu trúc, dùng:

```bash
python3 scripts/compare_channels.py
```

Nếu đã có tín hiệu hiện tại ở dạng JSON, dùng:

```bash
python3 scripts/compare_channels.py --signals-file signals.json
```

Script sẽ trả ra bảng JSON với các trường chính:

- `channel`
- `pros`
- `cons`
- `fit`
- `signal`

### 4. Kết luận theo điều kiện

Kết luận phải gắn với hoàn cảnh người dùng. Ưu tiên kiểu trả lời:

- nếu ưu tiên an toàn vốn thì ...
- nếu chấp nhận biến động để tìm upside thì ...
- nếu muốn phương án cân bằng thì ...

Không trả lời kiểu một công thức đúng cho mọi người.

## Quy tắc trả lời

- Không hứa hẹn lợi nhuận hoặc nói chắc chắn kênh nào sẽ thắng
- Không tự giả định khẩu vị rủi ro nếu người dùng chưa nói rõ
- Nếu dữ liệu còn mỏng, nhiễu hoặc thiên về cảm tính, phải nói rõ đây là góc nhìn tham khảo
- Nếu cần, thêm bảng ngắn: `kênh | lợi thế | rủi ro | phù hợp khi nào | tín hiệu hiện tại`
- Với bối cảnh Việt Nam, mặc định nên nhắc đủ ngân hàng, vàng và chứng khoán, trừ khi người dùng muốn phạm vi hẹp hơn

## Ghi chú

- Script hiện tại chỉ tạo khung so sánh mẫu, không tự đi thu thập tín hiệu thị trường
- Phần tín hiệu mới vẫn cần agent tự tổng hợp từ web search hoặc nguồn hiện có trước khi kết luận
