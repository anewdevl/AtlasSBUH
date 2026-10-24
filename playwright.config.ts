import { defineConfig,devices } from '@playwright/test';
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,use:{baseURL:'http://127.0.0.1:3000',...devices['Desktop Chrome'],channel:'msedge',trace:'retain-on-failure'},webServer:{command:'npm run dev -- --hostname 127.0.0.1',url:'http://127.0.0.1:3000',reuseExistingServer:!process.env.CI,timeout:120000}});
