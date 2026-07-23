"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, CheckCircle2, AlertTriangle, XCircle, Loader2, ImageIcon } from "lucide-react";
import {
  GEO_THRESHOLD_METERS,
  validateGeoProximity,
  generateStaticMapUrl,
  type LatLng,
  type GeoValidationResult,
} from "@/lib/geo";
import { useQuery } from "@tanstack/react-query";

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
  /** ID de la sesión (para guardar mapa como evidencia) */
  sessionId?: string;
  /** Token del magic link (para resetear evidencias al recapturar) */
  sessionToken?: string;
  /** Si debe reemplazar (borrar) evidencias geo_map anteriores antes de guardar nuevas */
  replaceEvidence?: boolean;
  /** ID del usuario que captura (para metadata de evidencia) */
  capturedBy?: string;
}

interface SavedEvidence {
  id: string;
  url: string;
  description: string;
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
  sessionId,
  sessionToken,
  replaceEvidence,
  capturedBy,
}: GeoCaptureProps) {
  const { data: threshold = GEO_THRESHOLD_METERS } = useQuery({
    queryKey: ["geo-threshold"],
    queryFn: async () => {
      const res = await fetch("/api/settings/geo-threshold");
      const data = await res.json();
      return typeof data.threshold === "number" ? data.threshold : GEO_THRESHOLD_METERS;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [captured, setCaptured] = React.useState<LatLng | null>(initialCoords || null);
  const [validation, setValidation] = React.useState<GeoValidationResult | null>(
    initialCoords && initialDistance != null
      ? { distance: initialDistance, status: initialStatus as GeoValidationResult["status"], threshold }
      : null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savingMap, setSavingMap] = React.useState(false);
  const [mapEvidence, setMapEvidence] = React.useState<SavedEvidence | null>(null);
  const [declaredMapEvidence, setDeclaredMapEvidence] = React.useState<SavedEvidence | null>(null);
  const lastCapturedRef = React.useRef<{ coords: LatLng; mapUrl: string } | null>(null);
  const autoCaptureRef = React.useRef(false);

  // Sincronizar con coordenadas iniciales cuando cambian (recaptura habilitada desde dashboard)
  React.useEffect(() => {
    if (!initialCoords) return;
    const id = setTimeout(() => {
      setCaptured(initialCoords);
      if (initialDistance != null) {
        setValidation({
          distance: initialDistance,
          status: initialStatus as GeoValidationResult["status"],
          threshold,
        });
      }
    }, 0);
    return () => clearTimeout(id);
  }, [initialCoords, initialDistance, initialStatus, threshold]);

  // Guardar el mapa estático como evidencia
  const saveMapAsEvidence = React.useCallback(
    async (sid: string, coords: LatLng, mapUrl: string, by?: string, label?: string) => {
      setSavingMap(true);
      try {
        const res = await fetch("/api/inspection/geo/save-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            lat: coords.lat,
            lng: coords.lng,
            mapUrl,
            capturedBy: by,
            label,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg =
            err.error && err.detail && err.detail !== err.error
              ? `${err.error}: ${err.detail}`
              : err.detail || err.error || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        const data = await res.json();
        if (data.evidence) {
          return {
            id: data.evidence.id,
            url: data.evidence.url,
            description: data.evidence.description,
          } as SavedEvidence;
        }
        throw new Error("La API no devolvió evidencia");
      } finally {
        setSavingMap(false);
      }
    },
    [],
  );

  const handleCapture = React.useCallback(() => {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        (async () => {
          try {
            const coords: LatLng = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };

            // Validar contra la dirección del siniestro con el umbral configurable
            let result: GeoValidationResult = {
              distance: 0,
              status: "verified",
              threshold,
            };
            if (claimCoords) {
              result = validateGeoProximity(coords, claimCoords, threshold);
            }

            // Mostrar inmediatamente la ubicación capturada en el mapa
            setCaptured(coords);
            setValidation(result);

            // Generar URL del mapa estático de la ubicación capturada
            const capturedMapUrl = generateStaticMapUrl(coords.lat, coords.lng, {
              zoom: 16,
              width: 600,
              height: 400,
            });

            // Notificar al padre inmediatamente para guardar lat/long/status
            // La evidencia del mapa se intenta después, pero nunca bloquea la captura
            lastCapturedRef.current = { coords, mapUrl: capturedMapUrl };
            onCapture({
              coords,
              distance: result.distance,
              status: result.status,
              mapUrl: capturedMapUrl,
            });

            // Guardar mapa(s) como evidencia automáticamente (segundo plano)
            if (sessionId) {
              try {
                if (replaceEvidence && sessionToken) {
                  await fetch("/api/inspection/geo/reset-geo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: sessionToken }),
                  });
                }
                const ev = await saveMapAsEvidence(sessionId, coords, capturedMapUrl, capturedBy, "captured");
                if (ev) setMapEvidence(ev);

                // Si está fuera de rango Y tenemos coords del siniestro, guardar
                // también el mapa de la dirección declarada (evidencia de discrepancia)
                if (result.status === "out_of_range" && claimCoords) {
                  const declaredMapUrl = generateStaticMapUrl(claimCoords.lat, claimCoords.lng, {
                    zoom: 16,
                    width: 600,
                    height: 400,
                  });
                  const dev = await saveMapAsEvidence(sessionId, claimCoords, declaredMapUrl, capturedBy, "declared");
                  if (dev) setDeclaredMapEvidence(dev);
                }
              } catch (evErr) {
                console.warn("[GeoCapture] No se pudo guardar evidencia del mapa:", evErr);
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Error al guardar la ubicación";
            setError(message);
          } finally {
            setLoading(false);
          }
        })();
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
  }, [claimCoords, onCapture, sessionId, sessionToken, replaceEvidence, capturedBy, saveMapAsEvidence, threshold]);

  // ── Auto-captura para inspecciones presenciales ──
  // El inspector no necesita presionar ningún botón: al montar el componente
  // (que ocurre al iniciar la inspección), se captura la ubicación automáticamente.
  React.useEffect(() => {
    if (autoCaptureRef.current) return;
    if (inspectionType !== "onsite") return;
    if (disabled) return;
    if (initialCoords) return; // ya fue capturada antes
    autoCaptureRef.current = true;
    // Diferir al siguiente tick para evitar setState sincrónico dentro del effect
    // (React Compiler: "Calling setState synchronously within an effect can trigger cascading renders")
    const id = setTimeout(() => handleCapture(), 0);
    return () => clearTimeout(id);
  }, [inspectionType, disabled, initialCoords, handleCapture, threshold]);

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
          ? "La ubicación se captura automáticamente al iniciar la inspección."
          : "El asegurado debe compartir su ubicación para verificar que está en el lugar del siniestro."}
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

      {/* Botón de captura — SOLO para inspecciones remotas.
          En presenciales, la captura es automática al montar el componente. */}
      {inspectionType === "remote" && (
        <>
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
                  {captured && disabled
                    ? "Ubicación ya registrada"
                    : captured
                      ? "Volver a establecer mi ubicación"
                      : "Establecer mi ubicación"}
                </span>
              </>
            )}
          </button>
          {captured && disabled && (
            <p className="mb-3 text-[10px] text-amber-600 dark:text-amber-400">
              Ya se registró tu ubicación. El liquidador debe habilitar una nueva captura.
            </p>
          )}
        </>
      )}

      {/* Indicador de captura automática en curso (presencial) */}
      {inspectionType === "onsite" && loading && (
        <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Capturando ubicación automáticamente...
        </div>
      )}

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
              url={
                process.env.NEXT_PUBLIC_MAP_PROVIDER === "mapbox" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN
                  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
                  : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              }
              attribution={
                process.env.NEXT_PUBLIC_MAP_PROVIDER === "mapbox" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN
                  ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              }
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
          <MapPin className="h-3 w-3" />
          {captured.lat.toFixed(6)}, {captured.lng.toFixed(6)}
        </div>
      )}

      {/* Estado del guardado del mapa como evidencia */}
      {captured && sessionId && (
        <div className="mt-2 flex items-center gap-2 text-[10px]">
          {savingMap ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-muted-foreground">
                Guardando {validation?.status === "out_of_range" && claimCoords ? "mapas" : "mapa"} como evidencia...
              </span>
            </>
          ) : mapEvidence ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-600">
                {declaredMapEvidence ? "Mapas guardados" : "Mapa guardado"}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">El mapa se guardará automáticamente como evidencia.</span>
          )}
        </div>
      )}

      {/* Miniaturas de mapas guardados como evidencia */}
      {(mapEvidence || declaredMapEvidence) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {mapEvidence && (
            <a
              href={mapEvidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dinámica de R2 */}
              <img
                src={mapEvidence.url}
                alt="Mapa de ubicación capturada"
                className="w-full h-24 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-1">
                <span className="text-[9px] text-white bg-black/60 rounded px-1 py-0.5 flex items-center gap-1">
                  <ImageIcon className="h-2.5 w-2.5" /> {declaredMapEvidence ? "Capturada" : "Mapa"}
                </span>
              </div>
            </a>
          )}
          {declaredMapEvidence && (
            <a
              href={declaredMapEvidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dinámica de R2 */}
              <img
                src={declaredMapEvidence.url}
                alt="Mapa de dirección declarada"
                className="w-full h-24 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-1">
                <span className="text-[9px] text-white bg-black/60 rounded px-1 py-0.5 flex items-center gap-1">
                  <ImageIcon className="h-2.5 w-2.5" /> Declarada
                </span>
              </div>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
