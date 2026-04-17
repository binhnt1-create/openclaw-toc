# Plan: `/auth-codex` Third-Party Plugin

## Goal

Standalone third-party plugin exposing `/auth-codex` slash command for OpenAI Codex OAuth login.
Designed for **cloud environments** where port 1455 callback is unreachable — user pastes the
callback URL directly into chat as a plain message (no command prefix needed).

Install flow:
```
openclaw plugins install @yourorg/openclaw-auth-codex
```

---

## Files to Create

```
auth-codex-plugin/
├── package.json           # npm package + openclaw metadata
├── openclaw.plugin.json   # plugin manifest
└── index.ts               # command + hook registration
```

---

## Command Design

| Invocation | Behavior |
|---|---|
| `/auth-codex` | Start OAuth: get authorize URL, bind conversation, wait for callback paste |
| `/auth-codex status` | Show current auth profile for `openai-codex` |
| `/auth-codex set-model` | Set `agents.defaults.model.primary = openai-codex/gpt-5.4` |

---

## Full Chat Flow (Cloud / Remote)

```
User:  /auth-codex
Bot:   Sign in to OpenAI Codex:
       https://auth.openai.com/oauth/authorize?...

       After signing in your browser will show a connection error page.
       Copy the full URL from the address bar and paste it here.

       [Allow once]  [Always allow]  [Deny]   ← approval buttons (first time only)

User:  clicks "Allow once"
Bot:   Ready. Paste the redirect URL here.

User:  http://127.0.0.1:1455/auth/callback?code=abc123&state=xyz   (plain message, not a command)
Bot:   ✓ Logged in as user@example.com
       Run /auth-codex set-model to set the default model.

User:  /auth-codex set-model
Bot:   Default model set to openai-codex/gpt-5.4. Restart OpenClaw to apply.
```

If the plugin was previously approved ("Always allow"), the approval buttons are skipped and the
bot goes straight to "Ready. Paste the redirect URL here."

---

## Resolved Technical Questions

### Q1 — How does the plugin intercept the pasted callback URL?

**Hook: `before_dispatch`**

This hook fires for every incoming message before it is dispatched to the AI. The plugin
registers it via `api.on("before_dispatch", handler)`.

- `event.content` — the raw text the user sent (the pasted callback URL)
- `ctx.conversationId` — used to look up pending OAuth state
- Return `{ handled: true, text: "reply text" }` → stops further processing, sends `text` as bot reply
- Return `void` or `{ handled: false }` → message passes through normally

