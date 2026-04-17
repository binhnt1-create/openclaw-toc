import { execSync } from "node:child_process";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { loginOpenAICodexOAuth } from "openclaw/plugin-sdk/provider-auth-login";

// ── Types ─────────────────────────────────────────────────────────────────────

type PendingAuth = {
  /** Resolve the pending manual code input promise with the callback URL. */
  resolveCode: (url: string) => void;
  /** Resolves when OAuth flow completes. */
  done: Promise<{ success: boolean; error?: string }>;
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

function authStatus(_bin: string): string {
  return "OpenAI Codex authenticated.";
}

function setDefaultModel(bin: string): void {
  execSync(
    `${bin} config set agents.defaults.model.primary openai-codex/gpt-5.4`,
    { encoding: "utf8" },
  );
}

/**
 * Create a minimal WizardPrompter stub for loginOpenAICodexOAuth.
 * `text()` returns a promise that resolves when the user pastes the callback URL.
 */
function createChatPrompter(manualCodePromise: Promise<string>) {
  const noop = async () => {};
  return {
    intro: noop,
    outro: noop,
    note: noop,
    select: async () => { throw new Error("not supported"); },
    multiselect: async () => { throw new Error("not supported"); },
    confirm: async () => false,
    text: async () => manualCodePromise,
    progress: () => ({
      update: () => {},
      stop: () => {},
    }),
  };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default definePluginEntry({
  id: "auth-codex",
  name: "Auth Codex",
  description: "Sign in to OpenAI Codex via OAuth with /auth-codex.",
  register(api) {
    api.on("before_dispatch", async (event, ctx) => {
      const key = ctx.sessionKey;
      if (!key) {return;}

      const pending = pendingOAuth.get(key);
      if (!pending) {return;}

      if (!isCallbackUrl(event.content)) {
        return {
          handled: true,
          text: "Waiting for the OAuth callback URL (starts with http://localhost:1455/auth/callback...).\nPaste it here, or run /auth-codex to restart.",
        };
      }

      pending.resolveCode(event.content.trim());
      pendingOAuth.delete(key);

      const result = await pending.done;
      await pending.detach().catch(() => {});

      if (result.success) {
        const bin = detectBin();
        const status = authStatus(bin);
        return { handled: true, text: `✓ Login complete!\n\n${status}\n\nRun /auth-codex set-model to set the default model.` };
      }
      return { handled: true, text: `OAuth failed: ${result.error}\nRun /auth-codex to try again.` };
    });

    api.registerCommand({
      name: "auth-codex",
      description: "Sign in to OpenAI Codex via OAuth",
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const action = (ctx.args?.trim().split(/\s+/)[0] ?? "").toLowerCase();
        const bin = detectBin();

        if (action === "status") {
          return { text: authStatus(bin) };
        }

        if (action === "set-model") {
          try {
            setDefaultModel(bin);
            return { text: "Default model set to openai-codex/gpt-5.4. Restart OpenClaw to apply." };
          } catch (err) {
            return { text: `Failed to set model: ${err instanceof Error ? err.message : String(err)}` };
          }
        }

        // ── /auth-codex <callback-url> — manual paste fallback
        const rawArgs = ctx.args?.trim() ?? "";
        if (isCallbackUrl(rawArgs)) {
          const key = ctx.sessionKey ?? `${ctx.channel}:${ctx.from ?? ctx.accountId ?? "default"}`;
          const pending = pendingOAuth.get(key);
          if (!pending) {
            return { text: "No pending OAuth session. Run /auth-codex first to start one." };
          }
          pending.resolveCode(rawArgs);
          pendingOAuth.delete(key);
          const result = await pending.done;
          if (result.success) {
            const status = authStatus(bin);
            return { text: `✓ Login complete!\n\n${status}\n\nRun /auth-codex set-model to set the default model.` };
          }
          return { text: `OAuth failed: ${result.error}\nRun /auth-codex to try again.` };
        }

        // ── /auth-codex (start OAuth) ──────────────────────────────────────

        let resolveCode!: (url: string) => void;
        const manualCodePromise = new Promise<string>((resolve) => {
          resolveCode = resolve;
        });

        let authorizeUrl = "";
        const prompter = createChatPrompter(manualCodePromise);

        // In remote mode, the OAuth flow logs the URL via runtime.log().
        // Capture it by parsing the log output.
        const runtime = {
          log: (msg: string) => {
            const match = msg.match(/https:\/\/auth\.openai\.com\/oauth\/authorize\?[^\s\n"']+/);
            if (match) {authorizeUrl = match[0];}
          },
          error: () => {},
        };

        const done = (async (): Promise<{ success: boolean; error?: string }> => {
          try {
            await loginOpenAICodexOAuth({
              prompter: prompter as never,
              runtime: runtime as never,
              isRemote: true,
              openUrl: async () => {},
            });
            return { success: true };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        })();

        // Wait for authorize URL.
        const start = Date.now();
        let earlyError: string | undefined;
        while (!authorizeUrl && !earlyError && Date.now() - start < 15_000) {
          const race = await Promise.race([
            done.then((r) => r.success ? null : r.error),
            new Promise<undefined>((r) => setTimeout(r, 200)),
          ]);
          if (typeof race === "string") {
            earlyError = race;
          }
        }
        if (earlyError) {
          return { text: `Failed to start OAuth: ${earlyError}` };
        }
        if (!authorizeUrl) {
          return { text: "Timed out waiting for authorize URL." };
        }

        const bindResult = await ctx.requestConversationBinding({
          summary: "Waiting for OAuth callback URL paste",
          detachHint: "/auth-codex",
        });

        const key = ctx.sessionKey ?? `${ctx.channel}:${ctx.from ?? ctx.accountId ?? "default"}`;

        if (bindResult.status === "error") {
          pendingOAuth.set(key, {
            resolveCode,
            done,
            detach: async () => ({ removed: false }),
            startedAt: Date.now(),
          });
          return {
            text: [
              "Sign in to OpenAI Codex:",
              authorizeUrl,
              "",
              "After signing in, your browser will show a connection error page.",
              "Copy the full URL from the address bar and paste it here.",
            ].join("\n"),
          };
        }

        pendingOAuth.set(key, {
          resolveCode,
          done,
          detach: ctx.detachConversationBinding,
          startedAt: Date.now(),
        });

        const body = [
          "Sign in to OpenAI Codex:",
          authorizeUrl,
          "",
          "After signing in, your browser will show a connection error page.",
          "Copy the full URL from the address bar and paste it here.",
        ].join("\n");

        if (bindResult.status === "pending") {
          return { ...bindResult.reply, text: body };
        }

        return { text: body };
      },
    });
  },
});
