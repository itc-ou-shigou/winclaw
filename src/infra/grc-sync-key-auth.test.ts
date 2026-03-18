/**
 * Tests that GrcSyncService.syncKeyConfig() correctly mirrors key config into
 * auth-profiles.json via upsertAuthProfile / loadAuthProfileStore /
 * saveAuthProfileStore.
 *
 * syncKeyConfig is a private method, so we drive it indirectly by casting the
 * instance to `unknown` and then to a record that exposes the method.  This is
 * intentional: the alternative (extracting the function into a module-level
 * helper) would change the production API surface just for testability.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockedFunction } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull in the mocked
// modules, because vi.mock() calls are hoisted to the top of the file.
// ---------------------------------------------------------------------------

vi.mock("../agents/auth-profiles.js", () => ({
  upsertAuthProfile: vi.fn(),
  loadAuthProfileStore: vi.fn(() => ({
    version: 1,
    profiles: {},
    lastGood: {},
  })),
  saveAuthProfileStore: vi.fn(),
}));

// Prevent GrcClient from opening real network connections.
vi.mock("./grc-client.js", () => ({
  GrcClient: vi.fn(function GrcClientMock() {
    return {};
  }),
}));

// Prevent EvolutionStore from touching real disk paths.
vi.mock("./evolution-store.js", () => ({
  EvolutionStore: vi.fn(function EvolutionStoreMock() {
    return {};
  }),
  hashPayload: vi.fn(),
}));

// Prevent GrcSkillManifestStore from touching real disk paths.
vi.mock("./grc-skill-manifest.js", () => ({
  GrcSkillManifestStore: vi.fn(function GrcSkillManifestStoreMock() {
    return {};
  }),
  compareSemver: vi.fn(),
}));

// Avoid any side-effects from the heartbeat-wake module.
vi.mock("./heartbeat-wake.js", () => ({
  requestHeartbeatNow: vi.fn(),
}));

// Avoid any side-effects from the task-event-cache module.
vi.mock("./task-event-cache.js", () => ({
  cacheTaskEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------

import {
  upsertAuthProfile,
  loadAuthProfileStore,
  saveAuthProfileStore,
} from "../agents/auth-profiles.js";
import { GrcSyncService } from "./grc-sync.js";
import type { GrcKeyConfigEntry } from "./grc-client.js";

// ---------------------------------------------------------------------------
// Typed access to the private syncKeyConfig method
// ---------------------------------------------------------------------------

type KeyConfig = {
  primary: GrcKeyConfigEntry | null;
  auxiliary: GrcKeyConfigEntry | null;
} | null;

interface GrcSyncServicePrivate {
  syncKeyConfig(keyConfig: KeyConfig): void;
}

function privateOf(service: GrcSyncService): GrcSyncServicePrivate {
  return service as unknown as GrcSyncServicePrivate;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const upsertAuthProfileMock = upsertAuthProfile as MockedFunction<typeof upsertAuthProfile>;
const loadAuthProfileStoreMock = loadAuthProfileStore as MockedFunction<
  typeof loadAuthProfileStore
>;
const saveAuthProfileStoreMock = saveAuthProfileStore as MockedFunction<typeof saveAuthProfileStore>;

function makeEntry(overrides: Partial<GrcKeyConfigEntry> = {}): GrcKeyConfigEntry {
  return {
    provider: "testprovider",
    model: "testprovider/base",
    apiKey: "sk-test-key",
    baseUrl: "https://api.testprovider.ai",
    ...overrides,
  };
}

function makeService(): GrcSyncService {
  return new GrcSyncService({
    enabled: false,
    url: "https://grc.example.com",
    authToken: "tok",
    nodeId: "node-test",
    syncInterval: 3600,
    autoUpdate: false,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("GrcSyncService syncKeyConfig — auth-profiles integration", () => {
  let fakeHome: string;

  beforeEach(() => {
    // Point os.homedir() at a real, isolated temp directory so that
    // syncKeyConfig can write winclaw.json and .grc-key-providers.json
    // without touching the developer's actual ~/.winclaw.
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "winclaw-sync-key-auth-"));
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);

    // Reset all mocked auth-profile functions before each test.
    vi.clearAllMocks();

    // The default loadAuthProfileStore mock returns a minimal valid store.
    loadAuthProfileStoreMock.mockReturnValue({
      version: 1,
      profiles: {},
      lastGood: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Best-effort cleanup of the temp home directory.
    try {
      fs.rmSync(fakeHome, { recursive: true, force: true });
    } catch {
      // Non-fatal: the OS will clean it up eventually.
    }
  });

  // -------------------------------------------------------------------------
  // Primary key
  // -------------------------------------------------------------------------

  describe("primary key provided", () => {
    it("calls upsertAuthProfile with correct profileId and api_key credential", () => {
      const service = makeService();
      const entry = makeEntry({ provider: "anthropic", apiKey: "sk-ant-abc123" });

      privateOf(service).syncKeyConfig({ primary: entry, auxiliary: null });

      expect(upsertAuthProfileMock).toHaveBeenCalledOnce();
      expect(upsertAuthProfileMock).toHaveBeenCalledWith({
        profileId: "anthropic:default",
        credential: {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-abc123",
        },
      });
    });

    it("loads the auth store and writes lastGood for the provider", () => {
      const service = makeService();
      const entry = makeEntry({ provider: "openai", apiKey: "sk-openai-xyz" });

      privateOf(service).syncKeyConfig({ primary: entry, auxiliary: null });

      expect(loadAuthProfileStoreMock).toHaveBeenCalled();
      expect(saveAuthProfileStoreMock).toHaveBeenCalledOnce();

      const savedStore = saveAuthProfileStoreMock.mock.calls[0]![0] as {
        lastGood: Record<string, string>;
      };
      expect(savedStore.lastGood["openai"]).toBe("openai:default");
    });

    it("does not call upsertAuthProfile when primary apiKey is empty", () => {
      const service = makeService();
      const entry = makeEntry({ provider: "gemini", apiKey: "" });

      privateOf(service).syncKeyConfig({ primary: entry, auxiliary: null });

      expect(upsertAuthProfileMock).not.toHaveBeenCalled();
      expect(saveAuthProfileStoreMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Auxiliary key
  // -------------------------------------------------------------------------

  describe("auxiliary key provided", () => {
    it("calls upsertAuthProfile for the auxiliary provider", () => {
      const service = makeService();
      const aux = makeEntry({ provider: "mistral", model: "mistral/7b", apiKey: "ms-key-999" });

      privateOf(service).syncKeyConfig({ primary: null, auxiliary: aux });

      expect(upsertAuthProfileMock).toHaveBeenCalledOnce();
      expect(upsertAuthProfileMock).toHaveBeenCalledWith({
        profileId: "mistral:default",
        credential: {
          type: "api_key",
          provider: "mistral",
          key: "ms-key-999",
        },
      });
    });

    it("writes lastGood for auxiliary provider", () => {
      const service = makeService();
      const aux = makeEntry({ provider: "mistral", model: "mistral/7b", apiKey: "ms-key-999" });

      privateOf(service).syncKeyConfig({ primary: null, auxiliary: aux });

      expect(saveAuthProfileStoreMock).toHaveBeenCalledOnce();
      const savedStore = saveAuthProfileStoreMock.mock.calls[0]![0] as {
        lastGood: Record<string, string>;
      };
      expect(savedStore.lastGood["mistral"]).toBe("mistral:default");
    });

    it("does not call upsertAuthProfile when auxiliary apiKey is empty", () => {
      const service = makeService();
      const aux = makeEntry({ provider: "mistral", model: "mistral/7b", apiKey: "" });

      privateOf(service).syncKeyConfig({ primary: null, auxiliary: aux });

      expect(upsertAuthProfileMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Both primary and auxiliary keys
  // -------------------------------------------------------------------------

  describe("both primary and auxiliary keys provided", () => {
    it("calls upsertAuthProfile twice — once per provider", () => {
      const service = makeService();
      const primary = makeEntry({ provider: "anthropic", apiKey: "sk-ant-primary" });
      const auxiliary = makeEntry({
        provider: "openai",
        model: "openai/gpt-4o",
        apiKey: "sk-oai-aux",
      });

      privateOf(service).syncKeyConfig({ primary, auxiliary });

      expect(upsertAuthProfileMock).toHaveBeenCalledTimes(2);

      const calls = upsertAuthProfileMock.mock.calls;
      const profileIds = calls.map((c) => c[0].profileId);
      expect(profileIds).toContain("anthropic:default");
      expect(profileIds).toContain("openai:default");
    });

    it("saves auth store twice — once after each syncAuthProfile call", () => {
      const service = makeService();
      const primary = makeEntry({ provider: "anthropic", apiKey: "sk-ant-primary" });
      const auxiliary = makeEntry({
        provider: "openai",
        model: "openai/gpt-4o",
        apiKey: "sk-oai-aux",
      });

      privateOf(service).syncKeyConfig({ primary, auxiliary });

      // saveAuthProfileStore should be called once per syncAuthProfile invocation.
      expect(saveAuthProfileStoreMock).toHaveBeenCalledTimes(2);
    });

    it("same provider for primary and auxiliary — upsertAuthProfile still called for each key", () => {
      const service = makeService();
      // Same provider name: primary and auxiliary share the provider entry in
      // winclaw.json (auxiliary model appended), but each key path still calls
      // syncAuthProfile independently.
      const primary = makeEntry({
        provider: "anthropic",
        model: "anthropic/claude-3-5-sonnet",
        apiKey: "sk-ant-primary",
      });
      const auxiliary = makeEntry({
        provider: "anthropic",
        model: "anthropic/claude-3-haiku",
        apiKey: "sk-ant-aux",
      });

      privateOf(service).syncKeyConfig({ primary, auxiliary });

      // upsertAuthProfile is called for each non-empty key regardless of whether
      // the provider names match.
      expect(upsertAuthProfileMock).toHaveBeenCalledTimes(2);
      const keys = upsertAuthProfileMock.mock.calls.map((c) => c[0].credential);
      const apiKeys = keys.map((cred) => (cred as { key: string }).key);
      expect(apiKeys).toContain("sk-ant-primary");
      expect(apiKeys).toContain("sk-ant-aux");
    });
  });

  // -------------------------------------------------------------------------
  // Unbind (keyConfig === null)
  // -------------------------------------------------------------------------

  describe("unbind — keyConfig null", () => {
    it("does not call upsertAuthProfile", () => {
      const service = makeService();

      privateOf(service).syncKeyConfig(null);

      expect(upsertAuthProfileMock).not.toHaveBeenCalled();
    });

    it("removes GRC-managed profile entries from the auth store", () => {
      // Seed a .grc-key-providers.json so the service knows which providers
      // were previously GRC-managed.
      const wincDir = path.join(fakeHome, ".winclaw");
      fs.mkdirSync(wincDir, { recursive: true });
      fs.writeFileSync(
        path.join(wincDir, ".grc-key-providers.json"),
        JSON.stringify({ providers: ["anthropic"] }),
        "utf-8",
      );

      // Seed the auth store snapshot that loadAuthProfileStore will return.
      loadAuthProfileStoreMock.mockReturnValue({
        version: 1,
        profiles: {
          "anthropic:default": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-old-key",
          },
        },
        lastGood: { anthropic: "anthropic:default" },
      });

      const service = makeService();
      privateOf(service).syncKeyConfig(null);

      // The store should be saved with the profile removed.
      expect(saveAuthProfileStoreMock).toHaveBeenCalledOnce();
      const savedStore = saveAuthProfileStoreMock.mock.calls[0]![0] as {
        profiles: Record<string, unknown>;
        lastGood: Record<string, string>;
      };
      expect(savedStore.profiles["anthropic:default"]).toBeUndefined();
      expect(savedStore.lastGood["anthropic"]).toBeUndefined();
    });

    it("does not call saveAuthProfileStore when no profiles were previously managed", () => {
      // No .grc-key-providers.json on disk — previousGrcProviders defaults to [].
      loadAuthProfileStoreMock.mockReturnValue({
        version: 1,
        profiles: {},
        lastGood: {},
      });

      const service = makeService();
      privateOf(service).syncKeyConfig(null);

      // Nothing changed — save should not be called.
      expect(saveAuthProfileStoreMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Persistence: winclaw.json is written to the fake home
  // -------------------------------------------------------------------------

  describe("winclaw.json side effects", () => {
    it("writes models.providers to winclaw.json under the fake home directory", () => {
      const service = makeService();
      const entry = makeEntry({ provider: "groq", model: "groq/llama3", apiKey: "gq-key" });

      privateOf(service).syncKeyConfig({ primary: entry, auxiliary: null });

      const configPath = path.join(fakeHome, ".winclaw", "winclaw.json");
      expect(fs.existsSync(configPath)).toBe(true);

      const written = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        models: { providers: Record<string, unknown> };
      };
      expect(written.models.providers["groq"]).toBeDefined();
    });

    it("removes winclaw.json models.providers on unbind", () => {
      const service = makeService();
      const entry = makeEntry({ provider: "groq", model: "groq/llama3", apiKey: "gq-key" });

      // First bind.
      privateOf(service).syncKeyConfig({ primary: entry, auxiliary: null });

      // Then unbind.
      privateOf(service).syncKeyConfig(null);

      const configPath = path.join(fakeHome, ".winclaw", "winclaw.json");
      const written = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      // After removing the only provider, models.providers (and models) should
      // be absent from the config.
      expect((written.models as Record<string, unknown> | undefined)?.providers).toBeUndefined();
    });
  });
});
