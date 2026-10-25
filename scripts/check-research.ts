import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  loadEnvConfig(process.cwd());
  const { research } = await import('../src/server/research');
  const { researchConfig } = await import('../src/server/research-providers');
  const config = researchConfig();
  const secrets = [config.nvidiaKey, config.tavilyKey].filter((s): s is string => Boolean(s));
  const redact = (value: string) => secrets.reduce((s, key) => s.split(key).join('[redacted]'), value);
  if (process.argv.includes('--models')) {
    if (!config.nvidiaKey) throw new Error('NVIDIA is not configured.');
    const response = await fetch('https://integrate.api.nvidia.com/v1/models', { headers: { Authorization: `Bearer ${config.nvidiaKey}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Model inventory unavailable.');
    const data = await response.json() as { data?: Array<{ id: string }> };
    console.log(JSON.stringify(data.data?.map(m => m.id).filter(id => /nemotron|llama|mistral|qwen/i.test(id)))); return;
  }
  console.log(JSON.stringify({ configuration: { nvidia: Boolean(config.nvidiaKey), nvidiaModel: config.model, tavily: Boolean(config.tavilyKey) } }));
  let nvidiaCalls = 0;
  let searches = 0, extractions = 0;
  const transport: typeof fetch = async (input, init) => {
    const host = new URL(String(input)).hostname;
    const started = Date.now();
    if (host === 'api.tavily.com' && new URL(String(input)).pathname === '/search') searches++;
    if (host === 'api.tavily.com' && new URL(String(input)).pathname === '/extract') extractions++;
    const response = await fetch(input, init);
    const diagnostic: Record<string, unknown> = { provider: host, status: response.status, durationMs: Date.now() - started };
    if (response.ok && host === 'integrate.api.nvidia.com') {
      try {
        const data = await response.clone().json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
        const choice = data.choices?.[0], content = choice?.message?.tool_calls?.[0]?.function?.arguments ?? choice?.message?.content;
        diagnostic.finishReason = choice?.finish_reason; diagnostic.contentLength = content?.length ?? 0;
        const outputDir = path.join(process.cwd(), '.atlas-local'); await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, `live-nvidia-${++nvidiaCalls}.json`), redact(JSON.stringify({ finishReason: choice?.finish_reason, content: content ?? null }, null, 2)));
      } catch { /* Diagnostics do not affect provider handling. */ }
    }
    if (!response.ok) {
      try {
        const data = await response.clone().json() as { error?: { message?: string; status?: string } };
        if (data.error?.message) diagnostic.message = redact(data.error.message).slice(0, 500);
        if (data.error?.status) diagnostic.code = data.error.status;
      } catch { /* Never print raw error bodies or headers. */ }
    }
    console.log(JSON.stringify(diagnostic));
    return response;
  };
  const report = await research({ description: 'A specialty coffee shop with fast morning pickup', goals: 'Explain how nearby business offerings could affect ours and give a provisional opening judgment.', scope: { cityId: 'nyc', center: { lat: 40.7308, lon: -73.9973 }, radiusMeters: 1000 }, ...(process.argv.includes('--broad') ? {} : { localOnly: true, osmRequest: { schemaVersion: '1' as const, registryVersion: '2' as const, scope: { cityId: 'nyc' as const, center: { lat: 40.7308, lon: -73.9973 }, radiusMeters: 1000 as const }, categoryId: 'cafe' as const, adjacentCategoryIds: [] } }) }, {
    config, transport, onStage: stage => console.log(JSON.stringify(stage)),
  });
  const output = path.join(process.cwd(), '.atlas-local', 'live-research.json');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, shortlistedBusinesses: report.shortlist.length, sources: report.evidence.length, findings: report.findings.length, insights: report.insights.length, impacts:report.impacts.length, verdict:report.assessment?.verdict??null, webSearches: searches, pageExtractionBatches: extractions, agentRuns: report.agentRuns, output }));
  if (report.status !== 'complete') process.exitCode = 1;
}
main().catch(() => { console.error('Live research check could not finish; inspect stage/provider diagnostics above.'); process.exitCode = 1; });
