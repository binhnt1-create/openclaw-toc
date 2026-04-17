#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

DEFAULT = {
    "bank": {
        "channel": "Gửi ngân hàng",
        "pros": ["ổn định", "rủi ro thấp", "dễ dự phóng"],
        "cons": ["upside thấp", "có thể thua lạm phát nếu lãi thấp"],
        "fit": "người ưu tiên an toàn vốn, gửi ngắn đến trung hạn",
    },
    "gold": {
        "channel": "Vàng",
        "pros": ["phòng thủ trước bất ổn", "giữ giá trị dài hạn tương đối"],
        "cons": ["biến động", "spread mua bán cao", "không tạo dòng tiền"],
        "fit": "người muốn phòng thủ, chấp nhận biến động giá",
    },
    "stocks": {
        "channel": "Chứng khoán",
        "pros": ["upside cao hơn", "hợp cho tăng trưởng dài hạn"],
        "cons": ["biến động mạnh", "cần chịu drawdown", "đòi hỏi kỷ luật"],
        "fit": "người có horizon dài hơn và chịu được rủi ro",
    },
}


def main():
    ap = argparse.ArgumentParser(description="Build investment channel comparison table")
    ap.add_argument("--signals-file", help="JSON file with current signals per channel")
    args = ap.parse_args()

    signals = {}
    if args.signals_file:
        signals = json.loads(Path(args.signals_file).read_text(encoding="utf-8"))

    rows = []
    for key in ["bank", "gold", "stocks"]:
        base = DEFAULT[key].copy()
        base["signal"] = signals.get(key, "chưa có tín hiệu cập nhật")
        rows.append(base)

    print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
