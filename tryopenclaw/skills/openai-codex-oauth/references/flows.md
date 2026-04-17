# OpenAI Codex OAuth reference

## Source-backed facts

### OpenAI Codex OAuth support

- OpenClaw supports **OpenAI Codex OAuth** for external tools/workflows.
- Default OpenClaw model for this path is `openai-codex/gpt-5.4`.

### OAuth flow shape

1. Generate PKCE verifier/challenge + random state
2. Open the authorize URL — stable prefix `https://auth.openai.com/oauth/authorize?` (full query string varies per session)
3. Try to capture callback on `http://127.0.0.1:1455/auth/callback` (some environments show `http://localhost:1455/auth/callback`; same listener)
4. If callback capture fails or host is remote/headless, paste redirect URL/code
5. Exchange token
6. Store `{ access, refresh, expires, accountId }`

### Assistant / tool limits

- **Auto-detect then execute:** run `command -v openclaw`, inspect workspace `package.json`, and `docker ps` when relevant. Decide **one** prefix, then **run commands** (do not just suggest). Show the authorize URL to the user in a 1:1 session so they can open it in the right browser/profile.
- Do not claim the user's environment was inspected without evidence. Remote sandboxes may lack `openclaw` on `PATH`.
- From a source checkout, use `pnpm openclaw ...` from the repo root when the global CLI is missing.

### Preventing auto-open browser

No `--no-browser` flag exists. Workaround: `SSH_TTY=1 <prefix> models auth login --provider openai-codex` forces remote/headless mode (URL printed, no browser opened). Source: `src/commands/oauth-env.ts` checks `SSH_TTY` among other env vars.

### State mismatch

Two causes: (A) two browsers opening the same authorize URL, (B) stale OAuth listener on port 1455 from a prior login. Cause B is more common on local Mac.

Fix: always run `lsof -i :1455` and kill stale listeners before re-running login. Use `SSH_TTY=1` to prevent auto-open. Only sign in from one browser.

### Docker / headless rule

If OpenAI Codex OAuth is used in wizard mode inside Docker/headless setup:

- complete browser sign-in
- copy the **full redirect URL** you land on
- paste it into chat so the assistant can feed it to the login process

### State locations

Important files:

- OAuth import/state: `~/.openclaw/credentials/oauth.json`
- Agent auth profiles: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

### Browser-machine to gateway-host pattern

For headless/server setups:

1. complete OAuth on a machine with a browser
2. copy `~/.openclaw/credentials/oauth.json`
3. place it on the gateway host using the same OpenClaw state dir
4. for Docker: verify `~/.openclaw` is mounted into the container so the process reads the same `oauth.json` (host-only copy is not enough if the volume map is wrong)

## Short answer templates

### Template: explain to non-technical user

- Sign in to Codex
- Copy auth state to the machine or container running OpenClaw if needed
- Set the default model to `openai-codex/gpt-5.4`
- Restart

### Template: one-line diagnosis

- Logged in but default model not changed yet
- Or model was changed but OpenClaw was not restarted
- Or the host/container does not see OAuth credentials (including wrong volume mount)
- Or tokens expired: re-run `openclaw onboard --auth-choice openai-codex` (or `openclaw models auth login --provider openai-codex`)
