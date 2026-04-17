# SETUP.md - Jira Agent First-Run Setup

This file is the first-run guide for installing this Jira agent into a client's OpenClaw workspace.

## Target Install Contract

This bundle is designed for the following operator experience:

1. Copy the bundle to `workspace/jira-agent`
2. Run one command:

```text
/agent-add "jira-agent"
```

Runtime equivalent:

```bash
openclaw agent add workspace/jira-agent
```

3. Let the setup flow prepare the workspace and guide missing dependencies

This bundle now includes `bundle.json` for the machine-readable setup contract.

For the machine-readable contract and flow definition, see:

- `bundle.json`
- `BUNDLE-CONTRACT.md`
- `INSTALL-FLOW.md`

## What This Bundle Includes

- Jira agent behavior files
- bootstrap files for identity and working style
- dependency checklist
- verification checklist
- a first-run setup skill

## What This Bundle Does Not Include

- OpenClaw runtime itself
- live auth state
- `auth-profiles.json`
- `.env`
- real Jira tokens
- local browser or session state

## Before You Start

Prepare these items:

1. A working OpenClaw environment
2. Access to the target Jira site
3. Jira account email
4. Jira API token or approved auth method
5. The MCP package or bundle required for Jira access
6. Any channel information if this agent should listen on chat surfaces

## Installation Flow

1. Copy this folder into the client's OpenClaw workspace as `workspace/jira-agent`
2. Run `/agent-add "jira-agent"` or `openclaw agent add workspace/jira-agent`
3. Let setup create or prepare `USER.md` and `TOOLS.md`
4. Complete bootstrap prompts if identity is still generic
5. Complete all checks in `VERIFY.md`

## Information To Collect During Setup

### Jira

- Jira base URL
- Jira account email
- Jira API token or approved auth flow
- default project key
- issue types the agent may create or edit
- any status or workflow constraints

### MCP

- Jira MCP package name or local bundle path
- command used to launch it
- environment variables required by the MCP
- how to verify the MCP is reachable

### Agent Scope

- read-only or read-write
- allowed projects
- allowed issue types
- approval rules for create, update, transition, or comment actions

## Setup Output

At the end of setup, the client should have:

- a completed `USER.md`
- a completed `TOOLS.md`
- a known working Jira auth path
- a working Jira MCP path
- a completed `VERIFY.md` record
- a stable local convention for rerunning setup if needed
- a valid `bundle.json` manifest

## Important Rule

Do not paste real credentials into tracked template files.

Prefer local secrets, environment variables, or client-local config files.
