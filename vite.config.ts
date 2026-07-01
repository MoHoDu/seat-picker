import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const base = process.env.VITE_BASE_PATH ?? "/seat-picker/";

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
