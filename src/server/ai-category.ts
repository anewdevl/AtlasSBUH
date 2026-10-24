import { z } from 'zod';
import { categoryIds, categories } from '../lib/categories';

export const categorySuggestionSchema = z.object({
  categoryId: z.enum(categoryIds).nullable(),
  explanation: z.string().trim().min(1).max(240),
}).strict();

export type CategorySuggestion = z.infer<typeof categorySuggestionSchema>;

const catalog = categoryIds.map((id) => `${id}: ${categories[id].label}`).join('\n');

export async function suggestCategory(description: string, apiKey: string, signal?: AbortSignal): Promise<CategorySuggestion> {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b', temperature: 0.1, top_p: 1, max_tokens: 220, stream: false,
      messages: [
        { role: 'system', content: `Classify a business description only when its primary local storefront category clearly matches one of these currently mapped categories:\n${catalog}\n\nReturn exactly one JSON object with keys categoryId and explanation. categoryId must be one listed ID or null. Never force a technology company, office, service, or other unsupported business into a nearby category. Do not make claims about local demand, competitors, or market fit. Give a brief user-facing explanation, not hidden reasoning.` },
        { role: 'user', content: description },
      ],
    }),
  });

  if (!response.ok) throw new Error(`NVIDIA NIM returned HTTP ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('NVIDIA NIM returned no text content');
  const json = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(json);
  return categorySuggestionSchema.parse(parsed);
}
