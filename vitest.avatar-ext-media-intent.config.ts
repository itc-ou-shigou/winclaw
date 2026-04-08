// Isolated vitest config for @winclaw-avatar/ext-media-intent.
// Run: pnpm vitest --config vitest.avatar-ext-media-intent.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/avatar-ext-media-intent/test/**/*.test.ts"],
    name: "avatar-ext-media-intent",
    isolate: true,
    pool: "threads",
    environment: "node",
  },
});
