"use client";

import React from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Camera,
  SwitchCamera,
  Repeat,
  Loader2,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Circle,
  Square,
  UserCheck,
} from "lucide-react";
import { joinSignalingChannel, fetchIceServers, hasTurnServer, type SignalingRole, type SignalingMessage } from "@/lib/webrtc/signaling";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface LiveVideoCallProps {
  sessionId: string;
  userId: string;
  role: SignalingRole;
  compact?: boolean;
  minimized?: boolean;
  onHangup: () => void;
  onScreenshotSaved?: (evidence?: { id: string; url: string; description: string }) => void;
  onPeerJoined?: () => void;
  onPeerRejected?: () => void;
  onRecordingSaved?: (evidence: { id: string; url: string; description: string }) => void;
  onKicked?: (reason: string) => void;
  onPeersUpdate?: (peers: ConnectedPeer[]) => void;
  onMediaPermission?: (result: { camera: "granted" | "denied" | "error"; microphone: "granted" | "denied" | "error" }) => void;
  /** Logear eventos de WebRTC para trazabilidad (peer_join, peer_leave, ice_restart, etc.) */
  onWebrtcEvent?: (eventType: string, details?: Record<string, unknown>) => void;
}

interface SavedEvidence {
  id: string;
  url: string;
  description: string;
}

export interface ConnectedPeer {
  userId: string;
  role: SignalingRole;
}

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed" | "rejected";

/**
 * Estados independientes para diagnóstico preciso.
 * El estado visible (ConnectionState) se deriva de estos.
 */
type SignalingHealth = "connecting" | "online" | "offline";
type PeerHealth = "new" | "connecting" | "connected" | "disconnected" | "failed";
type MediaHealth = "absent" | "flowing" | "stalled";
type RecoveryState = "idle" | "restarting-ice" | "rebuilding";

interface CallHealth {
  signaling: SignalingHealth;
  peer: PeerHealth;
  media: MediaHealth;
  recovery: RecoveryState;
}

/**
 * Deriva el estado visible a partir de los estados independientes.
 * Prioriza: si la media está fluyendo, la llamada está conectada
 * aunque el signaling esté caído.
 */
function deriveCallState(health: CallHealth, hasRemoteFrame: boolean): ConnectionState {
  // Rechazo explícito tiene prioridad
  // (se maneja por separado via setState directo)
  if (health.peer === "failed" && !hasRemoteFrame) return "failed";
  if (health.media === "flowing" || hasRemoteFrame) return "connected";
  if (health.peer === "connected") return "connected";
  if (health.peer === "connecting" || health.recovery !== "idle") return "connecting";
  if (health.peer === "disconnected" && !hasRemoteFrame) return "disconnected";
  if (health.signaling === "connecting") return "connecting";
  return "connecting";
}

/**
 * Captura un thumbnail JPEG base64 de un elemento <video>.
 * Retorna string vacío si el video no tiene frames disponibles.
 */
function captureVideoThumb(video: HTMLVideoElement | null, w: number, h: number): string {
  if (!video || !video.videoWidth) return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, w, h);
    // P2: Calidad 0.4 (era 0.5) — menos tamano base64 para previews de supervisor
    return canvas.toDataURL("image/jpeg", 0.4);
  } catch {
    return "";
  }
}

/** Devuelve un mensaje útil según el error de getUserMedia y el dispositivo. */
function getMediaErrorMessage(err: unknown): string {
  const domErr = err instanceof DOMException ? err : null;
  const raw = err instanceof Error ? err.message : "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (domErr?.name === "NotAllowedError" || domErr?.name === "SecurityError" || raw.toLowerCase().includes("permission")) {
    if (isIOS) return "Permiso denegado. Toca el icono de cámara/micrófono en la barra de direcciones de Safari o ve a Ajustes > Safari > Cámara y Micrófono > Permitir.";
    if (isAndroid) return "Permiso denegado. En Android: Configuración del navegador > Permisos > Cámara y micrófono > Permitir.";
    return "Permiso denegado. Habilite cámara y micrófono en la barra de direcciones o configuración del navegador.";
  }
  if (domErr?.name === "NotFoundError") return "No se encontró cámara o micrófono. Conecte uno o use subir fotos.";
  if (domErr?.name === "NotReadableError" || raw.toLowerCase().includes("could not start")) {
    return "La cámara o el micrófono están en uso por otra app. Cierre otras pestañas/programas y vuelva a intentar.";
  }
  if (domErr?.name === "OverconstrainedError") return "La cámara no soporta la resolución solicitada. Se intentará con configuración simplificada.";
  if (domErr?.name === "AbortError") return "La captura fue interrumpida. Intente nuevamente.";
  return raw || "No se pudo acceder a la cámara/micrófono.";
}

// Limite de tamano de mensajes de signaling para prevenir abuso (P0-4)
const MAX_SIGNALING_PAYLOAD_BYTES = 64 * 1024; // 64KB max por mensaje

