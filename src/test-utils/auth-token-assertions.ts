import { expect } from "vitest";
import type { WinClawConfig } from "../config/config.js";

export function expectGeneratedTokenPersistedToGatewayAuth(params: {
  generatedToken?: string;
  authToken?: string;
  persistedConfig?: WinClawConfig;
}) {
  expect(params.generatedToken).toMatch(/^[0-9a-f]{48}$/);
  expect(params.authToken).toBe(params.generatedToken);
  expect(params.persistedConfig?.gateway?.auth?.mode).toBe("token");
  expect(params.persistedConfig?.gateway?.auth?.token).toBe(params.generatedToken);
}
