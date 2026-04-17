#!/usr/bin/env python3
import argparse
import json
import re
import urllib.request

URLS = {
    'mb': 'https://xoso.com.vn/xo-so-mien-bac/xsmb-p1.html',
    'mn': 'https://xoso.com.vn/xo-so-mien-nam/xsmn-p1.html',
    'mt': 'https://xoso.com.vn/xo-so-mien-trung/xsmt-p1.html',
}
PRIZE_MAP_MN_MT = {
    '8': 'Giải tám',
    '7': 'Giải bảy',
    '6': 'Giải sáu',
    '5': 'Giải năm',
    '4': 'Giải tư',
    '3': 'Giải ba',
    '2': 'Giải nhì',
    '1': 'Giải nhất',
    'ĐB': 'Giải đặc biệt',
}
PRIZE_MAP_MB = {
    'ĐB': 'Giải đặc biệt',
    '1': 'Giải nhất',
    '2': 'Giải nhì',
    '3': 'Giải ba',
    '4': 'Giải tư',
    '5': 'Giải năm',
    '6': 'Giải sáu',
    '7': 'Giải bảy',
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='replace')


def extract_mb_section(html: str, date_token: str) -> str:
    marker = f'<section class=section id=kqngay_{date_token}'
    start = html.find(marker)
    if start == -1:
        raise SystemExit(f'section not found for date {date_token}')
    next_start = html.find('<section class=section id=', start + len(marker))
    return html[start:] if next_start == -1 else html[start:next_start]


def extract_mn_mt_section(html: str, region: str, date_token: str) -> str:
    marker = f'<section class=section id={region}_kqngay_{date_token}'
    start = html.find(marker)
    if start == -1:
        # older sections may omit id on non-live block, fall back by matching date link nearby
        m = re.search(rf'<section class=section(?: id={region}_kqngay_{date_token})?.*?href=/xs{region}-' + date_token[0:2] + '-' + date_token[2:4] + '-' + date_token[4:] + r'\.html.*?(?=<section class=section|$)', html, re.S)
        if not m:
            raise SystemExit(f'section not found for region {region} date {date_token}')
        return m.group(0)
    next_start = html.find('<section class=section', start + len(marker))
    return html[start:] if next_start == -1 else html[start:next_start]


def parse_mn_mt(section: str):
    stations = re.findall(r'<th class=prize-col\d+><h3><a [^>]*>([^<]+)</a>', section)
    out = {s: {} for s in stations}
    for code, label in PRIZE_MAP_MN_MT.items():
        m = re.search(rf'<tr><th>{re.escape(code)}(.*?)(?=<tr><th>|</table>)', section, re.S)
        if not m:
            continue
        cells = m.group(1).split('<td>')[1:]
        for station, cell in zip(stations, cells):
            out[station][label] = re.findall(r'data-loto=([0-9]+)', cell)
    return out


def parse_mb(section: str):
    station = 'Miền Bắc'
    m_station = re.search(r'XSMB \d{2}/\d{2}/\d{4}</a> \(([^)]+)\)', section)
    if m_station:
        station = m_station.group(1)
    out = {station: {}}
    rows = re.findall(r'<tr>(.*?)(?=<tr>|</table>)', section, re.S)
    for row in rows:
        code_match = re.search(r'<td>(ĐB|[1-7])<', row)
        if not code_match:
            continue
        code = code_match.group(1)
        label = PRIZE_MAP_MB.get(code, code)
        values = re.findall(r'<span[^>]*>(\s*\d{2,5}\s*)</span>', row)
        cleaned = [v.strip() for v in values if v.strip().isdigit()]
        if cleaned:
            out[station][label] = cleaned
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--region', choices=['mb','mn','mt'], required=True)
    ap.add_argument('--date-token', required=True, help='DDMMYYYY, e.g. 15042026')
    args = ap.parse_args()

    html = fetch(URLS[args.region])
    if args.region == 'mb':
        section = extract_mb_section(html, args.date_token)
        results = parse_mb(section)
    else:
        section = extract_mn_mt_section(html, args.region, args.date_token)
        results = parse_mn_mt(section)
    print(json.dumps({'region': args.region, 'dateToken': args.date_token, 'results': results}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