export function LiveVideoCall({
  sessionId,
  userId,
  role,
  compact: compactProp = false,
  minimized: minimizedProp = false,
  onHangup,
  onScreenshotSaved,
  onPeerJoined,
  onPeerRejected,
  onRecordingSaved,
  onKicked,
  onPeersUpdate,
  onMediaPermission,
  onWebrtcEvent,
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
  // Buffer de ICE candidates que llegan antes de la remote description
  const iceCandidateBufferRef = React.useRef<RTCIceCandidateInit[]>([]);
  // El inspector trackea al cliente que ya está conectado para rechazar a un segundo
  const connectedClientRef = React.useRef<string | null>(null);
  // Peers ya rechazados (para no notificar al inspector más de una vez por el mismo peer)
  const rejectedPeersRef = React.useRef<Set<string>>(new Set());

  const [state, setState] = React.useState<ConnectionState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [rejectedReason, setRejectedReason] = React.useState<string | null>(null);
  const [videoOn, setVideoOn] = React.useState(true);
  const [audioOn, setAudioOn] = React.useState(true);
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("user");
  const facingModeRef = React.useRef<"user" | "environment">("user");
  const [peerJoined, setPeerJoined] = React.useState(false);
  // Refs para acceder al estado actual dentro del intervalo de preview sin reiniciarlo
  const videoOnRef = React.useRef(true);
  const audioOnRef = React.useRef(true);
  const peerJoinedRef = React.useRef(false);
  React.useEffect(() => { videoOnRef.current = videoOn; }, [videoOn]);
  React.useEffect(() => { audioOnRef.current = audioOn; }, [audioOn]);
  React.useEffect(() => { peerJoinedRef.current = peerJoined; }, [peerJoined]);
  const [screenshotting, setScreenshotting] = React.useState(false);
  const [lastScreenshot, setLastScreenshot] = React.useState<SavedEvidence | null>(null);
  const [screenshotCount, setScreenshotCount] = React.useState(0);
  const [recording, setRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [hasLocalMedia, setHasLocalMedia] = React.useState(false);
  const [peers, setPeers] = React.useState<ConnectedPeer[]>([]);
  const [connectedClientId, setConnectedClientId] = React.useState<string | null>(null);
  // P1 Safari: el navegador puede bloquear autoplay del video remoto con audio
  const [needsPlaybackGesture, setNeedsPlaybackGesture] = React.useState(false);
  const peerJoinedNotifiedRef = React.useRef(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Backoff para ICE restart: contador de restarts consecutivos y timer
  const iceRestartCountRef = React.useRef<number>(0);
  const iceRestartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── P1: Reconstrucción automática con generaciones ──
  // connectionGeneration identifica cada reconstrucción completa del peer.
  // El inspector es el coordinador: solo el inicia la reconstruccion.
  const connectionGenerationRef = React.useRef<number>(0);
  const rebuildTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_REBUILD_ATTEMPTS = 2;
  const REBUILD_BUDGET_MS = 90_000; // 90s de presupuesto total para reconstrucciones
  const rebuildStartedAtRef = React.useRef<number>(0);
  const rebuildCountRef = React.useRef<number>(0);
  // Ref para acceder a rebuildPeerConnection desde createPeerConnection antes de declararlo
  const rebuildPeerConnectionRef = React.useRef<() => Promise<void>>(() => Promise.resolve());
  // Ping/keepalive: trackear último pong recibido
  const lastPongRef = React.useRef<number>(0);
  const pingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // ── P0-2: Lease del cliente conectado ──
  // Si el cliente se va sin hangup (cierra pestaña, pierde red, iOS suspend),
  // liberamos el slot despues de un timeout si no hay media fluyendo.
  const leaseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const LEASE_TIMEOUT_MS = 30_000; // 30s de gracia antes de liberar el slot

  // ── P0-1: Estados independientes de salud de la llamada ──
  const callHealthRef = React.useRef<CallHealth>({
    signaling: "connecting",
    peer: "new",
    media: "absent",
    recovery: "idle",
  });
  // Trackear media remota: bytesReceived y framesDecoded para detectar media stall
  const lastBytesReceivedRef = React.useRef<number>(0);
  const lastFramesDecodedRef = React.useRef<number>(0);
  const mediaCheckIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs estables para callbacks que se usan en suscripciones de larga duración
  const onPeersUpdateRef = React.useRef(onPeersUpdate);
  React.useEffect(() => {
    onPeersUpdateRef.current = onPeersUpdate;
  }, [onPeersUpdate]);

  // Ref estable para logear eventos WebRTC
  const onWebrtcEventRef = React.useRef(onWebrtcEvent);
  React.useEffect(() => {
    onWebrtcEventRef.current = onWebrtcEvent;
  }, [onWebrtcEvent]);
  const logWebrtcEvent = React.useCallback((eventType: string, details?: Record<string, unknown>) => {
    onWebrtcEventRef.current?.(eventType, details);
  }, []);

  // ── P0-1: Actualizar salud de la llamada y derivar estado visible ──
  const updateCallHealth = React.useCallback((partial: Partial<CallHealth>) => {
    const prev = callHealthRef.current;
    const next = { ...prev, ...partial };
    callHealthRef.current = next;
    // Solo derivar si no estamos en estado rejected (se maneja aparte)
    setState((currentState) => {
      if (currentState === "rejected") return currentState;
      const remoteVideo = remoteVideoRef.current;
      const hasRemoteFrame = !!(remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0);
      return deriveCallState(next, hasRemoteFrame);
    });
    // Logear cambios significativos
    if (prev.signaling !== next.signaling) {
      logWebrtcEvent("signaling_state", { from: prev.signaling, to: next.signaling });
    }
    if (prev.peer !== next.peer) {
      logWebrtcEvent("peer_state", { from: prev.peer, to: next.peer });
    }
    if (prev.media !== next.media) {
      logWebrtcEvent("media_state", { from: prev.media, to: next.media });
    }
  }, [logWebrtcEvent]);

  // ── P0-4: Validar role real de un peer via presence ──
  // No confiar en msg.role — usar el role que Supabase presence reporta.
  const getValidatedRole = React.useCallback((from: string, declaredRole: SignalingRole): SignalingRole | null => {
    const presenceRole = peerRolesRef.current.get(from);
    if (presenceRole) return presenceRole; // presence es fuente de verdad
    // Si no esta en presence aun, aceptar el role declarado pero con precaucion
    // (puede ser un peer que acaba de llegar y presence no se ha sincronizado)
    return declaredRole;
  }, []);

  // ── P0-4: Mapa de roles validados via presence ──
  // No confiar en msg.role declarado por el cliente.
  // Validar contra el role reportado por Supabase presence.
  const peerRolesRef = React.useRef<Map<string, SignalingRole>>(new Map());

  // Ref estable para switchCamera (usado por el handler de signaling cuando el inspector lo pide)
  const switchCameraRef = React.useRef<() => void>(() => {});

  // Ordenamos siempre audio primero, video después, para mantener m-lines consistentes
  const getOrderedLocalTracks = () => {
    const s = localStreamRef.current;
    return s ? [...s.getAudioTracks(), ...s.getVideoTracks()] : [];
  };

  // ── Inicializar media local ──
  const initLocalMedia = React.useCallback(async () => {
    // Estrategia: intentar video+audio primero. Si la cámara falla (ej: en uso
    // por otro navegador), hacer fallback a solo audio para no bloquear la cámara
    // del asegurado si están en el mismo equipo.
    let stream: MediaStream = new MediaStream();
    let cameraPerm: "granted" | "denied" | "error" = "error";
    let microphonePerm: "granted" | "denied" | "error" = "error";
    let userMessage: string | null = null;

    try {
      // Bitrate asimétrico: el inspector envía video de baja resolución (su cara
      // no necesita HD), el asegurado envía resolución media (necesita mostrar
      // el daño/propiedad). Esto reduce ~75% el bandwidth total.
      const videoConstraints = role === "inspector"
        ? { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: facingModeRef.current }
        : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: facingModeRef.current };
      stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      cameraPerm = "granted";
      microphonePerm = "granted";
    } catch (err) {
      const domErr = err instanceof DOMException ? err : null;
      const raw = err instanceof Error ? err.message : "";

      userMessage = getMediaErrorMessage(err);

      if (domErr?.name === "NotAllowedError" || domErr?.name === "SecurityError" || raw.toLowerCase().includes("permission")) {
        cameraPerm = "denied";
        microphonePerm = "denied";
      }

      // Logear el error de media para trazabilidad
      logWebrtcEvent("media_error", {
        error: domErr?.name || "Unknown",
        message: raw,
        cameraPerm,
        microphonePerm,
      });

      // P1: Fallback progresivo de captura
      // 1. OverconstrainedError: relajar restricciones y reintentar
      if (domErr?.name === "OverconstrainedError") {
        console.warn("[LiveVideoCall] OverconstrainedError — relajando restricciones de video");
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingModeRef.current },
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          cameraPerm = "granted";
          microphonePerm = "granted";
          userMessage = null;
        } catch {
          // Continuar al siguiente fallback
        }
      }

      // 2. Fallback a audio solo — no pedir video para no bloquear la cámara
      // del asegurado si están en el mismo equipo
      if (cameraPerm !== "granted") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          microphonePerm = "granted";
          if (cameraPerm !== "denied") cameraPerm = "error";
        } catch {
          // 3. Entrar sin media local para que el peer se conecte igual
          // stream ya esta inicializado como MediaStream vacio
        }
      }
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    setHasLocalMedia(stream.getTracks().length > 0);

    // P2: Listener para track.onended — dispositivo desconectado o permiso revocado
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        console.warn(`[LiveVideoCall] Track ${track.kind} ended — dispositivo desconectado o permiso revocado`);
        logWebrtcEvent("track_ended", { kind: track.kind, label: track.label });
      };
    });

    onMediaPermission?.({
      camera: cameraPerm,
      microphone: microphonePerm,
    });

    if (userMessage && stream.getTracks().length === 0) {
      setError(userMessage);
    }

    return stream;
  }, [onMediaPermission, role, logWebrtcEvent]);

  // ── Crear peer connection ──
  // Función helper para aplicar límite de bitrate a todos los video senders
  const applyMaxBitrate = React.useCallback((pc: RTCPeerConnection) => {
    const maxBitrate = role === "inspector" ? 200_000 : 800_000;
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind === "video") {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        if (params.encodings[0]) {
          params.encodings[0].maxBitrate = maxBitrate;
          sender.setParameters(params).catch((e) => {
            console.warn("[LiveVideoCall] No se pudo aplicar maxBitrate:", e);
          });
        }
      }
    }
  }, [role]);

  const createPeerConnection = React.useCallback(async () => {
    const iceServers = await fetchIceServers();
    const hasTurn = hasTurnServer(iceServers);
    if (!hasTurn) {
      console.warn("[LiveVideoCall] No hay servidor TURN disponible — conexiones en NAT simétrico pueden fallar");
      logWebrtcEvent("turn_unavailable", { iceServerCount: iceServers.length });
    } else {
      logWebrtcEvent("turn_available", { iceServerCount: iceServers.length });
    }
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all",     // permitir relay (TURN) cuando sea necesario
      bundlePolicy: "max-bundle",    // multiplexar audio+video en un solo par ICE
      iceCandidatePoolSize: 2,       // pre-gather candidates (reducido de 10 — menos overhead)
      rtcpMuxPolicy: "require",      // RTCP multiplexado (estándar moderno)
    });
    pcRef.current = pc;

    // Aplicar límite de bitrate asimétrico a los senders locales.
    // Inspector: 200 kbps (su cara no necesita HD).
    // Asegurado: 800 kbps (necesita mostrar el daño/propiedad).
    const maxBitrate = role === "inspector" ? 200_000 : 800_000;
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind === "video") {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        if (params.encodings[0]) {
          params.encodings[0].maxBitrate = maxBitrate;
          sender.setParameters(params).catch((e) => {
            console.warn("[LiveVideoCall] No se pudo aplicar maxBitrate:", e);
          });
        }
      }
    }

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
      // P1 Safari: intentar play() del video remoto — puede fallar por autoplay
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch(() => {
          console.warn("[LiveVideoCall] Autoplay bloqueado — esperando gesto del usuario");
          setNeedsPlaybackGesture(true);
        });
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && channelRef.current) {
        channelRef.current.send({ type: "ice", from: userId, role, candidate });
      }
      // P2: Cuando candidate es null, gathering completo — el flush del signaling
      // se hace automaticamente al enviar el siguiente mensaje (offer/answer/ready).
      // No necesitamos enviar un mensaje extra.
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        updateCallHealth({ peer: "connected", recovery: "idle" });
        setError(null);
        // P1: Registrar tiempo de inicio de conexion para medir timeToFirstFrame
        if (connectionStartTimeRef.current === 0) {
          connectionStartTimeRef.current = Date.now();
        }
      } else if (s === "connecting") {
        updateCallHealth({ peer: "connecting" });
      } else if (s === "disconnected") {
        // No marcar disconnected inmediatamente — el media puede seguir fluyendo.
        // El chequeo periodico de media detectara si realmente se cayo.
        const remoteVideo = remoteVideoRef.current;
        const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
        if (!hasRemoteFrame) {
          updateCallHealth({ peer: "disconnected" });
        } else {
          // Media sigue fluyendo — solo registrar, no cambiar estado visible
          updateCallHealth({ peer: "disconnected" });
          console.warn("[LiveVideoCall] connectionState=disconnected pero video remoto activo — manteniendo llamada");
        }
      } else if (s === "failed") {
        // Grace period de 5s para que ICE restart recupere.
        const remoteVideo = remoteVideoRef.current;
        const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
        if (hasRemoteFrame) {
          console.warn("[LiveVideoCall] connectionState=failed pero video remoto activo — ignorando");
          return;
        }
        updateCallHealth({ peer: "failed", recovery: "restarting-ice" });
        setTimeout(() => {
          const pc2 = pcRef.current;
          const rv = remoteVideoRef.current;
          const hasFrame = rv && rv.readyState >= 2 && rv.videoWidth > 0;
          if (pc2 && pc2.connectionState === "failed" && !hasFrame) {
            setState("failed");
            setError("Conexión fallida. Verifica tu conexión a internet.");
            logWebrtcEvent("connection_failed", { reason: "connection_state_failed_no_remote_frame", iceState: pc2.iceConnectionState });
            onWebrtcEvent?.("connection_failed", { reason: "connection_state_failed_no_remote_frame" });
          }
        }, 5000);
      } else if (s === "closed") {
        updateCallHealth({ peer: "disconnected" });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        // Backoff exponencial con jitter: 2s, 4s, 8s, 16s — máximo 3 restarts
        const restartCount = iceRestartCountRef.current;
        if (restartCount >= 3) {
          console.error("[LiveVideoCall] ICE restart falló 3 veces consecutivas — intentando reconstrucción completa");
          logWebrtcEvent("ice_restart_exhausted", { attempts: restartCount, iceState: pc.iceConnectionState });
          // P1: Disparar reconstruccion completa (solo inspector coordina)
          if (role === "inspector") {
            if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
            rebuildTimerRef.current = setTimeout(() => {
              void rebuildPeerConnectionRef.current();
            }, 2000);
          } else {
            // Cliente: esperar a que el inspector reconstruya
            updateCallHealth({ peer: "disconnected", recovery: "idle" });
            setState("disconnected");
            setError("Conexión inestable. El inspector está intentando reconectar...");
          }
          return;
        }
        const baseDelay = Math.min(2000 * Math.pow(2, restartCount), 16000);
        const jitter = Math.random() * 500; // 0-500ms jitter para evitar sincronía
        const delay = Math.round(baseDelay + jitter);
        console.warn(`[LiveVideoCall] ICE failed — restart en ${delay}ms (intento ${restartCount + 1}/3)`);
        iceRestartCountRef.current = restartCount + 1;
        updateCallHealth({ recovery: "restarting-ice" });
        logWebrtcEvent("ice_restart", { attempt: restartCount + 1, delay, iceState: pc.iceConnectionState });
        // Limpiar timer anterior si existe
        if (iceRestartTimerRef.current) clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.iceConnectionState === "failed") {
            pcRef.current.restartIce();
          }
        }, delay);
      } else if (pc.iceConnectionState === "connected") {
        // ICE se recuperó — resetear contador de restarts
        iceRestartCountRef.current = 0;
        if (iceRestartTimerRef.current) {
          clearTimeout(iceRestartTimerRef.current);
          iceRestartTimerRef.current = null;
        }
        updateCallHealth({ peer: "connected", recovery: "idle" });
        setError(null);
      } else if (pc.iceConnectionState === "disconnected") {
        // No cambiar estado visible — el chequeo de media determinara si hay problema real
        updateCallHealth({ peer: "disconnected" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, logWebrtcEvent]);

  // ── P1: Reconstrucción completa del RTCPeerConnection ──
  // Nivel 2 de recuperación: si ICE restart falla 3 veces, reconstruir
  // el peer connection completo. Solo el inspector coordina la reconstruccion.
  const rebuildPeerConnection = React.useCallback(async () => {
    // Solo el inspector inicia reconstruccion (coordinador)
    if (role !== "inspector") return;

    // Verificar presupuesto de tiempo
    if (rebuildStartedAtRef.current === 0) {
      rebuildStartedAtRef.current = Date.now();
    }
    const elapsed = Date.now() - rebuildStartedAtRef.current;
    if (elapsed > REBUILD_BUDGET_MS) {
      console.error("[LiveVideoCall] Presupuesto de reconstruccion agotado — requiere intervencion manual");
      updateCallHealth({ peer: "failed", recovery: "idle" });
      setState("failed");
      setError("No se pudo recuperar la conexión. Recarga la página e intenta nuevamente.");
      logWebrtcEvent("rebuild_exhausted", { elapsed, attempts: rebuildCountRef.current });
      return;
    }
    if (rebuildCountRef.current >= MAX_REBUILD_ATTEMPTS) {
      console.error(`[LiveVideoCall] Maximo de ${MAX_REBUILD_ATTEMPTS} reconstrucciones alcanzado`);
      updateCallHealth({ peer: "failed", recovery: "idle" });
      setState("failed");
      setError("No se pudo recuperar la conexión. Recarga la página e intenta nuevamente.");
      logWebrtcEvent("rebuild_max_attempts", { attempts: rebuildCountRef.current });
      return;
    }

    rebuildCountRef.current++;
    connectionGenerationRef.current++;
    const gen = connectionGenerationRef.current;
    updateCallHealth({ recovery: "rebuilding" });
    console.warn(`[LiveVideoCall] Reconstruyendo peer connection (generacion ${gen}, intento ${rebuildCountRef.current})`);
    logWebrtcEvent("rebuild_start", { generation: gen, attempt: rebuildCountRef.current });

    // Cerrar el peer connection anterior
    const oldPc = pcRef.current;
    if (oldPc) {
      try {
        oldPc.close();
      } catch {
        // ignorar
      }
      pcRef.current = null;
    }

    // Limpiar stream remoto
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Resetear ICE restart counter para la nueva generacion
    iceRestartCountRef.current = 0;

    // Esperar 1s antes de reconstruir para evitar carreras
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Si la generacion cambio mientras esperabamos, abortar
    if (connectionGenerationRef.current !== gen) {
      console.log(`[LiveVideoCall] Reconstruccion de generacion ${gen} cancelada — nueva generacion ${connectionGenerationRef.current}`);
      return;
    }

    // Reconstruir solo si tenemos media local
    if (!localStreamRef.current || localStreamRef.current.getTracks().length === 0) {
      console.warn("[LiveVideoCall] No hay media local para reconstruir — abortando");
      return;
    }

    try {
      const newPc = await createPeerConnection();
      // Re-agregar tracks locales en orden audio → video
      const stream = localStreamRef.current;
      [...stream.getAudioTracks(), ...stream.getVideoTracks()].forEach((track) => {
        newPc.addTrack(track, stream);
      });
      applyMaxBitrate(newPc);

      // Anunciar reconstruccion via signaling para que el peer sepa
      if (channelRef.current) {
        channelRef.current.send({ type: "ready", from: userId, role });
      }

      updateCallHealth({ peer: "connecting", recovery: "idle" });
      logWebrtcEvent("rebuild_complete", { generation: gen });
    } catch (err) {
      console.error(`[LiveVideoCall] Error reconstruyendo peer connection:`, err);
      logWebrtcEvent("rebuild_error", { generation: gen, error: err instanceof Error ? err.message : String(err) });
      updateCallHealth({ peer: "failed", recovery: "idle" });
      setState("failed");
      setError("No se pudo recuperar la conexión. Recarga la página.");
    }
  }, [role, userId, logWebrtcEvent, updateCallHealth, createPeerConnection, applyMaxBitrate]);

  // Sincronizar ref de rebuildPeerConnection para uso desde createPeerConnection
  React.useEffect(() => {
    rebuildPeerConnectionRef.current = rebuildPeerConnection;
  }, [rebuildPeerConnection]);

  // ── Manejar mensaje de signaling ──
  const handleSignalingMessage = React.useCallback(
    async (msg: SignalingMessage) => {
      const pc = pcRef.current;
      if (!pc) return;

      // P0-4: Validar tamano del payload para prevenir abuso
      try {
        const payloadSize = JSON.stringify(msg).length;
        if (payloadSize > MAX_SIGNALING_PAYLOAD_BYTES) {
          console.warn(`[LiveVideoCall] Mensaje de signaling descartado — tamano ${payloadSize}B excede limite ${MAX_SIGNALING_PAYLOAD_BYTES}B`);
          logWebrtcEvent("signaling_oversized", { type: msg.type, size: payloadSize, from: msg.from });
          return;
        }
      } catch {
        return;
      }

      try {
        // Kick: el inspector fuerza la desconexión de este peer
        if (msg.type === "kick") {
          // P0-4: Validar que el kick viene de un inspector real via presence
          const validatedRole = getValidatedRole(msg.from, msg.role);
          if (validatedRole !== "inspector") {
            console.warn(`[LiveVideoCall] Kick rechazado — sender ${msg.from} no es inspector validado (role: ${validatedRole})`);
            logWebrtcEvent("kick_rejected", { from: msg.from, declaredRole: msg.role, validatedRole, reason: "not_inspector" });
            return;
          }
          if (msg.target === userId) {
            // Avisar al inspector que nos desconectamos, para que libere
            // connectedClientRef y pueda aceptar a un nuevo cliente.
            if (!hangupSentRef.current && channelRef.current) {
              channelRef.current.send({ type: "hangup", from: userId, role });
              hangupSentRef.current = true;
            }
            setRejectedReason(msg.reason);
            setState("rejected");
            // Liberar cámara/micrófono local
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((t) => t.stop());
              localStreamRef.current = null;
            }
            // Notificar al padre para que cierre el modal
            onKicked?.(msg.reason);
          }
          return;
        }

        // Rechazo: el inspector nos avisa que ya hay una sesión en curso
        if (msg.type === "busy") {
          if (role === "client") {
            setRejectedReason(msg.reason);
            setState("rejected");
            // Liberar cámara/micrófono local
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((t) => t.stop());
              localStreamRef.current = null;
            }
          }
          return;
        }

        if (msg.type === "ready") {
          // Marcar signaling online — recibimos mensajes del peer
          updateCallHealth({ signaling: "online" });
          // El supervisor no afecta el estado de peer joined ni dispara notificaciones
          if (msg.role === "supervisor") return;
          // Inspector: rechazar a un segundo cliente si ya hay uno conectado
          if (role === "inspector" && msg.role === "client") {
            if (connectedClientRef.current && connectedClientRef.current !== msg.from) {
              channelRef.current?.send({
                type: "busy",
                from: userId,
                role,
                reason: "Ya existe una sesión de videollamada en curso. Espere a que finalice la inspección en curso.",
              });
              if (!rejectedPeersRef.current.has(msg.from)) {
                rejectedPeersRef.current.add(msg.from);
                onPeerRejected?.();
                logWebrtcEvent("peer_rejected", { peerId: msg.from, peerRole: msg.role, reason: "busy" });
              }
              return;
            }
            connectedClientRef.current = msg.from;
            setConnectedClientId(msg.from);
          }
          setPeerJoined(true);
          if (msg.role !== role && !peerJoinedNotifiedRef.current) {
            peerJoinedNotifiedRef.current = true;
            onPeerJoined?.();
            logWebrtcEvent("peer_join", { peerId: msg.from, peerRole: msg.role });
          }
          // El inspector (impolite) inicia la oferta cuando el cliente se une
          if (role === "inspector" && localStreamRef.current) {
            // Forzar renegotiación agregando tracks si no están (audio → video)
            const senders = pc.getSenders();
            if (senders.length === 0) {
              getOrderedLocalTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
              });
            }
          }
        } else if (msg.type === "offer") {
          // Ignorar mensajes WebRTC del supervisor (no tiene peer connection)
          if (msg.role === "supervisor") return;
          // Inspector: rechazar offer de un segundo cliente
          if (role === "inspector" && msg.role === "client") {
            if (connectedClientRef.current && connectedClientRef.current !== msg.from) {
              channelRef.current?.send({
                type: "busy",
                from: userId,
                role,
                reason: "Ya existe una sesión de videollamada en curso. Espere a que finalice la inspección en curso.",
              });
              if (!rejectedPeersRef.current.has(msg.from)) {
                rejectedPeersRef.current.add(msg.from);
                onPeerRejected?.();
                logWebrtcEvent("peer_rejected", { peerId: msg.from, peerRole: msg.role, reason: "busy" });
              }
              return;
            }
            connectedClientRef.current = msg.from;
            setConnectedClientId(msg.from);
          }
          setPeerJoined(true);
          if (msg.role !== role && !peerJoinedNotifiedRef.current) {
            peerJoinedNotifiedRef.current = true;
            onPeerJoined?.();
            logWebrtcEvent("peer_join", { peerId: msg.from, peerRole: msg.role });
          }
          const offerCollision = makingOfferRef.current;
          ignoreOfferRef.current = !politeRef.current && offerCollision;
          if (ignoreOfferRef.current) return;

          try {
            await pc.setRemoteDescription(msg.sdp);
          } catch (err) {
            if (err instanceof DOMException && err.name === "InvalidAccessError") {
              // La oferta tiene m-lines en orden incompatible; no podemos aceptarla
              setError("No se pudo conectar el video. El chat sigue disponible.");
              return;
            }
            throw err;
          }
          // Aplicar ICE candidates que llegaron antes de la oferta
          const buffered = iceCandidateBufferRef.current;
          iceCandidateBufferRef.current = [];
          for (const c of buffered) {
            try {
              await pc.addIceCandidate(c);
            } catch {
              // Algunos ICE del buffer ya no aplican tras la negociación; se ignoran
            }
          }
          // Asegurar que nuestros tracks estén agregados en orden audio → video
          if (localStreamRef.current) {
            const senders = pc.getSenders();
            if (senders.length === 0) {
              getOrderedLocalTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
              });
            }
          }
          await pc.setLocalDescription();
          channelRef.current?.send({ type: "answer", from: userId, role, sdp: pc.localDescription! });
        } else if (msg.type === "answer") {
          try {
            await pc.setRemoteDescription(msg.sdp);
          } catch (err) {
            if (err instanceof DOMException && err.name === "InvalidAccessError") {
              setError("No se pudo conectar el video. El chat sigue disponible.");
              return;
            }
            throw err;
          }
          // Aplicar ICE candidates que llegaron antes de la answer
          const buffered = iceCandidateBufferRef.current;
          iceCandidateBufferRef.current = [];
          for (const c of buffered) {
            try {
              await pc.addIceCandidate(c);
            } catch {
              // Algunos ICE del buffer ya no aplican tras la negociación; se ignoran
            }
          }
        } else if (msg.type === "ice") {
          // Ignorar ICE candidates de un cliente que no es el conectado (inspector)
          if (role === "inspector" && msg.role === "client" && connectedClientRef.current && connectedClientRef.current !== msg.from) {
            return;
          }

          if (!pc.remoteDescription) {
            // Llegó ICE antes de la oferta/answer remota; lo almacenamos
            iceCandidateBufferRef.current.push(msg.candidate);
            return;
          }

          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            const domErr = err instanceof DOMException ? err : null;
            const canIgnore =
              domErr?.name === "InvalidStateError" ||
              domErr?.name === "OperationError" ||
              (err instanceof Error && err.message?.toLowerCase().includes("remote description"));
            if (!canIgnore && !ignoreOfferRef.current) throw err;
          }
        } else if (msg.type === "ice-batch") {
          // Lote de ICE candidates (throttling para reducir mensajes en Realtime)
          if (role === "inspector" && msg.role === "client" && connectedClientRef.current && connectedClientRef.current !== msg.from) {
            return;
          }

          for (const candidate of msg.candidates) {
            if (!pc.remoteDescription) {
              iceCandidateBufferRef.current.push(candidate);
              continue;
            }
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              const domErr = err instanceof DOMException ? err : null;
              const canIgnore =
                domErr?.name === "InvalidStateError" ||
                domErr?.name === "OperationError" ||
                (err instanceof Error && err.message?.toLowerCase().includes("remote description"));
              if (!canIgnore && !ignoreOfferRef.current) throw err;
            }
          }
        } else if (msg.type === "hangup") {
          // Inspector: si cuelga el cliente conectado, liberar el slot
          if (role === "inspector" && msg.role === "client") {
            if (connectedClientRef.current === msg.from) {
              connectedClientRef.current = null;
              setConnectedClientId(null);
              // Cancelar lease timeout si estaba corriendo
              if (leaseTimeoutRef.current) {
                clearTimeout(leaseTimeoutRef.current);
                leaseTimeoutRef.current = null;
              }
            } else {
              // Hangup de un cliente que no es el conectado — ignorar
              return;
            }
          }
          logWebrtcEvent("peer_leave", { peerId: msg.from, peerRole: msg.role, reason: "hangup" });
          setPeerJoined(false);
          updateCallHealth({ peer: "disconnected", media: "absent", signaling: "offline" });
          // Limpiar stream remoto
          if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach((t) => t.stop());
            remoteStreamRef.current = null;
          }
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        } else if (msg.type === "ping") {
          // Responder pong para que el otro par sepa que estamos vivos
          channelRef.current?.send({ type: "pong", from: userId, role });
        } else if (msg.type === "pong") {
          // Actualizar último pong recibido y marcar signaling online
          lastPongRef.current = Date.now();
          updateCallHealth({ signaling: "online" });
        } else if (msg.type === "screenshot") {
          // El otro par capturó una foto — refrescar para mostrarla en tiempo real
          if (msg.from !== userId) onScreenshotSaved?.();
        } else if (msg.type === "switch_camera") {
          // El inspector pide al asegurado que voltee su cámara
          // P0-4: Validar que viene de un inspector real via presence
          if (msg.from !== userId) {
            const validatedRole = getValidatedRole(msg.from, msg.role);
            if (validatedRole !== "inspector") {
              console.warn(`[LiveVideoCall] switch_camera rechazado — sender ${msg.from} no es inspector validado`);
              return;
            }
            switchCameraRef.current();
          }
        }
      } catch (err) {
        console.error("[LiveVideoCall] Error procesando signaling:", msg.type, err);
      }
    },
    [role, userId, onPeerJoined, onPeerRejected, onKicked, onScreenshotSaved, logWebrtcEvent, updateCallHealth, getValidatedRole],
  );

  // ── P1: Monitoreo WebRTC mejorado ──
  // Muestreo cada 5s (mas frecuente que antes), buffer circular de 120s,
  // metricas por ventana (deltas), suavizado EWMA, metricas adicionales.
  const currentBitrateRef = React.useRef<number>(0);
  const goodConnectionSinceRef = React.useRef<number>(0);
  const statsUploadCounterRef = React.useRef<number>(0);
  // Buffer circular de muestras para diagnostico (120s = 24 muestras a 5s)
  interface StatsSample {
    t: number;
    outBitrate: number;
    inBitrate: number;
    lossPct: number;
    jitterMs: number;
    rttMs: number;
    iceType: string;
    qualityLimitation?: string;
    framesDropped?: number;
    nackCount?: number;
    pliCount?: number;
    concealedSamples?: number;
  }
  const statsBufferRef = React.useRef<StatsSample[]>([]);
  const MAX_STATS_BUFFER = 24;
  // Valores previos para calcular deltas por ventana
  const prevPacketsLostRef = React.useRef<number>(0);
  const prevPacketsReceivedRef = React.useRef<number>(0);
  // EWMA suavizado para loss y rtt
  const ewmaLossRef = React.useRef<number>(0);
  const ewmaRttRef = React.useRef<number>(0);
  const EWMA_ALPHA = 0.3;
  // Tiempo hasta primer frame
  const firstFrameTimeRef = React.useRef<number>(0);
  const connectionStartTimeRef = React.useRef<number>(0);
  // Cooldown entre cambios de bitrate (evitar oscilaciones)
  const lastBitrateChangeRef = React.useRef<number>(0);
  const BITRATE_COOLDOWN_MS = 15_000; // 15s entre cambios

  React.useEffect(() => {
    const interval = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== "connected") return;

      try {
        const stats = await pc.getStats();
        let outboundBitrate = 0;
        let inboundBitrate = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let jitter = 0;
        let rtt = 0;
        let iceCandidateType = "unknown";
        let qualityLimitationReason = "";
        let framesDropped = 0;
        let nackCount = 0;
        let pliCount = 0;
        let concealedSamples = 0;

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            if (report.bitrate) outboundBitrate = Math.round(report.bitrate / 1024);
            qualityLimitationReason = report.qualityLimitationReason || "";
            nackCount = report.nackCount || 0;
            pliCount = report.pliCount || 0;
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            if (report.bitrate) inboundBitrate = Math.round(report.bitrate / 1024);
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
            jitter = report.jitter || 0;
            framesDropped = report.framesDropped || 0;
          }
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            concealedSamples = report.concealedSamples || 0;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime) {
            rtt = Math.round(report.currentRoundTripTime * 1000);
          }
          if (report.type === "local-candidate" && report.candidateType) {
            iceCandidateType = report.candidateType;
          }
        });

        // P1: Calcular pérdida por ventana (delta desde ultima muestra)
        const deltaLost = packetsLost - prevPacketsLostRef.current;
        const deltaReceived = packetsReceived - prevPacketsReceivedRef.current;
        const windowLossPct = deltaReceived > 0
          ? Math.round((deltaLost / (deltaLost + deltaReceived)) * 100)
          : 0;
        prevPacketsLostRef.current = packetsLost;
        prevPacketsReceivedRef.current = packetsReceived;

        // P1: Suavizar con EWMA
        ewmaLossRef.current = EWMA_ALPHA * windowLossPct + (1 - EWMA_ALPHA) * ewmaLossRef.current;
        ewmaRttRef.current = EWMA_ALPHA * rtt + (1 - EWMA_ALPHA) * ewmaRttRef.current;
        const smoothLoss = Math.round(ewmaLossRef.current);
        const smoothRtt = Math.round(ewmaRttRef.current);

        const jitterMs = Math.round(jitter * 1000);
        console.log(
          `[WebRTC Stats] out=${outboundBitrate}kb/s in=${inboundBitrate}kb/s loss=${smoothLoss}% (win=${windowLossPct}%) jitter=${jitterMs}ms rtt=${smoothRtt}ms ice=${iceCandidateType} ql=${qualityLimitationReason}`
        );

        // P1: Guardar muestra en buffer circular
        const sample: StatsSample = {
          t: Date.now(),
          outBitrate: outboundBitrate,
          inBitrate: inboundBitrate,
          lossPct: smoothLoss,
          jitterMs,
          rttMs: smoothRtt,
          iceType: iceCandidateType,
          qualityLimitation: qualityLimitationReason,
          framesDropped,
          nackCount,
          pliCount,
          concealedSamples,
        };
        statsBufferRef.current.push(sample);
        if (statsBufferRef.current.length > MAX_STATS_BUFFER) {
          statsBufferRef.current.shift();
        }

        // P1: Tiempo hasta primer frame
        if (firstFrameTimeRef.current === 0 && inboundBitrate > 0) {
          firstFrameTimeRef.current = Date.now();
          if (connectionStartTimeRef.current > 0) {
            const ttff = firstFrameTimeRef.current - connectionStartTimeRef.current;
            logWebrtcEvent("first_frame", { timeToFirstFrameMs: ttff });
            console.log(`[WebRTC] Tiempo hasta primer frame: ${ttff}ms`);
          }
        }

        // ── Enviar stats a Supabase cada 30s (cada 6 iteraciones a 5s) ──
        statsUploadCounterRef.current++;
        if (statsUploadCounterRef.current >= 6) {
          statsUploadCounterRef.current = 0;
          fetch("/api/webrtc-stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              userId,
              role,
              outboundBitrate,
              inboundBitrate,
              packetLossPct: smoothLoss,
              jitterMs,
              rttMs: smoothRtt,
              iceCandidateType,
              connectionState: pc.connectionState,
              qualityLimitationReason,
              framesDropped,
            }),
          }).catch(() => {
            // Silencioso — no interrumpir la llamada por error de telemetría
          });
        }

        // ── Degradación adaptativa de video (mejorada con EWMA + cooldown) ──
        const baseBitrate = role === "inspector" ? 200_000 : 800_000;
        const minBitrate = 50_000;
        const currentBitrate = currentBitrateRef.current || baseBitrate;
        const now = Date.now();
        const sinceLastChange = now - lastBitrateChangeRef.current;

        let newBitrate = currentBitrate;

        // Solo aplicar cambios si paso el cooldown
        if (sinceLastChange > BITRATE_COOLDOWN_MS) {
          if (smoothLoss > 25 || smoothRtt > 2000) {
            // Degradación severa
            newBitrate = Math.max(minBitrate, Math.round(currentBitrate * 0.3));
            console.warn(`[WebRTC Adapt] Degradación severa (loss=${smoothLoss}% rtt=${smoothRtt}ms) → ${newBitrate}bps`);
            goodConnectionSinceRef.current = 0;
            lastBitrateChangeRef.current = now;
          } else if (smoothLoss > 10 || smoothRtt > 1000) {
            // Degradación moderada
            newBitrate = Math.max(minBitrate, Math.round(currentBitrate * 0.5));
            console.warn(`[WebRTC Adapt] Degradación moderada (loss=${smoothLoss}% rtt=${smoothRtt}ms) → ${newBitrate}bps`);
            goodConnectionSinceRef.current = 0;
            lastBitrateChangeRef.current = now;
          } else if (smoothLoss < 5 && smoothRtt < 500) {
            // Conexión buena — si dura 30s, subir bitrate gradualmente
            if (goodConnectionSinceRef.current === 0) {
              goodConnectionSinceRef.current = now;
            } else if (now - goodConnectionSinceRef.current > 30_000) {
              if (currentBitrate < baseBitrate) {
                newBitrate = Math.min(baseBitrate, Math.round(currentBitrate * 1.3));
                console.log(`[WebRTC Adapt] Recuperando bitrate → ${newBitrate}bps`);
                goodConnectionSinceRef.current = now;
                lastBitrateChangeRef.current = now;
              }
            }
          } else {
            goodConnectionSinceRef.current = 0;
          }
        }

        // Aplicar nuevo bitrate si cambió
        if (newBitrate !== currentBitrate) {
          currentBitrateRef.current = newBitrate;
          for (const sender of pc.getSenders()) {
            if (sender.track?.kind === "video") {
              const params = sender.getParameters();
              if (!params.encodings) params.encodings = [{}];
              if (params.encodings[0]) {
                params.encodings[0].maxBitrate = newBitrate;
                sender.setParameters(params).catch((e) => {
                  console.warn("[WebRTC Adapt] No se pudo aplicar nuevo bitrate:", e);
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn("[WebRTC Stats] Error obteniendo stats:", e);
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [role, sessionId, userId, logWebrtcEvent]);

  // ── P0-1: Monitoreo de media remota via getStats() ──
  // Chequea cada 5s si los bytesReceived/framesDecoded siguen incrementando.
  // Si no hay incremento en 10s (2 ciclos), marca media como "stalled".
  React.useEffect(() => {
    const interval = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      // Solo monitorear si hay peer connection activa
      if (pc.connectionState !== "connected" && pc.connectionState !== "disconnected") return;

      try {
        const stats = await pc.getStats();
        let bytesReceived = 0;
        let framesDecoded = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            bytesReceived = report.bytesReceived || 0;
            framesDecoded = report.framesDecoded || 0;
          }
        });

        const prevBytes = lastBytesReceivedRef.current;
        const prevFrames = lastFramesDecodedRef.current;
        const hasIncrement = bytesReceived > prevBytes || framesDecoded > prevFrames;

        if (bytesReceived > 0) {
          if (hasIncrement) {
            // Media fluyendo
            updateCallHealth({ media: "flowing" });
          } else {
            // No hay incremento — media stalled
            updateCallHealth({ media: "stalled" });
            console.warn("[LiveVideoCall] Media stalled — sin nuevos frames recibidos");
          }
        } else if (pc.connectionState === "connected") {
          // Connected pero sin bytes recibidos — media ausente
          updateCallHealth({ media: "absent" });
        }

        lastBytesReceivedRef.current = bytesReceived;
        lastFramesDecodedRef.current = framesDecoded;
      } catch {
        // Stats no disponibles — no cambiar estado
      }
    }, 5000);

    mediaCheckIntervalRef.current = interval;
    return () => {
      clearInterval(interval);
      mediaCheckIntervalRef.current = null;
    };
  }, [updateCallHealth]);

  // ── Inicializar todo al montar ──
  React.useEffect(() => {
    let cancelled = false;
    // P2: Capturar refs al inicio del effect para uso seguro en cleanup
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;
    const peerRolesMap = peerRolesRef.current;

    (async () => {
      setState("connecting");
      const stream = await initLocalMedia();
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Si no hay cámara/micrófono, igual nos unimos al canal de signaling
      // para que ambos lados se vean conectados en el chat/peers, pero no
      // creamos una conexión WebRTC que falle por SDP sin media.
      if (stream.getTracks().length > 0) {
        const pc = await createPeerConnection();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Agregar tracks locales al peer connection en orden audio → video
        [...stream.getAudioTracks(), ...stream.getVideoTracks()].forEach((track) => {
          pc.addTrack(track, stream);
        });
        // Aplicar límite de bitrate a los video senders después de agregar tracks
        applyMaxBitrate(pc);
      }

      // Unirse al canal de signaling
      const channel = joinSignalingChannel(sessionId, userId, role);
      channelRef.current = channel;
      channel.onMessage(handleSignalingMessage);
      // Suscribirse a presence para trackear peers conectados
      channel.onPresence((newPeers) => {
        setPeers(newPeers);
        onPeersUpdateRef.current?.(newPeers);

        // ── P0-4: Actualizar mapa de roles validados via presence ──
        // Solo confiar en el role que Supabase presence reporta, no en msg.role
        peerRolesRef.current.clear();
        for (const p of newPeers) {
          peerRolesRef.current.set(p.userId, p.role);
        }

        // ── P0-2: Liberar slot si el cliente conectado desaparece de presence ──
        if (role === "inspector" && connectedClientRef.current) {
          const connectedClientId = connectedClientRef.current;
          const stillPresent = newPeers.some((p) => p.userId === connectedClientId);
          if (!stillPresent) {
            // El cliente conectado desaparecio de presence.
            // No liberar inmediatamente — puede ser un blip de Supabase Realtime.
            // Iniciar timer de lease: si no vuelve en 30s y no hay media, liberar.
            if (!leaseTimeoutRef.current) {
              console.warn(`[LiveVideoCall] Cliente ${connectedClientId} desaparecio de presence — iniciando lease timeout de ${LEASE_TIMEOUT_MS}ms`);
              leaseTimeoutRef.current = setTimeout(() => {
                const health = callHealthRef.current;
                const hasRemoteFrame = !!(remoteVideoRef.current && remoteVideoRef.current.readyState >= 2 && remoteVideoRef.current.videoWidth > 0);
                // Solo liberar si no hay media fluyendo
                if (connectedClientRef.current === connectedClientId && health.media !== "flowing" && !hasRemoteFrame) {
                  console.warn(`[LiveVideoCall] Lease expirado — liberando slot del cliente ${connectedClientId}`);
                  connectedClientRef.current = null;
                  setConnectedClientId(null);
                  setPeerJoined(false);
                  updateCallHealth({ peer: "disconnected", media: "absent" });
                  logWebrtcEvent("peer_leave", { peerId: connectedClientId, reason: "lease_expired" });
                } else {
                  console.log(`[LiveVideoCall] Lease cancelado — cliente volvio o media sigue activa`);
                }
                leaseTimeoutRef.current = null;
              }, LEASE_TIMEOUT_MS);
            }
          } else {
            // El cliente volvio a presence — cancelar lease timeout
            if (leaseTimeoutRef.current) {
              clearTimeout(leaseTimeoutRef.current);
              leaseTimeoutRef.current = null;
              console.log(`[LiveVideoCall] Cliente ${connectedClientId} volvio a presence — lease cancelado`);
            }
          }
        }
      });

      // Ping/keepalive: enviar ping cada 15s, si no hay pong en 45s, marcar signaling offline
      // Pero NO marcar la llamada como disconnected si el media sigue fluyendo.
      lastPongRef.current = Date.now();
      pingIntervalRef.current = setInterval(() => {
        if (channelRef.current) {
          channelRef.current.send({ type: "ping", from: userId, role });
          // Verificar si el peer responde — 45s de tolerancia (no 30s)
          // para evitar falsos positivos en moviles en segundo plano
          if (Date.now() - lastPongRef.current > 45_000) {
            console.warn("[LiveVideoCall] Sin pong del peer en 45s — signaling posiblemente caído");
            updateCallHealth({ signaling: "offline" });
            // No forzar disconnected si el media sigue fluyendo
            // deriveCallState lo manejara correctamente
          } else {
            updateCallHealth({ signaling: "online" });
          }
        }
      }, 15_000);
    })();

    return () => {
      cancelled = true;
      // P2: Cleanup idempotente — seguro llamar multiples veces
      if (!hangupSentRef.current && channelRef.current) {
        try {
          channelRef.current.send({ type: "hangup", from: userId, role });
        } catch {
          // canal ya cerrado
        }
        hangupSentRef.current = true;
      }
      if (channelRef.current) {
        void channelRef.current.leave().catch(() => {});
        channelRef.current = null;
      }
      if (pcRef.current) {
        try { pcRef.current.close(); } catch { /* ya cerrado */ }
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* ya detenido */ } });
        localStreamRef.current = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* ya detenido */ } });
        remoteStreamRef.current = null;
      }
      // P2: Limpiar srcObject de los videos para liberar recursos
      if (localVideo) {
        localVideo.srcObject = null;
      }
      if (remoteVideo) {
        remoteVideo.srcObject = null;
      }
      // P2: Detener MediaRecorder si está activo
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch { /* ya detenido */ }
      }
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      // Limpiar todos los timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (iceRestartTimerRef.current) {
        clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = null;
      }
      if (leaseTimeoutRef.current) {
        clearTimeout(leaseTimeoutRef.current);
        leaseTimeoutRef.current = null;
      }
      if (rebuildTimerRef.current) {
        clearTimeout(rebuildTimerRef.current);
        rebuildTimerRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (mediaCheckIntervalRef.current) {
        clearInterval(mediaCheckIntervalRef.current);
        mediaCheckIntervalRef.current = null;
      }
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;
      }
      // P2: Resetear refs de reconstruccion
      iceRestartCountRef.current = 0;
      rebuildCountRef.current = 0;
      rebuildStartedAtRef.current = 0;
      connectionGenerationRef.current = 0;
      // P2: Limpiar mapa de roles
      peerRolesMap.clear();
      // P2: Limpiar buffer de stats
      statsBufferRef.current = [];
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
    } else {
      // No hay video track (cámara no disponible) — liberar el stream actual
      // y volver a pedir video+audio
      stream.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setVideoOn(false);
      // Re-intentar obtener cámara
      const videoConstraints = role === "inspector"
        ? { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: facingModeRef.current }
        : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: facingModeRef.current };
      navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: { echoCancellation: true, noiseSuppression: true },
      }).then((newStream) => {
        localStreamRef.current = newStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        setVideoOn(true);
        setHasLocalMedia(true);
        // Agregar tracks al peer connection existente
        if (pcRef.current) {
          newStream.getVideoTracks().forEach((track) => {
            pcRef.current!.addTrack(track, newStream);
          });
          applyMaxBitrate(pcRef.current);
        }
      }).catch(() => {
        setError("No se pudo acceder a la cámara. Puede estar en uso por otra aplicación.");
      });
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

  // ── Cambiar cámara (frontal/trasera) ──
  const switchCamera = React.useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      setError("No hay cámara activa para cambiar.");
      logWebrtcEvent("camera_switch_error", { reason: "no_video_track" });
      return;
    }

    const nextFacing: "user" | "environment" = facingModeRef.current === "user" ? "environment" : "user";

    try {
      const videoConstraints = role === "inspector"
        ? { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: nextFacing }
        : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: nextFacing };
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) throw new Error("No se obtuvo video");

      videoTrack.stop();
      stream.removeTrack(videoTrack);
      stream.addTrack(newVideoTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (pcRef.current) {
        const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      facingModeRef.current = nextFacing;
      setFacingMode(nextFacing);
      logWebrtcEvent("camera_switch", { from: facingModeRef.current === "user" ? "environment" : "user", to: nextFacing });
    } catch (err) {
      const domErr = err instanceof DOMException ? err : null;
      setError("No se pudo cambiar la cámara. El dispositivo puede no tener otra cámara disponible.");
      logWebrtcEvent("camera_switch_error", {
        reason: domErr?.name || "unknown",
        message: err instanceof Error ? err.message : "",
        attemptedFacing: nextFacing,
      });
    }
  }, [role, logWebrtcEvent]);

  // Mantener la ref de switchCamera actualizada para que el handler de signaling la pueda llamar
  React.useEffect(() => {
    switchCameraRef.current = switchCamera;
  }, [switchCamera]);

  // ── Colgar ──
  const handleHangup = () => {
    logWebrtcEvent("call_end", { reason: "hangup" });
    if (channelRef.current && !hangupSentRef.current) {
      channelRef.current.send({ type: "hangup", from: userId, role });
      hangupSentRef.current = true;
    }
    onHangup();
  };

  // ── Forzar desconexión de un peer (solo inspector) ──
  const kickPeer = (targetUserId: string, reason?: string) => {
    if (role !== "inspector" || !channelRef.current) return;
    logWebrtcEvent("kick", { target: targetUserId, reason });
    channelRef.current.send({
      type: "kick",
      from: userId,
      role,
      target: targetUserId,
      reason: reason || "El inspector ha finalizado tu conexión a la videollamada.",
    });
    // Limpiar el cliente conectado si era el kickeado — sin esto,
    // el inspector rechaza a todos los clientes nuevos con "busy"
    // porque connectedClientRef queda apuntando al cliente expulsado.
    if (connectedClientRef.current === targetUserId) {
      connectedClientRef.current = null;
      setConnectedClientId(null);
      // Cancelar lease timeout si estaba corriendo
      if (leaseTimeoutRef.current) {
        clearTimeout(leaseTimeoutRef.current);
        leaseTimeoutRef.current = null;
      }
    }
  };

  // ── Capturar screenshot del video remoto ──
  const captureScreenshot = async () => {
    // Priorizar video remoto (lo que muestra el asegurado), pero si no está
    // disponible (ej: WebRTC aún conectando), usar video local como fallback
    const remoteVideo = remoteVideoRef.current;
    const localVideo = localVideoRef.current;
    const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
    const hasLocalFrame = localVideo && localVideo.readyState >= 2 && localVideo.videoWidth > 0;
    const video: HTMLVideoElement | null = hasRemoteFrame ? remoteVideo : (hasLocalFrame ? localVideo : null);
    if (!video) {
      setError("No hay video disponible para capturar.");
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
        // Auto-dismiss despues de 3 segundos
        setTimeout(() => setLastScreenshot(null), 3000);
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

  // ── Grabación de sesión (solo inspector) ──
  const startRecording = () => {
    // Grabar video remoto (asegurado) si está disponible, sino video local (inspector)
    const sourceStream = remoteStreamRef.current?.getTracks().length
      ? remoteStreamRef.current
      : localStreamRef.current;
    if (!sourceStream || sourceStream.getTracks().length === 0) {
      setError("No hay cámara disponible para grabar.");
      return;
    }
    recordedChunksRef.current = [];
    const combined = new MediaStream();
    sourceStream.getTracks().forEach((track) => combined.addTrack(track));
    // Agregar audio local del inspector si no está ya incluido
    if (localStreamRef.current && sourceStream !== localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => combined.addTrack(track));
    }
    // P1 Safari: incluir MP4 en el fallback — Safari soporta video/mp4 con H.264/AAC
    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "",
    ].find((t) => (t ? MediaRecorder.isTypeSupported(t) : true));
    const recorder = new MediaRecorder(combined, { mimeType: mimeType || undefined });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onerror = (e) => {
      console.error("[record] recorder error", e);
      setError("Error del grabador: " + (e as ErrorEvent)?.message || "desconocido");
    };
    recorder.onstop = () => {
      void uploadRecording();
    };
    recorder.start(1000);
    setRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.error("[record] stop() error", err);
      setError(err instanceof Error ? err.message : "Error al detener grabación");
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecording(false);
  };

  const uploadRecording = async () => {
    const chunks = recordedChunksRef.current;
    if (chunks.length === 0) {
      return;
    }
    const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
    const ext = blob.type.includes("mp4") ? ".mp4" : ".webm";
    const fileName = `grabacion-sesion-${Date.now()}${ext}`;

    try {
      const presignRes = await fetch("/api/inspection/evidences/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          mimeType: blob.type,
          ext,
          originalName: fileName,
          source: "live_video",
        }),
      });
      if (!presignRes.ok) throw new Error(`HTTP ${presignRes.status} (presign)`);
      const { presignedUrl, url, fileCode, userId, claimId } = await presignRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", blob.type);
        xhr.upload.addEventListener("progress", () => {});
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status} (R2)`));
        });
        xhr.addEventListener("error", () => reject(new Error("Error de red al subir a R2")));
        xhr.addEventListener("abort", () => reject(new Error("Subida cancelada")));
        xhr.send(blob);
      });

      const regRes = await fetch("/api/inspection/evidences/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId, url, fileCode,
          mimeType: blob.type,
          originalName: fileName,
          source: "live_video",
          fileSize: blob.size,
          userId, claimId,
        }),
      });
      if (!regRes.ok) throw new Error(`HTTP ${regRes.status} (register)`);
      const data = await regRes.json();
      if (data.evidence) {
        onRecordingSaved?.({ id: data.evidence.id, url: data.evidence.url, description: data.evidence.description });
      }
    } catch (err) {
      console.error("[record] upload error", err);
      setError(err instanceof Error ? err.message : "Error al subir grabación");
    } finally {
      mediaRecorderRef.current = null;
    }
  };

  // ── Pantalla completa / ampliar video remoto ──
  const goFullscreen = async () => {
    setExpanded(true);
  };

  const stateLabel: Record<ConnectionState, string> = {
    idle: "Iniciando...",
    connecting: "Conectando...",
    connected: "Conectado",
    disconnected: "Reconectando...",
    failed: "Conexión fallida",
    rejected: "Sesión en uso",
  };

  const stateColor: Record<ConnectionState, string> = {
    idle: "text-muted-foreground",
    connecting: "text-amber-600",
    connected: "text-emerald-600",
    disconnected: "text-amber-600",
    failed: "text-rose-600",
    rejected: "text-amber-600",
  };

  const [expanded, setExpanded] = React.useState(false);
  const [showPeersPanel, setShowPeersPanel] = React.useState(false);
  const compact = (compactProp || minimizedProp) && !expanded;
  const minimized = minimizedProp && !expanded;

  // Peers cliente conectados (solo relevantes para el inspector)
  const clientPeers = peers.filter((p) => p.role === "client");
  // Detectar si hay un supervisor conectado
  const hasSupervisor = peers.some((p) => p.role === "supervisor");
  const previewIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Broadcast de thumbnails al supervisor ──
  // Cuando el inspector detecta un supervisor, captura thumbnails del video
  // remoto (asegurado) y local (inspector) cada 3 segundos y los envía via signaling.
  // Incluye estado de cámara/micrófono y conexión para que el supervisor sepa
  // si el inspector está conectado aunque los thumbnails estén vacíos.
  React.useEffect(() => {
    if (role !== "inspector") return;

    let interval: ReturnType<typeof setInterval> | null = null;

    if (hasSupervisor && !interval) {
      const captureAndSend = () => {
        const remoteVideo = remoteVideoRef.current;
        const localVideo = localVideoRef.current;
        // P2: Reducir resolución de thumbnails para menos trafico base64
        const remoteThumb = captureVideoThumb(remoteVideo, 240, 135);
        const localThumb = captureVideoThumb(localVideo, 120, 68);
        // Siempre enviar cuando hay supervisor, incluso si los thumbnails están vacíos.
        // El supervisor necesita saber que el inspector está activo aunque no haya video.
        if (channelRef.current) {
          channelRef.current.send({
            type: "preview",
            from: userId,
            role,
            remoteThumb: remoteThumb || "",
            localThumb: localThumb || "",
            inspectorVideoOn: videoOnRef.current,
            inspectorAudioOn: audioOnRef.current,
            peerConnected: peerJoinedRef.current,
          });
        }
      };
      // P2: Frecuencia reducida a 7s (era 3s) — menos trafico base64 por broadcast
      interval = setInterval(captureAndSend, 7000);
      captureAndSend(); // enviar inmediatamente
    } else if (!hasSupervisor && interval) {
      clearInterval(interval);
      interval = null;
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [hasSupervisor, role, userId]);

  const ctrlBtn = compact ? "p-2" : "p-3";
  const ctrlIcon = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={cn("flex flex-col bg-black/95", compact ? "relative h-full rounded-lg overflow-hidden" : "fixed inset-0 z-50")}>
      {!minimized && (
        <>
          {/* Header */}
          <div className={cn("flex items-center justify-between bg-black/40 border-b border-white/10 shrink-0", compact ? "px-3 py-2" : "px-4 py-3")}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {state === "connected" ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : state === "failed" ? (
              <WifiOff className="h-4 w-4 text-rose-500" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            )}
            <span className={`app-body font-medium ${stateColor[state]}`}>
              {stateLabel[state]}
            </span>
          </div>
          {!peerJoined && state !== "failed" && (
            <span className="app-body text-white/60">
              Esperando a que el {role === "inspector" ? "cliente" : "inspector"} se conecte...
            </span>
          )}
          {recording && (
            <span className="flex items-center gap-1.5 app-body font-medium text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              REC {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {screenshotCount > 0 && (
            <span className="app-body text-white/60 flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {screenshotCount} {screenshotCount === 1 ? "foto" : "fotos"}
            </span>
          )}
          {/* Panel de peers conectados (solo inspector) */}
          {role === "inspector" && clientPeers.length > 0 && (
            <div className="relative">
              <Tooltip>
                <TooltipTrigger className="inline-flex">
                  <button
                    type="button"
                    onClick={() => setShowPeersPanel((v) => !v)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors app-body"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                    {clientPeers.length} {clientPeers.length === 1 ? "conectado" : "conectados"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Ver conexiones activas</p>
                </TooltipContent>
              </Tooltip>
              {showPeersPanel && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-zinc-900 border border-white/15 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10 bg-white/5">
                    <p className="app-body font-medium text-white/90">Conexiones activas</p>
                    <p className="app-body text-white/40 text-xs mt-0.5">
                      {clientPeers.length} {clientPeers.length === 1 ? "asegurado conectado" : "asegurados conectados"} a este magic link
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {clientPeers.map((p) => (
                      <div key={p.userId} className="flex items-center justify-between px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="app-body text-white/70 truncate">
                            {p.userId === connectedClientId ? "Asegurado en sesión" : "Conexión adicional"}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger className="inline-flex">
                            <button
                              type="button"
                              onClick={() => {
                                kickPeer(p.userId, "El inspector ha finalizado tu conexión a la videollamada.");
                              }}
                              className="shrink-0 px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white app-body text-xs transition-colors"
                            >
                              Desconectar
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Desconectar a este usuario</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {expanded && (
            <Tooltip>
              <TooltipTrigger className="inline-flex">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Volver a ventana pequeña</p>
              </TooltipContent>
            </Tooltip>
          )}
          <span className="app-body text-white/40 hidden sm:inline">
            {role === "inspector" ? "Inspector" : "Cliente"}
          </span>
        </div>
      </div>
        </>
      )}

      {/* Cuerpo: video remoto + local en PiP */}
      <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center">
        {/* Video remoto (grande) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn("w-full h-full", minimized ? "object-cover" : "object-contain")}
        />
        {/* P1 Safari: overlay si autoplay fue bloqueado */}
        {needsPlaybackGesture && (
          <button
            type="button"
            onClick={() => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.play().then(() => {
                  setNeedsPlaybackGesture(false);
                }).catch(() => {
                  // seguir intentando
                });
              }
            }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10"
          >
            <Video className="h-12 w-12 mb-3 text-emerald-400" />
            <p className="app-body font-medium">Toca para escuchar y ver la llamada</p>
            <p className="app-body text-white/50 mt-1">Tu navegador bloqueó la reproducción automática</p>
          </button>
        )}
        {!minimized && !peerJoined && state !== "failed" && state !== "rejected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
            <Video className="h-12 w-12 mb-3 opacity-50" />
            <p className="app-body">
              {state === "connecting" ? "Esperando al otro participante..." : "Listo para conectar"}
            </p>
          </div>
        )}
        {!minimized && state === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
            <AlertTriangle className="h-12 w-12 mb-3 text-rose-500" />
            <p className="app-body font-medium">No se pudo establecer la conexión</p>
            <p className="app-body text-white/50 mt-1">{error}</p>
          </div>
        )}
        {!minimized && state === "rejected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 px-6 text-center">
            <AlertTriangle className="h-12 w-12 mb-3 text-amber-500" />
            <p className="app-body font-medium text-amber-400">Videollamada no disponible</p>
            <p className="app-body text-white/60 mt-2 max-w-sm">
              {rejectedReason || "Ya existe una sesión de videollamada en curso."}
            </p>
            <p className="app-body text-white/40 mt-3">
              Puede continuar revisando las evidencias y firmas de la inspección en las demás pestañas.
            </p>
          </div>
        )}
        {!minimized && state === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 px-6 text-center">
            <WifiOff className="h-12 w-12 mb-3 text-amber-500" />
            <p className="app-body font-medium">El inspector desconectó la videollamada</p>
            <p className="app-body text-white/50 mt-1">
              Esperando a que el inspector vuelva a conectar.
            </p>
          </div>
        )}

        {/* Video local (PiP) — oculto cuando la sesión fue rechazada o minimizado */}
        {!minimized && state !== "rejected" && (
        <div className={cn("absolute overflow-hidden bg-black", minimized ? "bottom-1 right-1 w-8 h-6 rounded border border-white/20" : compact ? "bottom-2 right-2 w-20 h-14 rounded border border-white/20" : "bottom-4 right-4 w-32 sm:w-48 h-24 sm:h-36 rounded-lg border-2 border-white/20 shadow-2xl")}>
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
          {!minimized && (
            <div className="absolute bottom-1 left-1 app-body text-white/80 bg-black/60 rounded px-1 py-0.5">
              Tú
            </div>
          )}
        </div>
        )}

        {/* Botón ampliar (solo visible cuando NO está expandido) */}
        {!minimized && peerJoined && !expanded && (
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={goFullscreen}
                className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Ampliar</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Notificación de screenshot — auto-dismiss a los 3s, sin botones */}
      {!minimized && lastScreenshot && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-zinc-900/95 rounded-xl shadow-2xl flex items-center gap-3 p-2 max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lastScreenshot.url}
            alt="Foto capturada"
            className="w-16 h-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="app-body font-medium truncate">Foto capturada</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{lastScreenshot.description}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!minimized && error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 max-w-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="app-body">{error}</span>
        </div>
      )}

      {!minimized && (
        <>
          {/* Controles inferiores */}
          <div className={cn("flex items-center justify-center bg-black/40 border-t border-white/10 shrink-0", compact ? "gap-2 px-2 py-2" : "gap-3 px-4 py-4")}>
        {state !== "rejected" && (
        <>
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button
              type="button"
              onClick={toggleAudio}
              className={`${ctrlBtn} rounded-full transition-colors ${
                audioOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {audioOn ? <Mic className={ctrlIcon} /> : <MicOff className={ctrlIcon} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{audioOn ? "Silenciar micrófono" : "Activar micrófono"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button
              type="button"
              onClick={toggleVideo}
              className={`${ctrlBtn} rounded-full transition-colors ${
                videoOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {videoOn ? <Video className={ctrlIcon} /> : <VideoOff className={ctrlIcon} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{videoOn ? "Apagar cámara" : "Encender cámara"}</p>
          </TooltipContent>
        </Tooltip>

        {videoOn && (
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={switchCamera}
                className={`${ctrlBtn} rounded-full transition-colors bg-white/10 hover:bg-white/20 text-white`}
              >
                <SwitchCamera className={ctrlIcon} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{facingMode === "user" ? "Cambiar a cámara trasera" : "Cambiar a cámara frontal"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {role === "inspector" && (
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={captureScreenshot}
                disabled={screenshotting}
                className={`${ctrlBtn} rounded-full bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {screenshotting ? (
                  <Loader2 className={cn(ctrlIcon, "animate-spin")} />
                ) : (
                  <Camera className={ctrlIcon} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{peerJoined ? "Capturar foto del video en vivo" : "Esperando video del asegurado..."}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {role === "inspector" && (
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={!hasLocalMedia && !recording}
                className={`${ctrlBtn} rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  recording ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {recording ? <Square className={ctrlIcon} /> : <Circle className={cn(ctrlIcon, "fill-white")} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{recording ? "Detener grabación" : peerJoined ? "Grabar video en vivo" : "Grabar cámara local"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {role === "inspector" && peerJoined && (
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                onClick={() => {
                  channelRef.current?.send({ type: "switch_camera", from: userId, role });
                  logWebrtcEvent("camera_switch_remote", { targetRole: "client" });
                }}
                className={`${ctrlBtn} rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors`}
              >
                <Repeat className={ctrlIcon} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Voltear cámara del asegurado</p>
            </TooltipContent>
          </Tooltip>
        )}
        </>
        )}

        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <button
              type="button"
              onClick={handleHangup}
              className={`${ctrlBtn} rounded-full bg-rose-600 hover:bg-rose-700 text-white transition-colors`}
            >
              <PhoneOff className={ctrlIcon} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Colgar</p>
          </TooltipContent>
        </Tooltip>
      </div>
        </>
      )}

      {/* Hint de captura */}
      {!compact && peerJoined && role === "inspector" && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/40 app-body flex items-center gap-1 pointer-events-none">
          <ImageIcon className="h-3 w-3" />
          Toca la cámara para capturar fotos del video en vivo
        </div>
      )}
    </div>
  );
}
