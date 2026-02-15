import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../icons.ts";
import { COMMANDS, COMMAND_CATEGORIES, type CommandDefinition } from "../navigation.ts";

export type CommandPaletteProps = {
  open: boolean;
  recentCommandIds: string[];
  onSelect: (cmd: CommandDefinition) => void;
  onClose: () => void;
};

function matchesQuery(cmd: CommandDefinition, query: string): boolean {
  const q = query.toLowerCase();
  if (cmd.label.toLowerCase().includes(q)) {
    return true;
  }
  if (cmd.id.toLowerCase().includes(q)) {
    return true;
  }
  return cmd.keywords.some((kw) => kw.toLowerCase().includes(q));
}

export function renderCommandPalette(props: CommandPaletteProps) {
  if (!props.open) {
    return nothing;
  }

  let query = "";
  let highlightIndex = 0;

  const getFilteredCommands = (q: string) => {
    if (!q.trim()) {
      return COMMANDS;
    }
    return COMMANDS.filter((cmd) => matchesQuery(cmd, q));
  };

  const handleKeydown = (e: KeyboardEvent) => {
    const listEl = (e.target as HTMLElement)
      .closest(".command-palette")
      ?.querySelector(".command-palette__list");
    const items = listEl?.querySelectorAll(".command-palette__item") as
      | NodeListOf<HTMLElement>
      | undefined;
    if (!items?.length) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
      items.forEach((item, i) => item.classList.toggle("highlighted", i === highlightIndex));
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
      items.forEach((item, i) => item.classList.toggle("highlighted", i === highlightIndex));
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const activeItem = items[highlightIndex];
      if (activeItem) {
        activeItem.click();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  };

  const handleInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    query = input.value;
    highlightIndex = 0;

    const paletteEl = input.closest(".command-palette");
    const listEl = paletteEl?.querySelector(".command-palette__list");
    if (!listEl) {
      return;
    }

    const filtered = getFilteredCommands(query);

    // Build grouped HTML
    const recentIds = props.recentCommandIds;
    const recentCmds = query.trim()
      ? []
      : recentIds.map((id) => filtered.find((c) => c.id === id)).filter(Boolean) as CommandDefinition[];
    const nonRecentFiltered = query.trim()
      ? filtered
      : filtered.filter((c) => !recentIds.includes(c.id));

    let itemIndex = 0;
    let htmlContent = "";

    if (recentCmds.length > 0) {
      htmlContent += `<div class="command-palette__category">最近のコマンド</div>`;
      for (const cmd of recentCmds) {
        htmlContent += renderCommandItemHtml(cmd, itemIndex === highlightIndex);
        itemIndex++;
      }
    }

    for (const cat of COMMAND_CATEGORIES) {
      const cmds = nonRecentFiltered.filter((c) => c.category === cat);
      if (cmds.length === 0) {
        continue;
      }
      htmlContent += `<div class="command-palette__category">${cat}</div>`;
      for (const cmd of cmds) {
        htmlContent += renderCommandItemHtml(cmd, itemIndex === highlightIndex);
        itemIndex++;
      }
    }

    listEl.innerHTML = htmlContent;

    // Rebind click handlers
    listEl.querySelectorAll(".command-palette__item").forEach((el) => {
      el.addEventListener("click", () => {
        const cmdId = (el as HTMLElement).dataset.cmdId;
        const cmd = COMMANDS.find((c) => c.id === cmdId);
        if (cmd) {
          props.onSelect(cmd);
        }
      });
    });
  };

  // Build initial list
  const recentIds = props.recentCommandIds;
  const recentCmds = recentIds
    .map((id) => COMMANDS.find((c) => c.id === id))
    .filter(Boolean) as CommandDefinition[];
  const nonRecent = COMMANDS.filter((c) => !recentIds.includes(c.id));

  let flatIndex = 0;

  return html`
    <div
      class="command-palette-overlay"
      @click=${(e: MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains("command-palette-overlay")) {
          props.onClose();
        }
      }}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Escape") {
          props.onClose();
        }
      }}
    >
      <div class="command-palette">
        <div class="command-palette__search">
          <span class="command-palette__search-icon">${icons.search ?? html`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>`}</span>
          <input
            type="text"
            class="command-palette__input"
            placeholder="コマンドを検索..."
            @input=${handleInput}
            @keydown=${handleKeydown}
            ${ref((el) => {
              if (el) {
                requestAnimationFrame(() => (el as HTMLInputElement).focus());
              }
            })}
          />
        </div>
        <div class="command-palette__list">
          ${recentCmds.length > 0
            ? html`
                <div class="command-palette__category">最近のコマンド</div>
                ${repeat(
                  recentCmds,
                  (cmd) => `recent-${cmd.id}`,
                  (cmd) => {
                    const idx = flatIndex++;
                    return renderCommandItem(cmd, idx === 0, props.onSelect);
                  },
                )}
              `
            : nothing}
          ${repeat(
            COMMAND_CATEGORIES,
            (cat) => cat,
            (cat) => {
              const cmds = nonRecent.filter((c) => c.category === cat);
              if (cmds.length === 0) {
                return nothing;
              }
              return html`
                <div class="command-palette__category">${cat}</div>
                ${repeat(
                  cmds,
                  (cmd) => cmd.id,
                  (cmd) => {
                    const idx = flatIndex++;
                    return renderCommandItem(cmd, idx === 0, props.onSelect);
                  },
                )}
              `;
            },
          )}
        </div>
      </div>
    </div>
  `;
}

function renderCommandItem(
  cmd: CommandDefinition,
  highlighted: boolean,
  onSelect: (cmd: CommandDefinition) => void,
) {
  return html`
    <button
      class="command-palette__item ${highlighted ? "highlighted" : ""}"
      data-cmd-id=${cmd.id}
      @click=${() => onSelect(cmd)}
    >
      <span class="command-palette__item-icon">${icons[cmd.icon]}</span>
      <span class="command-palette__item-label">${cmd.label}</span>
      ${cmd.shortcut
        ? html`<span class="command-palette__item-shortcut">${cmd.shortcut}</span>`
        : cmd.tab
          ? html`<span class="command-palette__item-shortcut">${cmd.tab}</span>`
          : nothing}
    </button>
  `;
}

function renderCommandItemHtml(cmd: CommandDefinition, highlighted: boolean): string {
  const shortcutHtml = cmd.shortcut
    ? `<span class="command-palette__item-shortcut">${cmd.shortcut}</span>`
    : cmd.tab
      ? `<span class="command-palette__item-shortcut">${cmd.tab}</span>`
      : "";
  return `<button class="command-palette__item ${highlighted ? "highlighted" : ""}" data-cmd-id="${cmd.id}">
    <span class="command-palette__item-icon"></span>
    <span class="command-palette__item-label">${cmd.label}</span>
    ${shortcutHtml}
  </button>`;
}
