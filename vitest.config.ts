import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./vitest.global-setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    env: {
      PAYPAL_ENV: "sandbox",
      PAYPAL_CLIENT_ID: "mock_test_client_id",
      PAYPAL_CLIENT_SECRET: "mock_test_client_secret",
      PAYPAL_WEBHOOK_ID: "mock_test_webhook_id",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        "postgresql://dispute:dispute_password@localhost:5433/dispute_defender_test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
