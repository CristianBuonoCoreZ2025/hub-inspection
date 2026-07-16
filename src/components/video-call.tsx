"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Video, VideoOff, PhoneOff, Mic, MicOff, Loader2, AlertCircle } from "lucide-react";

interface VideoCallProps {
  /** ID único de la sesión de inspección (genera el room name) */
  sessionId: string;
  /** Nombre para mostrar en la videollamada */
  displayName: string;
  /** Modo compacto para panel lateral */
  compact?: boolean;
  /** Callback cuando se cuelga la llamada */
  onHangup?: () => void;
}

/**
 * Componente de videollamada usando Jitsi Meet público (meet.jit.si).
 * Sin costo, sin SDK, sin servidor propio.
 * Cada sesión tiene su room único: hub-inspection-{sessionId}
 */
export default function VideoCall({ sessionId, displayName, compact = false, onHangup }: VideoCallProps) {
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<unknown>(null);

  const roomName = `hub-inspection-${sessionId.slice(0, 12)}`;

  // Cargar el script de Jitsi Meet External API
  useEffect(() => {
    if (joined) return;
    const existing = document.querySelector('script[src*="jitsi/external_api"]');
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onerror = () => setError("No se pudo cargar el servicio de videollamada.");
    document.body.appendChild(script);
  }, [joined]);

  const disposeApi = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      try {
        api.dispose();
      } catch {
        // ignore dispose errors
      }
      apiRef.current = null;
    }
    // Limpiar el contenedor del iframe
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, []);

  const handleJoin = useCallback(() => {
    setError(null);
    setLoading(true);
    setJoined(true);

    const tryInit = () => {
      const JitsiMeetExternalAPI = (window as unknown as Record<string, unknown>).JitsiMeetExternalAPI;
      if (!JitsiMeetExternalAPI) {
        // Timeout después de 10s
        setTimeout(tryInit, 200);
        return;
      }

      if (!containerRef.current) {
        setTimeout(tryInit, 100);
        return;
      }

      const domain = "meet.jit.si";
      const options = {
        roomName,
        width: "100%",
        height: compact ? 280 : 480,
        parentNode: containerRef.current,
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableInviteMore: true,
          disableJoinExitSounds: true,
          hideConferenceSubject: true,
          hideConferenceTimer: true,
          hideParticipantsStats: true,
          // Ocultar elementos promocionales
          toolbarButtons: [
            "microphone", "camera", "desktop", "fullscreen",
            "fodeviceselection", "hangup", "settings",
            "raisehand", "videoquality", "filmstrip", "tileview",
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
          MOBILE_APP_PROMO: false,
          DEFAULT_BACKGROUND: "#0a0a0a",
          INITIAL_TOOLBAR_TIMEOUT: 5000,
          TOOLBAR_TIMEOUT: 4000,
          // Ocultar banners y anuncios
          SHOW_BRAND_WATERMARK: false,
          JITSI_WATERMARK_LINK: "",
          BRAND_WATERMARK_LINK: "",
          // Ocultar página de cierre promocional
          HIDE_INVITE_MORE_HEADER: true,
        },
        userInfo: {
          displayName,
        },
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = new (JitsiMeetExternalAPI as any)(domain, options);
        apiRef.current = api;
        setLoading(false);

        api.addEventListener("audioMuteStatusChanged", (e: { muted: boolean }) => {
          setMuted(e.muted);
        });
        api.addEventListener("videoMuteStatusChanged", (e: { muted: boolean }) => {
          setVideoOff(e.muted);
        });
        api.addEventListener("participantLeft", () => {
          // Si el otro participante se va, no cerrar automáticamente
        });
        api.addEventListener("readyToClose", () => {
          disposeApi();
          setJoined(false);
          setMuted(false);
          setVideoOff(false);
          onHangup?.();
        });
      } catch {
        setError("Error al iniciar la videollamada.");
        setLoading(false);
        setJoined(false);
      }
    };

    setTimeout(tryInit, 300);
  }, [roomName, compact, displayName, onHangup, disposeApi]);

  const handleHangup = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      try {
        api.executeCommand("hangup");
      } catch {
        // ignore
      }
    }
    disposeApi();
    setJoined(false);
    setMuted(false);
    setVideoOff(false);
    setLoading(false);
    onHangup?.();
  }, [disposeApi, onHangup]);

  const toggleMute = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      api.executeCommand("toggleAudio");
    }
  }, []);

  const toggleVideo = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      api.executeCommand("toggleVideo");
    }
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      disposeApi();
    };
  }, [disposeApi]);

  // Estado: no joined — pantalla inicial
  if (!joined) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${compact ? "py-4" : "py-8"}`}>
        <div className={`flex items-center justify-center rounded-full bg-sky-500/10 ${compact ? "h-10 w-10" : "h-14 w-14"}`}>
          <Video className={`${compact ? "h-5 w-5" : "h-7 w-7"} text-sky-400`} />
        </div>
        <div className="text-center">
          <p className={`font-medium ${compact ? "text-[12px]" : "text-sm"}`}>Videollamada</p>
          <p className={`text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>
            Conéctese con {compact ? "el cliente" : "el inspector"}
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/30 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={handleJoin}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-white text-[13px] font-medium hover:bg-sky-500 transition-colors"
        >
          <Video className="h-4 w-4" />
          Iniciar
        </button>
      </div>
    );
  }

  // Estado: joined — videollamada activa
  return (
    <div className="flex flex-col gap-2">
      {/* Contenedor del iframe */}
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-lg border border-slate-700 bg-black relative"
        style={{ minHeight: compact ? 280 : 480 }}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black z-10">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
            <p className="text-[11px] text-slate-400">Conectando...</p>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={toggleMute}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            muted ? "bg-rose-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
          }`}
          title={muted ? "Activar micrófono" : "Silenciar micrófono"}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          onClick={toggleVideo}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            videoOff ? "bg-rose-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
          }`}
          title={videoOff ? "Activar cámara" : "Apagar cámara"}
        >
          {videoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </button>
        <button
          onClick={handleHangup}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-500 transition-colors"
          title="Colgar"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
