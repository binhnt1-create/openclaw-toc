# Install Flow

This file defines the intended behavior of:

```text
/agent-add "jira-agent"
```

And its runtime equivalent:

```bash
openclaw agent add workspace/jira-agent
```

## Goal

Make agent installation feel like:

1. upload bundle to `workspace/jira-agent`
2. run one install command
3. finish setup without manual file hunting

## Preconditions

Before the installer runs:

- the bundle exists at `workspace/jira-agent`
- the bundle contains a valid `bundle.json` manifest
- the manifest follows the contract documented in `BUNDLE-CONTRACT.md`
- OpenClaw can access the workspace path

## High-Level Flow

### 1. Discover Bundle

The installer should:

- resolve `workspace/jira-agent`
- confirm the bundle exists
- load `bundle.json`
- validate required fields

If the manifest is missing or invalid, stop immediately with a clear error.

### 2. Prepare Local Files

The installer should:

- create `USER.md` from `USER.template.md` if missing
- create `TOOLS.md` from `TOOLS.template.md` if missing
- keep existing local files if they already exist

This prevents template files from being treated as the live source of truth.

### 3. Run Bootstrap

If `BOOTSTRAP.md` exists and the bundle is still generic:

- guide the user through identity
- confirm who the agent is helping
- confirm scope and approval rules

### 4. Run Setup Skill

The installer should invoke the setup skill declared by the bundle.

For this bundle, that means:

- read `skills/first-run-setup/SKILL.md`
- collect Jira setup details
- collect MCP requirements
- collect auth and model readiness

### 5. Validate Dependencies

The installer should check:

- OpenClaw runtime readiness
- working model/auth path
- Jira MCP availability
- required environment inputs

If a dependency is missing, stop with a short remediation message.

### 6. Verify

The installer should walk through `VERIFY.md` and ensure:

- model/auth works
- Jira MCP works
- Jira access works
- optional write mode is confirmed if enabled

### 7. Mark Install Complete

The installer should end with:

- a short success summary
- remaining manual tasks, if any
- a pointer to rerun the same install command later if repair is needed

## Failure Rules

The installer must not:

- claim success without Jira verification
- silently ignore MCP problems
- overwrite existing local files without warning
- expose secrets in chat output

## Expected User Experience

From the user's perspective, this should feel like:

```text
Upload bundle -> /agent-add "jira-agent" -> answer a few setup questions -> done
```

## Jira-Specific Notes

For this bundle, install is not complete until:

- Jira site information is known
- the Jira MCP path is known
- the chosen auth method is understood
- verification has passed
