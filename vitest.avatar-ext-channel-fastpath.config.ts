// Isolated vitest config for @winclaw-avatar/ext-channel-fastpath.
// Run: pnpm vitest --config vitest.avatar-ext-channel-fastpath.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/avatar-ext-channel-fastpath/test/**/*.test.ts"],
    name: "avatar-ext-channel-fastpath",
    isolate: true,
    pool: "threads",
    environment: "node",
  },
});
