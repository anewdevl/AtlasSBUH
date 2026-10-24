export const OVERPASS_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://api.overpass.ch/v1/interpreter',
] as const;
const configuredEndpoint = process.env.ATLAS_OVERPASS_ENDPOINT;
if (configuredEndpoint && !OVERPASS_ENDPOINTS.includes(configuredEndpoint as typeof OVERPASS_ENDPOINTS[number])) {
  throw new Error('ATLAS_OVERPASS_ENDPOINT is not an allowlisted global Overpass endpoint.');
}
export const OVERPASS_ENDPOINT = configuredEndpoint ?? OVERPASS_ENDPOINTS[0];