The plugin only intercepts if **both** conditions are true:
1. `ctx.conversationId` is in the `pendingOAuth` map (there's an active OAuth flow)
2. `event.content` looks like a callback URL (`http://127.0.0.1:1455/auth/callback?...`)

### Q2 — How does the plugin complete the OAuth token exchange?

**No `--callback` CLI flag. No internal package dependency.**
Instead: **pipe stdin/stdout to the spawned CLI process**.

When running with `SSH_TTY=1`, the CLI:
1. Prints the authorize URL to stdout
2. Starts port 1455 listener (will fail silently on cloud — expected)
3. Prints `"Paste the authorization code (or full redirect URL):"` to stdout
4. Waits for input on stdin

The plugin acts as a **bridge** between the chat UI and the CLI process:

```
Plugin spawns CLI with stdin:"pipe", stdout:"pipe"
  ↓ reads stdout → finds authorize URL → returns to user in chat
  ↓ binds conversation
  ← user pastes callback URL as plain chat message
  ↓ hook fires → plugin writes URL to CLI process stdin
  ↓ CLI handles PKCE exchange + saves credentials automatically
  ↓ CLI exits → plugin reads success/failure from stdout
  ↓ plugin replies ✓ and detaches conversation
```

This approach has **zero internal or third-party package dependencies** beyond Node built-ins.
The CLI owns all OAuth complexity: PKCE, token exchange, credential storage.

### Q3 — How does the plugin send a reply from within the hook?

Return `{ handled: true, text: "..." }` from the `before_dispatch` handler.
OpenClaw sends `text` as the bot's reply in that conversation.

### Detach — How to release the conversation after OAuth completes?

`detachConversationBinding` is available on `PluginCommandContext` (not on the hook context).
**Solution:** store the function reference in the `pendingOAuth` map during the command handler,
then call it from the hook after processing.

```typescript
type PendingAuth = {
  stdinWrite: (data: string) => void;           // writes to CLI process stdin
  credentialsDone: Promise<string>;             // resolves with email or throws
  detach: () => Promise<{ removed: boolean }>; // releases conversation binding
  startedAt: number;
};

const pendingOAuth = new Map<string, PendingAuth>(); // keyed by conversationId
```

---

## Implementation

### `package.json`

```json
{
  "name": "@yourorg/openclaw-auth-codex",
  "version": "1.0.0",
  "type": "module",
  "openclaw": {
    "extensions": ["./index.ts"],
    "compat": {
      "pluginApi": ">=2026.3.24-beta.2",
      "minGatewayVersion": "2026.3.24-beta.2"
    }
  },
  "devDependencies": {
    "openclaw": "*"
  }
}
```

No runtime dependencies beyond Node built-ins (`node:child_process`). No `@mariozechner/pi-ai`.

### `openclaw.plugin.json`

```json
{
  "id": "auth-codex",
  "name": "Auth Codex",
  "description": "Sign in to OpenAI Codex via OAuth with /auth-codex.",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### `index.ts` — Core Logic

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { spawn, execSync } from "node:child_process";

// ── State ────────────────────────────────────────────────────────────────────

type PendingAuth = {
  stdinWrite: (data: string) => void;            // writes pasted URL to CLI stdin
  credentialsDone: Promise<string>;              // resolves with email, or throws
  detach: () => Promise<{ removed: boolean }>;  // releases conversation binding
  startedAt: number;
};

const pendingOAuth = new Map<string, PendingAuth>(); // key = conversationId

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectBin(): string {
  try { execSync("command -v openclaw", { stdio: "ignore" }); return "openclaw"; }
  catch { return "pnpm openclaw"; }
}

function isCallbackUrl(text: string): boolean {
  const t = text.trim();
  return t.startsWith("http://127.0.0.1:1455/auth/callback") ||
         t.startsWith("http://localhost:1455/auth/callback");
}

// Spawns the CLI login command, returns authorize URL + a handle to feed stdin
async function startOAuthCli(bin: string): Promise<{
  authorizeUrl: string;
  stdinWrite: (data: string) => void;
  credentialsDone: Promise<string>; // resolves with email on success
}> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = [
      ...bin.split(" "),
      "models", "auth", "login", "--provider", "openai-codex",
    ];
    const proc = spawn(cmd, args, {
      env: { ...process.env, SSH_TTY: "1" }, // force remote/headless mode
      stdio: ["pipe", "pipe", "pipe"],
    });

    let authorizeUrl = "";
    let outputBuffer = "";
    let resolved = false;

    const credentialsDone = new Promise<string>((resolveDone, rejectDone) => {
      proc.stdout.on("data", (chunk: Buffer) => {
        outputBuffer += chunk.toString();

        // Extract authorize URL from stdout
        if (!authorizeUrl) {
          const match = outputBuffer.match(/https:\/\/auth\.openai\.com\/oauth\/authorize\?[^\s]+/);
          if (match) {
            authorizeUrl = match[0];
            if (!resolved) {
              resolved = true;
              resolve({
                authorizeUrl,
                stdinWrite: (data) => proc.stdin.write(data + "\n"),
                credentialsDone: credentialsDone,
              });
            }
          }
        }

        // Detect success (look for "OAuth complete" or similar in stdout)
        if (/oauth complete|logged in|success/i.test(outputBuffer)) {
          const emailMatch = outputBuffer.match(/[\w.+-]+@[\w.-]+\.\w+/);
          resolveDone(emailMatch?.[0] ?? "");
        }
      });

      proc.on("exit", (code) => {
        if (code === 0) resolveDone("");
        else rejectDone(new Error(`Login process exited with code ${code}`));
      });

      proc.on("error", rejectDone);
    });

    // Timeout if URL never appears
    setTimeout(() => {
      if (!resolved) reject(new Error("Timed out waiting for authorize URL"));
    }, 8000);
  });
}

// ── Plugin ───────────────────────────────────────────────────────────────────

export default definePluginEntry({
  id: "auth-codex",
  name: "Auth Codex",
  description: "Sign in to OpenAI Codex via OAuth with /auth-codex.",
  register(api) {

    // Intercept plain messages — detect pasted callback URL for pending OAuth flows
    api.on("before_dispatch", async (event, ctx) => {
      const conversationId = ctx.conversationId;
      if (!conversationId) return;
      const pending = pendingOAuth.get(conversationId);
      if (!pending) return;
      if (!isCallbackUrl(event.content)) return;

      pendingOAuth.delete(conversationId);

      // Feed callback URL into the waiting CLI process via stdin
      pending.stdinWrite(event.content.trim());

      let resultText: string;
      try {
        const email = await pending.credentialsDone;
        resultText = `✓ Logged in${email ? ` as ${email}` : ""}\nRun /auth-codex set-model to set the default model.`;
      } catch (err) {
        resultText = `OAuth failed: ${err instanceof Error ? err.message : String(err)}\nTry /auth-codex again.`;
      }

      await pending.detach();
      return { handled: true, text: resultText };
    });

    api.registerCommand({
      name: "auth-codex",
      description: "Manage OpenAI Codex OAuth login",
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const action = ctx.args?.trim().split(/\s+/)[0] ?? "";
        const bin = detectBin();

        if (action === "status") {
          const out = execSync(`${bin} models auth status`, { encoding: "utf8" });
          return { text: out.trim() };
        }

        if (action === "set-model") {
          execSync(`${bin} config set agents.defaults.model.primary openai-codex/gpt-5.4`);
          return { text: "Default model set to openai-codex/gpt-5.4. Restart OpenClaw to apply." };
        }

        // Default: start OAuth
        let oauthHandle;
        try {
          oauthHandle = await startOAuthCli(bin);
        } catch (err) {
          return { text: `Failed to start OAuth: ${err instanceof Error ? err.message : String(err)}` };
        }

        const bindResult = await ctx.requestConversationBinding({
          summary: "Waiting for OAuth callback URL",
          detachHint: "/auth-codex",
        });

        if (bindResult.status === "error") {
          return {
            text: `Sign in to OpenAI Codex:\n${oauthHandle.authorizeUrl}\n\nCould not bind conversation. Paste callback URL with: /auth-codex <url>`,
          };
        }

        // Store state — hook uses this when user pastes the callback URL
        const conversationId = ctx.conversationId ?? ctx.sessionKey ?? "default";
        pendingOAuth.set(conversationId, {
          stdinWrite: oauthHandle.stdinWrite,
          credentialsDone: oauthHandle.credentialsDone,
          detach: ctx.detachConversationBinding,
          startedAt: Date.now(),
        });

        const body = [
          `Sign in to OpenAI Codex:`,
          oauthHandle.authorizeUrl,
          ``,
          `After signing in, your browser will show a connection error page.`,
          `Copy the full URL from the address bar and paste it here.`,
        ].join("\n");

        if (bindResult.status === "pending") {
          return { text: body, ...bindResult.reply };
        }
        return { text: body };
      },
    });
  },
});
```

---

## Implementation Steps

1. Create `example/auth-codex-plugin/` folder
2. Create `package.json` (with `@mariozechner/pi-ai` dep)
3. Create `openclaw.plugin.json`
4. Implement `index.ts` (full code, not pseudocode)
5. `npm install`
6. Typecheck: `npx tsc --noEmit`
7. Local install: `openclaw plugins install ./example/auth-codex-plugin`
8. Test: send `/auth-codex` in chat, complete OAuth, paste callback URL
