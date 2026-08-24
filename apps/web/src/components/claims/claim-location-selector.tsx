/// <reference types="google.maps" />
"use client";

declare global {
  interface Window {
    google: typeof google;
    __gmapsInit?: () => void;
  }
}

import * as React from "react";
import { MapPin, Loader2, AlertTriangle, CheckCircle2, MousePointer2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { geocodeAddressCandidates, reverseGeocode, type GeocodeCandidate, type LatLng, type MapProvider } from "@/lib/geo";

// ─── Google Maps loader (singleton) ─────────────────────────────
// Carga el script de Google Maps una sola vez y reutiliza la instancia.
let googleMapsPromise: Promise<typeof google> | null = null;

function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&callback=__gmapsInit`;
    script.async = true;
    script.defer = true;
    (window as unknown as { __gmapsInit?: () => void }).__gmapsInit = () => {
      resolve(window.google);
    };
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error("No se pudo cargar Google Maps"));
    };
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

// ─── Hook: useGoogleMap ──────────────────────────────────────────
// Crea un mapa de Google en el contenedor ref y expone la instancia.
function useGoogleMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  apiKey: string | null,
  center: LatLng,
  onMapClick: (latlng: LatLng) => void,
) {
  const [map, setMap] = React.useState<google.maps.Map | null>(null);
  const [ready, setReady] = React.useState(false);
  const onMapClickRef = React.useRef(onMapClick);
  React.useEffect(() => { onMapClickRef.current = onMapClick; });

  React.useEffect(() => {
    if (!apiKey || !containerRef.current || map) return;
    let cancelled = false;

    loadGoogleMaps(apiKey).then((g) => {
      if (cancelled || !containerRef.current) return;
      const m = new g.maps.Map(containerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: true,
        fullscreenControl: false,
        clickableIcons: false,
      });
      m.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          onMapClickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });
      setMap(m);
      setReady(true);
    }).catch(() => {
      // Si Google falla, el componente muestra fallback de lista
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Recentrar cuando cambia el centro
  React.useEffect(() => {
    if (map && ready) {
      map.setCenter({ lat: center.lat, lng: center.lng });
      if (map.getZoom()! < 14) map.setZoom(16);
    }
  }, [map, ready, center.lat, center.lng]);

  return { map, ready };
}

// ─── Hook: useGoogleMarkers ──────────────────────────────────────
// Gestiona los marcadores en el mapa de Google.
function useGoogleMarkers(
  map: google.maps.Map | null,
  ready: boolean,
  candidates: GeocodeCandidate[],
  selectedIndex: number,
  manualPin: LatLng | null,
  onMarkerClick: (index: number) => void,
) {
  const markersRef = React.useRef<google.maps.Marker[]>([]);
  const manualMarkerRef = React.useRef<google.maps.Marker | null>(null);
  const onMarkerClickRef = React.useRef(onMarkerClick);
  React.useEffect(() => { onMarkerClickRef.current = onMarkerClick; });

  // Limpiar al desmontar
  React.useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      manualMarkerRef.current?.setMap(null);
      manualMarkerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!map || !ready || !window.google?.maps) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Crear marcadores para cada candidato
    candidates.forEach((c, i) => {
      const isSelected = i === selectedIndex && !manualPin;
      const marker = new window.google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map,
        label: {
          text: String(i + 1),
          fontSize: "11px",
          fontWeight: "bold",
          color: isSelected ? "#ffffff" : "#6b7280",
        },
        zIndex: isSelected ? 100 : 1,
      });
      marker.addListener("click", () => onMarkerClickRef.current(i));
      markersRef.current.push(marker);
    });
  }, [map, ready, candidates, selectedIndex, manualPin]);

  // Marcador manual (click en mapa)
  React.useEffect(() => {
    if (!map || !ready || !window.google?.maps) return;
    manualMarkerRef.current?.setMap(null);
    manualMarkerRef.current = null;
    if (manualPin) {
      manualMarkerRef.current = new window.google.maps.Marker({
        position: { lat: manualPin.lat, lng: manualPin.lng },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#0095DA",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        zIndex: 200,
      });
    }
  }, [map, ready, manualPin]);
}

// ─── Hook: useGoogleAutocomplete ─────────────────────────────────
// Autocomplete de Places en el input de búsqueda.
function useGoogleAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  apiKey: string | null,
  onPlaceSelect: (place: { lat: number; lng: number; displayName: string }) => void,
) {
  const onPlaceSelectRef = React.useRef(onPlaceSelect);
  React.useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; });
  const [autocomplete, setAutocomplete] = React.useState<google.maps.places.Autocomplete | null>(null);

  React.useEffect(() => {
    if (!apiKey || !inputRef.current || autocomplete) return;
    let cancelled = false;

    loadGoogleMaps(apiKey).then((g) => {
      if (cancelled || !inputRef.current) return;
      const ac = new g.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode"],
        fields: ["geometry.location", "formatted_address", "name"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place.geometry?.location) {
          onPlaceSelectRef.current({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            displayName: place.formatted_address || place.name || "",
          });
        }
      });
      setAutocomplete(ac);
    }).catch(() => { /* ignore */ });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return autocomplete;
}

// ─── Componente principal ────────────────────────────────────────
interface ClaimLocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  commune?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  claimCoords?: LatLng | null;
  onSelect: (candidate: GeocodeCandidate) => void;
}

export function ClaimLocationSelector({
  open,
  onOpenChange,
  address,
  commune,
  city,
  region,
  country,
  claimCoords,
  onSelect,
}: ClaimLocationSelectorProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [manualPin, setManualPin] = React.useState<LatLng | null>(null);
  const [manualPinAddress, setManualPinAddress] = React.useState<string | null>(null);
  const [draftQuery, setDraftQuery] = React.useState(address);
  const [searchQuery, setSearchQuery] = React.useState(address);
  const [googlePlace, setGooglePlace] = React.useState<GeocodeCandidate | null>(null);
  const validClaimCoords = claimCoords && Number.isFinite(claimCoords.lat) && Number.isFinite(claimCoords.lng) ? claimCoords : null;

  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Reset al abrir
  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setSelectedIndex(0);
      setManualPin(null);
      setManualPinAddress(null);
      setGooglePlace(null);
      setDraftQuery(address);
      setSearchQuery(address);
    }, 0);
    return () => clearTimeout(id);
  }, [open, address, commune, city, region, country, validClaimCoords]);

  const handleSearch = () => {
    setSearchQuery(draftQuery);
    setSelectedIndex(0);
    setManualPin(null);
    setManualPinAddress(null);
    setGooglePlace(null);
  };

  const handleMapClick = async (latlng: LatLng) => {
    setManualPin(latlng);
    setManualPinAddress(null);
    setSelectedIndex(-1);
    setGooglePlace(null);
    const addr = await reverseGeocode(latlng.lat, latlng.lng);
    if (addr) {
      setManualPinAddress(addr);
      setDraftQuery(addr);
    }
  };

  const { data: mapProviders } = useQuery({
    queryKey: ["map-providers"],
    queryFn: async () => {
      const res = await fetch("/api/settings/map-providers");
      const data = await res.json();
      return data as { providers: MapProvider[]; tokens: Partial<Record<MapProvider, string | null>> };
    },
    enabled: open,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const googleApiKey = mapProviders?.tokens?.google ?? null;

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["geocode-candidates", searchQuery, commune, city, region, country, mapProviders],
    queryFn: () => geocodeAddressCandidates(searchQuery, { commune, city, region, country }, {
      providers: mapProviders?.providers,
      tokens: mapProviders?.tokens,
    }),
    enabled: open && !!searchQuery?.trim() && !!mapProviders,
    staleTime: 0,
  });

  // Reverse geocode de coordenadas ya registradas
  const { data: claimAddressFromCoords } = useQuery({
    queryKey: ["reverse-geocode", validClaimCoords],
    queryFn: () => reverseGeocode(validClaimCoords!.lat, validClaimCoords!.lng),
    enabled: open && !!validClaimCoords,
    staleTime: 5 * 60 * 1000,
  });

  // Fallback: centrar mapa en comuna/ciudad/región/país
  const centerAddress = [city, commune, region, country].filter(Boolean).join(", ") || "Chile";
  const { data: centerCandidates = [] } = useQuery({
    queryKey: ["geocode-center", centerAddress],
    queryFn: () => geocodeAddressCandidates(centerAddress, {}),
    enabled: open && !isLoading && candidates.length === 0 && !validClaimCoords,
    staleTime: 5 * 60 * 1000,
  });

  const fallbackCandidate = validClaimCoords
    ? {
        lat: validClaimCoords.lat,
        lng: validClaimCoords.lng,
        label: "Ubicación registrada del siniestro",
        displayName: claimAddressFromCoords || address || "Coordenadas registradas",
      }
    : null;
  const allCandidates = googlePlace
    ? [googlePlace]
    : candidates.length > 0 ? candidates : fallbackCandidate ? [fallbackCandidate] : [];
  const selected = selectedIndex >= 0 ? allCandidates[selectedIndex] || null : null;
  const mapCenter = manualPin || selected || centerCandidates[0] || { lat: -33.44, lng: -70.66 };
  const hasCandidates = allCandidates.length > 0;

  // Google Maps
  const { map, ready } = useGoogleMap(mapContainerRef, googleApiKey, mapCenter, handleMapClick);
  useGoogleMarkers(map, ready, allCandidates, selectedIndex, manualPin, (i) => {
    setSelectedIndex(i);
    setManualPin(null);
    setManualPinAddress(null);
    setGooglePlace(null);
  });

  // Autocomplete en el input de búsqueda
  useGoogleAutocomplete(searchInputRef, googleApiKey, (place) => {
    setGooglePlace({
      lat: place.lat,
      lng: place.lng,
      label: place.displayName.split(",")[0] || place.displayName,
      displayName: place.displayName,
    });
    setSelectedIndex(0);
    setManualPin(null);
    setManualPinAddress(null);
  });

  const handleConfirm = () => {
    if (manualPin) {
      onSelect({
        lat: manualPin.lat,
        lng: manualPin.lng,
        label: "Ubicación manual",
        displayName: manualPinAddress || "Ubicación manual seleccionada en mapa",
      });
      onOpenChange(false);
    } else if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-lg">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="app-section-title">Seleccionar ubicación exacta</DialogTitle>
          <DialogDescription className="modal-subtitle">
            {isLoading
              ? "Buscando ubicaciones..."
              : hasCandidates
                ? `Se encontraron ${allCandidates.length} posibles ubicaciones. Elige la más cercana al siniestro.`
                : "No se encontraron ubicaciones automáticas. Haz clic en el mapa para marcar la ubicación."}
          </DialogDescription>
          <div className="mt-3 flex items-center gap-2">
            <Input
              ref={searchInputRef}
              className="app-input h-8 flex-1"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Escribir dirección (autocompleta con Google)"
            />
            <Button type="button" variant="outline" className="h-8 px-3" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 h-[70vh]">
          {/* Lista de candidatos */}
          <div className="flex flex-col border-r border-border min-h-0">
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando ubicaciones...
                </div>
              )}
              {!isLoading && !hasCandidates && (
                <div className="space-y-3 py-4">
                  <div className="flex items-start gap-2 text-[11px] text-rose-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    No se encontraron ubicaciones con esa dirección.
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Haz clic en el mapa a la derecha para marcar el punto exacto. Luego pulsa Confirmar.
                  </p>
                  {manualPin && (
                    <div className="rounded-lg border border-border p-3 text-[11px] space-y-1">
                      <p className="font-medium text-emerald-600 flex items-center gap-1">
                        <MousePointer2 className="h-3 w-3" />
                        Ubicación manual seleccionada
                      </p>
                      <p className="font-mono text-muted-foreground">
                        {manualPin.lat.toFixed(6)}, {manualPin.lng.toFixed(6)}
                      </p>
                      {manualPinAddress && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2">
                          {manualPinAddress}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {!isLoading && hasCandidates && allCandidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSelectedIndex(i);
                    setManualPin(null);
                    setManualPinAddress(null);
                    setGooglePlace(null);
                  }}
                  className={`w-full text-left rounded-lg border p-3 text-[11px] transition-colors ${
                    i === selectedIndex && !manualPin
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{c.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {c.displayName}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
                      </p>
                    </div>
                    {i === selectedIndex && !manualPin && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="pg-btn-platinum"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="pg-btn-platinum"
                disabled={!selected && !manualPin}
                onClick={handleConfirm}
              >
                Confirmar
              </Button>
            </div>
          </div>

          {/* Mapa — Google Maps si hay API key, sino Leaflet fallback */}
          <div className="relative h-full min-h-70 md:min-h-0">
            {googleApiKey ? (
              <div ref={mapContainerRef} className="h-full w-full" />
            ) : (
              <div className="flex items-center justify-center h-full bg-muted/20 text-[11px] text-muted-foreground">
                Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
