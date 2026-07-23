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
 * Retorna lat/lng o null si no se encuentra.
 *
 * Nota: Nominatim tiene un rate limit de 1 request/segundo.
 * Para producción considerar usar un servicio con API key.
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!address?.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "hub-inspection/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
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

  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER || "osm";

  if (provider === "google") {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:${markerColor}|${lat},${lng}&key=${apiKey}`;
    }
  }

  if (provider === "mapbox") {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (token) {
      const pinColor = markerColor.replace("0x", "%23");
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+${pinColor}(${lng},${lat})/${lng},${lat},${zoom},0/${width}x${height}?access_token=${token}`;
    }
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
