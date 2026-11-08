import { writeFileSync } from 'node:fs';
import { categories } from '../src/lib/categories';
import { cities } from '../src/lib/cities';
import { OVERPASS_ENDPOINTS } from '../src/lib/providers';
writeFileSync('python_backend/atlas_api/registry.json',JSON.stringify({categories,cities,overpassEndpoints:OVERPASS_ENDPOINTS},null,2));
