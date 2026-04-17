#!/usr/bin/env python3
import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

DRAW_ORDER = [
    ("Giải tám", 2, 1),
    ("Giải bảy", 3, 1),
    ("Giải sáu", 4, 3),
    ("Giải năm", 5, 1),
    ("Giải tư", 5, 7),
    ("Giải ba", 5, 2),
    ("Giải nhì", 5, 1),
    ("Giải nhất", 5, 1),
    ("Đặc biệt", 6, 1),
]

@dataclass
class Match:
    station: str
    prize: str
    matched_value: str


def parse_draws(raw: str):
    nums = re.findall(r"\d+", raw)
    out = []
    i = 0
    for prize, digits, count in DRAW_ORDER:
        values = []
        for _ in range(count):
            if i >= len(nums):
                break
            token = nums[i]
            i += 1
            token = token[-digits:]
            values.append(token)
        out.append((prize, values))
    return out


def check_ticket(ticket: str, station: str, raw: str):
    ticket = re.sub(r"\D", "", ticket)
    if not ticket:
        return None
    ticket = ticket[-6:]
    for prize, values in parse_draws(raw):
        for value in values:
            if ticket.endswith(value):
                return Match(station=station, prize=prize, matched_value=value)
    return None


def main():
    ap = argparse.ArgumentParser(description="Check lottery ticket against raw station results")
    ap.add_argument("ticket")
    ap.add_argument("--station", action="append", nargs=2, metavar=("NAME", "FILE"), required=True,
                    help="Station name and text file path")
    args = ap.parse_args()

    matches = []
    for name, file_path in args.station:
        raw = Path(file_path).read_text(encoding="utf-8")
        found = check_ticket(args.ticket, name, raw)
        if found:
            matches.append(found.__dict__)

    print(json.dumps({
        "ticket": args.ticket,
        "matches": matches,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
