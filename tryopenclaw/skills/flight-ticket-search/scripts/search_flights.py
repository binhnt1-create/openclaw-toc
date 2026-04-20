#!/usr/bin/env python3
"""Generate deep links for Vietnamese flight booking sites."""
import json
import argparse
import sys
import re
import urllib.parse
from datetime import date
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
AIRPORTS_FILE = ROOT / "references" / "airports.json"


def load_airports():
    try:
        with open(AIRPORTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f).get("vietnam_airports", [])
    except Exception as e:
        print(f"Error loading airports: {e}", file=sys.stderr)
        return []


def get_airport_info(query, airports):
    q = str(query).lower().strip()
    for ap in airports:
        if q == ap["code"].lower() or q in ap["aliases"]:
            return ap
    # Partial match fallback (e.g. "saigon" matches "sai gon")
    for ap in airports:
        for alias in ap["aliases"]:
            if q in alias or alias in q:
                return ap
    return None


def suggest_airports(query, airports, limit=5):
    """Return short list of airport hints for error messages."""
    q = str(query).lower().strip()
    hits = []
    for ap in airports:
        for alias in ap["aliases"]:
            if q and (q[0] == alias[0] or q[:2] in alias):
                hits.append(f"{ap['code']} ({ap['city']})")
                break
        if len(hits) >= limit:
            break
    return hits or [f"{ap['code']} ({ap['city']})" for ap in airports[:limit]]


def parse_date(s):
    """Parse DD/MM/YYYY or DD-MM-YYYY into a date object."""
    if not s:
        return None
    s_norm = s.replace("/", "-").strip()
    if not re.match(r"^\d{1,2}-\d{1,2}-\d{4}$", s_norm):
        return None
    try:
        d, m, y = s_norm.split("-")
        return date(int(y), int(m), int(d))
    except ValueError:
        return None


def emit_error(msg, as_json):
    payload = {"status": "error", "error": msg}
    print(json.dumps(payload, ensure_ascii=False) if as_json else msg)
    sys.exit(1)


def build_links(ori, dest, depart, return_date):
    """Build deep links for Traveloka, BestPrice, Skyscanner."""
    # Traveloka: dt=DD-MM-YYYY.DD-MM-YYYY for round-trip, dt=DD-MM-YYYY.NA for one-way
    tvl_depart = depart.strftime("%d-%m-%Y")
    tvl_return = return_date.strftime("%d-%m-%Y") if return_date else "NA"
    traveloka = (
        "https://www.traveloka.com/vi-vn/flight/fullsearch"
        f"?ap={ori['code']}.{dest['code']}"
        f"&dt={tvl_depart}.{tvl_return}"
        "&ps=1.0.0&sc=ECONOMY"
    )

    # BestPrice: From/To use "City (CODE)", Depart/Return DD/MM/YYYY
    bp_from = urllib.parse.quote_plus(f"{ori['city']} ({ori['code']})")
    bp_to = urllib.parse.quote_plus(f"{dest['city']} ({dest['code']})")
    bp_depart = urllib.parse.quote(depart.strftime("%d/%m/%Y"), safe='')
    bp_return = urllib.parse.quote(return_date.strftime("%d/%m/%Y"), safe='') if return_date else ""
    bestprice = (
        "https://www.bestprice.vn/ve-may-bay/tim-kiem-ve"
        f"?From={bp_from}&To={bp_to}"
        f"&Depart={bp_depart}&Return={bp_return}"
        "&ADT=1&CHD=0&INF=0&is_search_cheapest=0"
    )

    # Skyscanner Vietnam: path-based dates in YYMMDD, rtn=1 for round-trip
    sky_depart = depart.strftime("%y%m%d")
    if return_date:
        sky_return = return_date.strftime("%y%m%d")
        skyscanner = (
            f"https://www.skyscanner.com.vn/transport/flights/"
            f"{ori['code'].lower()}/{dest['code'].lower()}/{sky_depart}/{sky_return}/"
            "?adultsv2=1&cabinclass=economy&rtn=1&preferdirects=false"
        )
    else:
        skyscanner = (
            f"https://www.skyscanner.com.vn/transport/flights/"
            f"{ori['code'].lower()}/{dest['code'].lower()}/{sky_depart}/"
            "?adultsv2=1&cabinclass=economy&rtn=0&preferdirects=false"
        )

    return {
        "traveloka": traveloka,
        "bestprice": bestprice,
        "skyscanner": skyscanner,
    }


def main():
    parser = argparse.ArgumentParser(description="Search flight tickets and generate deep links.")
    parser.add_argument("origin", help="Origin city or airport code (e.g. Sài Gòn, SGN)")
    parser.add_argument("destination", help="Destination city or airport code (e.g. Đà Nẵng, DAD)")
    parser.add_argument("date", help="Departure date in DD/MM/YYYY or DD-MM-YYYY")
    parser.add_argument("--return-date", help="Return date in DD/MM/YYYY (round trip)", default=None)
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    airports = load_airports()
    if not airports:
        emit_error("Cannot load airports reference file.", args.json)

    ori = get_airport_info(args.origin, airports)
    dest = get_airport_info(args.destination, airports)

    if not ori:
        hints = ", ".join(suggest_airports(args.origin, airports))
        emit_error(f"Không nhận diện được điểm đi '{args.origin}'. Gợi ý: {hints}", args.json)
    if not dest:
        hints = ", ".join(suggest_airports(args.destination, airports))
        emit_error(f"Không nhận diện được điểm đến '{args.destination}'. Gợi ý: {hints}", args.json)
    if ori["code"] == dest["code"]:
        emit_error(f"Điểm đi và điểm đến trùng nhau ({ori['code']}).", args.json)

    depart = parse_date(args.date)
    if not depart:
        emit_error(f"Ngày đi không hợp lệ: '{args.date}'. Định dạng cần là DD/MM/YYYY.", args.json)

    today = date.today()
    if depart < today:
        emit_error(f"Ngày đi {depart.strftime('%d/%m/%Y')} đã ở quá khứ (hôm nay {today.strftime('%d/%m/%Y')}).", args.json)

    return_date = None
    if args.return_date:
        return_date = parse_date(args.return_date)
        if not return_date:
            emit_error(f"Ngày về không hợp lệ: '{args.return_date}'. Định dạng cần là DD/MM/YYYY.", args.json)
        if return_date < depart:
            emit_error(
                f"Ngày về ({return_date.strftime('%d/%m/%Y')}) phải >= ngày đi ({depart.strftime('%d/%m/%Y')}).",
                args.json,
            )

    links = build_links(ori, dest, depart, return_date)

    trip_type = "Khứ hồi" if return_date else "Một chiều"
    route = f"{ori['city']} ({ori['code']}) ✈️ {dest['city']} ({dest['code']})"
    date_display = depart.strftime("%d/%m/%Y")
    if return_date:
        date_display += f" → {return_date.strftime('%d/%m/%Y')}"

    result = {
        "status": "success",
        "trip_type": trip_type,
        "route": route,
        "date": date_display,
        "deep_links": links,
        "note": "Giá vé thay đổi liên tục, vui lòng click link để xem giá thực tế.",
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Loại vé: {trip_type}")
        print(f"Chặng:   {route}")
        print(f"Ngày:    {date_display}")
        print("\nLink đặt vé:")
        for platform, url in links.items():
            print(f"- {platform.capitalize()}: {url}")


if __name__ == "__main__":
    main()
