/**
 * TOC skill mention layer (@skill_name syntax).
 *
 * Maintains a separate SKILL_COMMANDS array — completely independent of
 * the shared SLASH_COMMANDS used by the original / slash-command system.
 * Call refreshTocSkillCommands() on connect to populate it.
 */

import type { CommandEntry, CommandsListResult } from "../../../../src/gateway/protocol/index.js";
import type { GatewayBrowserClient } from "../gateway.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import type { SlashCommandDef } from "./slash-commands.ts";

const SKILL_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;

/** Skills available for @mention — separate from SLASH_COMMANDS. */
export const SKILL_COMMANDS: SlashCommandDef[] = [];

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function toSkillName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const name = raw.trim().replace(/^[@/]/u, "").toLowerCase().slice(0, MAX_NAME_LENGTH);
  return name && SKILL_IDENTIFIER_PATTERN.test(name) ? name : null;
}

function skillEntryToSlashDef(entry: CommandEntry): SlashCommandDef | null {
  const aliases = Array.isArray(entry.textAliases) ? entry.textAliases : [];
  const firstName = aliases[0] ?? entry.name;
  const name = toSkillName(firstName);
  if (!name) {
    return null;
  }
  return {
    key: name,
    name,
    aliases: aliases
      .slice(1)
      .map(toSkillName)
      .filter((a): a is string => a !== null),
    description: clamp(
      typeof entry.description === "string" ? entry.description : "",
      MAX_DESCRIPTION_LENGTH,
    ),
    icon: "zap",
    category: "tools",
    executeLocal: false,
  };
}

/** Filter SKILL_COMMANDS by partial name, same logic as getSlashCommandCompletions. */
export function getSkillCompletions(filter: string): SlashCommandDef[] {
  const lower = normalizeLowercaseStringOrEmpty(filter);
  const commands = lower
    ? SKILL_COMMANDS.filter(
        (cmd) =>
          cmd.name.startsWith(lower) ||
          cmd.aliases?.some((a) => normalizeLowercaseStringOrEmpty(a).startsWith(lower)) ||
          normalizeLowercaseStringOrEmpty(cmd.description).includes(lower),
      )
    : SKILL_COMMANDS;
  return lower
    ? commands.toSorted(
        (a, b) => (a.name.startsWith(lower) ? 0 : 1) - (b.name.startsWith(lower) ? 0 : 1),
      )
    : commands;
}

let _refreshSeq = 0;

/** Populate SKILL_COMMANDS from the gateway. Does NOT touch SLASH_COMMANDS. */
export async function refreshTocSkillCommands(params: {
  client: GatewayBrowserClient | null;
  agentId?: string | null;
}): Promise<void> {
  const seq = ++_refreshSeq;

  if (!params.client) {
    if (seq === _refreshSeq) {
      SKILL_COMMANDS.splice(0, SKILL_COMMANDS.length);
    }
    return;
  }

  try {
    const agentId = params.agentId?.trim();
    const result = await params.client.request<CommandsListResult>("commands.list", {
      ...(agentId ? { agentId } : {}),
      includeArgs: false,
      scope: "text",
    });

    if (seq !== _refreshSeq) {
      return;
    }

    const entries = Array.isArray(result?.commands) ? result.commands : [];
    const skillDefs = entries
      .filter((entry) => entry.source === "skill")
      .map(skillEntryToSlashDef)
      .filter((def): def is SlashCommandDef => def !== null);

    SKILL_COMMANDS.splice(0, SKILL_COMMANDS.length, ...skillDefs);
  } catch {
    if (seq === _refreshSeq) {
      SKILL_COMMANDS.splice(0, SKILL_COMMANDS.length);
    }
  }
}
