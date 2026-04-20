import json
import argparse
import re
import sys
from datetime import datetime, timedelta, timezone

# Ensure stdout uses UTF-8 to prevent Windows cp1258 encoding errors
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def get_vietnam_time():
    return datetime.now(timezone(timedelta(hours=7)))

def extract_amount(text):
    text = text.lower()
    
    # Convert formats like 50.000 or 50,000 to standard 50000 initially for direct matches
    cleaned_num = re.sub(r'(\d)[,\.](\d{3})', r'\1\2', text)
    
    # Check "tr rưỡi" / "củ rưỡi"
    match = re.search(r'(\d+(?:[\.,]\d+)?)\s*(?:tr|triệu|củ)\s*rưỡi', text)
    if match:
        val = float(match.group(1).replace(',', '.'))
        return int(val * 1000000 + 500000)
        
    # Check triệu/tr/m/củ
    match = re.search(r'(\d+(?:[\.,]\d+)?)\s*(?:triệu|tr|m\b|củ)', text)
    if match:
        val = float(match.group(1).replace(',', '.'))
        return int(val * 1000000)
        
    # Check trăm k / lít / lốp
    match = re.search(r'(\d+(?:[\.,]\d+)?)\s*(?:trăm|lít|lốp)', text)
    if match:
        val = float(match.group(1).replace(',', '.'))
        return int(val * 100000)
        
    # Check k/nghìn/ngàn
    match = re.search(r'(\d+(?:[\.,]\d+)?)\s*(?:k\b|nghìn|ngàn)', text)
    if match:
        val = float(match.group(1).replace(',', '.'))
        return int(val * 1000)
        
    # Standard numbers > 1000 without suffix
    match = re.search(r'\b(\d{4,})\b', cleaned_num)
    if match:
        return int(match.group(1))
        
    return 0

def extract_category(text):
    categories = {
        "Ăn uống": ["ăn", "uống", "phở", "cafe", "cà phê", "trà", "cơm", "nhậu", "quán"],
        "Di chuyển": ["xăng", "xe", "grab", "taxi", "vé", "bus", "parking", "bãi"],
        "Hóa đơn": ["bill", "điện", "nước", "internet", "thuê nhà", "tiền nhà"],
        "Sức khỏe": ["thuốc", "khám", "bệnh viện", "spa", "nha khoa"],
        "Mua sắm": ["mua", "áo", "quần", "giày", "shopee", "lazada", "tiki"],
        "Giải trí": ["karaoke", "phim", "game", "bar", "club", "nhạc", "vui chơi", "bi-a", "bowling"],
        "Học tập": ["học", "sách", "phí", "trường", "lớp"],
        "Gia đình": ["con", "bỉm", "sữa", "gia đình", "biếu", "cho", "gửi", "bố mẹ"],
        "Thu nhập": ["lương", "thưởng", "thu nhập", "nhận"]
    }
    
    text_lower = text.lower()
    for cat, keywords in categories.items():
        for kw in keywords:
            if kw in text_lower:
                return cat
    return "Khác"

def extract_date(text):
    now = get_vietnam_time()
    text_lower = text.lower()
    
    if "hôm qua" in text_lower:
        now = now - timedelta(days=1)
    elif "hôm kia" in text_lower:
        now = now - timedelta(days=2)
    else:
        # Check explicit day like "mùng 5", "ngày 12"
        match = re.search(r'(?:ngày|mùng)\s*(\d{1,2})', text_lower)
        if match:
            day = int(match.group(1))
            try:
                now = now.replace(day=day)
            except ValueError:
                pass
                
    return now.strftime('%d/%m/%Y')

def _col(r, g, b):
    return {"red": r, "green": g, "blue": b}

def _solid_border(r=0.75, g=0.75, b=0.75):
    return {"style": "SOLID", "color": _col(r, g, b)}

def _cell(value=None, fmt=None, is_formula=False):
    """Build an updateCells value entry. value can be str/number/None."""
    entry = {}
    if value is not None and value != "":
        if is_formula or (isinstance(value, str) and value.startswith("=")):
            entry["userEnteredValue"] = {"formulaValue": value}
        elif isinstance(value, (int, float)):
            entry["userEnteredValue"] = {"numberValue": value}
        else:
            entry["userEnteredValue"] = {"stringValue": str(value)}
    if fmt:
        entry["userEnteredFormat"] = fmt
    return entry

