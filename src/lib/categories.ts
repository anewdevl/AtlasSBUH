export const REGISTRY_VERSION = '2';
export const categoryIds = ['cafe', 'bakery', 'bubble-tea', 'pharmacy', 'supermarket', 'restaurant', 'fast-food', 'bar', 'ice-cream', 'convenience', 'clothing', 'shoes', 'electronics', 'books', 'florist', 'pet-shop', 'hairdresser', 'beauty', 'laundry', 'gym', 'dentist', 'clinic', 'veterinary', 'car-repair', 'hotel', 'software', 'coworking', 'estate-agent', 'accountant', 'lawyer'] as const;
export type CategoryId = typeof categoryIds[number];
type Category = { label: string; aliases: string[]; predicates: string[]; adjacent: CategoryId[]; qualifier: string; registryVersion: string };
// Additive catalog: existing v2 predicates/qualifiers are unchanged, preserving exact snapshot compatibility.
const tagRules: Partial<Record<CategoryId, { key: string; values: string[] }>> = {};
function mapped(id: CategoryId, label: string, aliases: string[], key: string, values: string): Category {
 const accepted = values.split('|'); tagRules[id] = { key, values: accepted };
 return { label, aliases, predicates: accepted.map(value => `["${key}"="${value}"]`), adjacent: [], qualifier: `${key}=${values}; active mapped features only`, registryVersion: REGISTRY_VERSION };
}
export const categories: Record<CategoryId, Category> = {
 cafe: { label: 'Café', aliases: ['cafe','café','coffee','coffee shop'], predicates: ['["amenity"="cafe"]'], adjacent: ['bakery','bubble-tea'], qualifier: 'amenity=cafe; excludes exact bubble_tea cuisine tokens', registryVersion: REGISTRY_VERSION },
 bakery: { label: 'Bakery', aliases: ['bakery','bakeries','bake shop'], predicates: ['["shop"="bakery"]'], adjacent: ['cafe'], qualifier: 'shop=bakery', registryVersion: REGISTRY_VERSION },
 'bubble-tea': { label: 'Bubble tea', aliases: ['bubble tea','boba','boba tea'], predicates: ['["amenity"~"^(cafe|fast_food|restaurant)$"]["cuisine"~"(^|;)[ ]*bubble_tea[ ]*(;|$)"]'], adjacent: ['cafe'], qualifier: 'active food amenity with exact bubble_tea cuisine token', registryVersion: REGISTRY_VERSION },
 pharmacy: { label: 'Pharmacy', aliases: ['pharmacy','pharmacies','drugstore','drug store','apothecary'], predicates: ['["amenity"="pharmacy"]','["healthcare"="pharmacy"]'], adjacent: [], qualifier: 'amenity=pharmacy or healthcare=pharmacy; excludes shop=chemist and deprecated shop=pharmacy', registryVersion: REGISTRY_VERSION },
 supermarket: { label: 'Supermarket', aliases: ['supermarket','supermarkets'], predicates: ['["shop"="supermarket"]'], adjacent: [], qualifier: 'shop=supermarket; excludes convenience and grocery shops', registryVersion: REGISTRY_VERSION },
 'restaurant': mapped('restaurant', 'Restaurant', ['restaurant', 'dining', 'pizzeria', 'sushi'], 'amenity', 'restaurant'),
 'fast-food': mapped('fast-food', 'Fast food / takeaway', ['fast food', 'takeaway', 'burger shop'], 'amenity', 'fast_food'),
 'bar': mapped('bar', 'Bar / pub', ['bar', 'pub', 'cocktail bar'], 'amenity', 'bar|pub'),
 'ice-cream': mapped('ice-cream', 'Ice cream', ['ice cream', 'gelato'], 'amenity', 'ice_cream'),
 'convenience': mapped('convenience', 'Convenience store', ['convenience store', 'corner store'], 'shop', 'convenience'),
 'clothing': mapped('clothing', 'Clothing shop', ['clothing', 'fashion store', 'boutique'], 'shop', 'clothes'),
 'shoes': mapped('shoes', 'Shoe shop', ['shoe shop', 'footwear'], 'shop', 'shoes'),
 'electronics': mapped('electronics', 'Electronics shop', ['electronics', 'computer shop'], 'shop', 'electronics|computer'),
 'books': mapped('books', 'Bookshop', ['bookshop', 'bookstore'], 'shop', 'books'),
 'florist': mapped('florist', 'Florist', ['florist', 'flower shop'], 'shop', 'florist'),
 'pet-shop': mapped('pet-shop', 'Pet shop', ['pet shop', 'pet store'], 'shop', 'pet'),
 'hairdresser': mapped('hairdresser', 'Hairdresser / barber', ['hairdresser', 'hair salon', 'barber'], 'shop', 'hairdresser'),
 'beauty': mapped('beauty', 'Beauty / nail salon', ['beauty salon', 'nail salon'], 'shop', 'beauty'),
 'laundry': mapped('laundry', 'Laundry / dry cleaner', ['laundry', 'laundromat', 'dry cleaner'], 'shop', 'laundry|dry_cleaning'),
 'gym': mapped('gym', 'Gym / fitness centre', ['gym', 'fitness', 'fitness centre', 'fitness center'], 'leisure', 'fitness_centre'),
 'dentist': mapped('dentist', 'Dentist', ['dentist', 'dental clinic'], 'amenity', 'dentist'),
 'clinic': mapped('clinic', 'Medical clinic', ['medical clinic', 'doctors office'], 'amenity', 'clinic|doctors'),
 'veterinary': mapped('veterinary', 'Veterinarian', ['veterinarian', 'vet clinic'], 'amenity', 'veterinary'),
 'car-repair': mapped('car-repair', 'Car repair', ['car repair', 'auto repair', 'mechanic'], 'shop', 'car_repair'),
 'hotel': mapped('hotel', 'Hotel / guest house', ['hotel', 'guest house'], 'tourism', 'hotel|guest_house'),
 'software': mapped('software', 'Software / IT office', ['software company', 'software office', 'it company', 'tech company'], 'office', 'it'),
 'coworking': mapped('coworking', 'Coworking space', ['coworking', 'co working'], 'office', 'coworking'),
 'estate-agent': mapped('estate-agent', 'Estate agent', ['estate agent', 'real estate office'], 'office', 'estate_agent'),
 'accountant': mapped('accountant', 'Accountant', ['accountant', 'accounting office'], 'office', 'accountant'),
 'lawyer': mapped('lawyer', 'Law office', ['lawyer', 'law firm', 'law office'], 'office', 'lawyer'),
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
 const rule = tagRules[id];
 if (rule && rule.values.includes(tags[rule.key])) return { [rule.key]: tags[rule.key] };
 return null;
}
