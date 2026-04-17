# OpenClaw — Project Overview

## What is OpenClaw?

OpenClaw is a **self-hosted personal AI assistant platform** — a multi-channel AI gateway that lets you run a single AI assistant across 20+ messaging platforms on your own devices. Think of it as a private, extensible bridge between you and AI models, reachable from WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Matrix, and many more.

It is open-source (MIT licensed), published as the `openclaw` npm package.

---

## Core Purpose

- One AI assistant, many messaging surfaces — all self-hosted for privacy.
- Extensible via a plugin system (custom channels, providers, tools).
- Supports multiple LLM providers (Anthropic Claude, OpenAI, Google Vertex, AWS Bedrock) with failover.
- Voice/speech support on macOS, iOS, and Android.
- Live Canvas UI for rich interactions.

---

## Key Technologies

| Area | Stack |
|------|-------|
| Runtime | Node.js 22+/24, TypeScript 6 (ESM) |
| HTTP | Express 5, Hono |
| AI Protocols | MCP v1.29, ACP v0.17 |
| Storage | SQLite + vec extensions (embeddings), Zod validation |
| Media | Sharp (images), Playwright (web rendering), pdfjs-dist (PDFs) |
| Transport | WebSockets, undici |
| Package mgr | pnpm (primary), Bun (scripts/dev/tests) |
| Test framework | Vitest (V8 coverage) |

---

## Architecture at a Glance

```
src/
├── cli/            CLI wiring and commands
├── commands/       326+ command implementations
├── channels/       75+ messaging platform integrations
├── agents/         693 agent runtime implementations
├── gateway/        Core routing, orchestration, server config
├── plugin-sdk/     Public plugin contract (external extension surface)
├── plugins/        Plugin discovery, manifest validation, loader, registry
├── config/         255+ config modules
├── sessions/       Conversation session state & persistence
├── flows/          Workflow automation engine
├── routing/        Message flow and decision routing
├── mcp/            Model Context Protocol server integration
├── secrets/        Auth & credential management
├── canvas-host/    Live UI/Canvas rendering
├── tui/            Terminal User Interface
├── cron/           Scheduled task execution
├── media/          Media pipeline (images, docs, etc.)
├── tts/            Speech synthesis & voice I/O
├── web-fetch/      External information retrieval
└── context-engine/ Context management for conversations
```

Entry point: `src/entry.ts` → builds to `openclaw.mjs` CLI binary.

---

## Plugin System

- Plugins live in the bundled workspace plugin tree (workspace packages).
- Public contract: `src/plugin-sdk/*` — the only surface third-party plugins may import.
- Plugin manifest: `openclaw.plugin.json` per plugin.
- Three plugin types: channel plugins, provider plugins, general capability plugins.

---

## Messaging Channels (built-in + extensions)

WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, Teams, WeChat, Zalo, ZaloUser, Twitch, IRC, Voice Call, and more.

---

## CLI Usage

```bash
# Install
npm i -g openclaw

# Run gateway
openclaw gateway run

# Check channel status
openclaw channels status --probe

# Send a message
openclaw message send
```

---

## Docs

- Public docs: https://docs.openclaw.ai
- Repo: https://github.com/openclaw/openclaw
