import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Ensure local test configuration is enforced
dotenv.config();

if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  if (process.env.SQL_DB_NAME === 'homehub_production') {
    // Override default .env to prevent accidental production connection
    process.env.SQL_DB_NAME = 'homehub_test';
  }
} else {
  process.env.SQL_DB_NAME = 'homehub_test';
}

if (process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`HARD SAFETY GATE TRIGGERED: Playwright tests must strictly target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 25000,
    navigationTimeout: 45000,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx tsx server.ts',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      SQL_DB_NAME: 'homehub_test',
      NODE_ENV: 'development',
      SERVE_STATIC: 'true',
    },
  },
});
