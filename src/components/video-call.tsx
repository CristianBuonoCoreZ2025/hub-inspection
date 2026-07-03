"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, PhoneOff, Mic, MicOff } from "lucide-react";

interface VideoCallProps {
  /** ID único de la sesión de inspección (genera el room name) */
  sessionId: string;
  /** Nombre para mostrar en la videollamada */
  displayName: string;
  /** Modo compacto para panel lateral */
  compact?: boolean;
}

/**
 * Componente de videollamada usando Jitsi Meet público (meet.jit.si).
 * Sin costo, sin SDK, sin servidor propio.
 * Cada sesión tiene su room único: hub-inspection-{sessionId}
 */
export default function VideoCall({ sessionId, displayName, compact = false }: VideoCallProps) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    document.body.appendChild(script);
  }, [joined]);

  function handleJoin() {
    setJoined(true);

    // Esperar a que el script cargue
    const tryInit = () => {
      const JitsiMeetExternalAPI = (window as unknown as Record<string, unknown>).JitsiMeetExternalAPI;
      if (!JitsiMeetExternalAPI) {
        setTimeout(tryInit, 200);
        return;
      }

      const domain = "meet.jit.si";
      const options = {
        roomName,
        width: "100%",
        height: compact ? 280 : 480,
        parentNode: iframeRef.current,
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableInviteMore: true,
          disableJoinExitSounds: true,
          toolbarButtons: [
            "microphone", "camera", "closedcaptions", "desktop",
            "fullscreen", "fodeviceselection", "hangup", "profile",
            "chat", "settings", "raisehand", "videoquality",
            "filmstrip", "shortcuts", "tileview", "select-background",
          ],
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            "microphone", "camera", "desktop", "fullscreen",
            "fodeviceselection", "hangup", "profile", "settings",
            "raisehand", "videoquality", "filmstrip", "tileview",
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_POWERED_BY: false,
          DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
          MOBILE_APP_PROMO: false,
          DEFAULT_BACKGROUND: "#0a0a0a",
          INITIAL_TOOLBAR_TIMEOUT: 5000,
          TOOLBAR_TIMEOUT: 4000,
        },
        userInfo: {
          displayName,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = new (JitsiMeetExternalAPI as any)(domain, options);
      apiRef.current = api;

      api.addEventListener("audioMuteStatusChanged", (e: { muted: boolean }) => {
        setMuted(e.muted);
      });
      api.addEventListener("videoMuteStatusChanged", (e: { muted: boolean }) => {
        setVideoOff(e.muted);
      });
      api.addEventListener("participantLeft", () => {
        // Si el otro participante se va, no cerrar automáticamente
      });
    };

    setTimeout(tryInit, 300);
  }

  function handleHangup() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      api.dispose();
      apiRef.current = null;
    }
    setJoined(false);
    setMuted(false);
    setVideoOff(false);
  }

  function toggleMute() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      api.executeCommand("toggleAudio");
    }
  }

  function toggleVideo() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = apiRef.current as any;
    if (api) {
      api.executeCommand("toggleVideo");
    }
  }

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = apiRef.current as any;
      if (api) {
        api.dispose();
      }
    };
  }, []);

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

  return (
    <div className="flex flex-col gap-2">
      {/* Contenedor del iframe */}
      <div
        ref={iframeRef}
        className="w-full overflow-hidden rounded-lg border border-slate-700 bg-black"
        style={{ minHeight: compact ? 280 : 480 }}
      />

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
