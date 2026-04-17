import { spawn, execSync } from "node:child_process";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// ── Types ─────────────────────────────────────────────────────────────────────

type PendingAuth = {
  /** Write pasted callback URL into the CLI process stdin. */
  stdinWrite: (data: string) => void;
  /** Resolves when CLI process exits (code 0), rejects on failure. */
  processDone: Promise<void>;
  /** Release conversation binding after OAuth completes. */
  detach: () => Promise<{ removed: boolean }>;
  startedAt: number;
};

// Keyed by sessionKey (stable conversation identifier).
const pendingOAuth = new Map<string, PendingAuth>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectBin(): string {
  try {
    execSync("command -v openclaw", { stdio: "ignore" });
    return "openclaw";
  } catch {
    return "pnpm openclaw";
  }
}

function isCallbackUrl(text: string): boolean {
  const t = text.trim();
  return (
    t.startsWith("http://127.0.0.1:1455/auth/callback") ||
    t.startsWith("http://localhost:1455/auth/callback")
  );
}

/**
 * Spawns `SSH_TTY=1 openclaw models auth login --provider openai-codex` with
 * stdio piped. Returns the authorize URL (parsed from stdout) and a handle to
 * feed the callback URL into the process stdin later.
 */
function startOAuthCli(bin: string): Promise<{
  authorizeUrl: string;
  stdinWrite: (data: string) => void;
  processDone: Promise<void>;
}> {
  return new Promise((resolveSetup, rejectSetup) => {
    const parts = bin.split(" ");
    const cmd = parts[0];
    const args = [
      ...parts.slice(1),
      "models",
      "auth",
      "login",
      "--provider",
      "openai-codex",
    ];

    const proc = spawn(cmd, args, {
      env: { ...process.env, SSH_TTY: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let setupDone = false;

    const processDone = new Promise<void>((resolveDone, rejectDone) => {
      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();

        if (setupDone) return;

        // Parse the authorize URL from stdout as soon as it appears.
        const match = stdout.match(
          /https:\/\/auth\.openai\.com\/oauth\/authorize\?[^\s\n"']+/,
        );
        if (match) {
          setupDone = true;
          resolveSetup({
            authorizeUrl: match[0],
            stdinWrite: (data: string) => {
              proc.stdin.write(data + "\n");
            },
            processDone,
          });
        }
      });

      proc.stderr.on("data", () => {
        // Absorb stderr — errors surface via exit code.
      });

      proc.on("exit", (code) => {
        if (code === 0) {
          resolveDone();
        } else {
          rejectDone(new Error(`Login process exited with code ${code ?? "null"}`));
        }
      });

      proc.on("error", (err) => {
        if (!setupDone) rejectSetup(err);
        else rejectDone(err);
      });
    });

    // Give up if the authorize URL never appears within 10 seconds.
    setTimeout(() => {
      if (!setupDone) {
        rejectSetup(new Error("Timed out waiting for authorize URL from CLI"));
        proc.kill();
      }
    }, 10_000);
  });
}

/**
 * Reads current auth status. Returns a short summary line.
 */
function authStatus(bin: string): string {
  try {
    return execSync(`${bin} models auth status`, { encoding: "utf8" }).trim();
  } catch (err) {
    return `Could not read auth status: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Sets the default model to openai-codex/gpt-5.4.
 */
function setDefaultModel(bin: string): void {
  execSync(
    `${bin} config set agents.defaults.model.primary openai-codex/gpt-5.4`,
    { encoding: "utf8" },
  );
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default definePluginEntry({
  id: "auth-codex",
  name: "Auth Codex",
  description: "Sign in to OpenAI Codex via OAuth with /auth-codex.",
  register(api) {
    // Intercept plain messages — detect pasted callback URL for pending OAuth flows.
    api.on("before_dispatch", async (event, ctx) => {
      const key = ctx.sessionKey;
      if (!key) return;

      const pending = pendingOAuth.get(key);
      if (!pending) return;

      if (!isCallbackUrl(event.content)) {
        // Not a callback URL — remind user what to paste.
        return {
          handled: true,
          text: "Waiting for the OAuth callback URL (starts with http://127.0.0.1:1455/auth/callback...).\nPaste it here, or run /auth-codex to restart.",
        };
      }

      // Feed the callback URL into the waiting CLI process.
      pending.stdinWrite(event.content.trim());
      pendingOAuth.delete(key);

      let resultText: string;
      try {
        await pending.processDone;
        // CLI exited cleanly — read back the resulting auth profile.
        const bin = detectBin();
        const status = authStatus(bin);
        resultText = `✓ Login complete!\n\n${status}\n\nRun /auth-codex set-model to set the default model.`;
      } catch (err) {
        resultText = `OAuth failed: ${err instanceof Error ? err.message : String(err)}\nRun /auth-codex to try again.`;
      }

      await pending.detach().catch(() => {});
      return { handled: true, text: resultText };
    });

    api.registerCommand({
      name: "auth-codex",
      description: "Sign in to OpenAI Codex via OAuth",
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const action = (ctx.args?.trim().split(/\s+/)[0] ?? "").toLowerCase();
        const bin = detectBin();

        // ── /auth-codex status ──────────────────────────────────────────────
        if (action === "status") {
          return { text: authStatus(bin) };
        }

        // ── /auth-codex set-model ───────────────────────────────────────────
        if (action === "set-model") {
          try {
            setDefaultModel(bin);
            return {
              text: "Default model set to openai-codex/gpt-5.4. Restart OpenClaw to apply.",
            };
          } catch (err) {
            return {
              text: `Failed to set model: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        // ── /auth-codex (default: start OAuth) ─────────────────────────────
        let oauthHandle: Awaited<ReturnType<typeof startOAuthCli>>;
        try {
          oauthHandle = await startOAuthCli(bin);
        } catch (err) {
          return {
            text: `Failed to start OAuth: ${err instanceof Error ? err.message : String(err)}\n\nMake sure the openai-codex provider plugin is installed.`,
          };
        }

        // Request conversation binding so subsequent plain messages come to us.
        const bindResult = await ctx.requestConversationBinding({
          summary: "Waiting for OAuth callback URL paste",
          detachHint: "/auth-codex",
        });

        if (bindResult.status === "error") {
          // Binding failed — give instructions for manual two-step flow.
          return {
            text: [
              "Sign in to OpenAI Codex:",
              oauthHandle.authorizeUrl,
              "",
              "Could not bind conversation automatically.",
              "After signing in, copy the callback URL from your browser and run:",
              "/auth-codex <paste-url-here>",
            ].join("\n"),
          };
        }

        // Store pending state — the hook will use this when the user pastes.
        const key = ctx.sessionKey ?? `${ctx.channel}:${ctx.from ?? ctx.accountId ?? "default"}`;
        pendingOAuth.set(key, {
          stdinWrite: oauthHandle.stdinWrite,
          processDone: oauthHandle.processDone,
          detach: ctx.detachConversationBinding,
          startedAt: Date.now(),
        });

        const body = [
          "Sign in to OpenAI Codex:",
          oauthHandle.authorizeUrl,
          "",
          "After signing in, your browser will show a connection error page.",
          "Copy the full URL from the address bar and paste it here.",
        ].join("\n");

        if (bindResult.status === "pending") {
          // Return the approval buttons from the binding request alongside our text.
          return { ...bindResult.reply, text: body };
        }

        // Already approved — go straight to waiting.
        return { text: body };
      },
    });
  },
});
