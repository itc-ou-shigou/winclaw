import { html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { AppViewState } from "./app-view-state.ts";
import type { ThemeTransitionContext } from "./theme-transition.ts";
import type { ThemeMode } from "./theme.ts";
import type { SessionsListResult } from "./types.ts";
import { WinClawApp } from "./app.ts";
import { renderChatSessionTabs } from "./components/chat-session-tabs.ts";
import { loadAgents } from "./controllers/agents.ts";
import { loadSessions, patchSession } from "./controllers/sessions.ts";
import { icons } from "./icons.ts";
import { iconForTab, pathForTab, titleForTab, type Tab } from "./navigation.ts";

export function renderTab(state: AppViewState, tab: Tab) {
  const href = pathForTab(tab, state.basePath);
  return html`
    <a
      href=${href}
      class="nav-item ${state.tab === tab ? "active" : ""}"
      @click=${(event: MouseEvent) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        state.setTab(tab);
      }}
      title=${titleForTab(tab)}
    >
      <span class="nav-item__icon" aria-hidden="true">${icons[iconForTab(tab)]}</span>
      <span class="nav-item__text">${titleForTab(tab)}</span>
    </a>
  `;
}

function resolveCurrentWorkspace(state: AppViewState): string | undefined {
  // 1. Per-session workspace (from sessionsResult)
  const sessionRow = state.sessionsResult?.sessions?.find(
    (s) => s.key === state.sessionKey,
  );
  if (sessionRow?.workspace) {
    return sessionRow.workspace;
  }
  // 2. Fallback: agent-level workspace
  const agents = state.agentsList?.agents;
  if (!agents || agents.length === 0) {
    return undefined;
  }
  const sessionKey = state.sessionKey ?? "";
  const agentMatch = sessionKey.match(/^agent:([^:]+):/);
  const agentId = agentMatch?.[1] ?? state.agentsList?.defaultId;
  const agent = agents.find((a) => a.id === agentId) ?? agents[0];
  return agent?.workspace;
}

function resolveCurrentAgentId(state: AppViewState): string {
  const sessionKey = state.sessionKey ?? "";
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match?.[1] ?? state.agentsList?.defaultId ?? "default";
}

function resolveCurrentModel(state: AppViewState): string {
  const sessions = state.sessionsResult?.sessions;
  const row = sessions?.find((s) => s.key === state.sessionKey);
  if (row?.model && row?.modelProvider) {
    return `${row.modelProvider}/${row.model}`;
  }
  if (row?.model) {
    return row.model;
  }
  const defaults = state.sessionsResult?.defaults;
  if (defaults?.model && defaults?.modelProvider) {
    return `${defaults.modelProvider}/${defaults.model}`;
  }
  if (defaults?.model) {
    return defaults.model;
  }
  return "";
}

export function renderChatControls(
  state: AppViewState,
  opts?: { onNewSession?: () => void },
) {
  return html`
    <div class="chat-controls">
      ${renderChatSessionTabs({
        activeSessionKey: state.sessionKey,
        openSessions: state.openChatSessions,
        sessionsResult: state.sessionsResult,
        onSelect: (key) => state.switchChatSession(key),
        onClose: (key) => state.removeChatSession(key),
        onNew: () => opts?.onNewSession?.(),
      })}
      ${renderWorkspacePath(state)}
      ${renderModelSelector(state)}
    </div>
  `;
}

async function changeWorkspace(state: AppViewState) {
  const current = resolveCurrentWorkspace(state) ?? "";
  let newPath: string | null = null;

  // Strategy 1: WebView2 bridge (inside WinClawUI.exe)
  const bridge = (window as unknown as Record<string, unknown>).chrome as
    | { webview?: { hostObjects?: { winclawBridge?: { ShowFolderDialog(p: string): Promise<string> } } } }
    | undefined;
  if (bridge?.webview?.hostObjects?.winclawBridge) {
    try {
      const selected = await bridge.webview.hostObjects.winclawBridge.ShowFolderDialog(current);
      newPath = typeof selected === "string" && selected.trim() ? selected.trim() : null;
      if (!newPath) return; // user cancelled
    } catch (err) {
      console.warn("[workspace] WebView2 bridge failed:", err);
    }
  }

  // Strategy 2: Gateway RPC — shows native Windows folder dialog via PowerShell
  if (!newPath && state.client) {
    try {
      const result = await state.client.request("system.showFolderDialog", {
        initialPath: current,
      }) as { path: string | null };
      if (result?.path) {
        newPath = result.path;
      } else if (result?.path === null) {
        return; // user cancelled the dialog
      }
    } catch (err) {
      console.warn("[workspace] Gateway folder dialog failed:", err);
    }
  }

  // Strategy 3: Fallback to window.prompt (plain text input)
  if (!newPath) {
    newPath = window.prompt("Enter workspace directory path:", current);
  }

  if (!newPath || newPath.trim() === current) {
    return;
  }
  const trimmedPath = newPath.trim();

  // Optimistic update: immediately reflect in UI
  const agents = state.agentsList?.agents;
  if (agents) {
    const agentId = resolveCurrentAgentId(state);
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      agent.workspace = trimmedPath;
      state.agentsList = { ...state.agentsList! };
    }
  }

  // Per-session workspace: patch the session entry
  try {
    await state.client?.request("sessions.patch", {
      key: state.sessionKey,
      workspace: trimmedPath,
    });
    await loadSessions(state as unknown as WinClawApp);
  } catch {
    // Fallback: update at agent level
    try {
      const agentId = resolveCurrentAgentId(state);
      await state.client?.request("agents.update", {
        agentId,
        workspace: trimmedPath,
      });
      await loadAgents(state as unknown as WinClawApp, { force: true });
    } catch (err) {
      console.error("[workspace] change failed:", err);
    }
  }
}

