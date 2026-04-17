# Claude Notes for OpenClaw

This file records how I (Claude Code) approach working in this repo.

---

## Memory System

Claude Code has a persistent memory system stored at:
```
~/.claude/projects/-Users-binhnt1-Documents-projects-openclaw/memory/
```

Memory is organized by type and indexed in `MEMORY.md` in that directory.

### Memory Types

| Type | What it stores | Example |
|------|---------------|---------|
| `user` | Who you are, your role, preferences, knowledge level | "user is experienced with TypeScript, new to the plugin system" |
| `feedback` | How you want me to work — corrections AND confirmations | "don't mock the DB in tests", "keep replies terse" |
| `project` | Ongoing work, goals, bugs, deadlines | "auth middleware rewrite is compliance-driven" |
| `reference` | Where to find things in external systems | "bugs tracked in Linear project INGEST" |

### How Memory Files Look

Each memory is a Markdown file with frontmatter:

```markdown
---
name: User role
description: User is a senior engineer focused on plugin system
type: user
---

User is a senior TypeScript engineer, primary focus on the OpenClaw plugin SDK
and channel plugin development.
```

`MEMORY.md` in the memory directory is an index — one line per memory file.

### When I Save Memories

- You say "remember that..." → I save immediately.
- I learn something non-obvious about your preferences → I save.
- A correction: "don't do X" → I save with the reason.
- A confirmation of a non-obvious choice: "yes, that was right" → I save.

### When I Load Memories

- At the start of every conversation (MEMORY.md index is always loaded).
- When a task seems related to a past decision.
- When you say "check what you remember about X".

### What I Do NOT Save

- Code patterns, file paths, architecture — readable from the repo.
- Git history — `git log`/`git blame` are authoritative.
- Debugging recipes — the fix is in the code.
- In-progress task details — those belong in TodoWrite tasks, not memory.

---

## This Folder (`my-docs/`)

| File | Purpose |
|------|---------|
| `project-overview.md` | High-level summary of what OpenClaw is |
| `claude.md` | This file — how Claude Code works in this repo |

---

## Key Repo Facts (quick ref)

- Package manager: `pnpm` (dev scripts use `bun`)
- Type-check: `pnpm build` / `pnpm tsgo`
- Lint/format: `pnpm check` / `pnpm format:fix`
- Tests: `pnpm test` (Vitest, forks pool only)
- Commits: use `scripts/committer "<msg>" <file...>` (not manual `git add`)
- Plugin SDK public surface: `src/plugin-sdk/*` — never import `src/**` from extensions
- Docs: https://docs.openclaw.ai
