import os from "node:os";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { GrcClient } from "../../infra/grc-client.js";
import type { GatewayRequestHandlers } from "./types.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

export const personalInfoHandlers: GatewayRequestHandlers = {
  "personal-info.get": async ({ respond }) => {
    const config = loadConfig();
    const grc = config.grc;
    let nodeId: string | null = null;
    try {
      nodeId = loadOrCreateDeviceIdentity().deviceId;
    } catch {
      // best-effort
    }
    respond(true, {
      employeeId: grc?.employeeId ?? "",
      employeeName: grc?.employeeName ?? "",
      employeeEmail: grc?.employeeEmail ?? "",
      grcUrl: grc?.url ?? GRC_DEFAULT_URL,
      nodeId,
    });
  },

  "personal-info.save": async ({ params, respond }) => {
    const employeeId = typeof params.employeeId === "string" ? params.employeeId : undefined;
    const employeeName = typeof params.employeeName === "string" ? params.employeeName : undefined;
    const employeeEmail = typeof params.employeeEmail === "string" ? params.employeeEmail : undefined;
    const grcUrl = typeof params.grcUrl === "string" ? params.grcUrl : undefined;

    // 1) Sync to GRC via A2A hello FIRST (before writeConfigFile which triggers
    //    config-reload and may restart the gateway, killing in-flight requests).
    let grcSynced = false;
    let grcError: string | undefined;
    const config = loadConfig();
    const grc = config.grc;
    let nodeId: string;
    try {
      nodeId = loadOrCreateDeviceIdentity().deviceId;
    } catch {
      nodeId = `${os.hostname()}-winclaw`;
    }
    const baseUrl = grcUrl ?? grc?.url ?? GRC_DEFAULT_URL;
    const authToken = grc?.auth?.token;
    if (baseUrl && authToken) {
      try {
        const client = new GrcClient({ baseUrl, authToken });
        const platform = os.platform();
        const version = process.env.WINCLAW_VERSION ?? "0.0.0";
        await client.hello(nodeId, platform, version, {
          id: employeeId,
          name: employeeName,
          email: employeeEmail,
        });
        grcSynced = true;
      } catch (err) {
        grcError = (err as Error).message;
      }
    } else {
      grcError = "GRC未接続（URLまたは認証トークン未設定）";
    }

    // 2) Save to winclaw.json (triggers config-reload / gateway restart via chokidar watcher).
    //    Placed after GRC sync so the HTTP request completes before the gateway potentially restarts.
    const nextConfig = {
      ...config,
      grc: {
        ...config.grc,
        ...(employeeId !== undefined && { employeeId }),
        ...(employeeName !== undefined && { employeeName }),
        ...(employeeEmail !== undefined && { employeeEmail }),
        ...(grcUrl !== undefined && { url: grcUrl }),
      },
    };
    await writeConfigFile(nextConfig);

    respond(true, { ok: true, grcSynced, grcError });
  },
};
