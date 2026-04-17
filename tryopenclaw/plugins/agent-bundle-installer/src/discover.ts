import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export type TemplateMapping = {
  source: string;
  target: string;
  required?: boolean;
};

export type McpRequirement = {
  id: string;
  required: boolean;
  purpose?: string;
  env?: string[];
};

export type BundleManifest = {
  schemaVersion: number;
  id: string;
  name: string;
  type: string;
  description?: string;
  workspaceRoot?: string;
  setup: {
    entryCommand: string;
    installerCommand: string;
    skillPath: string;
    setupDoc?: string;
    verifyDoc?: string;
  };
  templates?: TemplateMapping[];
  dependencies?: {
    docs?: string;
    runtime?: string[];
    optionalRuntime?: string[];
  };
  mcp?: McpRequirement[];
  install?: {
    createFromTemplates?: boolean;
    runBootstrapIfPresent?: boolean;
    runVerifyAtEnd?: boolean;
  };
};

type DiscoverOk = { ok: true; manifest: BundleManifest; bundlePath: string };
type DiscoverErr = { ok: false; error: string };
export type DiscoverResult = DiscoverOk | DiscoverErr;

// ── Path safety ──────────────────────────────────────────────────────────────

const UNSAFE_PATH = /(?:^|\/)\.\.(?:\/|$)/;

function isPathSafe(p: string): boolean {
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) {return false;}
  if (UNSAFE_PATH.test(p)) {return false;}
  return true;
}

function validatePaths(manifest: BundleManifest): string | null {
  const paths: string[] = [];

  if (manifest.workspaceRoot) {paths.push(manifest.workspaceRoot);}
  if (manifest.setup.skillPath) {paths.push(manifest.setup.skillPath);}
  if (manifest.setup.setupDoc) {paths.push(manifest.setup.setupDoc);}
  if (manifest.setup.verifyDoc) {paths.push(manifest.setup.verifyDoc);}
  if (manifest.dependencies?.docs) {paths.push(manifest.dependencies.docs);}

  for (const t of manifest.templates ?? []) {
    paths.push(t.source, t.target);
  }

  for (const p of paths) {
    if (!isPathSafe(p)) {
      return `Unsafe path in manifest: "${p}" (absolute or traversal not allowed)`;
    }
  }
  return null;
}

// ── Discovery ────────────────────────────────────────────────────────────────

export async function discoverBundleAt(
  bundlePath: string,
): Promise<DiscoverResult> {
  if (!existsSync(bundlePath)) {
    return { ok: false, error: `Bundle directory not found: ${bundlePath}` };
  }

  const manifestPath = join(bundlePath, "bundle.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, error: `No bundle.json found in ${bundlePath}` };
  }

  let raw: string;
  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch (err) {
    return { ok: false, error: `Cannot read bundle.json: ${err instanceof Error ? err.message : String(err)}` };
  }

  let manifest: BundleManifest;
  try {
    manifest = JSON.parse(raw) as BundleManifest;
  } catch {
    return { ok: false, error: "bundle.json is not valid JSON" };
  }

  // Required fields
  if (manifest.schemaVersion !== 1) {
    return { ok: false, error: `Unsupported schemaVersion: ${manifest.schemaVersion} (expected 1)` };
  }
  if (!manifest.id || typeof manifest.id !== "string") {
    return { ok: false, error: "Missing or invalid 'id' in bundle.json" };
  }
  if (!manifest.name || typeof manifest.name !== "string") {
    return { ok: false, error: "Missing or invalid 'name' in bundle.json" };
  }
  if (manifest.type !== "agent-bundle") {
    return { ok: false, error: `Invalid type: "${manifest.type}" (expected "agent-bundle")` };
  }
  if (!manifest.setup?.entryCommand || !manifest.setup?.installerCommand || !manifest.setup?.skillPath) {
    return { ok: false, error: "Missing required setup fields (entryCommand, installerCommand, skillPath)" };
  }

  // Path safety
  const pathError = validatePaths(manifest);
  if (pathError) {
    return { ok: false, error: pathError };
  }

  return { ok: true, manifest, bundlePath };
}
