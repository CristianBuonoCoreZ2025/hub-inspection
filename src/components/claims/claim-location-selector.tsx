"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { geocodeAddressCandidates, type GeocodeCandidate } from "@/lib/geo";

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

interface ClaimLocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  commune?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
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
  onSelect,
}: ClaimLocationSelectorProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Reset selected index cuando se abre con una nueva dirección
  // Se difiere con setTimeout para evitar setState sincrónico dentro del effect.
  React.useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setSelectedIndex(0), 0);
    return () => clearTimeout(id);
  }, [open, address, commune, city, region, country]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["geocode-candidates", address, commune, city, region, country],
    queryFn: () => geocodeAddressCandidates(address, { commune, city, region, country }),
    enabled: open && !!address?.trim() && !!city?.trim(),
    staleTime: 0,
  });

  const hasError = !isLoading && candidates.length === 0 && open && !!address && !!city;
  const selected = candidates[selectedIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="app-section-title">Seleccionar ubicación exacta</DialogTitle>
          <DialogDescription className="modal-subtitle">
            {isLoading
              ? "Buscando ubicaciones..."
              : `Se encontraron ${candidates.length} posibles ubicaciones. Elige la más cercana al siniestro.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 h-[500px]">
          {/* Lista de candidatos */}
          <div className="flex flex-col border-r border-border">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando ubicaciones...
                </div>
              )}
              {hasError && (
                <div className="flex items-start gap-2 text-[11px] text-rose-600 py-8">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No se encontraron ubicaciones con esa dirección y contexto.
                </div>
              )}
              {!isLoading && candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full text-left rounded-lg border p-3 text-[11px] transition-colors ${
                    i === selectedIndex
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
                    {i === selectedIndex && (
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
                disabled={!selected}
                onClick={() => {
                  if (selected) {
                    onSelect(selected);
                    onOpenChange(false);
                  }
                }}
              >
                Confirmar ubicación
              </Button>
            </div>
          </div>

          {/* Mapa */}
          <div className="relative h-full min-h-[300px] md:min-h-0">
            {selected ? (
              <MapContainer
                center={[selected.lat, selected.lng]}
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {candidates.map((c, i) => (
                  <Marker
                    key={i}
                    position={[c.lat, c.lng]}
                    icon={i === selectedIndex ? blueIcon : grayIcon}
                    eventHandlers={{
                      click: () => setSelectedIndex(i),
                    }}
                  />
                ))}
                <Recenter center={selected} />
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
