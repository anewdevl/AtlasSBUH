import { locationAdviceRequestSchema } from '../../../lib/location-advisor';
import { adviseLocation } from '../../../server/location-advisor';
export const runtime = 'nodejs';
export const maxDuration = 65;
let active = false, lastStart = 0;
export async function POST(request: Request) {
 let raw: unknown;
 try { const text = await request.text(); if (text.length > 4096) return Response.json({ error: 'Request too large.' }, { status: 413 }); raw = JSON.parse(text); }
 catch { return Response.json({ error: 'Send valid JSON.' }, { status: 400 }); }
 const parsed = locationAdviceRequestSchema.safeParse(raw);
 if (!parsed.success) return Response.json({ error: 'Choose a supported business type and area.' }, { status: 400 });
 if (active || Date.now() - lastStart < 30000) return Response.json({ error: 'Please wait 30 seconds between location comparisons.' }, { status: 429, headers: { 'Retry-After': '30' } });
 active = true; lastStart = Date.now();
 try { return Response.json(await adviseLocation(parsed.data, { signal: request.signal }), { headers: { 'Cache-Control': 'no-store' } }); }
 catch { return Response.json({ error: 'Location comparison could not retrieve usable map data. Check the Overpass provider and try again. No substitute area or zero counts were produced.' }, { status: 503 }); }
 finally { active = false; }
}
