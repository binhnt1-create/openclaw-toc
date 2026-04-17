# Plugins & Skills in OpenClaw

## What is a Plugin?

A **plugin** is the primary extension mechanism in OpenClaw. Plugins are self-contained TypeScript packages that register new capabilities into OpenClaw's central registry — things like messaging channels, AI model providers, agent tools, CLI commands, HTTP routes, and background services.

Plugins run **in-process** and communicate with core exclusively through the Plugin SDK (`openclaw/plugin-sdk/*`).

---

## Three Plugin Types

### 1. Channel Plugins

Connect OpenClaw to a messaging platform.

- Own account resolution, security policy, pairing, threading, and outbound delivery.
- The core `message` tool handles sending/editing/reacting generically.
- Examples: Discord, Telegram, Slack, iMessage, Signal, Matrix, WhatsApp, Zalo.

### 2. Provider Plugins

Add AI model capabilities to OpenClaw.

Providers can register one or more of:
- Text inference (LLM)
- Speech synthesis / recognition (TTS/STT)
- Image generation
- Media understanding (vision, audio analysis)
- Web search
- CLI backend (local inference via CLI tools)

Examples: `anthropic`, `openai`, `elevenlabs`, `moonshot`.

### 3. General Plugins

Everything else — tools, commands, hooks, HTTP routes, services, memory engines, context engines.

---

## Creating a Plugin

### Required Files

Every native plugin needs **at minimum** three files:

```
my-plugin/
├── package.json           # npm metadata + openclaw block
├── openclaw.plugin.json   # Plugin manifest (read before code runs)
└── index.ts               # Entry point
```

A full channel plugin looks like:

```
my-channel/
├── package.json
├── openclaw.plugin.json
├── index.ts               # defineChannelPluginEntry
├── setup-entry.ts         # lightweight setup-only entry (optional but recommended)
├── api.ts                 # public exports barrel (for core to consume)
├── runtime-api.ts         # runtime-only exports barrel
└── src/
    ├── channel.ts         # ChannelPlugin object
    ├── channel.setup.ts   # Setup wizard
    ├── runtime.ts         # Runtime initializer
    └── ...
```

---

### Step 1 — `package.json`

```json
{
  "name": "@myorg/openclaw-my-plugin",
  "version": "1.0.0",
  "type": "module",
  "devDependencies": {
    "openclaw": "workspace:*"
  },
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
  }
}
```

Key `openclaw` block fields:

| Field | Purpose |
|-------|---------|
| `extensions` | Entry point file(s) relative to package root |
| `setupEntry` | Lightweight setup-only entry (channel plugins) |
| `channel` | Channel metadata: `id`, `label`, `docsPath`, etc. |
| `install.npmSpec` | npm package name (for `openclaw plugins install`) |
| `compat` | Minimum version requirements (for ClawHub publish) |
| `build` | SDK version used at build time |

For a **channel plugin**, add a `channel` block:

```json
{
  "openclaw": {
    "extensions": ["./index.ts"],
    "setupEntry": "./setup-entry.ts",
    "channel": {
      "id": "my-channel",
      "label": "My Channel",
      "selectionLabel": "My Channel (Bot API)",
      "docsPath": "/channels/my-channel",
      "markdownCapable": true
    },
    "install": {
      "npmSpec": "@myorg/openclaw-my-channel"
    }
  }
}
```

---

### Step 2 — `openclaw.plugin.json`

Read **before** any plugin code runs. Used for config validation and manifest checks.

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "Adds a custom tool to OpenClaw",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

**Required fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `string` | Canonical plugin id — matches `plugins.entries.<id>` |
| `configSchema` | JSON Schema | Validates plugin config (must be present, even if empty) |

**Common optional fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Human-readable display name |
| `description` | `string` | Short summary |
| `enabledByDefault` | `boolean` | Auto-enable without user config (bundled plugins only) |
| `channels` | `string[]` | Channel ids owned by this plugin |
| `providers` | `string[]` | Provider ids owned by this plugin |
| `cliBackends` | `string[]` | CLI backend ids owned |
| `skills` | `string[]` | Relative paths to skill directories |
| `kind` | `"memory"` \| `"context-engine"` | Exclusive slot (only one active at a time) |
| `providerAuthEnvVars` | `Record<string, string[]>` | Env vars checked for auth without loading plugin code |
| `providerAuthChoices` | `object[]` | Auth method metadata for onboarding UI |
| `contracts` | `object` | Static capability snapshot for bundled contract checks |
| `uiHints` | `Record<string, object>` | Field labels, placeholders, sensitivity hints |

