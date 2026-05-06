# POC: TOC Skill Mention Layer

Branch: `tuandh/poc_custom_openclaw`

## Overview

Added a skill mention/selection system to the chat UI, separate from the existing slash-command system. Users can pick skills from a dropdown and compose messages with `@skill_name` prefixes.

## New Files

### `ui/src/ui/chat/chat-props.ts`

Extracted `ChatProps` type out of `ui/src/ui/views/chat.ts` into its own file to break a circular import cycle:

- `views/chat.ts` → `chat/input-bar-extras.ts` → `views/chat.ts` (was circular)
- Now both files import `ChatProps` from `chat/chat-props.ts`

### `ui/src/ui/chat/input-bar-extras.ts`

Renders the skill selection UI in the chat input bar:

- `FuncDropdownState` — local state interface for the dropdown
- `parseSkillsFromText(text)` — extracts leading `@skill_name` tokens from a message
- `buildDraftWithSkills(skills, text)` — prepends `@skill` prefixes to draft text
- `renderSkillBadgeBar(vs, requestUpdate)` — removable badge pills for selected skills
- `renderSkillBadgesInline(skills)` — skill header row inside sent message bubbles
- `renderFuncButton(vs, requestUpdate, props)` — the zap button + dropdown menu

### `ui/src/ui/chat/toc-slash-commands.ts`

Maintains a separate `SKILL_COMMANDS` array (independent of `SLASH_COMMANDS`):

- `getSkillCompletions(filter)` — filters skills by partial name for `@mention` autocomplete
- `refreshTocSkillCommands({ client, agentId })` — fetches `commands.list` from the gateway, keeps only `source === "skill"` entries, populates `SKILL_COMMANDS`

### `ui/src/styles/chat/input-bar-extras.css`

Styles for the skill dropdown, badge bar, and inline skill headers.

## Modified Files

### `ui/src/ui/views/chat.ts`

- Re-exports `ChatProps` from `chat/chat-props.ts` (type moved to break cycle)
- Imports and uses `parseSkillsFromText`, `buildDraftWithSkills`, `renderFuncButton`, `renderSkillBadgeBar`, `renderSkillBadgesInline` from `input-bar-extras.ts`
- Imports `getSkillCompletions` from `toc-slash-commands.ts` for `@mention` autocomplete

### `ui/src/ui/app-chat.ts`

- Calls `refreshTocSkillCommands` in parallel with `refreshSlashCommands` on connect

### `ui/src/styles/chat.css`

- Imports `input-bar-extras.css`

## Architecture Notes

- `SKILL_COMMANDS` is completely separate from `SLASH_COMMANDS` — slash commands handle `/` prefix, skill commands handle `@` prefix
- The `toc-slash-commands.ts` refresh only fetches skill-sourced entries (`entry.source === "skill"`)
- Skill badges are prepended to the message text before sending; `parseSkillsFromText` is used to re-extract them for display in sent message bubbles
