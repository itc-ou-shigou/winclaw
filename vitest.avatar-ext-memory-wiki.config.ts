// Isolated vitest config for @winclaw-avatar/ext-memory-wiki.
//
// This config is intentionally NOT referenced by any of the existing
// vitest.*.config.ts files in this repo. Run:
//   pnpm vitest --config vitest.avatar-ext-memory-wiki.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/avatar-ext-memory-wiki/test/**/*.test.ts"],
    name: "avatar-ext-memory-wiki",
    isolate: true,
    pool: "threads",
    environment: "node",
  },
});
