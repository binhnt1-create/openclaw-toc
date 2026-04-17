# Exporting and Distributing Plugins

## Overview

There are three ways to deliver a plugin to a user:

| Method | Best for |
|---|---|
| [Tarball (`.tgz`)](#method-1-tarball) | One-off sharing, private distribution |
| [npm package](#method-2-npm-package) | Public or org-scoped distribution via registry |
| [Git URL](#method-3-git-url) | Sharing directly from a GitHub/GitLab repo |

In all cases the user installs with:

```bash
openclaw plugins install <source>
```

---

## Method 1: Tarball

Use the included `pack.sh` script to build a `.tgz` file, then send it to the user.

### Pack

```bash
./pack.sh <plugin-name>
```

Example:

```bash
./pack.sh auth-codex
# Output:
#   Done: build/openclaw-auth-codex-1.0.0.tgz
#
#   Install with:
#     openclaw plugins install /path/to/my-op-plugins/build/openclaw-auth-codex-1.0.0.tgz
```

The `.tgz` file is saved to `my-op-plugins/build/`.

### User installs

```bash
openclaw plugins install ./openclaw-auth-codex-1.0.0.tgz
```

The path can be a local file path or an HTTPS URL:

```bash
# From a URL (e.g. your own CDN or GitHub release asset)
openclaw plugins install https://your-server.com/plugins/openclaw-auth-codex-1.0.0.tgz
```

If the plugin is blocked by the security scan (e.g. `child_process` usage), force install with:

```bash
openclaw plugins install --dangerously-force-unsafe-install ./openclaw-auth-codex-1.0.0.tgz
```

### Automate on your server

If your system auto-installs plugins for users, run this on their gateway host:

```bash
openclaw plugins install https://your-server.com/plugins/openclaw-auth-codex-1.0.0.tgz
```

Then restart the gateway so the plugin is activated.

---

## Method 2: npm Package

Publish to npm (public or a private registry) so users can install by package name.

### Publish

```bash
cd my-op-plugins/<plugin-name>

# Public npm registry
npm publish --access public

# Private/scoped registry (e.g. GitHub Packages, Verdaccio)
npm publish --registry https://npm.your-org.com
```

### User installs

```bash
# From npm
openclaw plugins install openclaw-auth-codex

# From private registry
openclaw plugins install openclaw-auth-codex --registry https://npm.your-org.com
```

### Version pinning

Users can pin a specific version:

```bash
openclaw plugins install openclaw-auth-codex@1.2.0
```

---

## Method 3: Git URL

Point users at a GitHub (or any Git) repository. No packing or publishing needed.

```bash
openclaw plugins install github:yourorg/openclaw-auth-codex
# or
openclaw plugins install https://github.com/yourorg/openclaw-auth-codex.git
```

If the plugin lives in a subfolder of a monorepo:

```bash
openclaw plugins install https://github.com/yourorg/my-plugins.git#path:auth-codex
```

---

## Updating a Plugin

After publishing a new version, users update with:

```bash
openclaw plugins update <plugin-id>
# or reinstall
openclaw plugins install openclaw-auth-codex@latest
```

---

## Sending to a User Step-by-Step (Tarball Example)

1. **Pack** the plugin:
   ```bash
   ./pack.sh auth-codex
   ```

2. **Send** the `.tgz` file from `build/` to the user (any channel).

3. **User installs** on their gateway host:
   ```bash
   openclaw plugins install ./openclaw-auth-codex-1.0.0.tgz
   ```
   If blocked by security scan, add `--dangerously-force-unsafe-install`.

4. **User restarts** the gateway (or the OpenClaw app) to activate the plugin.

5. **User verifies** the command appeared:
   ```
   /commands
   ```

---

## Automating Installation (Server-Side)

If your platform manages OpenClaw gateways for users, trigger installation via SSH or your deployment pipeline:

```bash
ssh user@gateway-host \
  "openclaw plugins install https://your-cdn.com/plugins/openclaw-auth-codex-1.0.0.tgz && \
   openclaw gateway restart"
```

Or with a direct npm spec:

```bash
ssh user@gateway-host \
  "openclaw plugins install openclaw-auth-codex@latest && \
   openclaw gateway restart"
```

---

## Verifying After Install

```bash
# List installed plugins
openclaw plugins list

# Inspect a specific plugin
openclaw plugins inspect auth-codex
```