function renderWorkspacePath(state: AppViewState) {
  const workspace = resolveCurrentWorkspace(state);
  if (!workspace) {
    return html``;
  }
  return html`
    <div
      class="chat-controls__workspace"
      title="Workspace: ${workspace} (click to change)"
      @click=${() => changeWorkspace(state)}
    >
      <span class="chat-controls__workspace-icon">📁</span>
      <span class="chat-controls__workspace-path">${workspace}</span>
    </div>
  `;
}

function renderModelSelector(state: AppViewState) {
  const models = state.modelCatalog;
  if (!models || models.length === 0) {
    return html``;
  }
  const currentModel = resolveCurrentModel(state);
  return html`
    <span class="chat-controls__separator">|</span>
    <label class="field chat-controls__model">
      <select
        .value=${currentModel}
        ?disabled=${!state.connected}
        @change=${async (e: Event) => {
          const value = (e.target as HTMLSelectElement).value;
          if (!value || value === currentModel) {
            return;
          }
          await patchSession(state as unknown as WinClawApp, state.sessionKey, {
            model: value,
          });
        }}
        title="Switch model"
      >
        ${repeat(
          models,
          (m) => `${m.provider}/${m.id}`,
          (m) => {
            const val = `${m.provider}/${m.id}`;
            return html`<option
              value=${val}
              ?selected=${val === currentModel}
            >
              ${m.name || m.id} (${m.provider})
            </option>`;
          },
        )}
      </select>
    </label>
  `;
}

export function resolveSessionDisplayName(
  key: string,
  row?: SessionsListResult["sessions"][number],
) {
  const displayName = row?.displayName?.trim() || "";
  const label = row?.label?.trim() || "";
  if (displayName && displayName !== key) {
    return `${displayName} (${key})`;
  }
  if (label && label !== key) {
    return `${label} (${key})`;
  }
  return key;
}

const THEME_ORDER: ThemeMode[] = ["system", "light", "dark"];

export function renderThemeToggle(state: AppViewState) {
  const index = Math.max(0, THEME_ORDER.indexOf(state.theme));
  const applyTheme = (next: ThemeMode) => (event: MouseEvent) => {
    const element = event.currentTarget as HTMLElement;
    const context: ThemeTransitionContext = { element };
    if (event.clientX || event.clientY) {
      context.pointerClientX = event.clientX;
      context.pointerClientY = event.clientY;
    }
    state.setTheme(next, context);
  };

  return html`
    <div class="theme-toggle" style="--theme-index: ${index};">
      <div class="theme-toggle__track" role="group" aria-label="Theme">
        <span class="theme-toggle__indicator"></span>
        <button
          class="theme-toggle__button ${state.theme === "system" ? "active" : ""}"
          @click=${applyTheme("system")}
          aria-pressed=${state.theme === "system"}
          aria-label="System theme"
          title="System"
        >
          ${renderMonitorIcon()}
        </button>
        <button
          class="theme-toggle__button ${state.theme === "light" ? "active" : ""}"
          @click=${applyTheme("light")}
          aria-pressed=${state.theme === "light"}
          aria-label="Light theme"
          title="Light"
        >
          ${renderSunIcon()}
        </button>
        <button
          class="theme-toggle__button ${state.theme === "dark" ? "active" : ""}"
          @click=${applyTheme("dark")}
          aria-pressed=${state.theme === "dark"}
          aria-label="Dark theme"
          title="Dark"
        >
          ${renderMoonIcon()}
        </button>
      </div>
    </div>
  `;
}

function renderSunIcon() {
  return html`
    <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="m4.93 4.93 1.41 1.41"></path>
      <path d="m17.66 17.66 1.41 1.41"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="m6.34 17.66-1.41 1.41"></path>
      <path d="m19.07 4.93-1.41 1.41"></path>
    </svg>
  `;
}

function renderMoonIcon() {
  return html`
    <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      ></path>
    </svg>
  `;
}

function renderMonitorIcon() {
  return html`
    <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2"></rect>
      <line x1="8" x2="16" y1="21" y2="21"></line>
      <line x1="12" x2="12" y1="17" y2="21"></line>
    </svg>
  `;
}
