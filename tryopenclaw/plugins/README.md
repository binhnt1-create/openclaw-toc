# OpenClaw Plugins

Third-party plugins for [OpenClaw](https://github.com/openclaw/openclaw). Each subfolder is a standalone plugin that can be installed into any OpenClaw gateway.

## Plugins

| Plugin | Command | Description |
|---|---|---|
| [auth-codex](./auth-codex/) | `/auth-codex` | Sign in to OpenAI Codex via OAuth |
| [agent-bundle-installer](./agent-bundle-installer/) | `/agent-add` | Install portable agent bundles |

---

## How to create a new plugin

### 1. Create the folder

```bash
mkdir plugins/<plugin-name>
cd plugins/<plugin-name>
```

### 2. Create `package.json`

Full reference: [Package metadata](https://docs.openclaw.ai/plugins/sdk-setup#package-metadata) (Plugin Setup and Config).

**General / provider plugin** (ClawHub publish baseline from the docs):

```json
{
  "name": "@myorg/openclaw-<plugin-name>",
  "version": "1.0.0",
  "type": "module",
  "openclaw": {
    "extensions": ["./index.ts"],
    "compat": {
      "pluginApi": ">=2026.3.24-beta.2",
      "minGatewayVersion": "2026.3.24-beta.2"
    },
    "build": {
      "openclawVersion": "2026.3.24-beta.2",
      "pluginSdkVersion": "2026.3.24-beta.2"
    }
  },
  "devDependencies": {
    "openclaw": "*"
  }
}
```

For ClawHub publishing, `compat` and `build` are required. Canonical snippets live in `docs/snippets/plugin-publish/` in the OpenClaw repo.

**Channel plugin** — add `setupEntry` and `openclaw.channel` (minimal example):

```json
{
  "name": "@myorg/openclaw-my-channel",
  "version": "1.0.0",
  "type": "module",
  "openclaw": {
    "extensions": ["./index.ts"],
    "setupEntry": "./setup-entry.ts",
    "channel": {
      "id": "my-channel",
      "label": "My Channel",
      "blurb": "Short description of the channel."
    }
  }
}
```

Summary of top-level `openclaw` fields:

| Field | Description |
| --- | --- |
| `extensions` | `string[]` — entry files (relative to package root) |
| `setupEntry` | `string` — lightweight setup-only entry (optional) |
| `channel` | Channel catalog metadata for setup, picker, quickstart, and status |
| `providers` | `string[]` — provider ids registered by this plugin |
| `install` | Install hints: `npmSpec`, `localPath`, `defaultChoice`, `minHostVersion`, `allowInvalidConfigRecovery` |
| `startup` | Startup behavior flags (e.g. deferred channel load) |

See [Plugin Setup and Config](https://docs.openclaw.ai/plugins/sdk-setup) for `openclaw.channel`, `openclaw.install`, and deferred full load.

### 3. Create `openclaw.plugin.json`

```json
{
  "id": "<plugin-name>",
  "name": "My Plugin",
  "description": "What this plugin does.",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### 4. Create `index.ts`

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "<plugin-name>",
  name: "My Plugin",
  description: "What this plugin does.",
  register(api) {

    // Register a slash command
    api.registerCommand({
      name: "<plugin-name>",
      description: "Short description shown in /commands",
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const args = ctx.args?.trim() ?? "";
        return { text: `Hello from my plugin! Args: ${args}` };
      },
    });

  },
});
```

### 5. Install dependencies and typecheck

```bash
npm install
```

### 6. Test locally

```bash
openclaw plugins install /path/to/plugins/<plugin-name>
# Restart gateway, then use the command in chat
```

If blocked by the security scan, force install with:

```bash
openclaw plugins install --dangerously-force-unsafe-install /path/to/plugins/<plugin-name>
```

---

## Plugin SDK quick reference

All imports go through `openclaw/plugin-sdk/*`. Common subpaths:

| Import | Use |
|---|---|
| `openclaw/plugin-sdk/plugin-entry` | `definePluginEntry` — required entry point |
| `openclaw/plugin-sdk/core` | `OpenClawPluginApi`, `OpenClawPluginCommandDefinition` types |
| `openclaw/plugin-sdk/provider-auth-login` | `loginOpenAICodexOAuth` and other provider auth helpers |

### Plugin API methods

| Method | What it does |
|---|---|
| `api.registerCommand(def)` | Register a `/command` that bypasses the AI |
| `api.registerTool(tool)` | Register an agent tool the AI can call |
| `api.registerHook(event, handler)` | Listen to gateway events |
| `api.on(hookName, handler)` | Typed hook listener |
| `api.registerService(service)` | Register a background service |

### Command handler context (`ctx`)

| Field | Type | Description |
|---|---|---|
| `ctx.args` | `string?` | Raw arguments after the command name |
| `ctx.channel` | `string` | Channel (e.g. "telegram", "discord") |
| `ctx.isAuthorizedSender` | `boolean` | Whether sender is on the allowlist |
| `ctx.sessionKey` | `string?` | Stable conversation identifier |
| `ctx.config` | `OpenClawConfig` | Current gateway config |
| `ctx.requestConversationBinding()` | function | Bind conversation so plain messages route to the plugin |
| `ctx.detachConversationBinding()` | function | Release the binding |

### Hook names

Common hooks for `api.on(hookName, handler)`:

| Hook | Fires when | Return to intercept |
|---|---|---|
| `before_dispatch` | Any message before AI dispatch | `{ handled: true, text: "reply" }` |
| `message_received` | Message received (observe only) | — |
| `message_sending` | Bot is about to send a message | `{ content: "override" }` |
| `gateway_start` | Gateway starts | — |
| `gateway_stop` | Gateway stops | — |

---

## Distribution

See [EXPORT.md](./EXPORT.md) for how to package and send plugins to users.
