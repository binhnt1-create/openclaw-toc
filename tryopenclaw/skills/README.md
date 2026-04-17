# OpenClaw Skills

Distributable skills for [OpenClaw](https://github.com/openclaw/openclaw). Each subfolder is a standalone skill that can be installed into any OpenClaw workspace.

A skill is a set of instructions (in `SKILL.md`) that the AI agent follows when invoked via `/skill <name>`. Unlike plugins (which run code), skills are pure markdown — no code, no dependencies.

## Skills

| Skill | Command | Description |
|---|---|---|
| [openai-codex-oauth](./openai-codex-oauth/) | `/skill openai-codex-oauth` | Guide the AI to set up OpenAI Codex OAuth login |

---

## How to install a skill

### From ClawHub (if published)

```bash
openclaw skills install <slug>
```

### From local file (manual)

`openclaw skills install` only supports ClawHub slugs. For local/private skills, copy the skill folder into one of these locations:

| Location | Scope | Priority |
|---|---|---|
| `<workspace>/skills/<name>/` | Workspace | Highest (recommended) |
| `<project>/.agents/skills/<name>/` | Project | High |
| `~/.agents/skills/<name>/` | Personal | Medium |
| `~/.openclaw/skills/<name>/` | Global | Low |

Recommended — copy to the workspace `skills/` directory:

```bash
cp -r openai-codex-oauth <workspace>/skills/openai-codex-oauth
```

Restart the gateway. The skill will appear in `/skill` command list.

---

## How to create a new skill

### 1. Create the folder

```bash
mkdir skills/<skill-name>
```

### 2. Create `SKILL.md`

```markdown
---
name: <skill-name>
description: What this skill does (one line).
---

# Skill Title

Instructions for the AI agent...
```

The frontmatter fields:

| Field | Required | Description |
|---|---|---|
| `name` | yes | Skill identifier (matches folder name) |
| `description` | yes | One-line description shown in `/skill` list |
| `homepage` | no | Link to docs or website |
| `metadata` | no | OpenClaw-specific metadata (emoji, requirements, install specs) |

### 3. Add references (optional)

```bash
mkdir skills/<skill-name>/references
```

Put supplementary markdown files in `references/`. The AI agent can read these for additional context.

### 4. Test

```bash
# Copy to workspace
cp -r skills/<skill-name> ~/.openclaw/skills/<skill-name>

# Restart gateway, then in chat:
/skill <skill-name>
```

---

## Skill vs Plugin

| | Skill | Plugin |
|---|---|---|
| Format | Markdown (`SKILL.md`) | TypeScript (`index.ts`) |
| Runs as | AI agent instructions | Gateway code |
| Dependencies | None | Node.js packages |
| Install | Copy folder | `openclaw plugins install` |
| Use | `/skill <name>` | `/command-name` |
| Best for | Guided workflows, setup wizards | Automated commands, hooks, tools |

---

## Distributing skills

Skills are just folders — zip, tarball, or share the folder directly:

```bash
# Tarball
tar czf openai-codex-oauth.tar.gz openai-codex-oauth/

# User installs
tar xzf openai-codex-oauth.tar.gz -C ~/.openclaw/skills/
```
