# Bundle Contract

This file defines the `bundle.json` contract for portable OpenClaw agent bundles.

The actual manifest now exists in this folder as `bundle.json`.

The validating schema now exists in this folder as `bundle.schema.json`.

## Purpose

`bundle.json` is the machine-readable manifest that lets OpenClaw detect, validate, and install an uploaded agent bundle.

It should answer these questions:

- what bundle is this
- where is the setup entrypoint
- which templates should become local files
- which dependencies are required
- which MCP servers are needed
- how install verification should work

## Manifest File

Current file:

- `bundle.json`
- `bundle.schema.json`

## Current Shape

```json
{
  "$schema": "./bundle.schema.json",
  "schemaVersion": 1,
  "id": "jira-agent",
  "name": "Jira Agent",
  "type": "agent-bundle",
  "description": "Portable Jira-focused project manager agent for OpenClaw.",
  "workspaceRoot": ".",
  "setup": {
    "entryCommand": "/agent-add \"jira-agent\"",
    "installerCommand": "openclaw agent add workspace/jira-agent",
    "skillPath": "skills/first-run-setup/SKILL.md",
    "setupDoc": "SETUP.md",
    "verifyDoc": "VERIFY.md"
  },
  "templates": [
    {
      "source": "USER.template.md",
      "target": "USER.md",
      "required": true
    },
    {
      "source": "TOOLS.template.md",
      "target": "TOOLS.md",
      "required": true
    }
  ],
  "dependencies": {
    "docs": "DEPENDENCIES.md",
    "runtime": [
      "openclaw"
    ],
    "optionalRuntime": [
      "node"
    ]
  },
  "mcp": [
    {
      "id": "jira",
      "required": true,
      "purpose": "jira read/write access",
      "env": [
        "JIRA_BASE_URL",
        "ATLASSIAN_EMAIL",
        "ATLASSIAN_API_TOKEN"
      ]
    }
  ],
  "install": {
    "createFromTemplates": true,
    "runBootstrapIfPresent": true,
    "runVerifyAtEnd": true
  }
}
```

## Schema Validation

`bundle.json` should validate against:

- `bundle.schema.json`

Recommended editor/tooling behavior:

- use `$schema` in `bundle.json`
- fail validation on unknown properties
- reject absolute paths and `..` path traversal patterns

## Field Definitions

### Top-Level Identity

- `schemaVersion`: version of the manifest schema
- `id`: stable bundle identifier
- `name`: display name
- `type`: lets OpenClaw distinguish an agent bundle from other workspace content
- `description`: short human-readable summary
- `workspaceRoot`: root path of the bundle

### Setup

- `entryCommand`: the chat-facing install command
- `installerCommand`: the CLI/runtime-facing equivalent
- `skillPath`: setup skill to execute
- `setupDoc`: human-readable first-run guide
- `verifyDoc`: final checklist

### Templates

Each template entry tells the installer:

- which file is a template
- which real file to create
- whether the file is required

### Dependencies

This section tells OpenClaw what to validate before claiming setup is complete.

### MCP

This section declares integration requirements in a discoverable way.

For the Jira bundle, MCP should not be inferred from random local config. It should be declared here.

### Install

This section defines installer behavior:

- create local files from templates
- run bootstrap if needed
- run verification before marking install complete

## Installer Expectations

An OpenClaw installer reading this contract should:

1. validate `schemaVersion`
2. confirm the bundle path exists
3. create missing files from templates
4. invoke the setup skill
5. validate MCP and runtime dependencies
6. end with verification

## Jira Bundle Mapping

For this specific bundle:

- `id` should be `jira-agent`
- `skillPath` should point to `skills/first-run-setup/SKILL.md`
- template files are `USER.template.md` and `TOOLS.template.md`
- verification is defined in `VERIFY.md`
- runtime dependency notes are defined in `DEPENDENCIES.md`

## Rule

`bundle.json` should never contain:

- live credentials
- OAuth tokens
- local absolute paths from the author's machine
- session state
