# Plan: `agent-bundle-installer` Plugin

## Goal

A standalone OpenClaw plugin that automates the agent bundle installation flow.
Client receives the plugin + a bundle folder (e.g. `jira-agent`), installs the plugin once,
then uses `/agent-add "jira-agent"` to set up the bundle automatically.

**Distribution:** packaged as `.tgz` via `pack.sh` (same as `auth-codex`), installed with
`openclaw plugins install ./openclaw-agent-bundle-installer-1.0.0.tgz`.

---

## What The Plugin Does

| Command | Behavior |
|---|---|
| `/agent-add <bundle-id>` | Full install flow: discover → validate → scaffold → guide setup → verify |
| `/agent-add <bundle-id> --verify` | Re-run verification only (for repair/re-check) |
| `/agent-add <bundle-id> --status` | Show current install state of a bundle |

### Install Flow (triggered by `/agent-add`)

```
1. Discover   → find workspace/<bundle-id>/bundle.json
2. Validate   → check manifest against bundle.schema.json
3. Scaffold   → create USER.md, TOOLS.md from templates (skip if exist)
4. Bootstrap  → if BOOTSTRAP.md exists, prompt user for identity/scope
5. Check deps → verify runtime deps (openclaw), optional deps (node)
6. Check MCP  → report required MCP servers + env vars to configure
7. Verify     → walk through VERIFY.md checklist items
8. Report     → summary of what was done, what's left manual
```

---

## Files To Create

```
tryopenclaw/plugins/agent-bundle-installer/
├── package.json
├── openclaw.plugin.json
├── index.ts                  # command registration, main entry
└── src/
    ├── discover.ts           # resolve bundle path, load + validate bundle.json
    ├── scaffold.ts           # create files from templates
    ├── check-deps.ts         # verify runtime & MCP dependencies
    └── report.ts             # format install result for chat output
```

---

## Design Decisions

### D1 — Bundle location convention

Bundles live at `workspace/<bundle-id>/` relative to the OpenClaw workspace root.
The plugin resolves the workspace root from `ctx.config` or falls back to `process.cwd()`.

### D2 — Schema validation

Use `bundle.schema.json` shipped inside the bundle itself (`$schema` field in `bundle.json`).
Validation is lightweight — check required fields + path safety (no `..`, no absolute paths).
No external JSON Schema validator dep — hand-validate the critical fields.

### D3 — Template scaffolding

For each entry in `bundle.json → templates[]`:
- If `target` file exists → skip (never overwrite user data)
- If `target` missing → copy `source` content to `target`
- Log what was created vs skipped

### D4 — MCP dependency reporting (not auto-install)

The plugin **reports** MCP requirements but does **not** auto-install MCP servers.
Reason: MCP setup requires credentials the plugin shouldn't handle.
Output: list of MCP ids, purposes, and required env vars for the user to configure.

### D5 — Verification is interactive guidance, not automated testing

The plugin reads `VERIFY.md`, parses checkbox items, and presents them as a checklist.
It does NOT actually test Jira connectivity — that requires MCP to be running.
The user confirms each item manually. The plugin records completion.

### D6 — No conversation binding needed

Unlike `auth-codex` (which waits for a pasted URL), this plugin's flow is single-command.
All output is returned in one response. No `before_dispatch` hook needed.

### D7 — Bootstrap is optional guidance

If `BOOTSTRAP.md` exists and the bundle looks uninitialized (IDENTITY.md still has template
placeholders), include bootstrap prompts in the output. Don't block on interactive Q&A —
just tell the user what to fill in.

---

## Implementation Steps

### Step 1: Create plugin skeleton

- `package.json` with `openclaw` metadata (same pattern as `auth-codex`)
- `openclaw.plugin.json` with id `agent-bundle-installer`
- `index.ts` with `definePluginEntry` and `/agent-add` command registration

### Step 2: Implement `src/discover.ts`

- `discoverBundle(bundleId: string, workspaceRoot: string)` function
- Resolve `workspace/<bundleId>/bundle.json`
- Read and parse JSON
- Validate required fields: `schemaVersion`, `id`, `name`, `type`, `setup`
- Validate path safety (no `..`, no absolute paths in any path field)
- Return typed `BundleManifest` or error

### Step 3: Implement `src/scaffold.ts`

- `scaffoldTemplates(bundlePath: string, templates: TemplateMapping[])` function
- For each template: check if target exists, copy source → target if missing
- Return list of `{ file, action: "created" | "skipped" }`

### Step 4: Implement `src/check-deps.ts`

- `checkDependencies(manifest: BundleManifest)` function
- Check runtime deps (e.g. `which openclaw`)
- Check optional runtime deps
- Collect MCP requirements with env var names
- Return structured result: `{ runtime: CheckResult[], mcp: McpReport[] }`

### Step 5: Implement `src/report.ts`

- `formatInstallReport(...)` function
- Format chat-friendly output:
  - Bundle identity (name, id, description)
  - Files created / skipped
  - Dependencies found / missing
  - MCP servers to configure (with env vars)
  - Verification checklist from VERIFY.md
  - Next steps

### Step 6: Wire everything in `index.ts`

- Parse `ctx.args` for bundle-id and flags (`--verify`, `--status`)
- Call discover → scaffold → check-deps → report
- Return formatted text

### Step 7: Test locally

```bash
# Pack
cd tryopenclaw/plugins && ./pack.sh agent-bundle-installer

# Install
openclaw plugins install ./build/openclaw-agent-bundle-installer-1.0.0.tgz

# Test with jira bundle
# (copy jira-agent-bundle to workspace/jira-agent first)
/agent-add jira-agent
```

---

## Example Output

```
📋 Installing bundle: Jira Agent (jira-agent)

── Files ──
  ✓ USER.md created from USER.template.md
  ✓ TOOLS.md created from TOOLS.template.md
  · BOOTSTRAP.md found — fill in IDENTITY.md with your agent name and scope

── Runtime ──
  ✓ openclaw: found
  ✓ node: found (optional)

── MCP Required ──
  ⚠ jira — jira read/write access
    Configure these env vars:
    - JIRA_BASE_URL
    - ATLASSIAN_EMAIL
    - ATLASSIAN_API_TOKEN

── Verify (from VERIFY.md) ──
  □ USER.md exists and is filled in
  □ TOOLS.md exists and is filled in
  □ IDENTITY.md matches the intended identity
  □ OpenClaw can use a working model
  □ Jira MCP is installed or available
  □ Jira MCP can reach the target Jira base URL
  □ Authentication to Jira works
  □ The agent can read at least one known issue

── Next Steps ──
  1. Configure Jira MCP with the env vars above
  2. Fill in USER.md and TOOLS.md
  3. Run /agent-add jira-agent --verify to re-check
```

---

## Scope Boundaries

**In scope:**
- Bundle discovery and manifest validation
- Template file scaffolding
- Dependency and MCP reporting
- Verification checklist presentation

**Out of scope (by design):**
- MCP server auto-installation
- Credential collection or storage
- Jira connectivity testing
- Model/auth provisioning
- Conversation binding / multi-turn interactive setup
