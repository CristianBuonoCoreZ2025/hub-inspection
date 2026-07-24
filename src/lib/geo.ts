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
  address?: {
    city?: string | null;
    town?: string | null;
    suburb?: string | null;
    municipality?: string | null;
    county?: string | null;
    state?: string | null;
    country?: string | null;
    [key: string]: string | null | undefined;
  };
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
export type MapProvider = "osm" | "mapbox" | "google";

interface GeocodeOptions {
  providers?: MapProvider[];
  tokens?: Partial<Record<MapProvider, string | null>>;
}

interface GeocodeContext {
  commune?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}

/**
 * Estrategias de query por proveedor.
 *
 * Cada servicio de geocodificación espera distintos parámetros y tolera
 * distintos niveles de contexto. Guardar estas estrategias aquí evita
 * mezclar lógica y volver a romper un proveedor al ajustar otro.
 */
function buildOSMQueries(a: string, ctx: GeocodeContext): string[] {
  // Nominatim (OpenStreetMap) prioriza calle + comuna + ciudad + país.
  // Para Chile la comuna es clave, ya que muchas calles se repiten
  // entre ciudades (ej: Calle X en Colina vs Concepción).
  const commune = ctx.commune?.trim();
  const city = ctx.city?.trim();
  const region = ctx.region?.trim();
  const country = ctx.country?.trim();
  const q1 = [a, commune, city, region, country].filter(Boolean).join(", ");
  const q2 = [a, commune, city, country].filter(Boolean).join(", ");
  const q3 = [a, commune, country].filter(Boolean).join(", ");
  const q4 = [a, city, country].filter(Boolean).join(", ");
  const q5 = [a, country].filter(Boolean).join(", ");
  return [...new Set([q1, q2, q3, q4, q5, a].filter(Boolean))];
}

function buildMapboxQueries(a: string, ctx: GeocodeContext): string[] {
  // Mapbox Geocoding acepta queries con mucho contexto; incluimos todo.
  const parts: string[] = [a];
  if (ctx.commune?.trim()) parts.push(ctx.commune.trim());
  if (ctx.city?.trim()) parts.push(ctx.city.trim());
  if (ctx.region?.trim()) parts.push(ctx.region.trim());
  if (ctx.country?.trim()) parts.push(ctx.country.trim());
  const full = parts.join(", ");
  const withCountry = [a, ctx.country?.trim()].filter(Boolean).join(", ");
  return [...new Set([full, withCountry, a])].filter(Boolean);
}

function buildGoogleQueries(a: string, ctx: GeocodeContext): string[] {
  // Google Geocoding: param address= con calle, comuna, ciudad, región, país.
  // components=country:CL|locality:Santiago requiere códigos ISO, que no
  // tenemos, así que usamos el address completo como fallback.
  const parts: string[] = [a];
  if (ctx.commune?.trim()) parts.push(ctx.commune.trim());
  if (ctx.city?.trim()) parts.push(ctx.city.trim());
  if (ctx.region?.trim()) parts.push(ctx.region.trim());
  if (ctx.country?.trim()) parts.push(ctx.country.trim());
  const full = parts.join(", ");
  const withCountry = [a, ctx.country?.trim()].filter(Boolean).join(", ");
  return [...new Set([full, withCountry, a])].filter(Boolean);
}

