# OpenClaw Skills

Distributable skills for [OpenClaw](https://github.com/openclaw/openclaw). Each subfolder is a standalone skill directory ([AgentSkills](https://agentskills.io)-compatible: `SKILL.md` with YAML frontmatter plus instructions).

Official references:

- [Skills](https://docs.openclaw.ai/tools/skills) — loading, precedence, gating, ClawHub, security
- [Creating Skills](https://docs.openclaw.ai/tools/creating-skills) — first skill walkthrough
- [Skills Config](https://docs.openclaw.ai/tools/skills-config) — `skills.*` and agent allowlists
- [Slash Commands](https://docs.openclaw.ai/tools/slash-commands) — `/skill` and command catalog

A skill teaches the agent how to use tools; it is **not** executable gateway code (unlike [plugins](../plugins/)). Invoke with **`/skill <name> [input]`** (see [dynamic skill commands](https://docs.openclaw.ai/tools/slash-commands#dynamic-skill-commands)).

## Skills in this folder

| Skill | Command | Description |
|---|---|---|
| [openai-codex-oauth](./openai-codex-oauth/) | `/skill openai-codex-oauth` | Guide the AI to set up OpenAI Codex OAuth login |

---

## Locations and precedence

OpenClaw merges skills from several roots. If the **same skill name** appears in more than one place, **higher precedence wins**:

| Precedence | Location | Scope |
|---:|---|---|
| Highest | `<workspace>/skills/<name>/` | Per-agent workspace |
| | `<workspace>/.agents/skills/<name>/` | Project agent skills for that workspace |
| | `~/.agents/skills/<name>/` | Personal agent skills (machine) |
| | `~/.openclaw/skills/<name>/` | Managed / shared local (all agents on host) |
| | Bundled skills (npm / OpenClaw.app) | Shipped with install |
| Lowest | `skills.load.extraDirs` in config | Extra directories (see [Skills Config](https://docs.openclaw.ai/tools/skills-config)) |

**Plugins** can ship skill directories via `openclaw.plugin.json` (`skills` paths relative to plugin root); those merge at **low** precedence so workspace or bundled overrides still win. See [Skills — Plugins + skills](https://docs.openclaw.ai/tools/skills#plugins--skills).

---

## Install

### ClawHub

Browse [clawhub.ai](https://clawhub.ai). Install/update with the CLI:

```bash
openclaw skills install <skill-slug>
openclaw skills update --all
```

Native `openclaw skills install` installs into the **active workspace** `skills/` directory. The separate `clawhub` CLI may install under `./skills` in the current working directory; OpenClaw picks that up as `<workspace>/skills` on the next session. Full flow: [ClawHub](https://docs.openclaw.ai/tools/clawhub).

### Local / private skills (manual copy)

Copy the skill folder into one of the locations in the precedence table above. Example for workspace:

```bash
cp -r openai-codex-oauth <workspace>/skills/openai-codex-oauth
```

Start a **new session** or restart the gateway so the skill loads. Verify:

```bash
openclaw skills list
```

---

## Create a new skill

1. Create a directory under a skill root (for example `<workspace>/skills/<skill-name>/`).
2. Add `SKILL.md` with at least:

```markdown
---
name: hello_world
description: One-line description for the agent and /skill list.
---

# Title

Instructions for the agent…
```

3. Optional: `references/` for extra markdown the agent can read.
4. Reload: new session (`/new`) or `openclaw gateway restart`, then test (`openclaw agent --message "…"` or chat).

**Frontmatter notes** (see [Skills — Format](https://docs.openclaw.ai/tools/skills#format-agentskills--pi-compatible)):

- `name` and `description` are required; prefer **snake_case** for `name` ([Creating Skills](https://docs.openclaw.ai/tools/creating-skills)).
- Parser expects **single-line** frontmatter keys; `metadata` should be a **single-line JSON object** when used.
- Use `{baseDir}` in body text to mean the skill folder path.
- Optional keys include `homepage`, `user-invocable`, `disable-model-invocation`, `command-dispatch` / `command-tool` / `command-arg-mode` (tool dispatch mode).

**Gating** via `metadata` (e.g. `metadata.openclaw.requires.bins`, `.env`, `.config`): [Skills — Gating](https://docs.openclaw.ai/tools/skills#gating-load-time-filters).

---

## Config (`~/.openclaw/openclaw.json`)

Per-skill toggles, env, and API keys use `skills.entries.<skillKey>` (key is skill `name`, or `metadata.openclaw.skillKey` if set). Optional **`allowBundled`** restricts which **bundled** skills are eligible.

**Per-agent skill allowlists** (which visible skills an agent may use) are separate from filesystem precedence:

- `agents.defaults.skills` — baseline list; omit for unrestricted skills.
- `agents.list[].skills` — **replaces** defaults when set (does not merge); use `[]` for no skills.

Details: [Skills Config](https://docs.openclaw.ai/tools/skills-config), [Skills — Agent skill allowlists](https://docs.openclaw.ai/tools/skills#agent-skill-allowlists).

---

## Slash commands and skills

- **`/skill <name> [input]`** — run a skill by name ([Slash Commands](https://docs.openclaw.ai/tools/slash-commands)).
- User-invocable skills may also appear as **direct** commands (e.g. `/prose`) when registered; native registration on Discord/Telegram is controlled by **`commands.nativeSkills`** and per-channel overrides (`channels.<provider>.commands.nativeSkills`).

---

## Skill vs plugin

| | Skill | Plugin |
|---|---|---|
| Format | Markdown (`SKILL.md`) | TypeScript (`index.ts`) + manifest |
| Runs as | Agent instructions | Gateway code |
| Dependencies | None (optional bins via metadata) | npm packages |
| Install | Copy folder / ClawHub / `openclaw skills install` | `openclaw plugins install` |
| Use | `/skill <name>` (and optional direct slash aliases) | Plugin `/commands` |
| Best for | Workflows, tool guidance | Automation, hooks, tools, HTTP |

---

## Security

Treat third-party skills as **untrusted**: read before enabling. Prefer sandboxed runs for risky tools. See [Skills — Security notes](https://docs.openclaw.ai/tools/skills#security-notes) and [Sandboxing](https://docs.openclaw.ai/gateway/sandboxing).

---

## Distributing skills

Folders can be zipped or tarballed for sharing:

```bash
tar czf openai-codex-oauth.tar.gz openai-codex-oauth/
tar xzf openai-codex-oauth.tar.gz -C ~/.openclaw/skills/
```

For public discovery, publish via [ClawHub](https://docs.openclaw.ai/tools/clawhub).
