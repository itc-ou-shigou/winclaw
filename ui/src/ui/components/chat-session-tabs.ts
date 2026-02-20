import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { SessionsListResult } from "../types.ts";

export type ChatSessionTabsProps = {
  activeSessionKey: string;
  openSessions: string[];
  sessionsResult: SessionsListResult | null;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  onNew: () => void;
};

function sessionTitle(key: string, sessionsResult: SessionsListResult | null): string {
  const row = sessionsResult?.sessions?.find((s) => s.key === key);
  if (row?.derivedTitle?.trim()) {
    return row.derivedTitle.trim();
  }
  if (row?.displayName?.trim() && row.displayName !== key) {
    return row.displayName.trim();
  }
  if (row?.label?.trim() && row.label !== key) {
    return row.label.trim();
  }
  // Extract a short label from session key: "agent:main:uuid" → "New Chat"
  // or "agent:main:main" → "Main"
  const parts = key.split(":");
  const last = parts[parts.length - 1] ?? key;
  // If it looks like a UUID, show "New Chat"
  if (/^[0-9a-f]{8}-/.test(last)) {
    return "New Chat";
  }
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function renderChatSessionTabs(props: ChatSessionTabsProps) {
  if (props.openSessions.length <= 1) {
    // Single session: don't show tabs, just show "+ New" button
    return html`
      <div class="chat-session-tabs chat-session-tabs--single">
        <button
          class="chat-session-tabs__new"
          @click=${() => props.onNew()}
          title="New Chat"
        >
          +
        </button>
      </div>
    `;
  }

  return html`
    <div class="chat-session-tabs">
      <div class="chat-session-tabs__list">
        ${repeat(
          props.openSessions,
          (key) => key,
          (key) => {
            const isActive = key === props.activeSessionKey;
            const title = sessionTitle(key, props.sessionsResult);
            return html`
              <button
                class="chat-session-tabs__tab ${isActive ? "chat-session-tabs__tab--active" : ""}"
                @click=${() => props.onSelect(key)}
                title=${key}
              >
                <span class="chat-session-tabs__tab-label">${title}</span>
                <span
                  class="chat-session-tabs__tab-close"
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    props.onClose(key);
                  }}
                  title="Close"
                >
                  &times;
                </span>
              </button>
            `;
          },
        )}
      </div>
      <button
        class="chat-session-tabs__new"
        @click=${() => props.onNew()}
        title="New Chat"
      >
        +
      </button>
    </div>
  `;
}
