"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, CheckCircle2, AlertTriangle, XCircle, Loader2, Camera } from "lucide-react";
import {
  GEO_THRESHOLD_METERS,
  validateGeoProximity,
  generateStaticMapUrl,
  type LatLng,
  type GeoValidationResult,
} from "@/lib/geo";

// Fix iconos de Leaflet en Next.js (CDN)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Marcador custom (celeste)
const blueIcon = L.divIcon({
  className: "geo-marker-blue",
  html: `<div style="background:#0095DA;width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const redIcon = L.divIcon({
  className: "geo-marker-red",
  html: `<div style="background:#ef4444;width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

// Componente para centrar el mapa cuando cambian los puntos
function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([center.lat, center.lng], 16);
  }, [center.lat, center.lng, map]);
  return null;
}

interface GeoCaptureProps {
  /** Coordenadas de la dirección del siniestro (para validación) */
  claimCoords?: LatLng | null;
  /** Dirección del siniestro (para mostrar) */
  claimAddress?: string;
  /** Tipo de inspección: onsite (inspector captura) o remote (usuario captura) */
  inspectionType: "onsite" | "remote";
  /** Coordenadas ya capturadas (si existen) */
  initialCoords?: LatLng | null;
  /** Distancia ya calculada (si existe) */
  initialDistance?: number | null;
  /** Estado inicial de la geo */
  initialStatus?: "pending" | "verified" | "out_of_range" | "failed";
  /** Callback cuando se captura la geolocalización */
  onCapture: (result: {
    coords: LatLng;
    distance: number;
    status: GeoValidationResult["status"];
    mapUrl: string;
  }) => void;
  /** Si la captura está deshabilitada (ej: inspección ya completada) */
  disabled?: boolean;
  /** Título del componente */
  title?: string;
}

export function GeoCapture({
  claimCoords,
  claimAddress,
  inspectionType,
  initialCoords,
  initialDistance,
  initialStatus = "pending",
  onCapture,
  disabled,
  title,
}: GeoCaptureProps) {
  const [captured, setCaptured] = React.useState<LatLng | null>(initialCoords || null);
  const [validation, setValidation] = React.useState<GeoValidationResult | null>(
    initialCoords && initialDistance != null
      ? { distance: initialDistance, status: initialStatus as GeoValidationResult["status"], threshold: GEO_THRESHOLD_METERS }
      : null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCapture = React.useCallback(() => {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCaptured(coords);

        // Validar contra la dirección del siniestro
        let result: GeoValidationResult = {
          distance: 0,
          status: "verified",
          threshold: GEO_THRESHOLD_METERS,
        };
        if (claimCoords) {
          result = validateGeoProximity(coords, claimCoords);
        }
        setValidation(result);

        // Generar URL del mapa estático
        const url = generateStaticMapUrl(coords.lat, coords.lng, {
          zoom: 16,
          width: 600,
          height: 400,
        });

        onCapture({
          coords,
          distance: result.distance,
          status: result.status,
          mapUrl: url,
        });
        setLoading(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Permiso de geolocalización denegado. Debes permitir el acceso a tu ubicación."
            : err.code === 2
              ? "No se pudo obtener tu ubicación. Verifica tu GPS o conexión."
              : err.code === 3
                ? "Tiempo de espera agotado al obtener ubicación."
                : "Error al obtener geolocalización.",
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [claimCoords, onCapture]);

  const statusConfig = {
    pending: { icon: MapPin, color: "text-muted-foreground", bg: "bg-muted/40", label: "Pendiente" },
    verified: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Verificada" },
    out_of_range: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-500/10", label: "Fuera de rango" },
    failed: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-500/10", label: "Fallida" },
  };

  const currentStatus = validation?.status || initialStatus;
  const sc = statusConfig[currentStatus];
  const StatusIcon = sc.icon;

  return (
    <div className="app-panel">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="app-section-title">
            {title || "Geolocalización del Lugar"}
          </h3>
        </div>
        {validation && (
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${sc.bg} ${sc.color}`}>
            <StatusIcon className="h-3 w-3" />
            {sc.label}
          </div>
        )}
      </div>

      {/* Info del tipo de captura */}
      <p className="text-[11px] text-muted-foreground mb-3">
        {inspectionType === "onsite"
          ? "El inspector debe capturar su ubicación en el lugar del siniestro."
          : "El asegurado debe capturar su ubicación para verificar que está en el lugar del siniestro."}
      </p>

      {/* Dirección del siniestro */}
      {claimAddress && (
        <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 mb-3">
          <span className="text-[10px] text-muted-foreground">Dirección declarada del siniestro:</span>
          <p className="text-[11px] font-medium mt-0.5">{claimAddress}</p>
          {claimCoords && (
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              {claimCoords.lat.toFixed(6)}, {claimCoords.lng.toFixed(6)}
            </p>
          )}
        </div>
      )}

      {/* Botón de captura */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={handleCapture}
        className="liquid-date-picker flex w-full items-center justify-center gap-2 mb-3"
        style={{ height: "36px" }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[11px]">Obteniendo ubicación...</span>
          </>
        ) : (
          <>
            <Navigation className="h-4 w-4" />
            <span className="text-[11px] font-medium">
              {captured ? "Volver a capturar ubicación" : "Capturar mi ubicación"}
            </span>
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 mb-3">
          <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Resultado de la validación */}
      {validation && captured && (
        <div className={`rounded-lg border px-3 py-2 mb-3 ${sc.bg} border-current/20`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${sc.color}`} />
              <span className={`text-[11px] font-medium ${sc.color}`}>{sc.label}</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {validation.distance} m
              {validation.status === "out_of_range" && (
                <span className="text-amber-600"> / {GEO_THRESHOLD_METERS} m máx</span>
              )}
            </span>
          </div>
          {validation.status === "out_of_range" && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              La ubicación capturada está a {validation.distance} m de la dirección declarada.
              Se permite continuar pero queda registrado para auditoría.
            </p>
          )}
          {validation.status === "verified" && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
              Ubicación verificada: a {validation.distance} m de la dirección declarada.
            </p>
          )}
        </div>
      )}

      {/* Mapa interactivo */}
      {captured && (
        <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm">
          <MapContainer
            center={[captured.lat, captured.lng]}
            zoom={16}
            style={{ height: "300px", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker position={[captured.lat, captured.lng]} icon={blueIcon}>
              <Popup>
                <div className="text-[11px]">
                  <strong>Ubicación capturada</strong>
                  <br />
                  {captured.lat.toFixed(6)}, {captured.lng.toFixed(6)}
                </div>
              </Popup>
            </Marker>
            {claimCoords && (
              <Marker position={[claimCoords.lat, claimCoords.lng]} icon={redIcon}>
                <Popup>
                  <div className="text-[11px]">
                    <strong>Dirección declarada</strong>
                    <br />
                    {claimAddress || "Siniestro"}
                  </div>
                </Popup>
              </Marker>
            )}
            <Recenter center={captured} />
          </MapContainer>
        </div>
      )}

      {/* Coordenadas capturadas */}
      {captured && (
        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <Camera className="h-3 w-3" />
          {captured.lat.toFixed(6)}, {captured.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
