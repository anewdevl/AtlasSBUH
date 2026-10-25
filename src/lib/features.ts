// Research and Locations are not part of the main pipeline. Their code stays in
// the project; set NEXT_PUBLIC_ATLAS_EXPERIMENTAL=1 in .env.local to show them.
export const experimentalTabs = process.env.NEXT_PUBLIC_ATLAS_EXPERIMENTAL === '1';