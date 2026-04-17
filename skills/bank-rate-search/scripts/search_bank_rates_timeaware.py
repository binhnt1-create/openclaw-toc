#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
WEB_SEARCH = ROOT / "web_search.py"
EXTRACT = ROOT / "extract_bank_rates.py"
CURRENT_YEAR = dt.datetime.now().year
DATE_PATTERNS = [
    re.compile(r"\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b"),
    re.compile(r"tháng\s*(\d{1,2})\s*[/-]\s*(20\d{2})", re.I),
    re.compile(r"(20\d{2})"),
]
OFFICIAL_DOMAINS = [
    "vietcombank.com.vn", "bidv.com.vn", "vietinbank.vn", "agribank.com.vn", "mbbank.com.vn",
    "techcombank.com", "acb.com.vn", "tpb.vn", "vpbank.com.vn", "hdbank.com.vn", "seabank.com.vn",
    "sacombank.com.vn", "cake.vn",
]


def run_json(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "command failed")
    return json.loads(proc.stdout)


def parse_date(text):
    if not text:
        return None
    for pat in DATE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        try:
            if pat.pattern.startswith("\\b(20"):
                y, mo, d = map(int, m.groups())
                return dt.date(y, mo, d)
            if pat.pattern.startswith("\\b(\\d{1,2})"):
                d, mo, y = map(int, m.groups())
                return dt.date(y, mo, d)
            if "tháng" in pat.pattern:
                mo, y = map(int, m.groups())
                return dt.date(y, mo, 1)
            y = int(m.group(1))
            return dt.date(y, 1, 1)
        except Exception:
            continue
    return None


def is_official(domain):
    return any(domain == d or domain.endswith('.' + d) for d in OFFICIAL_DOMAINS)


def domain(url):
    return urlparse(url).netloc.lower()


def score_result(item, query, year_to_date=False):
    score = 0
    text = (item.get('title', '') + ' ' + item.get('url', '')).lower()
    d = parse_date(item.get('title', ''))
    if is_official(item.get('domain', '')):
        score += 10
    if 'lãi suất' in text or 'lai suat' in text:
        score += 4
    if 'tiết kiệm' in text or 'tiet kiem' in text:
        score += 3
    if d:
        if d.year == CURRENT_YEAR:
            score += 5
        elif year_to_date:
            score -= 10
    return score


def main():
    ap = argparse.ArgumentParser(description="Time-aware bank rate search")
    ap.add_argument("query")
    ap.add_argument("--max-results", type=int, default=5)
    ap.add_argument("--year-to-date", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    try:
        search = run_json([sys.executable, str(WEB_SEARCH), args.query, "--max-results", str(max(args.max_results * 2, 8)), "--json"])
        enriched = []
        for item in search.get('results', []):
            item['dateHint'] = parse_date(item.get('title', ''))
            item['score'] = score_result(item, args.query, year_to_date=args.year_to_date)
            enriched.append(item)
        ranked = sorted(enriched, key=lambda x: x['score'], reverse=True)[: args.max_results]
        output = []
        for item in ranked:
            try:
                extracted = run_json([sys.executable, str(EXTRACT), item['url'], '--json'])
                candidates = extracted.get('candidates', [])[:10]
                extract_error = None
            except Exception as e:
                candidates = []
                extract_error = str(e)
            output.append({
                'title': item['title'],
                'url': item['url'],
                'domain': item['domain'],
                'official': is_official(item['domain']),
                'dateHint': item['dateHint'].isoformat() if item['dateHint'] else None,
                'score': item['score'],
                'candidates': candidates,
                'extractError': extract_error,
            })
        payload = {
            'query': args.query,
            'generatedAt': dt.datetime.now().isoformat(),
            'yearToDate': args.year_to_date,
            'results': output,
        }
    except Exception as e:
        print(f"search_bank_rates_timeaware failed: {e}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"Query: {args.query}")
    print(f"Generated at: {payload['generatedAt']}")
    for i, item in enumerate(output, 1):
        badge = 'official' if item['official'] else 'reference'
        date_hint = item['dateHint'] or 'unknown-date'
        print(f"{i}. {item['title']} [{badge}] [{date_hint}]")
        print(f"   {item['url']}")
        for cand in item['candidates'][:3]:
            term = f"{cand['termMonths']} tháng" if cand.get('termMonths') else 'không rõ kỳ hạn'
            print(f"   - {cand['ratePercent']}% | {term} | {cand['text'][:140]}")


if __name__ == '__main__':
    main()
