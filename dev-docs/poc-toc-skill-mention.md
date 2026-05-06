# POC: TOC Skill Mention Layer

Branch: `tuandh/poc_custom_openclaw`

## Overview

Added a skill mention/selection system to the chat UI, separate from the existing slash-command system. Users can pick skills from a dropdown or type `@skill_name` in the input to compose messages with skill prefixes.

## New Files

### `ui/src/ui/chat/input-bar-extras.ts`

Contains all TOC-specific UI logic. Maintains its own isolated module-level state (`tocState`) so `chat.ts` needs zero state changes.

**Exports:**

- `parseSkillsFromText(text)` — extracts leading `@skill_name` tokens from a message
- `buildDraftWithSkills(skills, text)` — prepends `@skill` prefixes to draft text
- `renderSkillBadgeBar(requestUpdate)` — removable badge pills for selected skills
- `renderSkillBadgesInline(skills)` — skill header row inside sent message bubbles
- `renderFuncButton(requestUpdate, props)` — zap button + dropdown menu
- `renderMentionMenu(requestUpdate, props)` — `@mention` autocomplete picker (independent of slash menu)
- `updateMentionMenu(value, requestUpdate)` — filters skills when user types `@...`
- `handleMentionKeyDown(e, props, requestUpdate)` — keyboard nav for mention menu; returns `true` if event was consumed
- `sendWithSkills(props, inputHistory)` — prepends selected skills to draft then calls `props.onSend()`
- `tryRenderSkillMessage(item)` — renders user message with skill badges if it has `@skill` prefix; returns `nothing` otherwise

**Internal state (`tocState`):**

- `selectedSkills` — skills chosen via dropdown or `@mention`
- `funcDropdownOpen` — zap dropdown open/close
- `mentionMenuOpen / mentionMenuItems / mentionMenuIndex` — `@mention` autocomplete state

### `ui/src/ui/chat/toc-slash-commands.ts`

Maintains a separate `SKILL_COMMANDS` array (independent of `SLASH_COMMANDS`):

- `getSkillCompletions(filter)` — filters skills by partial name for `@mention` autocomplete
- `refreshTocSkillCommands({ client, agentId })` — fetches `commands.list` from the gateway, keeps only `source === "skill"` entries, populates `SKILL_COMMANDS`

### `ui/src/styles/chat/input-bar-extras.css`

Styles for the skill dropdown, badge bar, and inline skill headers.

## Modified Files

### `ui/src/ui/views/chat.ts`

Minimal changes — only injection points, no modifications to existing functions:

| What                                                | Where in file                                       |
| --------------------------------------------------- | --------------------------------------------------- |
| Import block from `input-bar-extras.ts` (8 exports) | Top of file                                         |
| `tryRenderSkillMessage(item)`                       | Message rendering loop, before `renderMessageGroup` |
| `handleMentionKeyDown(e, props, requestUpdate)`     | Top of `handleKeyDown`, returns early if consumed   |
| `sendWithSkills(props, inputHistory)`               | Replaces `props.onSend()` in keyboard Enter handler |
| `updateMentionMenu(target.value, requestUpdate)`    | `handleInput`, after `updateSlashMenu`              |
| `renderMentionMenu(requestUpdate, props)`           | Input bar, before slash menu                        |
| `renderSkillBadgeBar(requestUpdate)`                | Input bar, above textarea                           |
| `renderFuncButton(requestUpdate, props)`            | Toolbar-left, first button                          |
| `sendWithSkills(props, inputHistory)`               | Send button `@click` handler                        |

**Not changed:** `ChatEphemeralState`, `renderSlashMenu`, `selectSlashCommand`, `tabCompleteSlashCommand` — all match upstream exactly.

### `ui/src/ui/app-chat.ts`

- Calls `refreshTocSkillCommands` in parallel with `refreshSlashCommands` on connect

### `ui/src/styles/chat.css`

- Imports `input-bar-extras.css`

## Architecture Notes

- All TOC state lives in `input-bar-extras.ts` (`tocState`). `chat.ts` has no new state fields.
- `SKILL_COMMANDS` is completely separate from `SLASH_COMMANDS` — slash commands handle `/` prefix, skill commands handle `@` prefix.
- `renderMentionMenu` appears in the template above the slash menu, triggered by typing `@` alone in the input.
- `renderFuncButton` renders the zap (⚡) dropdown button in the toolbar for mouse-based skill selection.
- Skill badges are prepended to the message text before sending; `tryRenderSkillMessage` re-extracts them for display in sent message bubbles.
- No circular imports: `input-bar-extras.ts` never imports from `views/chat.ts`.

## Rebase Strategy

When upstream `main` advances:

1. `git fetch origin && git rebase origin/main`
2. Conflicts in `chat.ts` are expected only in the 9 injection points listed above — re-insert them if overwritten
3. `renderSlashMenu`, `selectSlashCommand`, `tabCompleteSlashCommand` match upstream exactly — no conflict expected there
4. Custom files (`input-bar-extras.ts`, `toc-slash-commands.ts`, `dev-docs/`) never conflict
5. Run `pnpm check` to verify after rebase
