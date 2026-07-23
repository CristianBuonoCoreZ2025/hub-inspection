"use client";

import React from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Camera,
  Loader2,
  Wifi,
  WifiOff,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import { joinSignalingChannel, ICE_SERVERS, type SignalingRole, type SignalingMessage } from "@/lib/webrtc/signaling";

interface LiveVideoCallProps {
  sessionId: string;
  userId: string;
  role: SignalingRole;
  displayName: string;
  onHangup: () => void;
  onScreenshotSaved?: (evidence: { id: string; url: string; description: string }) => void;
}

interface SavedEvidence {
  id: string;
  url: string;
  description: string;
}

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

export function LiveVideoCall({
  sessionId,
  userId,
  role,
  displayName,
  onHangup,
  onScreenshotSaved,
}: LiveVideoCallProps) {
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);
  const channelRef = React.useRef<ReturnType<typeof joinSignalingChannel> | null>(null);
  const politeRef = React.useRef<boolean>(role === "client"); // cliente es polite, inspector impolite
  const makingOfferRef = React.useRef<boolean>(false);
  const ignoreOfferRef = React.useRef<boolean>(false);
  const hangupSentRef = React.useRef<boolean>(false);

  const [state, setState] = React.useState<ConnectionState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [videoOn, setVideoOn] = React.useState(true);
  const [audioOn, setAudioOn] = React.useState(true);
  const [peerJoined, setPeerJoined] = React.useState(false);
  const [screenshotting, setScreenshotting] = React.useState(false);
  const [lastScreenshot, setLastScreenshot] = React.useState<SavedEvidence | null>(null);
  const [screenshotCount, setScreenshotCount] = React.useState(0);

  // ── Inicializar media local ──
  const initLocalMedia = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo acceder a la cámara/micrófono";
      setError(`Permiso de cámara/micrófono denegado: ${msg}`);
      throw err;
    }
  }, []);

  // ── Crear peer connection ──
  const createPeerConnection = React.useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Stream remoto
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && channelRef.current) {
        channelRef.current.send({ type: "ice", from: userId, role, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setState("connected");
      else if (s === "connecting") setState("connecting");
      else if (s === "disconnected") setState("disconnected");
      else if (s === "failed") {
        setState("failed");
        setError("Conexión fallida. Verifica tu conexión a internet.");
      } else if (s === "closed") setState("disconnected");
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    // Negotiation needed — perfect negotiation pattern
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        channelRef.current?.send({ type: "offer", from: userId, role, sdp: pc.localDescription! });
      } catch (err) {
        console.error("[LiveVideoCall] Error en negotiationneeded:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [userId, role]);

  // ── Manejar mensaje de signaling ──
  const handleSignalingMessage = React.useCallback(
    async (msg: SignalingMessage) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (msg.type === "ready") {
          setPeerJoined(true);
          // El inspector (impolite) inicia la oferta cuando el cliente se une
          if (role === "inspector" && localStreamRef.current) {
            // Forzar renegotiación agregando tracks si no están
            const senders = pc.getSenders();
            if (senders.length === 0) {
              localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
              });
            }
          }
        } else if (msg.type === "offer") {
          setPeerJoined(true);
          const offerCollision = makingOfferRef.current;
          ignoreOfferRef.current = !politeRef.current && offerCollision;
          if (ignoreOfferRef.current) return;

          await pc.setRemoteDescription(msg.sdp);
          // Asegurar que nuestros tracks estén agregados
          if (localStreamRef.current) {
            const senders = pc.getSenders();
            if (senders.length === 0) {
              localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
              });
            }
          }
          await pc.setLocalDescription();
          channelRef.current?.send({ type: "answer", from: userId, role, sdp: pc.localDescription! });
        } else if (msg.type === "answer") {
          await pc.setRemoteDescription(msg.sdp);
        } else if (msg.type === "ice") {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            if (!ignoreOfferRef.current) throw err;
          }
        } else if (msg.type === "hangup") {
          setPeerJoined(false);
          setState("disconnected");
          // Limpiar stream remoto
          if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach((t) => t.stop());
            remoteStreamRef.current = null;
          }
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        } else if (msg.type === "screenshot") {
          // El otro par capturó una foto — podemos mostrar notificación
          // (no es necesario hacer nada, las evidencias se cargan por separado)
        }
      } catch (err) {
        console.error("[LiveVideoCall] Error procesando signaling:", msg.type, err);
      }
    },
    [role, userId],
  );

  // ── Inicializar todo al montar ──
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setState("connecting");
        const stream = await initLocalMedia();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const pc = createPeerConnection();
        // Agregar tracks locales al peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Unirse al canal de signaling
        const channel = joinSignalingChannel(sessionId, userId, role);
        channelRef.current = channel;
        channel.onMessage(handleSignalingMessage);
      } catch {
        if (!cancelled) setState("failed");
      }
    })();

    return () => {
      cancelled = true;
      // Cleanup
      if (!hangupSentRef.current && channelRef.current) {
        channelRef.current.send({ type: "hangup", from: userId, role });
        hangupSentRef.current = true;
      }
      if (channelRef.current) {
        void channelRef.current.leave();
        channelRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => t.stop());
        remoteStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, role]);

  // ── Toggle video ──
  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoOn(videoTrack.enabled);
    }
  };

  // ── Toggle audio ──
  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioOn(audioTrack.enabled);
    }
  };

  // ── Colgar ──
  const handleHangup = () => {
    if (channelRef.current && !hangupSentRef.current) {
      channelRef.current.send({ type: "hangup", from: userId, role });
      hangupSentRef.current = true;
    }
    onHangup();
  };

  // ── Capturar screenshot del video remoto ──
  const captureScreenshot = async () => {
    const video = remoteVideoRef.current;
    if (!video || !video.videoWidth) {
      setError("No hay video remoto para capturar.");
      return;
    }
    setScreenshotting(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo crear contexto de canvas");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("No se pudo generar la imagen");

      const file = new File([blob], `screenshot-${Date.now()}.jpg`, { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionId);
      formData.append("source", role === "inspector" ? "screenshot_inspector" : "screenshot_client");
      formData.append("originalName", file.name);

      const res = await fetch("/api/inspection/evidences/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.evidence) {
        const ev: SavedEvidence = {
          id: data.evidence.id,
          url: data.evidence.url,
          description: data.evidence.description,
        };
        setLastScreenshot(ev);
        setScreenshotCount((c) => c + 1);
        onScreenshotSaved?.(ev);
        // Avisar al otro par
        channelRef.current?.send({
          type: "screenshot",
          from: userId,
          role,
          evidenceId: ev.id,
          url: ev.url,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al capturar foto");
    } finally {
      setScreenshotting(false);
    }
  };

  // ── Pantalla completa del video remoto ──
  const goFullscreen = () => {
    const video = remoteVideoRef.current;
    if (video && video.requestFullscreen) {
      void video.requestFullscreen();
    }
  };

  const stateLabel: Record<ConnectionState, string> = {
    idle: "Iniciando...",
    connecting: "Conectando...",
    connected: "Conectado",
    disconnected: "Desconectado",
    failed: "Fallido",
  };

  const stateColor: Record<ConnectionState, string> = {
    idle: "text-muted-foreground",
    connecting: "text-amber-600",
    connected: "text-emerald-600",
    disconnected: "text-muted-foreground",
    failed: "text-rose-600",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {state === "connected" ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : state === "failed" ? (
              <WifiOff className="h-4 w-4 text-rose-500" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            )}
            <span className={`text-sm font-medium ${stateColor[state]}`}>
              {stateLabel[state]}
            </span>
          </div>
          {!peerJoined && state !== "failed" && (
            <span className="text-xs text-white/60">
              Esperando a que el {role === "inspector" ? "cliente" : "inspector"} se conecte...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {screenshotCount > 0 && (
            <span className="text-xs text-white/60 flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {screenshotCount} {screenshotCount === 1 ? "foto" : "fotos"}
            </span>
          )}
          <span className="text-xs text-white/40 hidden sm:inline">
            {displayName} · {role === "inspector" ? "Inspector" : "Cliente"}
          </span>
        </div>
      </div>

      {/* Cuerpo: video remoto + local en PiP */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {/* Video remoto (grande) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
        {!peerJoined && state !== "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
            <Video className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">
              {state === "connecting" ? "Esperando al otro participante..." : "Listo para conectar"}
            </p>
          </div>
        )}
        {state === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
            <AlertTriangle className="h-12 w-12 mb-3 text-rose-500" />
            <p className="text-sm font-medium">No se pudo establecer la conexión</p>
            <p className="text-xs text-white/50 mt-1">{error}</p>
          </div>
        )}

        {/* Video local (PiP) */}
        <div className="absolute bottom-4 right-4 w-32 sm:w-48 h-24 sm:h-36 rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {!videoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <VideoOff className="h-6 w-6 text-white/60" />
            </div>
          )}
          <div className="absolute bottom-1 left-1 text-[9px] text-white/80 bg-black/60 rounded px-1 py-0.5">
            Tú
          </div>
        </div>

        {/* Botón fullscreen */}
        {peerJoined && (
          <button
            type="button"
            onClick={goFullscreen}
            className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 transition-colors"
            title="Pantalla completa"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Notificación de screenshot */}
      {lastScreenshot && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-emerald-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium">Foto capturada: {lastScreenshot.description}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 max-w-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {/* Controles inferiores */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 bg-black/40 border-t border-white/10">
        <button
          type="button"
          onClick={toggleAudio}
          className={`p-3 rounded-full transition-colors ${
            audioOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
          }`}
          title={audioOn ? "Silenciar micrófono" : "Activar micrófono"}
        >
          {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            videoOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
          }`}
          title={videoOn ? "Apagar cámara" : "Encender cámara"}
        >
          {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={captureScreenshot}
          disabled={!peerJoined || screenshotting}
          className="p-3 rounded-full bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Capturar foto del video en vivo"
        >
          {screenshotting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </button>

        <button
          type="button"
          onClick={handleHangup}
          className="p-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition-colors"
          title="Colgar"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>

      {/* Hint de captura */}
      {peerJoined && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/40 text-[10px] flex items-center gap-1 pointer-events-none">
          <ImageIcon className="h-3 w-3" />
          Toca la cámara para capturar fotos del video en vivo
        </div>
      )}
    </div>
  );
}
