// Isolated vitest config for @winclaw-avatar/ext-compaction.
// Run: pnpm vitest --config vitest.avatar-ext-compaction.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/avatar-ext-compaction/test/**/*.test.ts"],
    name: "avatar-ext-compaction",
    isolate: true,
    pool: "threads",
    environment: "node",
  },
});
