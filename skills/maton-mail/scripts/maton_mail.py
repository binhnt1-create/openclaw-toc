#!/usr/bin/env python3
import argparse
import base64
import json
import os
import urllib.error
import urllib.request
from email.message import EmailMessage
from pathlib import Path

CTRL_BASE = "https://ctrl.maton.ai"
GATEWAY_BASE = "https://gateway.maton.ai/google-mail"


def load_key(args_key=None):
    candidates = [
        args_key,
        os.getenv("MATON_API_KEY", "").strip(),
    ]
    for path in [
        Path.home() / ".maton_api_key",
        Path.cwd() / ".maton_api_key",
        Path.cwd() / "secrets" / "maton_api_key.txt",
    ]:
        try:
            if path.exists():
                candidates.append(path.read_text(encoding="utf-8").strip())
        except Exception:
            pass
    for item in candidates:
        if item:
            return item
    raise SystemExit("MATON_API_KEY is required, or provide --api-key / a .maton_api_key file")


def auth_headers(args_key=None, json_content=True):
    key = load_key(args_key)
    headers = {"Authorization": f"Bearer {key}"}
    if json_content:
        headers["Content-Type"] = "application/json"
    return headers


def request(method, url, payload=None, api_key=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=auth_headers(api_key))
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body) if body else None
            except Exception:
                parsed = body
            return {"ok": True, "status": resp.status, "url": url, "body": parsed}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else None
        except Exception:
            parsed = body
        return {"ok": False, "status": e.code, "url": url, "body": parsed}
    except Exception as e:
        return {"ok": False, "status": None, "url": url, "body": str(e)}


def build_message(sender, to, subject, body, html_body=None):
    msg = EmailMessage()
    if sender:
        msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    text_body = body or ""
    msg.set_content(text_body)
    if html_body is not None:
        msg.add_alternative(html_body, subtype="html")
    return msg


def cmd_connections(args):
    url = f"{CTRL_BASE}/connections?app=google-mail&status=ACTIVE"
    print(json.dumps(request("GET", url, None, args.api_key), ensure_ascii=False, indent=2))


def cmd_connect_url(args):
    payload = {"app": "google-mail"}
    if args.redirect_uri:
        payload["redirectUri"] = args.redirect_uri
    url = f"{CTRL_BASE}/connections"
    print(json.dumps(request("POST", url, payload, args.api_key), ensure_ascii=False, indent=2))


def cmd_list_messages(args):
    qs = f"?maxResults={args.max_results}" if args.max_results else ""
    url = f"{GATEWAY_BASE}/gmail/v1/users/me/messages{qs}"
    print(json.dumps(request("GET", url, None, args.api_key), ensure_ascii=False, indent=2))


def cmd_send(args):
    body = Path(args.body_file).read_text(encoding="utf-8") if args.body_file else (args.body or "")
    html_body = Path(args.html_file).read_text(encoding="utf-8") if args.html_file else None
    msg = build_message(args.from_addr, args.to, args.subject, body, html_body)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    payload = {"raw": raw}
    url = f"{GATEWAY_BASE}/gmail/v1/users/me/messages/send"
    if args.dry_run:
        print(json.dumps({
            "dryRun": True,
            "url": url,
            "payloadPreview": {"raw": raw[:160] + "..." if len(raw) > 160 else raw},
        }, ensure_ascii=False, indent=2))
        return
    print(json.dumps(request("POST", url, payload, args.api_key), ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser(description="Maton Gmail helper")
    ap.add_argument("--api-key", help="Maton API key, fallback to MATON_API_KEY or local key files")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("connections")
    p.set_defaults(func=cmd_connections)

    p = sub.add_parser("connect-url")
    p.add_argument("--redirect-uri")
    p.set_defaults(func=cmd_connect_url)

    p = sub.add_parser("list-messages")
    p.add_argument("--max-results", type=int, default=10)
    p.set_defaults(func=cmd_list_messages)

    p = sub.add_parser("send")
    p.add_argument("--from", dest="from_addr")
    p.add_argument("--to", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--body")
    p.add_argument("--body-file")
    p.add_argument("--html-file")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=cmd_send)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
