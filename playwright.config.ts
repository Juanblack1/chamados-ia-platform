import { defineConfig, devices } from "@playwright/test";

const backendPort = process.env.E2E_BACKEND_PORT ?? "4100";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "53174";
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./frontend/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  reporter: [["list"]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome"
      }
    }
  ],
  webServer: [
    {
      command: "npm --workspace backend run dev",
      url: `${backendUrl}/api/health`,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "development",
        PORT: backendPort,
        FRONTEND_ORIGIN: frontendUrl,
        LOG_LEVEL: "silent",
        AI_PROVIDER: "mock",
        AUTH_BOOTSTRAP_ADMIN_PASSWORD: "admin123",
        AUTH_TEST_REQUESTER_PASSWORD: "dev123",
        TICKET_STORAGE: "memory"
      }
    },
    {
      command: `npm --workspace frontend run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: frontendUrl,
      timeout: 30_000,
      reuseExistingServer: false,
      env: {
        VITE_DEV_API_TARGET: backendUrl,
        VITE_ENABLE_TEST_LOGIN: "true",
        VITE_TEST_REQUESTER_EMAIL: "solicitante.teste@empresa.local",
        VITE_TEST_REQUESTER_PASSWORD: "dev123"
      }
    }
  ]
});
