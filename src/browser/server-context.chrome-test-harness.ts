import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/winclaw" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchWinClawChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveWinClawUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopWinClawChrome: vi.fn(async () => {}),
}));
