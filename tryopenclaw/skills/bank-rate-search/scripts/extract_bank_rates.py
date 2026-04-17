#!/usr/bin/env python3
import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
RATE_RE = re.compile(r"(?<!\d)(\d{1,2}[\.,]\d{1,2}|\d{1,2})\s*%")
TERM_RE = re.compile(r"(1|2|3|4|5|6|7|8|9|10|11|12|13|15|18|24|36)\s*(tháng|thang|th|month|months)", re.I)
KEYWORDS = [
    "lãi suất", "lai suat", "tiết kiệm", "tiet kiem", "tiền gửi", "tien gui", "online", "kỳ hạn", "ky han"
]
NEGATIVE_HINTS = [
    "vay", "cho vay", "apr", "next_f.push", "khuyến mại", "khuyen mai", "ưu đãi", "uu dai", "thẻ", "the", "bảo hiểm", "bao hiem"
]


class MiniSoup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texts = []

    def handle_data(self, data):
        text = " ".join(data.split())
        if text:
            self.texts.append(text)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as resp:
        raw = resp.read()
        charset = resp.headers.get_content_charset()
        if charset and "," in charset:
            charset = charset.split(",", 1)[0].strip()
        for enc in [charset, "utf-8", "utf-8-sig", "cp1258", "latin-1"]:
            if not enc:
                continue
            try:
                return raw.decode(enc, errors="replace")
            except Exception:
                pass
        return raw.decode("utf-8", errors="replace")


def html_to_text(html):
    parser = MiniSoup()
    parser.feed(html)
    return "\n".join(parser.texts)


def normalize_rate(raw):
    try:
        return float(raw.replace(",", "."))
    except Exception:
        return None


def extract_candidates(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    out = []
    for line in lines:
        lower = line.lower()
        if not any(k in lower for k in KEYWORDS):
            continue
        if any(bad in lower for bad in NEGATIVE_HINTS):
            continue
        rates = RATE_RE.findall(line)
        if not rates:
            continue
        term_match = TERM_RE.search(line)
        for rate_raw in rates:
            rate = normalize_rate(rate_raw)
            if rate is None or rate <= 0 or rate > 15:
                continue
            out.append({
                "termMonths": int(term_match.group(1)) if term_match else None,
                "ratePercent": rate,
                "text": line,
            })
    return out


def score_candidate(item):
    text = item["text"].lower()
    score = 0
    if item.get("termMonths"):
        score += 3
    if "online" in text:
        score += 2
    if "cuối kỳ" in text or "cuoi ky" in text:
        score += 1
    if "tiết kiệm" in text or "tiet kiem" in text:
        score += 2
    if "lãi suất" in text or "lai suat" in text:
        score += 2
    if any(bad in text for bad in NEGATIVE_HINTS):
        score -= 5
    return score


def dedupe(items):
    seen = set()
    out = []
    for item in sorted(items, key=lambda x: (-score_candidate(x), x.get("termMonths") or 999, -x["ratePercent"])):
        key = (item.get("termMonths"), item["ratePercent"], item["text"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def main():
    ap = argparse.ArgumentParser(description="Extract bank rate candidates from a web page")
    ap.add_argument("url")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    try:
        html = fetch(args.url)
        text = html_to_text(html)
        candidates = dedupe(extract_candidates(text))
    except Exception as e:
        print(f"extract failed: {e}", file=sys.stderr)
        sys.exit(1)

    payload = {
        "url": args.url,
        "fetchedAt": int(time.time()),
        "candidates": candidates[:30],
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"URL: {args.url}")
    if not candidates:
        print("No rate candidates found")
        return
    for i, item in enumerate(candidates[:15], 1):
        term = f"{item['termMonths']} tháng" if item.get("termMonths") else "không rõ kỳ hạn"
        print(f"{i}. {item['ratePercent']}% | {term}")
        print(f"   {item['text']}")


if __name__ == "__main__":
    main()
