import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { MessageGroup } from "../types/chat-types.ts";
import { InputHistory } from "./input-history.ts";
import { extractTextCached } from "./message-extract.ts";
import { SLASH_COMMANDS, type SlashCommandDef } from "./slash-commands.ts";
import { getSkillCompletions } from "./toc-slash-commands.ts";

// TOC-specific ephemeral state — isolated from ChatEphemeralState in chat.ts.
// All skill-mention and func-dropdown state lives here so chat.ts needs zero
// state additions.
interface TocState {
  mentionMenuOpen: boolean;
  mentionMenuItems: SlashCommandDef[];
  mentionMenuIndex: number;
  funcDropdownOpen: boolean;
  selectedSkills: string[];
}

const tocState: TocState = {
  mentionMenuOpen: false,
  mentionMenuItems: [],
  mentionMenuIndex: 0,
  funcDropdownOpen: false,
  selectedSkills: [],
};

// Module-level ref so removeEventListener works across renders
let _outsideHandler: ((e: PointerEvent) => void) | null = null;

function attachOutsideListener(onClose: () => void): void {
  detachOutsideListener();
  _outsideHandler = (e: PointerEvent) => {
    if (!(e.target as Element).closest?.(".func-dropdown")) {
      onClose();
    }
  };
  document.addEventListener("pointerdown", _outsideHandler as EventListener);
}

function detachOutsideListener(): void {
  if (_outsideHandler) {
    document.removeEventListener("pointerdown", _outsideHandler as EventListener);
    _outsideHandler = null;
  }
}

/** Skill identifier pattern — @skill_name syntax. */
const SKILL_PREFIX_RE = /^(@([a-z0-9][a-z0-9_-]*)\s*)+/u;
const SKILL_TOKEN_RE = /@([a-z0-9][a-z0-9_-]*)/gu;

/**
 * Parse leading @skillname tokens from a message text.
 * Returns the extracted skill names and the remaining clean text.
 */
export function parseSkillsFromText(text: string): { skills: string[]; cleanText: string } {
  const match = text.match(SKILL_PREFIX_RE);
  if (!match) {
    return { skills: [], cleanText: text };
  }
  const prefix = match[0];
  const skills: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SKILL_TOKEN_RE);
  while ((m = re.exec(prefix)) !== null) {
    skills.push(m[1]);
  }
  return { skills, cleanText: text.slice(prefix.length) };
}

/**
 * Build the full draft string by prepending selected skill invocations.
 */
export function buildDraftWithSkills(selectedSkills: string[], textDraft: string): string {
  if (selectedSkills.length === 0) {
    return textDraft;
  }
  const prefix = selectedSkills.map((s) => `@${s}`).join(" ");
  return textDraft.trim() ? `${prefix} ${textDraft}` : prefix;
}

/**
 * Render removable badge pills for skills selected in the input bar.
 */
export function renderSkillBadgeBar(requestUpdate: () => void): TemplateResult | typeof nothing {
  if (tocState.selectedSkills.length === 0) {
    return nothing;
  }
  return html`
    <div class="func-selected-bar">
      ${tocState.selectedSkills.map(
        (name) => html`
          <span class="func-badge func-badge--selected">
            <span class="func-badge__icon">${icons.fileText}</span>
            <span class="func-badge__name">${name}</span>
            <button
              class="func-badge__remove"
              type="button"
              aria-label="Remove ${name}"
              @click=${() => {
                tocState.selectedSkills = tocState.selectedSkills.filter((s) => s !== name);
                requestUpdate();
              }}
            >
              ${icons.x}
            </button>
          </span>
        `,
      )}
    </div>
  `;
}

/**
 * Render skill header (icon + name) inside a sent chat message bubble.
 */
export function renderSkillBadgesInline(skills: string[]): TemplateResult | typeof nothing {
  if (skills.length === 0) {
    return nothing;
  }
  return html`
    <div class="func-skill-header-row">
      ${skills.map(
        (name) => html`
          <div class="func-skill-header">
            <span class="func-skill-header__icon">${icons.fileText}</span>
            <span class="func-skill-header__name">${name}</span>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderFuncButton(
  requestUpdate: () => void,
  props: { connected: boolean },
): TemplateResult {
  const close = () => {
    tocState.funcDropdownOpen = false;
    detachOutsideListener();
    requestUpdate();
  };

  const toggle = () => {
    tocState.funcDropdownOpen = !tocState.funcDropdownOpen;
    if (tocState.funcDropdownOpen) {
      attachOutsideListener(close);
    } else {
      detachOutsideListener();
    }
    requestUpdate();
  };

  const insertSkill = (name: string) => {
    if (!tocState.selectedSkills.includes(name)) {
      tocState.selectedSkills = [...tocState.selectedSkills, name];
    }
    close();
  };

  return html`
    <div class="func-dropdown">
      <button
        class="agent-chat__input-btn ${tocState.funcDropdownOpen
          ? "agent-chat__input-btn--active"
          : ""}"
        @click=${toggle}
        title="Skills"
        aria-label="Insert skill"
        ?disabled=${!props.connected}
      >
        ${icons.zap}
      </button>

      ${tocState.funcDropdownOpen
        ? html`
            <div class="func-dropdown__menu" role="listbox" aria-label="Skills">
              <div class="func-dropdown__header">SKILLS</div>
              ${SLASH_COMMANDS.length === 0
                ? html`<div class="func-dropdown__empty">No skills available</div>`
                : SLASH_COMMANDS.map(
                    (cmd) => html`
                      <button
                        class="func-skill-row ${tocState.selectedSkills.includes(cmd.name)
                          ? "func-skill-row--selected"
                          : ""}"
                        role="option"
                        @click=${() => insertSkill(cmd.name)}
                      >
                        <span class="func-skill-row__icon">${icons.fileText}</span>
                        <span class="func-skill-row__body">
                          <span class="func-skill-row__name">${cmd.name}</span>
                          ${cmd.description
                            ? html`<span class="func-skill-row__desc">${cmd.description}</span>`
                            : nothing}
                        </span>
                        <span class="func-skill-row__tag">Official</span>
                      </button>
                    `,
                  )}
            </div>
          `
        : nothing}
    </div>
  `;
}

/** Open/filter the @mention skill picker. Called from chat.ts handleInput. */
export function updateMentionMenu(value: string, requestUpdate: () => void): void {
  const match = value.match(/^@(\S*)$/);
  if (match) {
    const items = getSkillCompletions(match[1]);
    tocState.mentionMenuItems = items;
    tocState.mentionMenuOpen = items.length > 0;
    tocState.mentionMenuIndex = 0;
  } else {
    tocState.mentionMenuOpen = false;
    tocState.mentionMenuItems = [];
  }
  requestUpdate();
}

function selectMention(
  cmd: SlashCommandDef,
  props: { onDraftChange: (next: string) => void },
  requestUpdate: () => void,
): void {
  tocState.mentionMenuOpen = false;
  tocState.mentionMenuItems = [];
  if (!tocState.selectedSkills.includes(cmd.name)) {
    tocState.selectedSkills = [...tocState.selectedSkills, cmd.name];
  }
  props.onDraftChange("");
  requestUpdate();
}

/**
 * Handle keyboard navigation for the @mention menu.
 * Returns true if the event was consumed (caller should return early).
 */
export function handleMentionKeyDown(
  e: KeyboardEvent,
  props: { onDraftChange: (next: string) => void },
  requestUpdate: () => void,
): boolean {
  if (!tocState.mentionMenuOpen || tocState.mentionMenuItems.length === 0) {
    return false;
  }
  const len = tocState.mentionMenuItems.length;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      tocState.mentionMenuIndex = (tocState.mentionMenuIndex + 1) % len;
      requestUpdate();
      return true;
    case "ArrowUp":
      e.preventDefault();
      tocState.mentionMenuIndex = (tocState.mentionMenuIndex - 1 + len) % len;
      requestUpdate();
      return true;
    case "Tab":
    case "Enter":
      e.preventDefault();
      selectMention(tocState.mentionMenuItems[tocState.mentionMenuIndex], props, requestUpdate);
      return true;
    case "Escape":
      e.preventDefault();
      tocState.mentionMenuOpen = false;
      tocState.mentionMenuItems = [];
      requestUpdate();
      return true;
  }
  return false;
}

/** @mention skill picker — independent of the slash menu. */
export function renderMentionMenu(
  requestUpdate: () => void,
  props: { onDraftChange: (next: string) => void },
): TemplateResult | typeof nothing {
  if (!tocState.mentionMenuOpen || tocState.mentionMenuItems.length === 0) {
    return nothing;
  }
  return html`
    <div class="slash-menu slash-menu--badge" role="listbox" aria-label="Skills">
      <div class="slash-menu__badge-grid">
        ${tocState.mentionMenuItems.map(
          (cmd, i) => html`
            <button
              class="func-badge ${i === tocState.mentionMenuIndex ? "func-badge--active" : ""}"
              role="option"
              aria-selected=${i === tocState.mentionMenuIndex}
              title=${cmd.description}
              @click=${() => selectMention(cmd, props, requestUpdate)}
              @mouseenter=${() => {
                tocState.mentionMenuIndex = i;
                requestUpdate();
              }}
            >
              <span class="func-badge__icon">${icons.zap}</span>
              <span class="func-badge__name">${cmd.name}</span>
            </button>
          `,
        )}
      </div>
    </div>
  `;
}

/**
 * Build draft with skill prefixes and send.
 * Replaces the inline send handler in chat.ts — keeps skill state entirely in this module.
 */
export function sendWithSkills(
  props: { draft: string; onDraftChange: (next: string) => void; onSend: () => void },
  inputHistory: InputHistory,
): void {
  const skills = tocState.selectedSkills.slice();
  tocState.selectedSkills = [];
  if (skills.length > 0) {
    const fullDraft = buildDraftWithSkills(skills, props.draft);
    props.onDraftChange(fullDraft);
    if (fullDraft.trim()) {
      inputHistory.push(fullDraft);
    }
  } else {
    if (props.draft.trim()) {
      inputHistory.push(props.draft);
    }
  }
  props.onSend();
}

/**
 * If a user message starts with @skill tokens, render it with skill badges.
 * Returns nothing when the message should fall through to the default renderMessageGroup.
 */
export function tryRenderSkillMessage(item: MessageGroup): TemplateResult | typeof nothing {
  if (item.role.toLowerCase() !== "user" || item.messages.length === 0) {
    return nothing;
  }
  const rawText = extractTextCached(item.messages[0].message) ?? "";
  const { skills, cleanText } = parseSkillsFromText(rawText);
  if (skills.length === 0) {
    return nothing;
  }
  return html`
    <div class="chat-group user">
      <div class="chat-group-messages">
        <div class="chat-bubble fade-in">
          ${renderSkillBadgesInline(skills)}
          ${cleanText.trim()
            ? html`<div class="chat-skill-body">${cleanText.trim()}</div>`
            : nothing}
        </div>
      </div>
    </div>
  `;
}
