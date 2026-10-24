import type { NextConfig } from 'next';
const config: NextConfig = { turbopack: { root: process.cwd() }, outputFileTracingIncludes: { '/api/analyze': ['./data/snapshots/**/*.json'] } };
export default config;
