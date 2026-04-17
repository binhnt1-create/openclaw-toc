---
name: openai-codex-oauth
description: Configure OpenClaw to use OpenAI Codex OAuth (ChatGPT sign-in) instead of an OpenAI API key. Use when the assistant should auto-detect install context (PATH vs pnpm source vs Docker), pick the correct CLI invocation, handle redirect paste flow, set default model openai-codex/gpt-5.4, or copy OAuth state between machines.
homepage: https://platform.openai.com/docs/guides/authentication
metadata:
  {
    "openclaw":
      {
        "emoji": "🔑",
        "requires": { "bins": ["openclaw"], "minModel": ["gemini-pro-3.1", "gpt-5.4", "sonnet-4.6"] },
        "install":
          [
            {
              "id": "npm",
              "kind": "npm",
              "package": "openclaw",
              "bins": ["openclaw"],
              "label": "Install OpenClaw CLI (npm)",
            },
          ],
      },
  }
---

# OpenAI Codex OAuth

## Model requirements

This skill requires strong instruction-following and tool-use capabilities. **Do not use lightweight or "flash" models.**

### Minimum recommended models

| Provider | Minimum model |
| --- | --- |
| Google Gemini | Gemini Pro 3.1+ |
| OpenAI | GPT-5.4+ |
| Anthropic | Sonnet 4.6+ |

### Insufficient models

- **Gemini Flash 2.5** and below — gives up on environment detection, refuses to run login claiming it "needs a TTY", skips mandatory post-login steps.
- **GPT-4o-mini**, **GPT-3.5** — hallucinate CLI flags or skip steps.
- Any model without reliable tool/function-calling support.

### Step 0: self-check (run before anything else)

Check your own model name against the lists above.

- **Insufficient model?** Stop immediately and warn the user:
  > **Warning:** I am running as `<your model name>`, which is below the minimum capability for this skill. Please switch to a more capable model (Gemini Pro 3.1+, GPT-5.4+, or Sonnet 4.6+) before continuing.
  Do **not** attempt the flow.
- **Recommended model or above?** Proceed.
- **Unsure?** Proceed with caution but tell the user which model you are.

---

## Goal

Get OpenClaw running with Codex OAuth. Three things must be true when done:

1. `openai-codex` auth profile exists
2. Default model is `openai-codex/gpt-5.4`
3. No API key needed for chat/completions

Keep answers short. Focus on the exact next step. Execute commands yourself — do not dump numbered lists for the user to follow.

---

## Execution flow

**Do not just suggest commands.** When you have shell access, **run them yourself**: say what you are about to do, execute, report the result. Only fall back to suggesting when your shell truly cannot reach the binary.

### Step 1: detect prefix

Run these checks top-to-bottom in your shell. Stop at first match:

