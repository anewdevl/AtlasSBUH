import { z } from 'zod';
import { categorySuggestionSchema, suggestCategory } from '../../../server/ai-category';

const bodySchema = z.object({ description: z.string().trim().min(3).max(200) }).strict();

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: 'Send a valid JSON request.' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Enter a business description between 3 and 200 characters.' }, { status: 400 });

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return Response.json({ error: 'AI suggestions are not configured. Add NVIDIA_API_KEY to .env.local and restart the dev server.' }, { status: 503 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const result = await suggestCategory(parsed.data.description, apiKey, controller.signal);
    return Response.json(categorySuggestionSchema.parse(result), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    console.error('NVIDIA NIM category suggestion failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: timedOut ? 'The AI suggestion timed out. Try again.' : 'The AI suggestion is unavailable. Check the NVIDIA key and try again.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
