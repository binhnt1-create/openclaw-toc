#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB_SEARCH = ROOT / "web_search.py"
EXTRACT = ROOT / "extract_bank_rates.py"
OFFICIAL_DOMAINS = [
    "vietcombank.com.vn",
    "bidv.com.vn",
    "vietinbank.vn",
    "agribank.com.vn",
    "mbbank.com.vn",
    "techcombank.com",
    "acb.com.vn",
    "tpb.vn",
    "vpbank.com.vn",
    "hdbank.com.vn",
    "seabank.com.vn",
    "sacombank.com.vn",
    "cake.vn",
]


def run_json(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "command failed")
    return json.loads(proc.stdout)


def is_official(domain):
    return any(domain == d or domain.endswith("." + d) for d in OFFICIAL_DOMAINS)


def score_result(result):
    score = 0
    domain = result.get("domain", "")
    title = result.get("title", "").lower()
    if is_official(domain):
        score += 10
    if "lãi suất" in title or "lai suat" in title:
        score += 4
    if "tiết kiệm" in title or "tiet kiem" in title:
        score += 3
    return score


def main():
    ap = argparse.ArgumentParser(description="Search and extract bank rates without any paid API")
    ap.add_argument("query")
    ap.add_argument("--max-results", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    try:
        search = run_json([sys.executable, str(WEB_SEARCH), args.query, "--max-results", str(args.max_results), "--json"])
        ranked = sorted(search["results"], key=score_result, reverse=True)
        output = []
        for item in ranked[: args.max_results]:
            extracted = run_json([sys.executable, str(EXTRACT), item["url"], "--json"])
            output.append({
                "title": item["title"],
                "url": item["url"],
                "domain": item["domain"],
                "official": is_official(item["domain"]),
                "candidates": extracted.get("candidates", [])[:10],
            })
        payload = {"query": args.query, "results": output}
    except Exception as e:
        print(f"search_bank_rates failed: {e}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"Query: {args.query}")
    for i, item in enumerate(payload["results"], 1):
        badge = "official" if item["official"] else "reference"
        print(f"{i}. {item['title']} [{badge}]")
        print(f"   {item['url']}")
        if not item["candidates"]:
            print("   No extracted rates")
            continue
        for cand in item["candidates"][:3]:
            term = f"{cand['termMonths']} tháng" if cand.get("termMonths") else "không rõ kỳ hạn"
            print(f"   - {cand['ratePercent']}% | {term} | {cand['text'][:140]}")


if __name__ == "__main__":
    main()
