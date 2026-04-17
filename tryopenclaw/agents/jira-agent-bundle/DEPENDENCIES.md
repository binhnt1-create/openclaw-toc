# DEPENDENCIES.md - Jira Agent Runtime Contract

This file describes what the client must provide for this bundle to work.

## Required

- OpenClaw installed and runnable
- access to a supported model and auth path
- Jira access for the target workspace
- a working Jira MCP server or package

## Recommended

- Node.js available if the Jira MCP is Node-based
- a client-local secret storage method
- a clean workspace where this bundle can own its own files

## Model And Auth

The client must choose one working model/auth path, for example:

- OpenAI API key
- OpenAI Codex OAuth
- another provider supported by their OpenClaw runtime

This bundle does not ship any auth state.

## Jira MCP

The recommended MCP server is `@mcp-devtools/jira` (npm package).

Run: `npx -y @mcp-devtools/jira`

The Jira MCP should support, at minimum:

- connecting to the client's Jira base URL
- authenticating with the client's credentials
- reading issues
- optionally creating or updating issues if the client wants write access

The machine-readable declaration for this dependency now lives in `bundle.json`, with the human-readable rules documented in `BUNDLE-CONTRACT.md`.

## Expected Jira Inputs

The setup flow will need these values:

- `JIRA_URL` (e.g. https://yourteam.atlassian.net)
- `JIRA_API_MAIL` (your Atlassian account email)
- `JIRA_API_KEY` (create at https://id.atlassian.com/manage-profile/security/api-tokens)
- default project key
- permission mode: read-only or read-write

## Optional Channel Dependencies

Only needed if the client wants chat integration:

- Discord bot token and routing config
- Google Chat app/service account setup
- any channel-specific IDs and mention rules

## Export Rule

Do not commit:

- live tokens
- refresh tokens
- `.env`
- `auth-profiles.json`
- browser state
- session state

Keep those local to the client runtime.