**Provider plugin example (Moonshot):**

```json
{
  "id": "moonshot",
  "enabledByDefault": true,
  "providers": ["moonshot"],
  "providerAuthEnvVars": { "moonshot": ["MOONSHOT_API_KEY"] },
  "providerAuthChoices": [
    {
      "provider": "moonshot",
      "method": "api-key",
      "choiceId": "moonshot-api-key",
      "choiceLabel": "Moonshot API key (.ai)",
      "optionKey": "moonshotApiKey",
      "cliFlag": "--moonshot-api-key"
    }
  ],
  "contracts": {
    "mediaUnderstandingProviders": ["moonshot"],
    "webSearchProviders": ["kimi"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "webSearch": {
        "type": "object",
        "properties": {
          "apiKey": { "type": ["string", "object"] },
          "baseUrl": { "type": "string" },
          "model": { "type": "string" }
        }
      }
    }
  }
}
```

---

### Step 3 — Entry Point (`index.ts`)

**General plugin (tools, providers, hooks):**

```typescript
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";

export default definePluginEntry({
  id: "my-plugin",
  name: "My Plugin",
  description: "Adds a custom tool to OpenClaw",
  configSchema: { type: "object", additionalProperties: false },

  register(api) {
    // Read plugin-specific config from openclaw config
    const myApiKey = api.pluginConfig.apiKey as string | undefined;

    api.registerTool({
      name: "my_tool",
      description: "Do a thing",
      parameters: Type.Object({
        input: Type.String({ description: "Input text" }),
      }),
      async execute(_id, params) {
        return {
          content: [{ type: "text", text: `Got: ${params.input}` }],
        };
      },
    });

    api.registerHook(["before_tool_call"], async (ctx) => {
      api.logger.debug("Tool call intercepted", ctx);
    });
  },
});
```

**Channel plugin:**

```typescript
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { myChannelPlugin } from "./src/channel.js";
import { setMyChannelRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "my-channel",
  name: "My Channel",
  description: "My channel plugin",
  plugin: myChannelPlugin,
  setRuntime: setMyChannelRuntime,

  registerCliMetadata(api) {
    // Runs early for CLI root help — keep it lightweight, no heavy imports
  },
  registerFull(api) {
    // Full runtime registration, skipped when channel is disabled
    api.registerHook(["message_sending"], async (ctx) => {
      // intercept outgoing messages
    });
  },
});
```

**Setup entry (`setup-entry.ts`) — recommended for channel plugins:**

```typescript
import { defineSetupPluginEntry } from "openclaw/plugin-sdk/core";
import { myChannelSetupPlugin } from "./src/channel.setup.js";

export default defineSetupPluginEntry(myChannelSetupPlugin);
```

OpenClaw loads only the setup entry when:
- The channel is disabled but needs onboarding
- The channel is enabled but not yet configured
- Deferred loading is active

The setup entry must **not** include CLI registrations, background services, or heavy runtime imports.

---

### Step 4 — Local Barrel Files (recommended pattern)

Inside a plugin, **never** self-import via `openclaw/plugin-sdk/<id>`. Use a local barrel instead:

```typescript
// api.ts — public exports for external consumers (core, tests)
export { resolveAccountPolicy } from "./src/accounts.js";
export { getMyChannelRuntime } from "./src/runtime.js";

// In index.ts — import locally, not via SDK
import { myChannelPlugin } from "./src/channel.js";       // ✓ correct
// import { myChannelPlugin } from "openclaw/plugin-sdk/my-channel";  // ✗ wrong
```

---

## Plugin Registration API

Inside `register(api)`, call `api.registerXxx()` to declare capabilities.

### Capabilities

| Method | Purpose |
|--------|---------|
| `api.registerProvider(spec)` | LLM text inference provider |
| `api.registerCliBackend(spec)` | Local CLI inference backend |
| `api.registerChannel({ plugin })` | Messaging channel |
| `api.registerSpeechProvider(spec)` | TTS / STT |
| `api.registerMediaUnderstandingProvider(spec)` | Vision / audio analysis |
| `api.registerImageGenerationProvider(spec)` | Image generation |
| `api.registerWebSearchProvider(spec)` | Web search |

