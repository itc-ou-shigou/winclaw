import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { icons } from "../icons.ts";

/**
 * A single log entry from Bash tool execution.
 */
export type ExecLogEntry = {
  ts: number;
  stream: "stdout" | "stderr" | "system";
  text: string;
  toolCallId?: string;
};

export type ExecLogConsoleProps = {
  entries: ExecLogEntry[];
  isActive: boolean;
  autoScroll: boolean;
  onClose: () => void;
  onClear: () => void;
  onToggleAutoScroll: () => void;
};

const MAX_VISIBLE_LINES = 2000;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function renderLogLine(entry: ExecLogEntry) {
  const streamClass =
    entry.stream === "stderr"
      ? "exec-log__line--stderr"
      : entry.stream === "system"
        ? "exec-log__line--system"
        : "";

  // Split multi-line text into individual lines for display
  const lines = entry.text.split("\n");
  const ts = formatTimestamp(entry.ts);

  return lines.map(
    (line, i) => html`
      <div class="exec-log__line ${streamClass}">
        ${
          i === 0
            ? html`<span class="exec-log__timestamp">${ts}</span>`
            : html`
                <span class="exec-log__timestamp-pad"></span>
              `
        }
        <span class="exec-log__text">${line || " "}</span>
      </div>
    `,
  );
}

export function renderExecLogConsole(props: ExecLogConsoleProps) {
  const visibleEntries =
    props.entries.length > MAX_VISIBLE_LINES
      ? props.entries.slice(-MAX_VISIBLE_LINES)
      : props.entries;

  const lineCount = visibleEntries.reduce((acc, e) => acc + e.text.split("\n").length, 0);

  return html`
    <div class="exec-log">
      <div class="exec-log__header">
        <div class="exec-log__header-left">
          <span class="exec-log__title">Execution Log</span>
          <span class="exec-log__status ${props.isActive ? "exec-log__status--active" : ""}">
            ${props.isActive ? "● Running" : "○ Idle"}
          </span>
        </div>
        <div class="exec-log__header-right">
          <button
            class="exec-log__btn"
            @click=${props.onClear}
            title="Clear log"
          >
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
          <button
            class="exec-log__btn"
            @click=${props.onClose}
            title="Close log console"
          >
            ${icons.x}
          </button>
        </div>
      </div>

      <div
        class="exec-log__body"
        ${ref((el) => {
          if (el && props.autoScroll && visibleEntries.length > 0) {
            requestAnimationFrame(() => {
              el.scrollTop = el.scrollHeight;
            });
          }
        })}
      >
        ${
          visibleEntries.length === 0
            ? html`
                <div class="exec-log__empty">Waiting for execution output…</div>
              `
            : visibleEntries.map((entry) => renderLogLine(entry))
        }
      </div>

      <div class="exec-log__footer">
        <span class="exec-log__line-count">${lineCount} lines</span>
        <button
          class="exec-log__btn exec-log__auto-scroll ${props.autoScroll ? "exec-log__auto-scroll--on" : ""}"
          @click=${props.onToggleAutoScroll}
          title="${props.autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}"
        >
          ⬇ ${props.autoScroll ? "Auto" : "Manual"}
        </button>
      </div>
    </div>
  `;
}
