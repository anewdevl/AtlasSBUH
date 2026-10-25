import { defineConfig,devices } from '@playwright/test';
const production = process.env.ATLAS_E2E_PRODUCTION === '1';
const port = Number(process.env.ATLAS_E2E_PORT || 3000);
const url = `http://127.0.0.1:${port}`;
export default defineConfig({testDir:'./tests/e2e',fullyParallel:false,use:{baseURL:url,...devices['Desktop Chrome'],channel:process.env.ATLAS_E2E_CHANNEL||undefined,trace:'retain-on-failure'},webServer:{env:{NEXT_PUBLIC_ATLAS_LOCATIONS:'1'},command:`npm run ${production ? 'start' : 'dev'} -- --hostname 127.0.0.1 --port ${port}`,url,reuseExistingServer:!production&&!process.env.CI,timeout:120000}});