### Tools & Commands

| Method | Purpose |
|--------|---------|
| `api.registerTool(tool, opts?)` | Agent tool (pass `optional: true` to make it opt-in) |
| `api.registerCommand(def)` | Custom command (bypasses the LLM loop) |

#### Registering a `/command`

Use `api.registerCommand()` to create a slash command that users can type in any channel (e.g. `/tts`, `/status`). The command **bypasses the LLM** — it runs a direct handler function.

```typescript
api.registerCommand({
  name: "tts",              // user types /tts — no leading slash here
  description: "Toggle text to speech",
  acceptsArgs: true,        // allow /tts hello world
  requireAuth: true,        // only authorized senders (default: true)

  async handler(ctx) {
    // ctx.args        — raw arguments after the command name
    // ctx.channel     — channel surface (e.g. "telegram", "discord")
    // ctx.senderId    — sender identifier
    // ctx.sessionKey  — stable session key for the conversation
    // ctx.config      — current OpenClaw config

    return {
      content: [{ type: "text", text: `Got: ${ctx.args}` }],
    };
  },
});
```

**Command definition fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Command name **without** `/` — e.g. `"tts"` → user types `/tts` |
| `description` | `string` | Shown in `/help` and command menus |
| `nativeNames` | `object` | Platform-specific aliases (Discord slash menu, etc.) |
| `acceptsArgs` | `boolean` | Whether the command accepts arguments after the name |
| `requireAuth` | `boolean` | Only authorized senders may use it (default: `true`) |
| `handler` | `function` | Handler — receives `ctx`, returns a reply payload |

**Platform-specific names** via `nativeNames`:

```typescript
api.registerCommand({
  name: "voice",
  nativeNames: {
    default: "talkvoice",   // name on most channels
    discord: "voice2",      // name on Discord native slash menu
  },
  description: "Start voice mode",
  handler: async (ctx) => { /* ... */ },
});
```

**Priority:** Plugin commands are processed **before** built-in commands and before agent invocation. If a plugin command name collides with a built-in, the plugin wins.

### Infrastructure

| Method | Purpose |
|--------|---------|
| `api.registerHook(events, handler, opts?)` | Event hook |
| `api.registerHttpRoute(params)` | Gateway HTTP endpoint |
| `api.registerGatewayMethod(name, handler)` | Gateway RPC method |
| `api.registerCli(registrar, opts?)` | CLI subcommand |
| `api.registerService(service)` | Background service |

### Exclusive Slots (one active at a time)

| Method | Purpose |
|--------|---------|
| `api.registerContextEngine(id, factory)` | Context engine |
| `api.registerMemoryRuntime(runtime)` | Memory runtime adapter |
| `api.registerMemoryPromptSection(builder)` | Memory prompt section |
| `api.registerMemoryFlushPlan(resolver)` | Memory flush plan |

### API Object Fields

| Field | Type | Purpose |
|-------|------|---------|
| `api.id` | `string` | Plugin id |
| `api.config` | `OpenClawConfig` | Current config snapshot |
| `api.pluginConfig` | `Record<string, unknown>` | Plugin config from `plugins.entries.<id>.config` |
| `api.runtime` | `PluginRuntime` | Runtime helpers |
| `api.logger` | `PluginLogger` | Scoped logger (`debug`, `info`, `warn`, `error`) |
| `api.registrationMode` | `"full"` \| `"setup-only"` \| `"setup-runtime"` \| `"cli-metadata"` | Load mode |
| `api.resolvePath(input)` | `function` | Resolve a path relative to plugin root |

---

## Hook Events

| Hook | When it fires |
|------|--------------|
| `before_tool_call` | Before any agent tool executes |
| `before_model_resolve` | Before a model is selected |
| `before_prompt_build` | Before the prompt is assembled |
| `message_sending` | Before a message is sent to a channel |
| `before_install` | Before a plugin is installed |

---

## Runtime Helpers (`api.runtime`)

### Agent

```typescript
api.runtime.agent.resolveAgentDir(cfg)
api.runtime.agent.resolveAgentWorkspaceDir(cfg)
api.runtime.agent.resolveAgentIdentity(cfg)
api.runtime.agent.runEmbeddedPiAgent({ ... })
```

### Subagent

```typescript
api.runtime.subagent.run({ sessionKey, message, provider?, model? })
api.runtime.subagent.waitForRun({ runId, timeoutMs })
api.runtime.subagent.getSessionMessages({ sessionKey, limit })
api.runtime.subagent.deleteSession({ sessionKey })
```

