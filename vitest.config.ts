import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    env: {
      PAYPAL_ENV: "sandbox",
      PAYPAL_CLIENT_ID: "mock_test_client_id",
      PAYPAL_CLIENT_SECRET: "mock_test_client_secret",
      PAYPAL_WEBHOOK_ID: "mock_test_webhook_id",
      DATABASE_URL: "file:./data/app.db",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