def generate_format_payload(month_year):
    BLUE = _col(0.08, 0.39, 0.75)
    WHITE = _col(1, 1, 1)
    LIGHT_GRAY = _col(0.95, 0.95, 0.95)
    SOFT_BLUE = _col(0.92, 0.95, 0.99)
    DARK_TEXT = _col(0.15, 0.15, 0.15)

    VND = {"type": "CURRENCY", "pattern": "#,##0\" ₫\""}
    PCT = {"type": "NUMBER", "pattern": "0.0\"%\""}

    hdr_fmt = {
        "backgroundColor": BLUE,
        "textFormat": {"foregroundColor": WHITE, "bold": True, "fontSize": 11},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE",
    }
    section_title_fmt = {
        "backgroundColor": BLUE,
        "textFormat": {"foregroundColor": WHITE, "bold": True, "fontSize": 12},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE",
    }
    section_sub_fmt = {
        "backgroundColor": LIGHT_GRAY,
        "textFormat": {"foregroundColor": DARK_TEXT, "bold": True, "fontSize": 11},
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE",
    }
    label_bold_fmt = {
        "backgroundColor": SOFT_BLUE,
        "textFormat": {"bold": True},
        "verticalAlignment": "MIDDLE",
    }
    label_plain_fmt = {"verticalAlignment": "MIDDLE"}
    value_vnd_fmt = {"numberFormat": VND, "horizontalAlignment": "RIGHT", "verticalAlignment": "MIDDLE"}
    value_pct_fmt = {"numberFormat": PCT, "horizontalAlignment": "RIGHT", "verticalAlignment": "MIDDLE"}
    value_vnd_bold_fmt = {"numberFormat": VND, "horizontalAlignment": "RIGHT", "verticalAlignment": "MIDDLE",
                          "backgroundColor": SOFT_BLUE, "textFormat": {"bold": True}}

    col_widths = [
        (0, 1, 110),   # A: Ngày
        (1, 2, 280),   # B: Nội Dung
        (2, 3, 140),   # C: Số Tiền
        (3, 4, 130),   # D: Phân Loại
        (4, 5, 30),    # E: spacer
        (5, 6, 220),   # F: Tổng kết label
        (6, 7, 170),   # G: Tổng kết value
    ]

    requests = []

    # Column widths
    for start, end, px in col_widths:
        requests.append({
            "updateDimensionProperties": {
                "range": {"dimension": "COLUMNS", "startIndex": start, "endIndex": end},
                "properties": {"pixelSize": px},
                "fields": "pixelSize"
            }
        })

    # Header row height
    requests.append({
        "updateDimensionProperties": {
            "range": {"dimension": "ROWS", "startIndex": 0, "endIndex": 1},
            "properties": {"pixelSize": 36},
            "fields": "pixelSize"
        }
    })

    # Freeze header
    requests.append({
        "updateSheetProperties": {
            "properties": {"gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount"
        }
    })

    # ====== DATA TABLE (A:D) ======
    # Header row A1:D1 — values + format
    header_labels = ["Ngày", "Nội Dung", "Số Tiền", "Phân Loại"]
    requests.append({
        "updateCells": {
            "start": {"rowIndex": 0, "columnIndex": 0},
            "rows": [{"values": [_cell(h, hdr_fmt) for h in header_labels]}],
            "fields": "userEnteredValue,userEnteredFormat"
        }
    })

    # Column C (Số Tiền) — currency VND for ALL rows (so data rows auto-format)
    requests.append({
        "repeatCell": {
            "range": {"startRowIndex": 1, "startColumnIndex": 2, "endColumnIndex": 3},
            "cell": {"userEnteredFormat": {"numberFormat": VND, "horizontalAlignment": "RIGHT"}},
            "fields": "userEnteredFormat(numberFormat,horizontalAlignment)"
        }
    })

    # Column A (Ngày) center align
    requests.append({
        "repeatCell": {
            "range": {"startRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": 1},
            "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
            "fields": "userEnteredFormat.horizontalAlignment"
        }
    })

    # Column D (Phân Loại) center align
    requests.append({
        "repeatCell": {
            "range": {"startRowIndex": 1, "startColumnIndex": 3, "endColumnIndex": 4},
            "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
            "fields": "userEnteredFormat.horizontalAlignment"
        }
    })

    # Borders for data area (first 50 rows is enough visually)
    requests.append({
        "updateBorders": {
            "range": {"startRowIndex": 0, "endRowIndex": 50, "startColumnIndex": 0, "endColumnIndex": 4},
            "innerHorizontal": _solid_border(),
            "innerVertical": _solid_border(),
            "top": _solid_border(0.5, 0.5, 0.5),
            "bottom": _solid_border(0.5, 0.5, 0.5),
            "left": _solid_border(0.5, 0.5, 0.5),
            "right": _solid_border(0.5, 0.5, 0.5)
        }
    })

    # ====== SUMMARY BLOCK (F1:G17) ======
    # Merge title cells
    requests.append({
        "mergeCells": {
            "range": {"startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 5, "endColumnIndex": 7},
            "mergeType": "MERGE_ALL"
        }
    })
    requests.append({
        "mergeCells": {
            "range": {"startRowIndex": 7, "endRowIndex": 8, "startColumnIndex": 5, "endColumnIndex": 7},
            "mergeType": "MERGE_ALL"
        }
    })

    # Build summary rows with values + formats in updateCells
    summary_rows = [
        # (label, label_fmt, value, value_fmt)
        ("💰 TỔNG KẾT THÁNG " + month_year, section_title_fmt, None, section_title_fmt),
        ("Ngân Sách Khả Dụng", label_bold_fmt, None, value_vnd_bold_fmt),
        ("Tổng Đã Chi", label_bold_fmt, "=SUM(C2:C9999)", value_vnd_fmt),
        ("Số Dư Còn Lại", label_bold_fmt, "=G2-G3", value_vnd_fmt),
        ("% Đã Sử Dụng", label_bold_fmt, "=IF(G2>0,ROUND(G3/G2*100,1),0)", value_pct_fmt),
        ("% Còn Lại", label_bold_fmt, "=IF(G2>0,ROUND(G4/G2*100,1),0)", value_pct_fmt),
        ("", None, None, None),
        ("📈 CHI TIÊU THEO DANH MỤC", section_sub_fmt, None, section_sub_fmt),
        ("Ăn uống", label_plain_fmt, '=SUMIF(D:D,"Ăn uống",C:C)', value_vnd_fmt),
        ("Di chuyển", label_plain_fmt, '=SUMIF(D:D,"Di chuyển",C:C)', value_vnd_fmt),
        ("Hóa đơn", label_plain_fmt, '=SUMIF(D:D,"Hóa đơn",C:C)', value_vnd_fmt),
        ("Sức khỏe", label_plain_fmt, '=SUMIF(D:D,"Sức khỏe",C:C)', value_vnd_fmt),
        ("Mua sắm", label_plain_fmt, '=SUMIF(D:D,"Mua sắm",C:C)', value_vnd_fmt),
        ("Giải trí", label_plain_fmt, '=SUMIF(D:D,"Giải trí",C:C)', value_vnd_fmt),
        ("Học tập", label_plain_fmt, '=SUMIF(D:D,"Học tập",C:C)', value_vnd_fmt),
        ("Gia đình", label_plain_fmt, '=SUMIF(D:D,"Gia đình",C:C)', value_vnd_fmt),
        ("Khác", label_plain_fmt, '=SUMIF(D:D,"Khác",C:C)', value_vnd_fmt),
    ]

    rows_payload = []
    for label, lfmt, value, vfmt in summary_rows:
        rows_payload.append({
            "values": [
                _cell(label, lfmt),
                _cell(value, vfmt, is_formula=isinstance(value, str) and value.startswith("="))
            ]
        })

    requests.append({
        "updateCells": {
            "start": {"rowIndex": 0, "columnIndex": 5},
            "rows": rows_payload,
            "fields": "userEnteredValue,userEnteredFormat"
        }
    })

    # Borders on summary block
    requests.append({
        "updateBorders": {
            "range": {"startRowIndex": 0, "endRowIndex": 17, "startColumnIndex": 5, "endColumnIndex": 7},
            "innerHorizontal": _solid_border(),
            "innerVertical": _solid_border(),
            "top": _solid_border(0.5, 0.5, 0.5),
            "bottom": _solid_border(0.5, 0.5, 0.5),
            "left": _solid_border(0.5, 0.5, 0.5),
            "right": _solid_border(0.5, 0.5, 0.5)
        }
    })

    payload = {
        "note": "GỬI NGUYÊN JSON NÀY vào 1 tool call spreadsheets.batchUpdate (trường 'requests'). TẤT CẢ value + format đã gói sẵn trong updateCells — KHÔNG CẦN gọi values.update cho setup. Sau đó chỉ việc values.append để thêm dòng chi tiêu. sheetId bạn tự lấy sau khi tạo sheet.",
        "requests": requests
    }
    return payload

def main():
    parser = argparse.ArgumentParser(description="Expense Manager Helper Script")
    parser.add_argument('action', choices=['parse', 'format'], help="Action to perform")
    parser.add_argument('--text', type=str, help="User input text to parse")
    parser.add_argument('--month', type=str, help="Month year for formatting payload (MM/YYYY)")
    
    args = parser.parse_args()
    
    if args.action == 'parse':
        if not args.text:
            print(json.dumps({"error": "Missing --text argument"}))
            return
            
        amount = extract_amount(args.text)
        category = extract_category(args.text)
        date = extract_date(args.text)
        
        result = {
            "parsed": True,
            "date": date,
            "category": category,
            "amount": amount,
            "original_text": args.text
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    elif args.action == 'format':
        if not args.month:
            print(json.dumps({"error": "Missing --month argument"}))
            return
            
        payload = generate_format_payload(args.month)
        print(json.dumps(payload, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
