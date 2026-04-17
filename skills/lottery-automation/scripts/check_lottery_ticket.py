#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import re
import subprocess

PRIZE_DIGITS = {
    'Giải tám': 2,
    'Giải bảy': 3,
    'Giải sáu': 4,
    'Giải năm': 5,
    'Giải tư': 5,
    'Giải ba': 5,
    'Giải nhì': 5,
    'Giải nhất': 5,
    'Giải đặc biệt': 6,
}


def load_results(region: str, date_token: str):
    script_path = str(Path(__file__).resolve().parent / 'lottery_results.py')
    out = subprocess.check_output([
        'python3',
        script_path,
        '--region', region,
        '--date-token', date_token,
    ], text=True)
    return json.loads(out)['results']


def check_ticket(ticket: str, results: dict):
    ticket = re.sub(r'\D', '', ticket)[-6:]
    matches = []
    for station, prizes in results.items():
        for prize, values in prizes.items():
            digits = PRIZE_DIGITS.get(prize)
            if not digits:
                continue
            for value in values:
                if ticket.endswith(value[-digits:]):
                    matches.append({
                        'station': station,
                        'prize': prize,
                        'matched_value': value,
                    })
    return matches


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--region', choices=['mb', 'mn', 'mt'], required=True)
    ap.add_argument('--date-token', required=True)
    ap.add_argument('--ticket', required=True)
    args = ap.parse_args()

    results = load_results(args.region, args.date_token)
    matches = check_ticket(args.ticket, results)
    print(json.dumps({
        'region': args.region,
        'dateToken': args.date_token,
        'ticket': args.ticket,
        'matches': matches,
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
