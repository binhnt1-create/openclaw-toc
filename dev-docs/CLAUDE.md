# Custom Fork — Development Rules

These rules apply to all work on branch `tuandh/poc_custom_openclaw`.
They override default behavior when there is a conflict.

---

## Core Principles

**1. Leverage existing openclaw functions first.**
Before writing any new utility, check if openclaw already provides it.
- UI data: prefer `SLASH_COMMANDS`, `getSlashCommandCompletions`, `CATEGORY_LABELS` from `ui/src/ui/chat/slash-commands.ts`
- Icons: use the existing `icons` object from `ui/src/ui/icons.ts`
- CSS: reuse existing classes (`btn`, `btn--ghost`, `agent-chat__input-btn`, etc.) before adding new ones
- Patterns: follow the pure-function render pattern used throughout `ui/src/ui/views/`

**2. Always think about syncing with upstream.**
Every line changed in an existing file is a potential rebase conflict.
Before modifying any existing file, ask: can this live in a new file instead?
- New files = zero upstream conflict
- Changes to existing files = rebase cost on every upstream update

**3. Minimize modifications to existing files.**
Target: each existing file touched should have the fewest lines changed possible.
- Prefer adding a single `${renderCustomThing(...)}` call in an existing template over restructuring the template
- Prefer adding a single `import` over multiple imports
- Never refactor surrounding code just because you are nearby

---

## Injection Rules for `chat.ts`

`ui/src/ui/views/chat.ts` is the highest-conflict file in this fork.
Keep the diff to **2 lines maximum**:

```ts
// Line 1 — one import at top
import { renderFuncButton } from "../chat/input-bar-extras.ts";

// Line 2 — one expression in toolbar-left
${renderFuncButton(vs, requestUpdate, props)}
```

Do not touch any other part of `chat.ts` unless absolutely required.

---

## File Strategy

| What | Where | Rule |
|---|---|---|
| New render helpers | `ui/src/ui/chat/input-bar-extras.ts` | New file, no upstream conflict |
| New CSS | Inline in template or append to existing file | Prefer reuse over new files |
| New types | Inside the new helper file | Do not extend `ChatProps` in `chat.ts` |
| Data sources | Existing openclaw exports only | No new registries or fetch calls |

---

## Rebase Workflow

When upstream `main` advances:

1. `git fetch origin`
2. `git rebase origin/main` — prioritize custom changes when conflicts arise
3. Re-insert the 2-line injection into `chat.ts` if it was overwritten
4. Run `pnpm check` to verify nothing broke
5. Custom files (`input-bar-extras.ts`, `dev-docs/`) will never conflict — upstream does not touch them

---

## What NOT to Do

- Do not add new props to `ChatProps` — use existing props or close-over local state
- Do not create a new CSS file unless the feature is large enough to justify it
- Do not mock or replace openclaw's existing data layer — consume it as-is
- Do not add complex badge rendering that requires replacing `<textarea>` with `contenteditable`
- Do not introduce new package dependencies for UI customizations
