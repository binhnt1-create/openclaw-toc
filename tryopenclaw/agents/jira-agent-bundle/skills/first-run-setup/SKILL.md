# Jira Agent Setup Wizard

This skill is the interactive setup flow for the Jira agent bundle.
It runs after `/agent-add` has scaffolded the bundle files.

## When To Use

- User says "continue setup" or similar after `/agent-add`
- VERIFY.md has unchecked items
- USER.md or TOOLS.md still has empty fields

## How To Run

Walk through each step below **in order**. For each step:
- Ask the user one question at a time
- Write their answer into the correct file immediately
- Confirm what you wrote before moving on
- If the user says "skip", move to the next step

Do not dump all questions at once. Keep it conversational.

---

## Step 1: Identity

Read IDENTITY.md. If fields are empty, ask:

> "What should this agent be called?"

Write the answer to IDENTITY.md → Name field.

> "What tone should it use? (e.g. concise, friendly, formal)"

Write to IDENTITY.md → Vibe field.

---

## Step 2: User Profile

Read USER.md. Ask:

> "What's your name?"

> "What timezone are you in?"

> "What are your main goals for this Jira agent? (e.g. track sprint progress, manage backlog)"

Write answers to USER.md fields. Keep it short — don't ask optional fields unless the user volunteers.

---

## Step 3: Jira Configuration

Ask one by one:

> "What's your Jira site URL? (e.g. https://yourteam.atlassian.net)"

Validate: must be a URL. Write to TOOLS.md → Jira → Base URL.

> "What's your default project key? (e.g. PROJ, ENG)"

Write to TOOLS.md → Jira → Default project key.

> "Should this agent have read-only or read-write access?"

Write to TOOLS.md → Notes section.

---

## Step 4: Jira API Token

Before MCP setup, the user needs an API token. Always show this guide when asking for the token:

> To create your Atlassian API token:
>
> 1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
> 2. Click "Create API token"
> 3. Give it a label (e.g. "openclaw-jira-agent")
> 4. Copy the token — you won't see it again
>
> Keep this token safe. Do not paste it into any tracked file.
> Store it as an environment variable: JIRA_API_KEY

Wait for the user to confirm they have the token. Do not ask them to paste it in chat.

---

## Step 5: Jira MCP Setup

This is the most technical step. Guide carefully.

The recommended MCP server is `@mcp-devtools/jira`.

Ask:

> "Do you already have a Jira MCP server configured in OpenClaw?"

If **yes**:
> "What's the MCP server name in your config? (e.g. 'jira')"

Write to TOOLS.md → MCP section.

If **no**, guide them step by step:

> You need the `@mcp-devtools/jira` MCP server so I can access your Jira data.
>
> **Configure in OpenClaw:**
> Add this to your `openclaw.json` under `mcp.servers`
> (or use `openclaw config set mcp.servers.jira ...`):
>
> ```json
> {
>   "mcp": {
>     "servers": {
>       "jira": {
>         "command": "npx",
>         "args": ["-y", "@mcp-devtools/jira"],
>         "env": {
>           "JIRA_URL": "https://yourteam.atlassian.net",
>           "JIRA_API_MAIL": "you@example.com",
>           "JIRA_API_KEY": "your-token-from-step-4"
>         }
>       }
>     }
>   }
> }
> ```
>
> Replace the values:
> - `JIRA_URL` → your Jira site URL (e.g. https://yourteam.atlassian.net)
> - `JIRA_API_MAIL` → your Atlassian account email
> - `JIRA_API_KEY` → the API token you created in step 4
>
> After editing, restart the OpenClaw gateway to load the MCP server.
>
> Let me know when you've installed and configured it.

Wait for confirmation. Write MCP details to TOOLS.md → MCP section.

---

## Step 6: Verify

Walk through VERIFY.md one section at a time:

1. **Identity and Workspace** — check if USER.md, TOOLS.md, IDENTITY.md are filled
2. **Model and Auth** — ask user to confirm the AI can respond (it already can if they're talking to you)
3. **Jira MCP** — if MCP is configured, try a simple read test:
   > "Let me try to read a Jira issue. What's an issue key I can test with? (e.g. PROJ-1)"
4. **Optional Write Access** — only if read-write mode was chosen in step 3

For each item that passes, update VERIFY.md to mark `[x]`.

---

## Step 7: Finish

When all critical items are verified:

1. Delete BOOTSTRAP.md (it says to delete after bootstrap)
2. Tell the user:

> Setup complete! Here's what's configured:
> - Jira site: [URL from TOOLS.md]
> - Project: [key from TOOLS.md]
> - Mode: [read-only/read-write]
> - MCP: [status]
>
> You can now ask me about your Jira projects. Try:
> - "What's in the current sprint?"
> - "Summarize blocked issues in PROJ"
> - "Create a task for ..."

---

## Rules

- Never store raw API tokens in tracked files — guide user to use env vars
- Never pretend Jira is working if MCP isn't verified
- If any step fails, say exactly what's missing and how to fix it
- Keep responses short — this is setup, not a tutorial