### Task Flow

```typescript
const taskFlow = api.runtime.taskFlow.fromToolContext(ctx);
const flow = await taskFlow.createManaged({ controllerId, goal });
await taskFlow.runTask({ flowId, ... });
```

### Other Namespaces

- `api.runtime.config.*` — Config load/write
- `api.runtime.directory.*` — Config-backed directory query
- `api.runtime.fetch.*` — Wrapped fetch with proxy/auth
- `api.runtime.approval.*` — Exec/plugin approval helpers

---

## Installing a Plugin

### On OpenClaw (user-facing)

```bash
# From ClawHub (tried first, recommended)
openclaw plugins install clawhub:@myorg/openclaw-my-plugin

# From npm
openclaw plugins install @myorg/openclaw-my-plugin

# From a local directory (development)
openclaw plugins install ./my-plugin

# From a local archive
openclaw plugins install ./my-plugin.tgz
```

After install, restart the gateway:

```bash
openclaw gateway restart
```

### For In-Repo Development (bundled plugins)

Bundled plugins live under `extensions/` in the repository and are **automatically discovered** — no install command needed.

```bash
# 1. Add your plugin folder
mkdir extensions/my-plugin

# 2. pnpm workspace picks it up automatically (pnpm-workspace.yaml includes extensions/*)
pnpm install

# 3. Run and test
pnpm build
pnpm test:extension my-plugin
pnpm check
```

### Plugin Discovery Order

When OpenClaw starts, it scans for plugins in this precedence:

1. `plugins.load.paths` — explicit paths in config
2. Workspace extensions — `<workspace>/.openclaw/<plugin-root>/`
3. Global extensions — `~/.openclaw/<plugin-root>/`
4. Bundled plugins — shipped with OpenClaw (under `dist/extensions/`)

---

## Configuring an Installed Plugin

Plugin config lives in the OpenClaw config file under `plugins.entries.<id>`:

```json5
{
  plugins: {
    entries: {
      "my-plugin": {
        enabled: true,
        config: {
          apiKey: "abc123",
          webhookSecret: "xyz789"
        }
      }
    }
  }
}
```

### Config Commands

```bash
# View config file location
openclaw config file

# Enable / disable a plugin
openclaw config set plugins.entries.my-plugin.enabled true
openclaw config set plugins.entries.my-plugin.enabled false

# Set plugin-specific config
openclaw config set plugins.entries.my-plugin.config.apiKey "abc123"

# Read a config value
openclaw config get plugins.entries.my-plugin.config.apiKey

# Remove a config value
openclaw config unset plugins.entries.my-plugin.config.apiKey

# Store a secret via SecretRef (env var, not plaintext)
openclaw config set plugins.entries.my-plugin.config.apiKey \
  --ref-provider default \
  --ref-source env \
  --ref-id MY_PLUGIN_API_KEY
```

### Allowlist / Denylist

```json5
{
  plugins: {
    allow: ["my-plugin", "discord"],   // only these plugins run
    deny: ["untrusted-plugin"],        // deny wins over allow
  }
}
```

### Exclusive Slots

For `kind: "memory"` or `kind: "context-engine"` plugins, only one is active at a time:

```json5
{
  plugins: {
    slots: {
      memory: "memory-core",
      contextEngine: "legacy"
    }
  }
}
```

---

## Plugin Lifecycle

```
1. Read openclaw.plugin.json          ← no code runs here
2. Validate plugin config schema
3. Check plugins.entries.<id>.enabled
4. Load module in registration mode:
   "full"           → normal gateway startup
   "setup-only"     → disabled/unconfigured channel
   "setup-runtime"  → setup flow with runtime
   "cli-metadata"   → CLI root help capture only
5. Call register(api)
6. Register capabilities into central registry
7. Expose through surfaces: agent tools, CLI, UI, HTTP, services
```

---

## Publishing a Plugin

### To ClawHub (recommended)

```bash
# Dry run first
clawhub package publish @myorg/openclaw-my-plugin --dry-run

# Publish
clawhub package publish @myorg/openclaw-my-plugin
```

Users install it with:

```bash
openclaw plugins install clawhub:@myorg/openclaw-my-plugin
```

### To npm

Publish normally with `npm publish`, then users install with:

```bash
openclaw plugins install @myorg/openclaw-my-plugin
```

---

## Testing a Plugin

```bash
# Run tests for a single extension (in-repo)
pnpm test:extension my-plugin

# List valid extension ids
pnpm test:extension --list

# Test shared plugin contracts
pnpm test:contracts
pnpm test:contracts:channels
pnpm test:contracts:plugins

# Full gate before landing
pnpm build && pnpm check && pnpm test
```

---

## Pre-Submission Checklist

- [ ] `package.json` has correct `openclaw` block (`extensions`, `compat`, `build`)
- [ ] `openclaw.plugin.json` is present and valid (`id` + `configSchema` at minimum)
- [ ] Entry point uses `definePluginEntry` or `defineChannelPluginEntry`
- [ ] All SDK imports use focused `plugin-sdk/<subpath>` paths (not the monolithic root)
- [ ] Internal imports use local barrel files (`./api.ts`, `./runtime-api.ts`), not SDK self-imports
- [ ] `pnpm check` passes
- [ ] `pnpm test:extension my-plugin` passes

---

## Skills

**Skills are a feature within plugins**, not a separate concept.

A skill is a **Markdown file** (`SKILL.md`) describing a specialized agent task. Plugins declare skill directories in their manifest:

```json
{
  "id": "my-plugin",
  "skills": ["./skills"],
  "configSchema": { "type": "object", "additionalProperties": false }
}
```

Each skill directory contains:
- `SKILL.md` — task description, guidelines, and context
- Optional handler code

Internal `.agents/skills/` examples:
- `.agents/skills/openclaw-pr-maintainer/` — maintainer GitHub PR workflows
- `.agents/skills/openclaw-release-maintainer/` — release naming and changelog
- `.agents/skills/openclaw-ghsa-maintainer/` — security advisory patch/publish

---

## SDK Import Rules

Always import from **specific subpaths** — the monolithic root is deprecated:

```typescript
// Correct
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth-api-key";
import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";

// Deprecated — do not use
import { definePluginEntry } from "openclaw/plugin-sdk";
```

Key subpaths:

| Subpath | Contents |
|---------|----------|
| `plugin-sdk/plugin-entry` | `definePluginEntry`, core types |
| `plugin-sdk/core` | `defineChannelPluginEntry`, `createChatChannelPlugin`, channel helpers |
| `plugin-sdk/provider-auth` | Auth method helpers |
| `plugin-sdk/provider-auth-api-key` | API key auth builder |
| `plugin-sdk/provider-model-shared` | Model normalization |
| `plugin-sdk/runtime-store` | `createPluginRuntimeStore` |
| `plugin-sdk/speech` | Speech provider types |
| `plugin-sdk/image-generation` | Image generation types |
| `plugin-sdk/channel-setup` | Channel setup surface |
| `plugin-sdk/channel-pairing` | Pairing controller |
| `plugin-sdk/channel-inbound` | Envelope, debounce, mentions |
| `plugin-sdk/approval-runtime` | Approval helpers |

Full list: `scripts/lib/plugin-sdk-entrypoints.json`

---

## Key Boundaries

- Extensions must only cross into core through `openclaw/plugin-sdk/*` — never import `src/**` from plugin production code.
- Core must not deep-import bundled plugin internals — expose via the plugin's `api.ts` barrel.
- New plugin seams must be additive, backwards-compatible, and versioned.
- Exclusive slots (`kind: "memory"` or `kind: "context-engine"`) allow only one active plugin at a time.
- Plugin runtime deps must be in `dependencies`, not `devDependencies` (`npm install --omit=dev` runs on install).
- Do not use `workspace:*` in `dependencies` — put `openclaw` in `devDependencies` or `peerDependencies`.

---

## Further Reading

- `docs/plugins/building-plugins.md` — step-by-step authoring guide
- `docs/plugins/architecture.md` — architecture overview
- `docs/plugins/sdk-overview.md` — SDK surface reference
- `docs/plugins/sdk-entrypoints.md` — entry point patterns
- `docs/plugins/sdk-runtime.md` — runtime helpers reference
- `docs/plugins/sdk-channel-plugins.md` — channel plugin specifics
- `docs/plugins/sdk-provider-plugins.md` — provider plugin specifics
- `docs/plugins/manifest.md` — full manifest field reference
- `extensions/discord/` — real channel plugin example
- `extensions/anthropic/` — real provider plugin example
