// Tabs beyond the core Search / Competitors / Compare flow.
// Research is on by default. Set NEXT_PUBLIC_ATLAS_RESEARCH=0 in .env.local to hide it.
// Locations (the area advisor) is off by default. Set NEXT_PUBLIC_ATLAS_LOCATIONS=1 to show it.
export const showResearch = process.env.NEXT_PUBLIC_ATLAS_RESEARCH !== '0';
export const showLocations = process.env.NEXT_PUBLIC_ATLAS_LOCATIONS === '1';