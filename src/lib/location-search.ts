import { z } from 'zod';
import { positionSchema } from './contracts';
export const locationSearchSchema = z.object({ query: z.string().trim().min(3).max(180), cityId: z.enum(['nyc', 'london', 'dubai', 'singapore']) }).strict();
export const locationResultsSchema = z.array(z.object({ id: z.string(), label: z.string().min(1).max(1000), coordinates: positionSchema }).strict()).max(8);
export type LocationResult = z.infer<typeof locationResultsSchema>[number];
