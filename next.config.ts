import type { NextConfig } from 'next';
const config: NextConfig = {
 distDir: process.env.ATLAS_NEXT_DIST_DIR || '.next',
 experimental: { proxyTimeout: 115000 },
 turbopack: { root: process.cwd() },
 outputFileTracingIncludes: { '/api/analyze': ['./data/snapshots/**/*.json'] },
 async rewrites() {
  if (process.env.ATLAS_TYPESCRIPT_REFERENCE === '1') return [];
  // Preserve the existing Node routes on Vercel. Switching production to a
  // separately hosted Python service is an explicit deployment decision.
  if (process.env.VERCEL === '1' && process.env.ATLAS_USE_PYTHON_BACKEND !== '1') return [];
  const backend = process.env.ATLAS_BACKEND_URL?.trim();
  if (!backend) return [];
  const destination = new URL(backend);
  if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password || destination.search || destination.hash) throw new Error('ATLAS_BACKEND_URL must be an HTTP(S) service URL without credentials, query or fragment.');
  if (process.env.VERCEL === '1' && (destination.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname))) throw new Error('A Vercel Python backend must use a deployed HTTPS service, not localhost.');
  return { beforeFiles: ['analyze', 'research', 'suggest', 'locations', 'location-advice'].map(route => ({ source: `/api/${route}`, destination: `${backend.replace(/\/$/, '')}/api/${route}` })) };
 },
};
export default config;
