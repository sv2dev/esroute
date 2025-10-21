import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.spec.ts"],
    restoreMocks: true,
    environment: "happy-dom",
    pool: "forks",
    testTimeout: 1000,
  },
});
