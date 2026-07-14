import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "convex/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    css: true,
  },
});