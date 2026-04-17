# VERIFY.md - Jira Agent Go-Live Checklist

Use this file after setup.

## Identity And Workspace

- [ ] `USER.md` exists and is filled in
- [ ] `TOOLS.md` exists and is filled in
- [ ] `IDENTITY.md` matches the intended client-facing agent identity

## Model And Auth

- [ ] OpenClaw can use a working model
- [ ] The chosen auth path is valid
- [ ] The agent can answer a simple test prompt

## Jira MCP

- [ ] Jira MCP is installed or available
- [ ] Jira MCP launch command is known
- [ ] Jira MCP can reach the target Jira base URL
- [ ] Authentication to Jira works
- [ ] The agent can read at least one known issue

## Optional Write Access

- [ ] Approval rules for write actions are documented
- [ ] The agent can create or update a test issue if write access is intended

## Optional Channel Routing

- [ ] The desired channel is configured
- [ ] The bundle is routed to the correct agent
- [ ] Mentions or inbound events reach the agent

## Final Acceptance

- [ ] The agent reports Jira facts accurately
- [ ] The agent does not expose secrets
- [ ] The client understands where to update future local config

## Record

- Setup completed by:
- Date:
- Jira site:
- Permission mode:
- Notes:
