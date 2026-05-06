import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { ChatProps } from "./chat-props.ts";
import { SLASH_COMMANDS } from "./slash-commands.ts";

export interface FuncDropdownState {
  funcDropdownOpen: boolean;
  selectedSkills: string[];
}

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
export function renderSkillBadgeBar(
  vs: FuncDropdownState,
  requestUpdate: () => void,
): TemplateResult | typeof nothing {
  if (vs.selectedSkills.length === 0) {
    return nothing;
  }
  return html`
    <div class="func-selected-bar">
      ${vs.selectedSkills.map(
        (name) => html`
          <span class="func-badge func-badge--selected">
            <span class="func-badge__icon">${icons.fileText}</span>
            <span class="func-badge__name">${name}</span>
            <button
              class="func-badge__remove"
              type="button"
              aria-label="Remove ${name}"
              @click=${() => {
                vs.selectedSkills = vs.selectedSkills.filter((s) => s !== name);
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
  vs: FuncDropdownState,
  requestUpdate: () => void,
  props: ChatProps,
): TemplateResult {
  const close = () => {
    vs.funcDropdownOpen = false;
    detachOutsideListener();
    requestUpdate();
  };

  const toggle = () => {
    vs.funcDropdownOpen = !vs.funcDropdownOpen;
    if (vs.funcDropdownOpen) {
      attachOutsideListener(close);
    } else {
      detachOutsideListener();
    }
    requestUpdate();
  };

  const insertSkill = (name: string) => {
    if (!vs.selectedSkills.includes(name)) {
      vs.selectedSkills = [...vs.selectedSkills, name];
    }
    close();
  };

  return html`
    <div class="func-dropdown">
      <button
        class="agent-chat__input-btn ${vs.funcDropdownOpen ? "agent-chat__input-btn--active" : ""}"
        @click=${toggle}
        title="Skills"
        aria-label="Insert skill"
        ?disabled=${!props.connected}
      >
        ${icons.zap}
      </button>

      ${vs.funcDropdownOpen
        ? html`
            <div class="func-dropdown__menu" role="listbox" aria-label="Skills">
              <div class="func-dropdown__header">SKILLS</div>
              ${SLASH_COMMANDS.length === 0
                ? html`<div class="func-dropdown__empty">No skills available</div>`
                : SLASH_COMMANDS.map(
                    (cmd) => html`
                      <button
                        class="func-skill-row ${vs.selectedSkills.includes(cmd.name)
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
