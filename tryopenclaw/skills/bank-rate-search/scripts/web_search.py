#!/usr/bin/env python3
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


class DDGParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.results = []
        self._capture = False
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag != "a":
            return
        href = attrs.get("href")
        cls = attrs.get("class", "")
        if not href:
            return
        if "result__a" in cls or "uddg=" in href:
            self._capture = True
            self._href = href
            self._text = []

    def handle_data(self, data):
        if self._capture:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag != "a" or not self._capture:
            return
        title = " ".join(" ".join(self._text).split()).strip()
        url = unwrap_ddg(self._href)
        if title and url:
            self.results.append({
                "title": title,
                "url": url,
                "domain": urllib.parse.urlparse(url).netloc.lower(),
            })
        self._capture = False
        self._href = None
        self._text = []


def unwrap_ddg(url):
    if not url:
        return None
    if url.startswith("//"):
        url = "https:" + url
    if url.startswith("/"):
        url = "https://html.duckduckgo.com" + url
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    uddg = qs.get("uddg", [None])[0]
    if uddg:
        return urllib.parse.unquote(uddg)
    if parsed.scheme in {"http", "https"}:
        return url
    return None


def fetch(query):
    url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query, "kl": "vn-vi"})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def search(query, max_results, domain=None):
    parser = DDGParser()
    parser.feed(fetch(query))
    out = []
    seen = set()
    for item in parser.results:
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        if domain and domain not in item["domain"]:
            continue
        out.append(item)
        if len(out) >= max_results:
            break
    return out


def main():
    ap = argparse.ArgumentParser(description="Simple web search via DuckDuckGo HTML")
    ap.add_argument("query")
    ap.add_argument("--max-results", type=int, default=5)
    ap.add_argument("--domain")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    try:
        results = search(args.query, args.max_results, args.domain)
    except Exception as e:
        print(f"search failed: {e}", file=sys.stderr)
        sys.exit(1)

    payload = {"query": args.query, "fetchedAt": int(time.time()), "results": results}
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"Query: {args.query}")
    for i, item in enumerate(results, 1):
        print(f"{i}. {item['title']}")
        print(f"   {item['url']}")
        print(f"   domain: {item['domain']}")


if __name__ == "__main__":
    main()
