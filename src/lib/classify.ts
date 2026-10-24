import { categories, categoryIds } from './categories';
const normalize = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function classify(description: string) {
 const text = ` ${normalize(description)} `;
 const matches = categoryIds.filter(id => categories[id].aliases.some(alias => text.includes(` ${normalize(alias)} `)));
 return { status: matches.length === 1 ? 'suggested' : matches.length ? 'ambiguous' : 'unsupported', matches } as const;
}
