import { html, nothing } from "lit";
import type { ChannelsStatusSnapshot } from "../types.ts";

export type StatusBarProps = {
  connected: boolean;
  channels: ChannelsStatusSnapshot | null;
  totalCost: number | null;
  expanded: boolean;
  onToggle: () => void;
};

function formatCost(cost: number | null): string {
  if (cost == null) {
    return "--";
  }
  return `$${cost.toFixed(2)}`;
}

export function renderStatusBar(props: StatusBarProps) {
  const channelLabels = props.channels?.channelLabels ?? {};
  const channelOrder = props.channels?.channelOrder ?? [];
  const channelMeta = props.channels?.channelMeta ?? [];

  // Build connected channel list
  const connectedChannels: string[] = [];
  for (const meta of channelMeta) {
    if (meta && typeof meta === "object" && "id" in meta) {
      const id = (meta as { id: string }).id;
      const connected = (meta as { connected?: boolean }).connected;
      if (connected) {
        const label = channelLabels[id] ?? id;
        connectedChannels.push(label);
      }
    }
  }

  // If no meta, try channelOrder for simple display
  if (connectedChannels.length === 0 && channelOrder.length > 0) {
    for (const id of channelOrder) {
      const label = channelLabels[id] ?? id;
      connectedChannels.push(label);
    }
  }

  return html`
    <div class="statusbar__content" @click=${props.onToggle}>
      <div class="statusbar__section">
        <span class="statusDot ${props.connected ? "ok" : ""}"></span>
        <span class="statusbar__label">Gateway: ${props.connected ? "OK" : "Offline"}</span>
      </div>
      <span class="statusbar__sep"></span>
      <div class="statusbar__section">
        ${connectedChannels.length > 0
          ? connectedChannels.map(
              (ch) => html`<span class="statusbar__channel">${ch} &#10003;</span>`,
            )
          : html`<span class="statusbar__muted">No channels</span>`}
      </div>
      <span class="statusbar__sep"></span>
      <div class="statusbar__section">
        <span>${formatCost(props.totalCost)} this month</span>
      </div>
    </div>
    ${props.expanded
      ? html`
          <div class="statusbar__expanded">
            <div class="statusbar__panel">
              <div class="statusbar__panel-title">Gateway</div>
              <div>Status: ${props.connected ? "Running" : "Offline"}</div>
            </div>
            <div class="statusbar__panel">
              <div class="statusbar__panel-title">Channels</div>
              ${connectedChannels.length > 0
                ? connectedChannels.map((ch) => html`<div>${ch}: connected</div>`)
                : html`<div class="statusbar__muted">None connected</div>`}
            </div>
            <div class="statusbar__panel">
              <div class="statusbar__panel-title">Cost</div>
              <div>Month: ${formatCost(props.totalCost)}</div>
            </div>
          </div>
        `
      : nothing}
  `;
}
