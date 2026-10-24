import { researchRequestSchema } from '../../../lib/research-contracts';
import { research } from '../../../server/research';
import { researchConfig } from '../../../server/research-providers';

export const runtime = 'nodejs';
export const maxDuration = 120;
let active = 0;
let nextRun = 0;
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  let raw: unknown;
  try { const body = await request.text(); if (body.length > 4096) return Response.json({ error: 'Request too large.' }, { status: 413, headers }); raw = JSON.parse(body); }
  catch { return Response.json({ error: 'Send valid JSON.' }, { status: 400, headers }); }
  const parsed = researchRequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Enter a business description and valid geographic scope.' }, { status: 400, headers });
  const config = researchConfig();
  if (active || Date.now() < nextRun) return Response.json({ error: 'Research capacity reached. Try again shortly.' }, { status: 429, headers: { ...headers, 'Retry-After': '30' } });
  active++; nextRun = Date.now() + 30000;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => { if (!request.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      try {
        const report = await research(parsed.data, { config, signal: request.signal, onStage: stage => send({ type: 'stage', stage }) });
        send({ type: 'report', report });
      } catch { send({ type: 'error', error: 'Research could not finish. Try again with a smaller task.' }); }
      finally { active--; controller.close(); }
    },
  });
  return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'X-Content-Type-Options': 'nosniff' } });
}
