---
name: lottery-automation
description: Use when the user asks for lottery results, lottery result tables, Miền Bắc or Miền Nam or Miền Trung daily result lookups, or Miền Trung ticket checking with short or full ticket numbers. Also use when packaging or testing recurring lottery email workflows.
---

# Lottery Automation

Use this skill for lottery-result workflows backed by local scripts shipped with the skill. `{baseDir}` is the folder that contains this `SKILL.md` (the skill root).

## When to use

- User asks for a full lottery results table for Miền Bắc, Miền Nam, or Miền Trung
- User asks to look up lottery numbers for a specific recent date
- User asks to check a Miền Trung ticket number
- User asks to test or package recurring lottery email workflows

## Core scripts

- `{baseDir}/scripts/lottery_results.py` — full result tables by region and date token (`DDMMYYYY`); regions `mb`, `mn`, `mt`
- `{baseDir}/scripts/check_xsmt_ticket.py` — fetch XSMT page and check a ticket against the section for that day
- `{baseDir}/scripts/check_lottery_ticket.py` — optional: check a ticket against **saved** station text files (`--station NAME FILE` pairs)

## Standard workflow

Always run commands with the skill directory in context, for example:

```bash
cd "{baseDir}"
python3 scripts/lottery_results.py --region <mb|mn|mt> --date-token DDMMYYYY
```

Or invoke with absolute paths:

```bash
python3 "{baseDir}/scripts/lottery_results.py" --region <mb|mn|mt> --date-token DDMMYYYY
```

Return parsed output in a clean table or bullet list.

### Miền Trung ticket check (live site)

Use the draw date as `DDMMYYYY` (same token as in `lottery_results.py` for that day):

```bash
python3 "{baseDir}/scripts/check_xsmt_ticket.py" <ticket> --date-token DDMMYYYY
```

You can pass an explicit section instead: `--section-id mt_kqngay_DDMMYYYY`.

Interpret results using these rules:

- Real ticket is always 6 digits
- If the user gives 4 or 5 digits, treat them as trailing digits only
- Prize match lengths:
  - giải tám: 2 digits
  - giải bảy: 3 digits
  - giải sáu: 4 digits
  - giải năm to giải nhất: 5 digits
  - giải đặc biệt: 6 digits

## Email workflow

If another skill (for example `maton-mail`) exists under `<workspace>/skills/`, you can call its script from there. Do not assume paths outside `{baseDir}` unless they exist in the workspace.

Prefer:

- full HTML table for full results
- very short wording for ticket win/lose mails

## Notes

- Lottery source workflow currently relies on xoso.com.vn aggregate pages
- Prefer structured parsed values over loose rendered page text
- For recurring jobs, test direct scripts first, then wire cron
