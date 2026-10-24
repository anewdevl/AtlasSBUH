export const REGISTRY_VERSION = '2';
export const categoryIds = ['cafe', 'bakery', 'bubble-tea', 'pharmacy', 'supermarket'] as const;
export type CategoryId = typeof categoryIds[number];
type Category = { label: string; aliases: string[]; predicates: string[]; adjacent: CategoryId[]; qualifier: string; registryVersion: string };
export const categories: Record<CategoryId, Category> = {
 cafe: { label: 'Café', aliases: ['cafe','café','coffee','coffee shop'], predicates: ['["amenity"="cafe"]'], adjacent: ['bakery','bubble-tea'], qualifier: 'amenity=cafe; excludes exact bubble_tea cuisine tokens', registryVersion: REGISTRY_VERSION },
 bakery: { label: 'Bakery', aliases: ['bakery','bakeries','bake shop'], predicates: ['["shop"="bakery"]'], adjacent: ['cafe'], qualifier: 'shop=bakery', registryVersion: REGISTRY_VERSION },
 'bubble-tea': { label: 'Bubble tea', aliases: ['bubble tea','boba','boba tea'], predicates: ['["amenity"~"^(cafe|fast_food|restaurant)$"]["cuisine"~"(^|;)[ ]*bubble_tea[ ]*(;|$)"]'], adjacent: ['cafe'], qualifier: 'active food amenity with exact bubble_tea cuisine token', registryVersion: REGISTRY_VERSION },
 pharmacy: { label: 'Pharmacy', aliases: ['pharmacy','pharmacies','drugstore','drug store','apothecary'], predicates: ['["amenity"="pharmacy"]','["healthcare"="pharmacy"]'], adjacent: [], qualifier: 'amenity=pharmacy or healthcare=pharmacy; excludes shop=chemist and deprecated shop=pharmacy', registryVersion: REGISTRY_VERSION },
 supermarket: { label: 'Supermarket', aliases: ['supermarket','supermarkets'], predicates: ['["shop"="supermarket"]'], adjacent: [], qualifier: 'shop=supermarket; excludes convenience and grocery shops', registryVersion: REGISTRY_VERSION },
};
export const cuisineTokens = (value = '') => value.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
export function inactive(tags: Record<string,string>) {
 return Object.entries(tags).some(([k,v]) => /^(disused|abandoned|demolished|removed|razed|construction|proposed|was)(:|$)/.test(k) && !['no','false','0',''].includes(v.toLowerCase())) || ['closed','disused','abandoned','demolished'].includes(tags.lifecycle ?? '') || tags.operational_status === 'closed' || ['closed','disused','abandoned'].includes(tags.amenity ?? '') || tags.opening_hours === 'closed';
}
export function matchingEvidence(id: CategoryId, tags: Record<string,string>): Record<string,string> | null {
 if (inactive(tags)) return null;
 const bubble = cuisineTokens(tags.cuisine).includes('bubble_tea');
 if (id === 'cafe' && tags.amenity === 'cafe' && !bubble) return { amenity: tags.amenity, ...(tags.cuisine ? { cuisine: tags.cuisine } : {}) };
 if (id === 'bakery' && tags.shop === 'bakery') return { shop: tags.shop };
 if (id === 'bubble-tea' && bubble && ['cafe','fast_food','restaurant'].includes(tags.amenity)) return { amenity: tags.amenity, cuisine: tags.cuisine };
 if (id === 'pharmacy' && (tags.amenity === 'pharmacy' || tags.healthcare === 'pharmacy')) return { ...(tags.amenity === 'pharmacy' ? { amenity: tags.amenity } : {}), ...(tags.healthcare === 'pharmacy' ? { healthcare: tags.healthcare } : {}) };
 if (id === 'supermarket' && tags.shop === 'supermarket') return { shop: tags.shop };
 return null;
}
