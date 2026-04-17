import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TemplateMapping } from "./discover.js";

export type ScaffoldAction = {
  file: string;
  action: "created" | "skipped";
  from?: string;
};

export async function scaffoldTemplates(
  bundlePath: string,
  templates: TemplateMapping[],
): Promise<ScaffoldAction[]> {
  const results: ScaffoldAction[] = [];

  for (const t of templates) {
    const targetPath = join(bundlePath, t.target);
    const sourcePath = join(bundlePath, t.source);

    if (existsSync(targetPath)) {
      results.push({ file: t.target, action: "skipped" });
      continue;
    }

    if (!existsSync(sourcePath)) {
      // Source template missing — skip silently, report will show it
      results.push({ file: t.target, action: "skipped", from: `${t.source} (not found)` });
      continue;
    }

    const content = readFileSync(sourcePath, "utf8");
    writeFileSync(targetPath, content, "utf8");
    results.push({ file: t.target, action: "created", from: t.source });
  }

  return results;
}