1. `command -v openclaw` succeeds → prefix = `openclaw`.
2. Workspace has `package.json` with an `openclaw` script (or this is the OpenClaw repo) → prefix = `pnpm openclaw` (from repo root).
3. `docker ps` shows an OpenClaw container → use [Path B (headless)](#path-b--headless-docker--vps).
4. `~/.openclaw` exists but nothing above matched → ask the user once: "How do you normally run openclaw?"
5. Nothing found → say your shell cannot see OpenClaw; give a 3-line check for the user to run locally.

**Critical:** once a check eliminates a prefix, never suggest it. Use the same prefix for all subsequent commands.

### Step 2: execute OAuth login

Run each sub-step in order. Report results between steps.

1. **Check auth state:** `<prefix> models auth status` — show what exists now.
2. **Kill stale listeners:** `lsof -i :1455` — kill any leftover process from a prior login. Stale listeners cause [state mismatch errors](#state-mismatch-error).
3. **Start login:** `<prefix> models auth login --provider openai-codex` — run it.
   - Show the printed authorize URL to the user (they may need a different browser/profile/device).
   - If the wrong browser might auto-open, prepend `SSH_TTY=1` to suppress auto-open (see [preventing auto-open](#preventing-auto-open-browser)).
   - If the browser did auto-open: warn "If that browser has the wrong account, **close that tab immediately** before opening this URL in your preferred browser."
   - Tell the user: open the URL in **one** browser, sign in, and if callback does not auto-complete, paste the callback URL (`http://127.0.0.1:1455/auth/callback?...`) back into chat.
4. **Set default model (mandatory):**
   ```
   <prefix> config set agents.defaults.model.primary openai-codex/gpt-5.4
   ```
   Remind the user: without this, OpenClaw keeps using the old provider even though login succeeded.
5. **Restart:** run the restart command or tell the user to restart (for example macOS app). Config changes require restart.
6. **Verify:** run both:
   - `<prefix> models auth status` — confirm `openai-codex` profile exists
   - `<prefix> config get agents.defaults.model.primary` — confirm `openai-codex/gpt-5.4`

   If model is wrong, re-run step 4. If profile is missing, re-run login.

### Path B — headless (Docker / VPS)

Use when the gateway host cannot open a browser.

1. Complete OAuth on any machine with a browser (Path A steps 1–3, or `openclaw onboard --auth-choice openai-codex`).
2. Copy `~/.openclaw/credentials/oauth.json` to the gateway host's same path.
3. For Docker: verify `~/.openclaw` is volume-mounted into the container. Host-only copy is not enough.
4. Set default model: `openai-codex/gpt-5.4`.
5. Restart container.
6. If the container cannot catch the callback, the user should paste the full callback URL into chat (the assistant feeds it to the login process).

### When to suggest instead of execute

Only suggest (not execute) when:

- Shell genuinely cannot run the binary (sandbox, missing PATH)
- Step requires user-only interaction (browser sign-in, pasting callback URL)
- Step is destructive and needs confirmation (for example overwriting production config)

Give **one** exact command and wait.

---

## Anti-patterns

**"Try X, if not found try Y":** If you already checked, give the working prefix directly.

**"Run this command":** If you have shell access, execute it yourself.

**"Needs a TTY / interactive terminal":** The login command does **not** require a TTY. It prints a URL to stdout and waits for a callback on `localhost:1455`. Run it via your shell tool, capture the URL, show it to the user.

**"I cannot open a browser":** You are not expected to. Run the CLI, it prints a URL, you show it. The browser step is the user's job.

---

## OAuth URL shapes

| Step | Pattern | Notes |
| --- | --- | --- |
| Authorize | `https://auth.openai.com/oauth/authorize?...` | Host+path stable; query params change each run |
| Callback | `http://127.0.0.1:1455/auth/callback?...` or `localhost:1455` | Same listener; hostname varies by browser/OS |

Safe to show authorize URLs in a private 1:1 session. Do **not** post in public channels.

## Config target

```json5
{
  agents: {
    defaults: {
      model: { primary: "openai-codex/gpt-5.4" },
      models: {
        "openai-codex/gpt-5.4": {
          params: { transport: "auto" },
        },
      },
    },
  },
}
```

Merge into existing config. Do not replace the whole file or wipe unrelated keys.

## Plain-language file map

For non-technical users:

- `auth-profiles.json` = where sign-in credentials are stored
- `openclaw.json` = where you choose which credential/model to use

---

## Safety

- Treat `access`, `refresh`, and API keys as secrets.
- Warn briefly if a user pastes tokens into chat.
- Authorize URLs: safe in private 1:1 sessions; never in public channels/logs/tickets.
- Callback URLs: user pastes these to complete the flow — do not lecture them. The code is short-lived and single-use.
- Codex OAuth covers chat/completions, not embeddings.

---

## Troubleshooting

### Login succeeded but OpenClaw still uses API key

Check in order: (1) `openai-codex` auth profile exists, (2) default model is `openai-codex/gpt-5.4`, (3) OpenClaw was restarted.

### `openclaw: command not found`

Use `pnpm openclaw models auth login --provider openai-codex` from the repo root, or invoke the built CLI by full path.

### Preventing auto-open browser

No `--no-browser` flag exists. Workarounds:

1. **Force remote mode** (cleaner — no race):
   ```
   SSH_TTY=1 <prefix> models auth login --provider openai-codex
   ```
2. **Close the auto-opened tab instantly** before it loads, then open the URL from CLI output in the correct browser.

### State mismatch error

**Cause A:** Two browsers opened the same authorize URL (auto-opened wrong profile + manually opened correct one race each other).

**Cause B (more common):** Stale OAuth listener on port 1455 from a prior interrupted login.

**Fix (do this before every re-run):**

1. `lsof -i :1455` — kill any stale listener.
2. Use `SSH_TTY=1` to prevent auto-open.
3. Re-run login (old URL is dead).
4. Sign in from **one** browser only.

### Token expired or auth failing silently

Re-run the login flow: `<prefix> models auth login --provider openai-codex` (or `openclaw onboard --auth-choice openai-codex`). Then confirm default model and restart.

### User wants minimum explanation

Respond with: what is already done → the next single command → what success looks like.

---

## References

Read `references/flows.md` for the exact flow summary and source-backed phrasing.
