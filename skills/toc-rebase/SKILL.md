---
name: toc-rebase
description: "Manage TOC fork rebase workflow: detect new upstream versions, analyze risk, squash & chained rebase POC commits onto upstream tags, resolve conflicts with injection-point awareness."
metadata: { "openclaw": { "emoji": "🔄", "requires": { "bins": ["gh", "git"] } } }
---

# TOC Rebase Skill

Manage the rebase workflow for the TOC fork against upstream openclaw releases.

## When to Use

- Checking for new upstream versions
- Analyzing risk before rebase
- Performing squash + chained rebase
- Resolving conflicts in TOC injection points

## When NOT to Use

- Regular git operations (commit, push, branch)
- Developing new TOC features → work on `tuandh/poc_custom_openclaw` directly

---

## Quick Commands

### Check for new upstream versions

```bash
bash dev-docs/scripts/check-upstream.sh
```

Or manually:

```bash
git fetch upstream --tags
git tag | grep -E '^v2026\.' | grep -v beta | sort -V | tail -1
```

### View release notes

```bash
gh release view $VERSION --repo openclaw/openclaw
```

---

## Rebase Strategy

**Chained rebase**: each version branches from the previous rebase result.
Squash only happens once on the first version.

```
tuandh/poc_custom_openclaw (many commits)
    ↓ squash + rebase --onto v2026.4.20 origin/main
rebase-vs-v2026.4.20  (1 squashed commit)
    ↓ rebase --onto v2026.4.21 v2026.4.20
rebase-vs-v2026.4.21
    ↓ ...
rebase-vs-$LATEST
```

---

## Workflow

### Step 0 — Analyze release & create risk file

Read the release notes and compare with TOC injection points.
Create `dev-docs/rebase/$VERSION.md` with:

- Summary of upstream changes
- Risk table per change (relevant to TOC files only):
  - 🔴 CAO — upstream changes exact zone of TOC injection
  - 🟡 TRUNG — upstream changes same file, different area
  - 🟢 THẤP — no direct impact
- Checklist of things to verify after rebase

**Files that can conflict** (upstream-owned, TOC injects into):

| File | TOC touches |
|---|---|
| `ui/src/ui/views/chat.ts` | 9 injection points (see below) |
| `ui/src/ui/controllers/app-chat.ts` | `refreshTocSkillCommands` in connect |

**Files that never conflict** (TOC-owned, new files):

- `ui/src/ui/chat/input-bar-extras.ts`
- `ui/src/ui/chat/toc-slash-commands.ts`
- `ui/src/styles/chat/input-bar-extras.css`

### Step 1 — Create branch

**First time** (from POC branch):

```bash
git checkout -b rebase-vs-$VERSION tuandh/poc_custom_openclaw
```

**Chained** (from previous version):

```bash
git checkout -b rebase-vs-$VERSION rebase-vs-$PREV
```

### Step 2 — Squash (first time only)

```bash
git rebase -i origin/main
# Change all lines except first to "s" (squash)
# Message: "feat(toc): skill mention layer — squashed"
```

### Step 3 — Rebase

**First time:**

```bash
git fetch upstream --tags
git rebase --onto $VERSION origin/main
```

**Chained:**

```bash
git fetch upstream --tags
git rebase --onto $VERSION $PREV
```

### Step 4 — Verify & push

```bash
pnpm install     # if package.json changed
pnpm check       # lint + typecheck
pnpm build       # if build output affected
git push origin rebase-vs-$VERSION
```

Fill results in `dev-docs/rebase/$VERSION.md`.

---

## Conflict Resolution Rules

### Direction

In rebase, labels are **reversed** vs merge:

| Marker | Is | Keep when |
|---|---|---|
| `<<<<<<< HEAD` (Current) | **Upstream** code | Change is unrelated to TOC |
| `>>>>>>> feat(toc)...` (Incoming) | **TOC POC** code | Change is in a TOC injection point |

### Decision rules

1. **Unrelated to TOC custom** → Accept Current (upstream HEAD)
2. **Conflict in a TOC injection point** → Combine both: keep upstream refactoring + re-apply TOC injection
3. **Upstream refactored a function that TOC injects into** → Adapt injection to new upstream structure (e.g., `renderChatRunControls` replacing inline toolbar)

### Naming convention for TOC code

- File names: prefix `toc-` (e.g., `toc-slash-commands.ts`)
- Variables, functions, classes: prefix `toc` (e.g., `tocState`, `refreshTocSkillCommands`)

---

## 9 Injection Points in `chat.ts`

These must survive every rebase. Verify each one after conflict resolution.

```ts
// 1. Import block
import { handleMentionKeyDown, renderFuncButton, renderMentionMenu,
         renderSkillBadgeBar, sendWithSkills, tryRenderSkillMessage,
         updateMentionMenu } from "../chat/input-bar-extras.ts";

// 2. Message loop — before renderMessageGroup
const skillMsg = tryRenderSkillMessage(item);
if (skillMsg !== nothing) return skillMsg;

// 3. handleKeyDown — first line
if (handleMentionKeyDown(e, props, requestUpdate)) return;

// 4. handleKeyDown — Enter to send
sendWithSkills(props, inputHistory);

// 5. handleInput — after updateSlashMenu
updateMentionMenu(target.value, requestUpdate);

// 6. Input bar template — before renderSlashMenu
${renderMentionMenu(requestUpdate, props)} ${renderSlashMenu(requestUpdate, props)}

// 7. Input bar template — above textarea
${renderSkillBadgeBar(requestUpdate)}

// 8. Toolbar-left — first button
${renderFuncButton(requestUpdate, props)}

// 9. Send button onSend (may be inline @click or renderChatRunControls prop)
onSend: () => sendWithSkills(props, inputHistory)
```

---

## Risk Analysis Template

Each `dev-docs/rebase/$VERSION.md`:

```markdown
# Rebase Analysis — $VERSION

- Release date: YYYY-MM-DD
- URL: https://github.com/openclaw/openclaw/releases/tag/$VERSION

## Summary

(Brief summary of major changes)

## Risk Assessment

| Upstream change | File | Injection point | Risk |
|---|---|---|---|
| ... | ... | ... | 🔴/🟡/🟢 |

## Verification checklist

(Specific things to check after rebase)

## Results

- Branch: `rebase-vs-$VERSION`
- Date: —
- Conflicts: —
- Resolution: —
- pnpm check: —
```
