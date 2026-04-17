# Jira Agent Bundle

This is a portable Jira-focused agent bundle for OpenClaw.

## Start Here

Target install experience:

1. Copy this folder to `workspace/jira-agent`
2. Run one setup command
3. Complete `VERIFY.md`

## One Add Command

The intended import contract for this bundle is:

```text
/agent-add "jira-agent"
```

Runtime equivalent:

```bash
openclaw agent add workspace/jira-agent
```

This is the desired add/install entrypoint for the client environment.

It should do the equivalent of:

- reading `BUNDLE-CONTRACT.md`
- following `INSTALL-FLOW.md`
- reading `SETUP.md`
- using `skills/first-run-setup/SKILL.md`
- checking `DEPENDENCIES.md`
- preparing `USER.md` and `TOOLS.md`
- guiding Jira MCP setup
- ending at `VERIFY.md`

This bundle now includes `bundle.json` as the machine-readable manifest for that flow.

## Included Files

- `AGENTS.md`: agent operating rules
- `SOUL.md`: core behavior
- `IDENTITY.md`: agent identity
- `bundle.json`: machine-readable bundle manifest
- `bundle.schema.json`: JSON Schema for manifest validation
- `BUNDLE-CONTRACT.md`: human-readable manifest contract
- `INSTALL-FLOW.md`: installer flow spec
- `USER.template.md`: user profile template
- `TOOLS.template.md`: local setup template
- `SETUP.md`: first-run install guide
- `DEPENDENCIES.md`: runtime contract
- `VERIFY.md`: go-live checklist

## Not Included

- live credentials
- auth state
- runtime session state
- local browser state

This bundle is designed to be safe to share after review.
