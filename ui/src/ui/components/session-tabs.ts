import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../icons.ts";
import { iconForTab, titleForTab, type Tab } from "../navigation.ts";

export type SessionTabsProps = {
  activeTab: Tab;
  openTabs: Tab[];
  onTabSelect: (tab: Tab) => void;
  onTabClose: (tab: Tab) => void;
  onAddTab: () => void;
};

export function renderSessionTabs(props: SessionTabsProps) {
  return html`
    <div class="session-tabs">
      ${repeat(
        props.openTabs,
        (tab) => tab,
        (tab) => {
          const isActive = tab === props.activeTab;
          const isChat = tab === "chat";
          return html`
            <button
              class="session-tabs__tab ${isActive ? "session-tabs__tab--active" : ""}"
              @click=${() => props.onTabSelect(tab)}
              title=${titleForTab(tab)}
            >
              <span class="session-tabs__tab-icon">${icons[iconForTab(tab)]}</span>
              <span class="session-tabs__tab-label">${isChat ? "New Chat" : titleForTab(tab)}</span>
              ${isChat
                ? nothing
                : html`
                    <button
                      class="session-tabs__tab-close"
                      @click=${(e: MouseEvent) => {
                        e.stopPropagation();
                        props.onTabClose(tab);
                      }}
                      title="Close tab"
                    >
                      &times;
                    </button>
                  `}
            </button>
          `;
        },
      )}
      <button
        class="session-tabs__add"
        @click=${() => props.onAddTab()}
        title="Open command palette"
      >
        +
      </button>
    </div>
  `;
}
