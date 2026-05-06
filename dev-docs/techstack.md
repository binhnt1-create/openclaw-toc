# OpenClaw — Dev Docs (Custom Fork Notes)

Branch: `tuandh/poc_custom_openclaw`

---

## Version

**OpenClaw `2026.4.14`** — date-based versioning (year.month.day).

---

## Tech Stack

### Runtime & Package Management

| Tool        | Version   | Role                                           |
| ----------- | --------- | ---------------------------------------------- |
| **Node.js** | ≥ 22.14.0 | Runtime for built output (`dist/`) and scripts |
| **Bun**     | latest    | Preferred runner for TS scripts and dev server |
| **pnpm**    | locked    | Package manager (`pnpm-lock.yaml`)             |

### UI Layer (`ui/`)

| Tool             | Version  | Role                                            |
| ---------------- | -------- | ----------------------------------------------- |
| **Lit 3**        | `^3.3.2` | Core UI framework (web components + templates)  |
| **Vite 8**       | `8.0.8`  | Bundler and dev server for the Control UI       |
| **TypeScript 6** | `^6.0.2` | Type system; `pnpm tsgo` uses native TS preview |
| **Vitest 4**     | `4.1.4`  | Test runner (with Playwright for browser tests) |

### Code Quality

| Tool       | Version   | Role                                      |
| ---------- | --------- | ----------------------------------------- |
| **Oxlint** | `^1.59.0` | Linter (Rust-based, replaces ESLint)      |
| **Oxfmt**  | via pnpm  | Formatter (Rust-based, replaces Prettier) |

---

## UI Architecture

### Two Lit patterns used in this project

**Pattern 1 — `LitElement` (class-based web component)**

Used for: root app (`app.ts`) and self-contained components with their own lifecycle.

```ts
// app.ts, resizable-divider.ts
@customElement("openclaw-app")
class OpenClawApp extends LitElement {
  @state() messages = []; // reactive — triggers re-render automatically
  render() {
    return html`...`;
  }
}
```

**Pattern 2 — Pure render function (no class, no lifecycle)**

Used for: views and sub-views like `chat.ts`.

```ts
// chat.ts — dominant pattern for views
export function renderChat(props: ChatProps): TemplateResult {
  return html`<div>...</div>`;
}
```

No lifecycle hooks, no reactive state. The parent `LitElement` owns the re-render cycle.

### View state (`vs`) in `chat.ts`

- `vs` is a **plain mutable object** (not Lit-reactive).
- Mutating `vs` alone does NOT trigger a re-render.
- Must call `requestUpdate()` (callback from parent) after each mutation.
- This is "managed from outside" — parent `LitElement` is the single source of truth for renders.

---

## Directory Structure (`ui/src/`)

```
ui/src/
├── ui/
│   ├── app.ts              ← Root LitElement (@state, @customElement, full lifecycle)
│   ├── views/
│   │   └── chat.ts         ← Pure function → TemplateResult (no class)
│   ├── chat/               ← Pure utilities (no rendering)
│   │   ├── slash-commands.ts   ← SLASH_COMMANDS[], getSlashCommandCompletions()
│   │   ├── speech.ts
│   │   └── ...
│   └── components/
│       └── resizable-divider.ts  ← LitElement (isolated web component)
└── styles/
    └── chat/               ← CSS separated by concern
        ├── layout.css          ← Input bar, toolbar, split layout
        ├── tool-cards.css
        └── ...
```

---

## Slash Commands / Skills API

The existing `SLASH_COMMANDS` reactive array in `ui/src/ui/chat/slash-commands.ts` is the data source for installed skills/commands.

Key exports:

```ts
// Live-updated array — reflects currently installed commands from gateway
export const SLASH_COMMANDS: SlashCommandDef[];

// Filtered + sorted completions
export function getSlashCommandCompletions(filter: string): SlashCommandDef[];

// Human-readable category labels
export const CATEGORY_LABELS: Record<SlashCommandCategory, string>;
// → { session: "Session", model: "Model", agents: "Agents", tools: "Tools" }
```

`SlashCommandDef` shape:

```ts
type SlashCommandDef = {
  key: string;
  name: string;
  aliases?: string[];
  description: string;
  args?: string;
  icon?: IconName;
  category?: "session" | "model" | "agents" | "tools";
  executeLocal?: boolean;
  argOptions?: string[];
  shortcut?: string;
};
```

---

## Custom Changes (this branch)

### Input Bar Extras

Goal: add a "+" button in the toolbar-left that opens a dropdown of skills/commands.

**Strategy: minimal diff to upstream, maximum isolation in new files.**

Files changed in `chat.ts`: **2 lines only**

1. `import { renderFuncButton } from "../chat/input-bar-extras.ts";`
2. `${renderFuncButton(vs, requestUpdate, props)}` in toolbar-left

New file: `ui/src/ui/chat/input-bar-extras.ts`

- Pure render function (same pattern as `chat.ts` sub-renderers)
- Uses `SLASH_COMMANDS` directly — no new data layer
- Click a skill → calls `props.onDraftChange(props.draft + "/" + skill.name + " ")`
- No new CSS files; reuses existing `btn`, `btn--ghost`, `agent-chat__input-btn` classes

**Rebase cost when upstream updates `chat.ts`:** re-insert 2 lines only.

---

## Common Commands

```bash
pnpm install          # install deps
pnpm build            # type-check + build (dist/)
pnpm tsgo             # TypeScript check only
pnpm check            # lint + format check (local dev gate)
pnpm format:fix       # auto-format with oxfmt
pnpm test             # run vitest
pnpm openclaw ...     # run CLI via bun in dev
```

docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml up --build
