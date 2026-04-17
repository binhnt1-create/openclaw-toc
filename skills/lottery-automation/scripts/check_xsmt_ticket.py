#!/usr/bin/env python3
import argparse
import json
import re
import urllib.request
from dataclasses import dataclass

XSMT_URL = "https://xoso.com.vn/xo-so-mien-trung/xsmt-p1.html"
PRIZE_MAP = {
    "8": ("Giải tám", 2),
    "7": ("Giải bảy", 3),
    "6": ("Giải sáu", 4),
    "5": ("Giải năm", 4),
    "4": ("Giải tư", 5),
    "3": ("Giải ba", 5),
    "2": ("Giải nhì", 5),
    "1": ("Giải nhất", 5),
    "ĐB": ("Giải đặc biệt", 6),
}
ROW_CODES = ["8", "7", "6", "5", "4", "3", "2", "1", "ĐB"]

@dataclass
class Match:
    station: str
    prize: str
    matched_value: str


def fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_section(html: str, section_id: str) -> str:
    marker = f'<section class=section id={section_id}'
    start = html.find(marker)
    if start == -1:
        raise SystemExit(f"section not found: {section_id}")
    next_start = html.find('<section class=section id=', start + len(marker))
    return html[start:] if next_start == -1 else html[start:next_start]


def parse_results(section_html: str):
    station_names = re.findall(r'<th class=prize-col\d+><h3><a [^>]*>([^<]+)</a>', section_html)
    results = {name: {} for name in station_names}
    for code in ROW_CODES:
        row_match = re.search(rf'<tr><th>{re.escape(code)}(.*?)(?=<tr><th>|</table>)', section_html, re.S)
        if not row_match:
            continue
        body = row_match.group(1)
        cells = body.split('<td>')[1:]
        for station, cell in zip(station_names, cells):
            values = re.findall(r'data-loto=([0-9]+)', cell)
            results[station][PRIZE_MAP[code][0]] = values
    return results


def check_ticket(ticket: str, results: dict):
    ticket = re.sub(r'\D', '', ticket)[-6:]
    matches = []
    for station, prizes in results.items():
        for prize, values in prizes.items():
            digits = next(v[1] for v in PRIZE_MAP.values() if v[0] == prize)
            for value in values:
                if ticket.endswith(value[-digits:]):
                    matches.append(Match(station=station, prize=prize, matched_value=value).__dict__)
    return matches


def main():
    ap = argparse.ArgumentParser(description="Check XSMT ticket from xoso.com.vn")
    ap.add_argument("ticket")
    ap.add_argument("--section-id", default="mt_kqngay_15042026")
    ap.add_argument("--url", default=XSMT_URL)
    ap.add_argument("--show-results", action="store_true")
    args = ap.parse_args()

    html = fetch_html(args.url)
    section_html = extract_section(html, args.section_id)
    results = parse_results(section_html)
    matches = check_ticket(args.ticket, results)
    out = {"ticket": args.ticket, "matches": matches}
    if args.show_results:
        out["results"] = results
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
