// Isolated vitest config for @winclaw-avatar/avatar-agent-controls.
// Run: pnpm vitest --config vitest.avatar-agent-controls.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/avatar-agent-controls/test/**/*.test.ts"],
    name: "avatar-agent-controls",
    isolate: true,
    pool: "threads",
    environment: "node",
  },
});
