import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BundleManifest, McpRequirement } from "./discover.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type RuntimeCheck = {
  name: string;
  found: boolean;
  optional: boolean;
};

export type McpReport = {
  id: string;
  required: boolean;
  purpose?: string;
  env: string[];
  envStatus: Array<{ name: string; set: boolean }>;
};

export type VerifyItem = {
  text: string;
  checked: boolean;
};

export type DepsResult = {
  runtime: RuntimeCheck[];
  mcp: McpReport[];
  verify: VerifyItem[];
  hasBootstrap: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEARCH_DIRS = (process.env.PATH ?? "").split(":");

function commandExists(cmd: string): boolean {
  return SEARCH_DIRS.some((dir) => existsSync(join(dir, cmd)));
}

function parseVerifyChecklist(bundlePath: string, verifyDoc?: string): VerifyItem[] {
  if (!verifyDoc) return [];
  const verifyPath = join(bundlePath, verifyDoc);
  if (!existsSync(verifyPath)) return [];

  const content = readFileSync(verifyPath, "utf8");
  const items: VerifyItem[] = [];

  for (const line of content.split("\n")) {
    const match = line.match(/^- \[([ xX])\] (.+)$/);
    if (match) {
      items.push({
        text: match[2].trim(),
        checked: match[1] !== " ",
      });
    }
  }

  return items;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function checkDependencies(
  manifest: BundleManifest,
  bundlePath: string,
): Promise<DepsResult> {
  // Runtime deps
  const runtime: RuntimeCheck[] = [];

  for (const dep of manifest.dependencies?.runtime ?? []) {
    runtime.push({ name: dep, found: commandExists(dep), optional: false });
  }
  for (const dep of manifest.dependencies?.optionalRuntime ?? []) {
    runtime.push({ name: dep, found: commandExists(dep), optional: true });
  }

  // MCP requirements
  const mcp: McpReport[] = [];

  for (const m of manifest.mcp ?? []) {
    const envStatus = (m.env ?? []).map((name) => ({
      name,
      set: !!process.env[name],
    }));
    mcp.push({
      id: m.id,
      required: m.required,
      purpose: m.purpose,
      env: m.env ?? [],
      envStatus,
    });
  }

  // Verify checklist
  const verify = parseVerifyChecklist(bundlePath, manifest.setup.verifyDoc);

  // Bootstrap check
  const hasBootstrap = existsSync(join(bundlePath, "BOOTSTRAP.md"));

  return { runtime, mcp, verify, hasBootstrap };
}
