import { z } from 'zod';
import { categoryIds } from './categories';
export const categorySuggestionSchema = z.object({
  categoryId: z.enum(categoryIds).nullable(),
  explanation: z.string().trim().min(1).max(240),
}).strict();

export type CategorySuggestion = z.infer<typeof categorySuggestionSchema>;

