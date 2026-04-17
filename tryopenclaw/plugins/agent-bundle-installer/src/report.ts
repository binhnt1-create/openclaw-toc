import type { BundleManifest } from "./discover.js";
import type { ScaffoldAction } from "./scaffold.js";
import type { DepsResult } from "./check-deps.js";

export type ReportInput = {
  manifest: BundleManifest;
  bundlePath: string;
  scaffolded: ScaffoldAction[];
  deps: DepsResult;
  mode: "install" | "verify" | "status";
};

export function formatInstallReport(input: ReportInput): string {
  const { manifest, deps, scaffolded, mode } = input;
  const lines: string[] = [];

  // Header
  if (mode === "install") {
    lines.push(`Installing bundle: ${manifest.name} (${manifest.id})`);
  } else if (mode === "verify") {
    lines.push(`Verifying bundle: ${manifest.name} (${manifest.id})`);
  } else {
    lines.push(`Status: ${manifest.name} (${manifest.id})`);
  }

  if (manifest.description) {
    lines.push(manifest.description);
  }
  lines.push("");

  // Files section (install mode only)
  if (mode === "install" && scaffolded.length > 0) {
    lines.push("-- Files --");
    for (const s of scaffolded) {
      if (s.action === "created") {
        lines.push(`  + ${s.file} created from ${s.from}`);
      } else {
        lines.push(`  . ${s.file} skipped (already exists)`);
      }
    }
    lines.push("");
  }

  // Bootstrap notice
  if (deps.hasBootstrap && mode === "install") {
    lines.push("-- Bootstrap --");
    lines.push("  BOOTSTRAP.md found — fill in IDENTITY.md with your agent name and scope");
    lines.push("");
  }

  // Runtime deps
  lines.push("-- Runtime --");
  if (deps.runtime.length === 0) {
    lines.push("  No runtime dependencies declared");
  }
  for (const r of deps.runtime) {
    const icon = r.found ? "+" : "!";
    const suffix = r.optional ? " (optional)" : "";
    lines.push(`  ${icon} ${r.name}: ${r.found ? "found" : "NOT FOUND"}${suffix}`);
  }
  lines.push("");

  // MCP requirements
  if (deps.mcp.length > 0) {
    lines.push("-- MCP Required --");
    for (const m of deps.mcp) {
      const req = m.required ? "required" : "optional";
      lines.push(`  ${m.required ? "!" : "."} ${m.id} — ${m.purpose ?? req}`);
      if (m.envStatus.length > 0) {
        lines.push("    Env vars:");
        for (const e of m.envStatus) {
          lines.push(`      ${e.set ? "+" : "-"} ${e.name}: ${e.set ? "set" : "NOT SET"}`);
        }
      }
    }
    lines.push("");
  }

  // Verify checklist
  if (deps.verify.length > 0) {
    lines.push("-- Verify --");
    for (const v of deps.verify) {
      lines.push(`  [${v.checked ? "x" : " "}] ${v.text}`);
    }
    lines.push("");
  }

  // Next steps
  if (mode === "install") {
    lines.push("-- Continue Setup --");
    lines.push("");
    lines.push("Bundle files are ready. To complete setup, say:");
    lines.push("");
    lines.push(`  "Continue setup for ${manifest.name}"`);
    lines.push("");
    lines.push(`I will read ${manifest.setup.skillPath} and guide you through:`);

    const items: string[] = [];
    if (deps.hasBootstrap) {
      items.push("Agent identity and scope (IDENTITY.md, USER.md)");
    }
    const missingMcp = deps.mcp.filter((m) => m.required);
    if (missingMcp.length > 0) {
      items.push(`${missingMcp.map((m) => m.id).join(", ")} MCP setup and credentials`);
    }
    items.push("Local configuration (TOOLS.md)");
    items.push("Verification checklist");

    for (const item of items) {
      lines.push(`  - ${item}`);
    }

    lines.push("");
    lines.push(`To re-check later: /agent-add ${manifest.id} --verify`);
  } else if (mode === "verify") {
    const done = deps.verify.filter((v) => v.checked).length;
    const total = deps.verify.length;
    lines.push(`-- Summary: ${done}/${total} verified --`);
    if (done < total) {
      lines.push("");
      lines.push(`Say "continue setup for ${manifest.name}" to resume.`);
    }
  }

  return lines.join("\n");
}