function getGeocodeQueries(provider: MapProvider, a: string, ctx?: GeocodeContext): string[] {
  const context = ctx ?? {};
  if (provider === "mapbox") return buildMapboxQueries(a, context);
  if (provider === "google") return buildGoogleQueries(a, context);
  return buildOSMQueries(a, context);
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCountryCode(country?: string | null): string | undefined {
  if (!country) return undefined;
  const n = normalizeForMatch(country);
  if (n.includes("chile")) return "CL";
  if (n.includes("argentina")) return "AR";
  if (n.includes("peru") || n.includes("perú")) return "PE";
  if (n.includes("colombia")) return "CO";
  if (n.includes("mexico") || n.includes("méxico")) return "MX";
  if (n.includes("españa")) return "ES";
  return undefined;
}

/**
 * Filtra candidatos que realmente estén en el contexto esperado.
 * Evita que Nominatim (u otro proveedor) devuelva una calle con nombre
 * similar en otra ciudad/region (ej: "Caletera" en Concepción cuando
 * la dirección es en Colina, Chacabuco).
 */
function filterCandidatesByContext(
  candidates: GeocodeCandidate[],
  ctx?: GeocodeContext,
): GeocodeCandidate[] {
  if (!ctx) return candidates;
  const needles = [ctx.commune, ctx.city, ctx.region]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => normalizeForMatch(v));
  if (needles.length === 0) return candidates;

  return candidates.filter((c) => {
    // Usar los campos de dirección estructurada de Nominatim cuando existan.
    // Así evitamos que el nombre de la calle coincida accidentalmente
    // con una comuna/provincia (ej: "Chacabuco").
    const haystack = c.address
      ? normalizeForMatch(
          [
            c.address.suburb,
            c.address.town,
            c.address.city,
            c.address.municipality,
            c.address.county,
            c.address.state,
            c.address.country,
          ]
            .filter((v): v is string => !!v && v.length > 0)
            .join(" "),
        )
      : normalizeForMatch(c.displayName.split(",").slice(1).join(","));
    return needles.some((needle) => haystack.includes(needle));
  });
}

async function osmGeocodeCandidates(q: string, country?: string | null): Promise<GeocodeCandidate[]> {
  const countryCode = getCountryCode(country);
  const countryParam = countryCode ? `&countrycodes=${countryCode}` : "";
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&accept-language=es${countryParam}`;
  const res = await fetch(url, { headers: { "User-Agent": "hub-inspection/1.0" } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map(
    (item: {
      lat: string;
      lon: string;
      display_name: string;
      address?: GeocodeCandidate["address"];
    }) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
      label: item.display_name.split(",")[0] || item.display_name,
      address: item.address,
    }),
  );
}

async function mapboxGeocodeCandidates(q: string, token: string): Promise<GeocodeCandidate[]> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${encodeURIComponent(token)}&limit=5&language=es`;
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

async function googleGeocodeCandidates(q: string, token: string): Promise<GeocodeCandidate[]> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(token)}&language=es`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) return [];
  return data.results.map((item: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }) => ({
    lat: item.geometry.location.lat,
    lng: item.geometry.location.lng,
    displayName: item.formatted_address,
    label: item.formatted_address.split(",")[0] || item.formatted_address,
  }));
}

export async function geocodeAddressCandidates(
  address: string,
  ctx?: GeocodeContext,
  options?: GeocodeOptions
): Promise<GeocodeCandidate[]> {
  if (!address?.trim()) return [];

  const a = address.trim();
  // Respetar el orden configurado, pero asegurar que OSM siempre esté
  // disponible como fallback si no está en la lista.
  const requestedProviders: MapProvider[] = options?.providers?.length ? options.providers : ["osm"];
  const providers = Array.from(
    new Set<MapProvider>([...requestedProviders, "osm"]),
  );

  for (let p = 0; p < providers.length; p++) {
    const provider = providers[p];
    const token = options?.tokens?.[provider];

    if ((provider === "mapbox" || provider === "google") && !token) {
      console.warn(`[geocode] ${provider} solicitado pero no hay token configurado`);
      continue;
    }

    const queries = getGeocodeQueries(provider, a, ctx);

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        let candidates: GeocodeCandidate[] = [];
        if (provider === "mapbox") {
          candidates = await mapboxGeocodeCandidates(q, token as string);
        } else if (provider === "google") {
          candidates = await googleGeocodeCandidates(q, token as string);
        } else {
          candidates = await osmGeocodeCandidates(q, ctx?.country);
        }
        const relevant = filterCandidatesByContext(candidates, ctx);
        if (relevant.length > 0) return relevant;
      } catch {
        // continuar con siguiente query o provider
      }
      // Respetar rate limit entre queries (Nominatim 1 req/s, Mapbox/Google toleran más)
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
