"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
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

// Fix iconos de Leaflet en Next.js (CDN)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const blueIcon = L.divIcon({
  className: "geo-marker-blue",
  html: `<div style="background:#0095DA;width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const grayIcon = L.divIcon({
  className: "geo-marker-gray",
  html: `<div style="background:#6b7280;width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 14],
});

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([center.lat, center.lng], 16);
  }, [center.lat, center.lng, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

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
  const [manualPin, setManualPin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [manualPinAddress, setManualPinAddress] = React.useState<string | null>(null);
  const [draftQuery, setDraftQuery] = React.useState(address);
  const [searchQuery, setSearchQuery] = React.useState(address);
  const validClaimCoords = claimCoords && Number.isFinite(claimCoords.lat) && Number.isFinite(claimCoords.lng) ? claimCoords : null;

  // Reset selected index y búsqueda cuando se abre con una nueva dirección
  // Se difiere con setTimeout para evitar setState sincrónico dentro del effect.
  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setSelectedIndex(0);
      setManualPin(null);
      setManualPinAddress(null);
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
  };

  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    setManualPin(latlng);
    setManualPinAddress(null);
    setSelectedIndex(-1);
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

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["geocode-candidates", searchQuery, commune, city, region, country, mapProviders],
    queryFn: () => geocodeAddressCandidates(searchQuery, { commune, city, region, country }, {
      providers: mapProviders?.providers,
      tokens: mapProviders?.tokens,
    }),
    enabled: open && !!searchQuery?.trim() && !!mapProviders,
    staleTime: 0,
  });

  // Reverse geocode de las coordenadas ya registradas del siniestro
  const { data: claimAddressFromCoords } = useQuery({
    queryKey: ["reverse-geocode", validClaimCoords],
    queryFn: () => reverseGeocode(validClaimCoords!.lat, validClaimCoords!.lng),
    enabled: open && !!validClaimCoords,
    staleTime: 5 * 60 * 1000,
  });

  // Fallback: centrar el mapa manual en la comuna/ciudad/región/país
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
  const allCandidates = candidates.length > 0 ? candidates : fallbackCandidate ? [fallbackCandidate] : [];
  const selected = selectedIndex >= 0 ? allCandidates[selectedIndex] || null : null;
  const mapCenter = manualPin || selected || centerCandidates[0] || { lat: -33.44, lng: -70.66 };
  const hasCandidates = allCandidates.length > 0;

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
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
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
              className="app-input h-8 flex-1"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Editar dirección de búsqueda"
            />
            <Button type="button" variant="outline" className="h-8 px-3" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 h-[75vh]">
          {/* Lista de candidatos */}
          <div className="flex flex-col border-r border-border">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                Confirmar ubicación
              </Button>
            </div>
          </div>

          {/* Mapa */}
          <div className="relative h-full min-h-75 md:min-h-0">
            {(selected || !hasCandidates || manualPin) ? (
              <MapContainer
                center={[mapCenter.lat, mapCenter.lng]}
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {allCandidates.map((c, i) => (
                  <Marker
                    key={i}
                    position={[c.lat, c.lng]}
                    icon={i === selectedIndex && !manualPin ? blueIcon : grayIcon}
                    eventHandlers={{
                      click: () => {
                        setSelectedIndex(i);
                        setManualPin(null);
                        setManualPinAddress(null);
                      },
                    }}
                  />
                ))}
                {manualPin && (
                  <Marker
                    position={[manualPin.lat, manualPin.lng]}
                    icon={blueIcon}
                  />
                )}
                <MapClickHandler onClick={handleMapClick} />
                <Recenter center={mapCenter} />
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                {isLoading ? "Cargando mapa..." : "Selecciona una ubicación"}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
