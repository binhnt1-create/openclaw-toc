import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { discoverBundleAt } from "./src/discover.js";
import { scaffoldTemplates } from "./src/scaffold.js";
import { checkDependencies } from "./src/check-deps.js";
import { formatInstallReport } from "./src/report.js";

/**
 * Resolve the bundle path from user input.
 * Accepts:
 *   /agent-add jira-agent                → searches multiple locations
 *   /agent-add ./my-bundles/jira-agent   → relative path
 *   /agent-add /abs/path/to/bundle       → absolute path
 *
 * Search order for short ids:
 *   1. ~/.openclaw/workspace/<id>
 *   2. <cwd>/workspace/<id>
 *   3. <cwd>/<id>
 */
function resolveBundlePath(input: string): string {
  // Absolute or relative path
  if (input.startsWith("/") || input.startsWith("./") || input.startsWith("../") || input.includes("/")) {
    return resolve(input);
  }

  // Short id — search multiple locations
  const candidates = [
    join(homedir(), ".openclaw", "workspace", input),
    resolve("workspace", input),
    resolve(input),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Default to ~/.openclaw/workspace (most common for installed bundles)
  return candidates[0];
}

export default definePluginEntry({
  id: "agent-bundle-installer",
  name: "Agent Bundle Installer",
  description: "Install portable agent bundles with /agent-add.",
  register(api) {
    api.registerCommand({
      name: "agent-add",
      description: "Install an agent bundle: /agent-add <path-or-id> [--verify] [--status]",
      acceptsArgs: true,
      requireAuth: true,
      handler: async (ctx) => {
        const raw = ctx.args?.trim() ?? "";
        if (!raw) {
          return {
            text: [
              "Usage: /agent-add <path-or-id> [--verify] [--status]",
              "",
              "Examples:",
              "  /agent-add jira-agent                  (looks in workspace/jira-agent/)",
              "  /agent-add ./my-bundles/jira-agent     (relative path)",
              "  /agent-add /abs/path/to/bundle         (absolute path)",
            ].join("\n"),
          };
        }

        const parts = raw.split(/\s+/);
        const bundleInput = parts[0];
        const flags = new Set(parts.slice(1));

        const bundlePath = resolveBundlePath(bundleInput);

        // Step 1: Discover and validate bundle
        const discovery = await discoverBundleAt(bundlePath);
        if (!discovery.ok) {
          return { text: `Failed to load bundle "${bundleInput}":\n${discovery.error}` };
        }

        const manifest = discovery.manifest;

        // --status: show current state only
        if (flags.has("--status")) {
          const deps = await checkDependencies(manifest, bundlePath);
          return {
            text: formatInstallReport({
              manifest,
              bundlePath,
              scaffolded: [],
              deps,
              mode: "status",
            }),
          };
        }

        // --verify: re-run verification only
        if (flags.has("--verify")) {
          const deps = await checkDependencies(manifest, bundlePath);
          return {
            text: formatInstallReport({
              manifest,
              bundlePath,
              scaffolded: [],
              deps,
              mode: "verify",
            }),
          };
        }

        // Full install flow
        const scaffolded = await scaffoldTemplates(bundlePath, manifest.templates ?? []);
        const deps = await checkDependencies(manifest, bundlePath);

        return {
          text: formatInstallReport({
            manifest,
            bundlePath,
            scaffolded,
            deps,
            mode: "install",
          }),
        };
      },
    });
  },
});
