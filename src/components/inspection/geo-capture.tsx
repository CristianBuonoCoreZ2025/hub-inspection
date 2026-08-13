"use client";

import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, MapPinned, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
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
  /** Si true, oculta mensajes de "fuera de rango" al usuario (solo muestra "Ubicación capturada") */
  hideOutOfRange?: boolean;
  /** Si true, no sube evidencia geo_map automáticamente (el inspector la crea desde el dashboard) */
  skipEvidenceUpload?: boolean;
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
  hideOutOfRange = false,
  skipEvidenceUpload = false,
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

  const { data: mapProviders } = useQuery({
    queryKey: ["map-providers"],
    queryFn: async () => {
      const res = await fetch("/api/settings/map-providers");
      const data = await res.json();
      return data as { providers: ("carto" | "mapbox")[]; tokens: Record<string, string | null> };
    },
    staleTime: 5 * 60 * 1000,
  });
  const primary = mapProviders?.providers[0] || "carto";
  const secondary = mapProviders?.providers[1] || "none";
  const mapboxToken = mapProviders?.tokens?.mapbox || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failedPrimary, setFailedPrimary] = React.useState(false);
  const tileErrorRef = React.useRef(0);
  const activeProvider: "carto" | "mapbox" = failedPrimary && secondary !== "none" ? secondary : primary;

  const getTileUrl = React.useCallback(
    (provider: "carto" | "mapbox") => {
      if (provider === "mapbox" && mapboxToken) {
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
      }
      // CartoDB: datos de OSM con CORS headers y sin rate limits estrictos.
      return "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    },
    [mapboxToken],
  );

  // Función custom para construir la URL del tile.
  // CartoDB tiene CORS headers, no necesita proxy.
  const buildTileUrl = React.useCallback(
    (data: { x: number; y: number; z: number }) => {
      const subdomains = ["a", "b", "c"];
      const s = subdomains[Math.abs(data.x + data.y) % subdomains.length];
      return `https://${s}.basemaps.cartocdn.com/light_all/${data.z}/${data.x}/${data.y}.png`;
    },
    [],
  );

  const getAttribution = React.useCallback(
    (provider: "carto" | "mapbox") => {
      if (provider === "mapbox" && mapboxToken) {
        return '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
      }
      return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    },
    [mapboxToken],
  );

  const [captured, setCaptured] = React.useState<LatLng | null>(initialCoords || null);
  const [validation, setValidation] = React.useState<GeoValidationResult | null>(
    initialCoords && initialDistance != null
      ? { distance: initialDistance, status: initialStatus as GeoValidationResult["status"], threshold }
      : null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Para inspecciones remotas: bloquear el boton inmediatamente despues de capturar
  // hasta que el inspector habilite una nueva recaptura
  const [locallyCaptured, setLocallyCaptured] = React.useState(false);
  const autoCaptureRef = React.useRef(false);
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Sincronizar con coordenadas iniciales cuando cambian (recaptura habilitada desde dashboard)
  React.useEffect(() => {
    if (!initialCoords) {
      // Inspector habilito recaptura y limpio los campos geo_*
      // Resetear estado local para que el asegurado pueda capturar de nuevo
      setCaptured(null);
      setValidation(null);
      setLocallyCaptured(false);
      setError(null);
      return;
    }
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

  // Capturar el mapa de Leaflet como imagen usando html2canvas-pro
  // Esto genera una imagen real del mapa que ve el inspector, sin depender
  // de servicios externos de mapas estáticos.
  const captureMapAsBlob = React.useCallback(async (): Promise<Blob | null> => {
    if (!mapContainerRef.current) return null;
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      // Esperar a que los tiles del mapa terminen de cargar
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 2,
        imageTimeout: 15000,
      });
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png", 0.9);
      });
      return blob;
    } catch (err) {
      console.error("[geo-capture] Error capturando mapa:", err);
      return null;
    }
  }, []);

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
            // Bloquear el boton inmediatamente (inspeccion remota)
            // hasta que el inspector habilite una nueva recaptura
            if (inspectionType === "remote") {
              setLocallyCaptured(true);
            }

            // Subir el mapa como evidencia (source: geo_map)
            // Solo si skipEvidenceUpload es false (inspecciones onsite o cuando el inspector lo decide)
            let mapUrl = "";
            if (sessionId && !skipEvidenceUpload) {
              try {
                // Si replaceEvidence, borrar evidencias geo_map anteriores
                if (replaceEvidence && sessionToken) {
                  await fetch("/api/inspection/geo/reset-geo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: sessionToken }),
                  }).catch(() => {});
                }

                // Esperar a que el mapa de Leaflet se renderice
                await new Promise((resolve) => setTimeout(resolve, 3000));

                const mapboxToken = mapProviders?.tokens?.mapbox || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

                if (mapboxToken) {
                  mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+f74e4e(${coords.lng},${coords.lat})/${coords.lng},${coords.lat},16,0/600x400?access_token=${mapboxToken}`;

                  await fetch("/api/inspection/geo/save-map", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sessionId,
                      lat: coords.lat,
                      lng: coords.lng,
                      mapUrl,
                      capturedBy,
                      label: inspectionType === "onsite" ? "inspector" : "asegurado",
                    }),
                  });
                } else {
                  const mapBlob = await captureMapAsBlob();

                  if (mapBlob) {
                    const formData = new FormData();
                    formData.append("file", new File([mapBlob], `geo_map_${Date.now()}.png`, { type: "image/png" }));
                    formData.append("sessionId", sessionId);
                    formData.append("lat", String(coords.lat));
                    formData.append("lng", String(coords.lng));
                    formData.append("source", "geo_map");
                    formData.append("label", inspectionType === "onsite" ? "inspector" : "asegurado");
                    if (capturedBy) formData.append("capturedBy", capturedBy);

                    await fetch("/api/inspection/evidences/upload", {
                      method: "POST",
                      body: formData,
                    });
                  } else {
                    mapUrl = generateStaticMapUrl(coords.lat, coords.lng, {
                      zoom: 16,
                      width: 600,
                      height: 400,
                    });

                    await fetch("/api/inspection/geo/save-map", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId,
                        lat: coords.lat,
                        lng: coords.lng,
                        mapUrl,
                        capturedBy,
                        label: inspectionType === "onsite" ? "inspector" : "asegurado",
                      }),
                    });
                  }
                }
              } catch (mapErr) {
                console.error("[geo-capture] Error subiendo mapa como evidencia:", mapErr);
              }
            }

            onCapture({
              coords,
              distance: result.distance,
              status: result.status,
              mapUrl,
            });
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
  }, [claimCoords, onCapture, threshold, sessionId, sessionToken, replaceEvidence, capturedBy, inspectionType, captureMapAsBlob, skipEvidenceUpload, mapProviders]);

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
    verified: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Ubicación capturada" },
    out_of_range: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-500/10", label: "Fuera de rango" },
    failed: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-500/10", label: "Fallida" },
  };

  const currentStatus = validation?.status || initialStatus;
  // Si hideOutOfRange, mostramos "Ubicación capturada" para cualquier estado exitoso
  const displayStatus = hideOutOfRange && (currentStatus === "verified" || currentStatus === "out_of_range") ? "verified" : currentStatus;
  const sc = statusConfig[displayStatus];
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
          {claimCoords ? (
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
              {claimCoords.lat.toFixed(6)}, {claimCoords.lng.toFixed(6)}
            </p>
          ) : (
            <p className="text-[10px] text-amber-600 mt-0.5">Sin coordenadas del siniestro</p>
          )}
        </div>
      )}

      {/* Botón de captura — para inspecciones remotas Y presenciales.
          En presenciales, la captura es automática al montar el componente,
          pero se permite recapturar manualmente si el inspector lo necesita. */}
      {(inspectionType === "remote" || (inspectionType === "onsite" && captured)) && (
        <>
          <button
            type="button"
            disabled={disabled || loading || locallyCaptured}
            onClick={handleCapture}
            className="liquid-date-picker flex w-full items-center justify-center gap-2 mb-3 h-9"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[11px]">Obteniendo ubicación...</span>
              </>
            ) : (
              <>
                <MapPinned className="h-4 w-4" />
                <span className="text-[11px] font-medium">
                  {captured && (disabled || locallyCaptured)
                    ? "Ubicación ya registrada"
                    : captured
                      ? "Recapturar ubicación"
                      : "Establecer mi ubicación"}
                </span>
              </>
            )}
          </button>
          {captured && (disabled || locallyCaptured) && (
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

      {/* Confirmación de captura exitosa (presencial) */}
      {inspectionType === "onsite" && captured && !loading && (
        <div className="flex items-center gap-2 mb-3 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Ubicación capturada y mapa guardado como evidencia
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
            {!hideOutOfRange && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {validation.distance} m
                {validation.status === "out_of_range" && (
                  <span className="text-amber-600"> / {GEO_THRESHOLD_METERS} m máx</span>
                )}
              </span>
            )}
          </div>
          {!hideOutOfRange && validation.status === "out_of_range" && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              La ubicación capturada está a {validation.distance} m de la dirección declarada.
              Se permite continuar pero queda registrado para auditoría.
            </p>
          )}
          {!hideOutOfRange && validation.status === "verified" && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
              Ubicación verificada: a {validation.distance} m de la dirección declarada.
            </p>
          )}
          {hideOutOfRange && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
              Tu ubicación ha sido registrada correctamente.
            </p>
          )}
        </div>
      )}

      {/* Mapa interactivo */}
      {captured && (
        <div ref={mapContainerRef} className="rounded-xl overflow-hidden border border-border/40 shadow-sm">
          <MapContainer
            center={[captured.lat, captured.lng]}
            zoom={16}
            className="geo-map-container w-full"
            scrollWheelZoom={false}
          >
            <TileLayer
              url={getTileUrl(activeProvider)}
              attribution={getAttribution(activeProvider)}
              crossOrigin={true}
              eventHandlers={{
                tileerror: () => {
                  if (activeProvider !== primary || secondary === "none" || failedPrimary) return;
                  tileErrorRef.current += 1;
                  if (tileErrorRef.current > 4) {
                    setFailedPrimary(true);
                  }
                },
              }}
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


    </div>
  );
}
