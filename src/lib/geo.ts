/**
 * Helpers de geolocalización para inspecciones.
 *
 * - haversine: distancia entre dos puntos (metros)
 * - geocodeAddress: geocodificar dirección → lat/lng (Nominatim / OpenStreetMap)
 * - generateStaticMapUrl: URL de mapa estático (configurable via MAP_PROVIDER)
 * - reverseGeocode: lat/lng → dirección (Nominatim)
 *
 * Proveedores de mapa estático soportados (via MAP_PROVIDER env var):
 *   - "osm"     → OpenStreetMap Static Map (default, gratis)
 *   - "google"  → Google Static Maps API (requiere GOOGLE_MAPS_API_KEY)
 *   - "mapbox"  → Mapbox Static API (requiere MAPBOX_TOKEN)
 */

// Umbral de cercanía: 500 metros
export const GEO_THRESHOLD_METERS = 500;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeCandidate extends LatLng {
  label: string;
  displayName: string;
}

export interface GeoValidationResult {
  distance: number; // metros
  status: "verified" | "out_of_range" | "failed";
  threshold: number;
}

/**
 * Distancia haversine entre dos puntos en metros.
 */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000; // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Valida la cercanía entre la geo capturada y la dirección del siniestro.
 */
export function validateGeoProximity(
  captured: LatLng,
  claim: LatLng,
  threshold: number = GEO_THRESHOLD_METERS,
): GeoValidationResult {
  const distance = haversine(captured, claim);
  if (distance <= threshold) {
    return { distance, status: "verified", threshold };
  }
  return { distance, status: "out_of_range", threshold };
}

/**
 * Geocodifica una dirección usando Nominatim (OpenStreetMap).
 * Retorna TODOS los candidatos (máx 5) para que el usuario elija.
 *
 * La query se construye con dirección + comuna + ciudad + región + país
 * para reducir ambigüedad cuando hay múltiples ubicaciones con la misma
 * calle.
 *
 * Nota: Nominatim tiene un rate limit de 1 request/segundo.
 * Para producción considerar usar un servicio con API key.
 */
export type MapProvider = "osm" | "mapbox";

interface GeocodeOptions {
  providers?: MapProvider[];
  tokens?: Record<MapProvider, string | null>;
}

function buildQueries(a: string, ctx?: { commune?: string | null; city?: string | null; country?: string | null }): string[] {
  const lowerA = a.toLowerCase();
  const commune = ctx?.commune?.trim();
  const city = ctx?.city?.trim();
  const country = ctx?.country?.trim();
  const included = (value?: string) => !!value && lowerA.includes(value.toLowerCase());

  const parts1 = [a];
  if (commune && !included(commune)) parts1.push(commune);
  if (city && !included(city) && city.toLowerCase() !== commune?.toLowerCase()) parts1.push(city);
  if (country && !included(country)) parts1.push(country);

  const parts2 = [a];
  if (country && !included(country)) parts2.push(country);

  return [...new Set([parts1.join(", "), parts2.join(", "), a])];
}

async function osmGeocodeCandidates(q: string): Promise<GeocodeCandidate[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: { "User-Agent": "hub-inspection/1.0" } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map((item: { lat: string; lon: string; display_name: string }) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
    label: item.display_name.split(",")[0] || item.display_name,
  }));
}

async function mapboxGeocodeCandidates(q: string, token: string): Promise<GeocodeCandidate[]> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(token)}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.features || data.features.length === 0) return [];
  return data.features.map((item: { center: [number, number]; place_name: string }) => ({
    lat: item.center[1],
    lng: item.center[0],
    displayName: item.place_name,
    label: item.place_name.split(",")[0] || item.place_name,
  }));
}

export async function geocodeAddressCandidates(
  address: string,
  ctx?: {
    commune?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
  },
  options?: GeocodeOptions
): Promise<GeocodeCandidate[]> {
  if (!address?.trim()) return [];

  const a = address.trim();
  const providers: MapProvider[] = options?.providers?.length ? options.providers : ["osm"];
  const queries = buildQueries(a, ctx);

  for (let p = 0; p < providers.length; p++) {
    const provider = providers[p];
    const token = options?.tokens?.[provider];

    if (provider === "mapbox" && !token) {
      console.warn("[geocode] Mapbox solicitado pero no hay token configurado");
      continue;
    }

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        const candidates =
          provider === "mapbox"
            ? await mapboxGeocodeCandidates(q, token as string)
            : await osmGeocodeCandidates(q);
        if (candidates.length > 0) return candidates;
      } catch {
        // continuar con siguiente query o provider
      }
      // Respetar rate limit entre queries (Nominatim 1 req/s, Mapbox tolera más)
      if (i < queries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    // Pausa entre providers para no saturar
    if (p < providers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }

  return [];
}

/**
 * Geocodifica una dirección y retorna el primer resultado.
 * @deprecated Usar geocodeAddressCandidates + selector manual.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const candidates = await geocodeAddressCandidates(address);
  return candidates[0] || null;
}

/**
 * Geocodificación inversa: lat/lng → dirección.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "hub-inspection/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Genera la URL de un mapa estático con un marcador en el punto dado.
 *
 * Proveedor se determina por la variable de entorno MAP_PROVIDER:
 *   - "google"  → Google Static Maps API (requiere NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
 *   - "mapbox"  → Mapbox Static API (requiere NEXT_PUBLIC_MAPBOX_TOKEN)
 *   - default   → OpenStreetMap Static Map (gratis, sin API key)
 */
export function generateStaticMapUrl(
  lat: number,
  lng: number,
  options?: {
    zoom?: number;
    width?: number;
    height?: number;
    markerColor?: string;
  },
): string {
  const zoom = options?.zoom ?? 16;
  const width = options?.width ?? 600;
  const height = options?.height ?? 400;
  const markerColor = options?.markerColor || "0x0095DA";

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (mapboxToken) {
    const pinColor = markerColor.replace("0x", "%23");
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+${pinColor}(${lng},${lat})/${lng},${lat},${zoom},0/${width}x${height}?access_token=${mapboxToken}`;
  }

  if (googleKey) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:${markerColor}|${lat},${lng}&key=${googleKey}`;
  }

  // Default: OpenStreetMap Static Map (via staticmap.openstreetmap.de)
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin`;
}

/**
 * Construye una dirección completa a partir de los campos del claim.
 */
export function buildClaimAddress(claim: {
  claim_address?: string | null;
  claim_city?: string | null;
  claim_region?: string | null;
  claim_country?: string | null;
  commune?: { name?: string } | null;
}): string {
  const parts: string[] = [];
  if (claim.claim_address) parts.push(claim.claim_address);
  const commune = typeof claim.commune === "object" ? claim.commune?.name : null;
  if (commune) parts.push(commune);
  if (claim.claim_city) parts.push(claim.claim_city);
  if (claim.claim_region) parts.push(claim.claim_region);
  return parts.join(", ");
}
