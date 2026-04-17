# How OpenClaw Discovers Skills

OpenClaw scans multiple directories for skills at gateway startup. A skill is any folder containing a `SKILL.md` file with valid frontmatter.

## Scan locations (priority order)

OpenClaw scans these directories from lowest to highest priority. When the same skill name exists in multiple locations, the higher-priority one wins.

| Priority | Location | Source label | Description |
|---|---|---|---|
| 1 (lowest) | Config `skills.load.extraDirs` | `openclaw-extra` | Custom directories defined in `openclaw.json` |
| 2 | Bundled `skills/` (inside OpenClaw repo) | `openclaw-bundled` | Built-in skills shipped with OpenClaw |
| 3 | `~/.openclaw/skills/` | `openclaw-managed` | Global user skills (installed via `openclaw skills install`) |
| 4 | `~/.agents/skills/` | `agents-skills-personal` | Personal skills shared across all projects |
| 5 | `<project>/.agents/skills/` | `agents-skills-project` | Project-scoped skills |
| 6 (highest) | `<workspace>/skills/` | `openclaw-workspace` | Workspace skills (recommended for custom skills) |

## How scanning works

For each location, OpenClaw:

1. Resolves the directory path
2. Checks if the directory itself contains `SKILL.md` (single-skill root)
3. If not, lists immediate subdirectories and checks each for `SKILL.md`
4. Parses the YAML frontmatter (`name`, `description`, `metadata`)
5. Skips files exceeding the size limit (`skills.load.maxSkillFileBytes`)
6. Merges all discovered skills by name (higher priority overwrites lower)

## Skill folder structure

Minimal:

```
<skill-name>/
└── SKILL.md
```

With references:

```
<skill-name>/
├── SKILL.md
└── references/
    └── flows.md
```

## SKILL.md format

```markdown
---
name: my-skill
description: One-line description of what this skill does.
homepage: https://example.com/docs
metadata:
  openclaw:
    emoji: "🔧"
    requires:
      bins: ["some-cli"]
      minModel: ["gpt-5.4", "sonnet-4.6"]
    install:
      - id: npm
        kind: npm
        package: some-cli
        bins: ["some-cli"]
        label: "Install via npm"
---

# Skill Title

Instructions for the AI agent...
```

### Frontmatter fields

| Field | Required | Description |
|---|---|---|
| `name` | yes | Skill identifier (should match folder name) |
| `description` | yes | One-line description shown in skill listings |
| `homepage` | no | URL to documentation or website |
| `metadata.openclaw.emoji` | no | Emoji displayed in skill list |
| `metadata.openclaw.requires.bins` | no | CLI binaries the skill needs |
| `metadata.openclaw.requires.minModel` | no | Minimum AI models that can run this skill |
| `metadata.openclaw.install` | no | Auto-install specs for required binaries |

## Config options

In `openclaw.json`:

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/path/to/custom/skills"],
      "maxSkillFileBytes": 65536
    }
  }
}
```

| Key | Default | Description |
|---|---|---|
| `skills.load.extraDirs` | `[]` | Additional directories to scan for skills |
| `skills.load.maxSkillFileBytes` | 64KB | Max size of a single SKILL.md file |

## Overriding a bundled skill

To replace a built-in skill with your own version, put a skill with the same name in a higher-priority location. For example, placing `openai-codex-oauth/SKILL.md` in `<workspace>/skills/` will override the bundled version.

## When does scanning happen?

Skills are scanned **on demand**, not at gateway startup:

| Trigger | When |
|---|---|
| **AI agent run** | Every time a message is dispatched to the AI agent, skills are resolved for that run |
| **`/skill <name>`** | When user invokes a skill in chat |
| **`openclaw skills list`** | CLI lists all discovered skills |
| **`openclaw skills info`** | CLI shows skill details |
| **`openclaw skills check`** | CLI checks skill readiness |

This means: after copying a skill folder, you do **not** need to restart the gateway. The skill will be picked up on the next agent run or `/skill` invocation.

## No enable/disable toggle

Unlike plugins, skills have no enable/disable mechanism. If a `SKILL.md` exists in a scanned directory, it is available. To "disable" a skill, remove or rename the folder.

## Install commands

| Command | Source |
|---|---|
| `openclaw skills install <slug>` | Install from ClawHub (online registry) |
| Manual copy to `skills/` folder | Install from local file |

There is no `openclaw skills install <local-path>` — local skills must be copied manually.

## Verifying discovery

```bash
# List all discovered skills
openclaw skills list

# Check skill details
openclaw skills info <skill-name>

# Check which skills are ready vs missing requirements
openclaw skills check
```
