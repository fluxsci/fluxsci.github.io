import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open:'never' }]],
  use: { baseURL:'http://127.0.0.1:1430', trace:'retain-on-failure', screenshot:'only-on-failure' },
  webServer: {
    command:'node scripts/serve.mjs',
    url:'http://127.0.0.1:1430',
    reuseExistingServer:!process.env.CI,
    timeout:15_000
  },
  projects: [
    { name:'chromium', use:{ ...devices['Desktop Chrome'], viewport:{ width:1440, height:1000 } } },
    { name:'firefox', use:{ ...devices['Desktop Firefox'], viewport:{ width:1440, height:1000 } } },
    { name:'webkit', use:{ ...devices['Desktop Safari'], viewport:{ width:1440, height:1000 } } },
    { name:'mobile', use:{ ...devices['iPhone 13'], defaultBrowserType:'webkit' } }
  ]
});
