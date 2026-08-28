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
import { joinSignalingChannel, fetchIceServers, type SignalingRole, type SignalingMessage } from "@/lib/webrtc/signaling";
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
 * Captura un thumbnail JPEG base64 de un elemento <video>.
 * Retorna string vac├¡o si el video no tiene frames disponibles.
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
    return canvas.toDataURL("image/jpeg", 0.5);
  } catch {
    return "";
  }
}

/** Devuelve un mensaje ├║til seg├║n el error de getUserMedia y el dispositivo. */
function getMediaErrorMessage(err: unknown): string {
  const domErr = err instanceof DOMException ? err : null;
  const raw = err instanceof Error ? err.message : "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (domErr?.name === "NotAllowedError" || domErr?.name === "SecurityError" || raw.toLowerCase().includes("permission")) {
    if (isIOS) return "Permiso denegado. En iPhone: Ajustes > Safari > C├ímara/Micr├│fono > Permitir.";
    if (isAndroid) return "Permiso denegado. En Android: Configuraci├│n del navegador > Permisos > C├ímara y micr├│fono > Permitir.";
    return "Permiso denegado. Habilite c├ímara y micr├│fono en la barra de direcciones o configuraci├│n del navegador.";
  }
  if (domErr?.name === "NotFoundError") return "No se encontr├│ c├ímara o micr├│fono. Conecte uno o use subir fotos.";
  if (domErr?.name === "NotReadableError" || raw.toLowerCase().includes("could not start")) {
    return "La c├ímara o el micr├│fono est├ín en uso por otra app. Cierre otras pesta├▒as/programas y vuelva a intentar.";
  }
  return raw || "No se pudo acceder a la c├ímara/micr├│fono.";
}

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
  // El inspector trackea al cliente que ya est├í conectado para rechazar a un segundo
  const connectedClientRef = React.useRef<string | null>(null);
  // Peers ya rechazados (para no notificar al inspector m├ís de una vez por el mismo peer)
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
  const peerJoinedNotifiedRef = React.useRef(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Backoff para ICE restart: contador de restarts consecutivos y timer
  const iceRestartCountRef = React.useRef<number>(0);
  const iceRestartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ping/keepalive: trackear último pong recibido
  const lastPongRef = React.useRef<number>(0);
  const pingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs estables para callbacks que se usan en suscripciones de larga duraci├│n
  const onPeersUpdateRef = React.useRef(onPeersUpdate);
  React.useEffect(() => {
    onPeersUpdateRef.current = onPeersUpdate;
  }, [onPeersUpdate]);

  // Ordenamos siempre audio primero, video despu├®s, para mantener m-lines consistentes
  const getOrderedLocalTracks = () => {
    const s = localStreamRef.current;
    return s ? [...s.getAudioTracks(), ...s.getVideoTracks()] : [];
  };

  // ÔöÇÔöÇ Inicializar media local ÔöÇÔöÇ
  const initLocalMedia = React.useCallback(async () => {
    // Estrategia: intentar video+audio primero. Si la c├ímara falla (ej: en uso
    // por otro navegador), hacer fallback a solo audio para no bloquear la c├ímara
    // del asegurado si est├ín en el mismo equipo.
    let stream: MediaStream;
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

      // Fallback a audio solo ÔÇö no pedir video para no bloquear la c├ímara
      // del asegurado si est├ín en el mismo equipo
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        microphonePerm = "granted";
        if (cameraPerm !== "denied") cameraPerm = "error";
      } catch {
        // Entrar sin media local para que el peer se conecte igual
        stream = new MediaStream();
      }
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    setHasLocalMedia(stream.getTracks().length > 0);

    onMediaPermission?.({
      camera: cameraPerm,
      microphone: microphonePerm,
    });

    if (userMessage && stream.getTracks().length === 0) {
      setError(userMessage);
    }

    return stream;
  }, [onMediaPermission, role]);

  // ÔöÇÔöÇ Crear peer connection ÔöÇÔöÇ
  const createPeerConnection = React.useCallback(async () => {
    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all",     // permitir relay (TURN) cuando sea necesario
      bundlePolicy: "max-bundle",    // multiplexar audio+video en un solo par ICE
      iceCandidatePoolSize: 10,      // pre-gather candidates para acelerar conexión
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
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && channelRef.current) {
        channelRef.current.send({ type: "ice", from: userId, role, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        setState("connected");
        setError(null);
      } else if (s === "connecting") {
        setState("connecting");
      } else if (s === "disconnected") {
        // No cambiar a "disconnected" inmediatamente si el video remoto sigue reproduci├®ndose.
        // WebRTC puede reportar "disconnected" temporalmente durante renegotiaci├│n o
        // cambios de red, aunque el media siga fluyendo.
        const remoteVideo = remoteVideoRef.current;
        const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
        if (!hasRemoteFrame) {
          setState("disconnected");
        }
      } else if (s === "failed") {
        // No mostrar "failed" inmediatamente. ICE restart ya se dispara en
        // oniceconnectionstatechange. Dar un grace period de 5s para que
        // ICE restart recupere la conexi├│n. Si despu├®s de 5s sigue failed
        // y no hay video remoto, reci├®n ah├¡ mostrar el error.
        const remoteVideo = remoteVideoRef.current;
        const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
        if (hasRemoteFrame) {
          // El video remoto sigue reproduci├®ndose ÔÇö no es un fallo real
          console.warn("[LiveVideoCall] connectionState=failed pero video remoto activo ÔÇö ignorando");
          return;
        }
        setState("connecting");
        setTimeout(() => {
          const pc2 = pcRef.current;
          const rv = remoteVideoRef.current;
          const hasFrame = rv && rv.readyState >= 2 && rv.videoWidth > 0;
          if (pc2 && pc2.connectionState === "failed" && !hasFrame) {
            setState("failed");
            setError("Conexi├│n fallida. Verifica tu conexi├│n a internet.");
          }
        }, 5000);
      } else if (s === "closed") {
        setState("disconnected");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        // Backoff exponencial: 2s, 4s, 8s, 16s — máximo 3 restarts
        const restartCount = iceRestartCountRef.current;
        if (restartCount >= 3) {
          console.error("[LiveVideoCall] ICE restart falló 3 veces consecutivas — conexión inestable");
          setState("failed");
          setError("Conexión inestable. Verifica tu conexión a internet e intenta nuevamente.");
          return;
        }
        const delay = Math.min(2000 * Math.pow(2, restartCount), 16000);
        console.warn(`[LiveVideoCall] ICE failed — restart en ${delay}ms (intento ${restartCount + 1}/3)`);
        iceRestartCountRef.current = restartCount + 1;
        // Limpiar timer anterior si existe
        if (iceRestartTimerRef.current) clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.iceConnectionState === "failed") {
            pcRef.current.restartIce();
          }
        }, delay);
      } else if (pc.iceConnectionState === "connected") {
        // ICE se recuper├│ ÔÇö resetear contador de restarts y limpiar estado de error
        iceRestartCountRef.current = 0;
        if (iceRestartTimerRef.current) {
          clearTimeout(iceRestartTimerRef.current);
          iceRestartTimerRef.current = null;
        }
        setState("connected");
        setError(null);
      }
    };

    // Negotiation needed ÔÇö perfect negotiation pattern
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

  // ÔöÇÔöÇ Manejar mensaje de signaling ÔöÇÔöÇ
  const handleSignalingMessage = React.useCallback(
    async (msg: SignalingMessage) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        // Kick: el inspector fuerza la desconexi├│n de este peer
        if (msg.type === "kick") {
          if (msg.target === userId) {
            // Avisar al inspector que nos desconectamos, para que libere
            // connectedClientRef y pueda aceptar a un nuevo cliente.
            if (!hangupSentRef.current && channelRef.current) {
              channelRef.current.send({ type: "hangup", from: userId, role });
              hangupSentRef.current = true;
            }
            setRejectedReason(msg.reason);
            setState("rejected");
            // Liberar c├ímara/micr├│fono local
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((t) => t.stop());
              localStreamRef.current = null;
            }
            // Notificar al padre para que cierre el modal
            onKicked?.(msg.reason);
          }
          return;
        }

        // Rechazo: el inspector nos avisa que ya hay una sesi├│n en curso
        if (msg.type === "busy") {
          if (role === "client") {
            setRejectedReason(msg.reason);
            setState("rejected");
            // Liberar c├ímara/micr├│fono local
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((t) => t.stop());
              localStreamRef.current = null;
            }
          }
          return;
        }

        if (msg.type === "ready") {
          // El supervisor no afecta el estado de peer joined ni dispara notificaciones
          if (msg.role === "supervisor") return;
          // Inspector: rechazar a un segundo cliente si ya hay uno conectado
          if (role === "inspector" && msg.role === "client") {
            if (connectedClientRef.current && connectedClientRef.current !== msg.from) {
              channelRef.current?.send({
                type: "busy",
                from: userId,
                role,
                reason: "Ya existe una sesi├│n de videollamada en curso. Espere a que finalice la inspecci├│n en curso.",
              });
              if (!rejectedPeersRef.current.has(msg.from)) {
                rejectedPeersRef.current.add(msg.from);
                onPeerRejected?.();
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
          }
          // El inspector (impolite) inicia la oferta cuando el cliente se une
          if (role === "inspector" && localStreamRef.current) {
            // Forzar renegotiaci├│n agregando tracks si no est├ín (audio ÔåÆ video)
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
                reason: "Ya existe una sesi├│n de videollamada en curso. Espere a que finalice la inspecci├│n en curso.",
              });
              if (!rejectedPeersRef.current.has(msg.from)) {
                rejectedPeersRef.current.add(msg.from);
                onPeerRejected?.();
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
              // Algunos ICE del buffer ya no aplican tras la negociaci├│n; se ignoran
            }
          }
          // Asegurar que nuestros tracks est├®n agregados en orden audio ÔåÆ video
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
              // Algunos ICE del buffer ya no aplican tras la negociaci├│n; se ignoran
            }
          }
        } else if (msg.type === "ice") {
          // Ignorar ICE candidates de un cliente que no es el conectado (inspector)
          if (role === "inspector" && msg.role === "client" && connectedClientRef.current && connectedClientRef.current !== msg.from) {
            return;
          }

          if (!pc.remoteDescription) {
            // Lleg├│ ICE antes de la oferta/answer remota; lo almacenamos
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
            } else {
              // Hangup de un cliente que no es el conectado ÔÇö ignorar
              return;
            }
          }
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
        } else if (msg.type === "ping") {
          // Responder pong para que el otro par sepa que estamos vivos
          channelRef.current?.send({ type: "pong", from: userId, role });
        } else if (msg.type === "pong") {
          // Actualizar último pong recibido
          lastPongRef.current = Date.now();
        } else if (msg.type === "screenshot") {
          // El otro par captur├│ una foto ÔÇö refrescar para mostrarla en tiempo real
          if (msg.from !== userId) onScreenshotSaved?.();
        }
      } catch (err) {
        console.error("[LiveVideoCall] Error procesando signaling:", msg.type, err);
      }
    },
    [role, userId, onPeerJoined, onPeerRejected, onKicked, onScreenshotSaved],
  );

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

  // ÔöÇÔöÇ Monitoreo WebRTC: getStats() cada 10s + degradación adaptativa ÔöÇÔöÇ
  // Refs para degradación adaptativa: trackear el bitrate actual y tiempo de buena conexión
  const currentBitrateRef = React.useRef<number>(0);
  const goodConnectionSinceRef = React.useRef<number>(0);
  // Contador para enviar stats a Supabase cada 30s (cada 3 iteraciones)
  const statsUploadCounterRef = React.useRef<number>(0);

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

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            if (report.bitrate) outboundBitrate = Math.round(report.bitrate / 1024);
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            if (report.bitrate) inboundBitrate = Math.round(report.bitrate / 1024);
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
            jitter = report.jitter || 0;
          }
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime) {
            rtt = Math.round(report.currentRoundTripTime * 1000);
          }
          if (report.type === "local-candidate" && report.candidateType) {
            iceCandidateType = report.candidateType;
          }
        });

        const lossPct = packetsReceived > 0 ? Math.round((packetsLost / (packetsLost + packetsReceived)) * 100) : 0;
        const jitterMs = Math.round(jitter * 1000);
        console.log(
          `[WebRTC Stats] out=${outboundBitrate}kb/s in=${inboundBitrate}kb/s loss=${lossPct}% jitter=${jitterMs}ms rtt=${rtt}ms ice=${iceCandidateType}`
        );

        // ── Enviar stats a Supabase cada 30s (cada 3 iteraciones) ──
        statsUploadCounterRef.current++;
        if (statsUploadCounterRef.current >= 3) {
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
              packetLossPct: lossPct,
              jitterMs,
              rttMs: rtt,
              iceCandidateType,
              connectionState: pc.connectionState,
            }),
          }).catch(() => {
            // Silencioso — no interrumpir la llamada por error de telemetría
          });
        }

        // ── Degradación adaptativa de video ──
        // Si la conexión se degrada, reducir bitrate automáticamente.
        // Si la conexión es buena por 30s, subir bitrate gradualmente.
        const baseBitrate = role === "inspector" ? 200_000 : 800_000;
        const minBitrate = 50_000; // mínimo absoluto
        const currentBitrate = currentBitrateRef.current || baseBitrate;

        let newBitrate = currentBitrate;

        if (lossPct > 25 || rtt > 2000) {
          // Degradación severa: bajar al mínimo
          newBitrate = Math.max(minBitrate, Math.round(currentBitrate * 0.3));
          console.warn(`[WebRTC Adapt] Degradación severa (loss=${lossPct}% rtt=${rtt}ms) → ${newBitrate}bps`);
          goodConnectionSinceRef.current = 0;
        } else if (lossPct > 10 || rtt > 1000) {
          // Degradación moderada: bajar 50%
          newBitrate = Math.max(minBitrate, Math.round(currentBitrate * 0.5));
          console.warn(`[WebRTC Adapt] Degradación moderada (loss=${lossPct}% rtt=${rtt}ms) → ${newBitrate}bps`);
          goodConnectionSinceRef.current = 0;
        } else if (lossPct < 5 && rtt < 500) {
          // Conexión buena — si dura 30s, subir bitrate gradualmente
          if (goodConnectionSinceRef.current === 0) {
            goodConnectionSinceRef.current = Date.now();
          } else if (Date.now() - goodConnectionSinceRef.current > 30_000) {
            if (currentBitrate < baseBitrate) {
              newBitrate = Math.min(baseBitrate, Math.round(currentBitrate * 1.3));
              console.log(`[WebRTC Adapt] Recuperando bitrate → ${newBitrate}bps`);
              goodConnectionSinceRef.current = Date.now(); // reset para próxima subida
            }
          }
        } else {
          // Conexión regular — no cambiar
          goodConnectionSinceRef.current = 0;
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
    }, 10_000);

    return () => clearInterval(interval);
  }, [role, sessionId, userId]);

  // ÔöÇÔöÇ Inicializar todo al montar ÔöÇÔöÇ
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setState("connecting");
      const stream = await initLocalMedia();
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Si no hay c├ímara/micr├│fono, igual nos unimos al canal de signaling
      // para que ambos lados se vean conectados en el chat/peers, pero no
      // creamos una conexi├│n WebRTC que falle por SDP sin media.
      if (stream.getTracks().length > 0) {
        const pc = await createPeerConnection();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // Agregar tracks locales al peer connection en orden audio ÔåÆ video
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
      });

      // Ping/keepalive: enviar ping cada 15s, si no hay pong en 30s, mostrar "Reconectando..."
      lastPongRef.current = Date.now();
      pingIntervalRef.current = setInterval(() => {
        if (channelRef.current) {
          channelRef.current.send({ type: "ping", from: userId, role });
          // Verificar si el peer responde
          if (Date.now() - lastPongRef.current > 30_000) {
            console.warn("[LiveVideoCall] Sin pong del peer en 30s — canal signaling posiblemente caído");
            setState("disconnected");
          } else if (pcRef.current?.connectionState === "connected") {
            setState("connected");
          }
        }
      }, 15_000);
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
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (iceRestartTimerRef.current) {
        clearTimeout(iceRestartTimerRef.current);
        iceRestartTimerRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, role]);

  // ÔöÇÔöÇ Toggle video ÔöÇÔöÇ
  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoOn(videoTrack.enabled);
    } else {
      // No hay video track (c├ímara no disponible) ÔÇö liberar el stream actual
      // y volver a pedir video+audio
      stream.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setVideoOn(false);
      // Re-intentar obtener c├ímara
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
        setError("No se pudo acceder a la c├ímara. Puede estar en uso por otra aplicaci├│n.");
      });
    }
  };

  // ÔöÇÔöÇ Toggle audio ÔöÇÔöÇ
  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioOn(audioTrack.enabled);
    }
  };

  // ÔöÇÔöÇ Cambiar c├ímara (frontal/trasera) ÔöÇÔöÇ
  const switchCamera = React.useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      setError("No hay c├ímara activa para cambiar.");
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
    } catch {
      setError("No se pudo cambiar la c├ímara. El dispositivo puede no tener otra c├ímara disponible.");
    }
  }, []);

  // ÔöÇÔöÇ Colgar ÔöÇÔöÇ
  const handleHangup = () => {
    if (channelRef.current && !hangupSentRef.current) {
      channelRef.current.send({ type: "hangup", from: userId, role });
      hangupSentRef.current = true;
    }
    onHangup();
  };

  // ÔöÇÔöÇ Forzar desconexi├│n de un peer (solo inspector) ÔöÇÔöÇ
  const kickPeer = (targetUserId: string, reason?: string) => {
    if (role !== "inspector" || !channelRef.current) return;
    channelRef.current.send({
      type: "kick",
      from: userId,
      role,
      target: targetUserId,
      reason: reason || "El inspector ha finalizado tu conexi├│n a la videollamada.",
    });
    // Limpiar el cliente conectado si era el kickeado — sin esto,
    // el inspector rechaza a todos los clientes nuevos con "busy"
    // porque connectedClientRef queda apuntando al cliente expulsado.
    if (connectedClientRef.current === targetUserId) {
      connectedClientRef.current = null;
      setConnectedClientId(null);
    }
  };

  // ÔöÇÔöÇ Capturar screenshot del video remoto ÔöÇÔöÇ
  const captureScreenshot = async () => {
    // Priorizar video remoto (lo que muestra el asegurado), pero si no est├í
    // disponible (ej: WebRTC a├║n conectando), usar video local como fallback
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

  // ÔöÇÔöÇ Grabaci├│n de sesi├│n (solo inspector) ÔöÇÔöÇ
  const startRecording = () => {
    // Grabar video remoto (asegurado) si est├í disponible, sino video local (inspector)
    const sourceStream = remoteStreamRef.current?.getTracks().length
      ? remoteStreamRef.current
      : localStreamRef.current;
    if (!sourceStream || sourceStream.getTracks().length === 0) {
      setError("No hay c├ímara disponible para grabar.");
      return;
    }
    recordedChunksRef.current = [];
    const combined = new MediaStream();
    sourceStream.getTracks().forEach((track) => combined.addTrack(track));
    // Agregar audio local del inspector si no est├í ya incluido
    if (localStreamRef.current && sourceStream !== localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => combined.addTrack(track));
    }
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", ""].find((t) =>
      t ? MediaRecorder.isTypeSupported(t) : true,
    );
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
      setError(err instanceof Error ? err.message : "Error al detener grabaci├│n");
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
      setError(err instanceof Error ? err.message : "Error al subir grabaci├│n");
    } finally {
      mediaRecorderRef.current = null;
    }
  };

  // ÔöÇÔöÇ Pantalla completa / ampliar video remoto ÔöÇÔöÇ
  const goFullscreen = async () => {
    setExpanded(true);
  };

  const stateLabel: Record<ConnectionState, string> = {
    idle: "Iniciando...",
    connecting: "Conectando...",
    connected: "Conectado",
    disconnected: "Desconectado",
    failed: "Fallido",
    rejected: "Sesi├│n en uso",
  };

  const stateColor: Record<ConnectionState, string> = {
    idle: "text-muted-foreground",
    connecting: "text-amber-600",
    connected: "text-emerald-600",
    disconnected: "text-muted-foreground",
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

  // ÔöÇÔöÇ Broadcast de thumbnails al supervisor ÔöÇÔöÇ
  // Cuando el inspector detecta un supervisor, captura thumbnails del video
  // remoto (asegurado) y local (inspector) cada 3 segundos y los env├¡a via signaling.
  // Incluye estado de c├ímara/micr├│fono y conexi├│n para que el supervisor sepa
  // si el inspector est├í conectado aunque los thumbnails est├®n vac├¡os.
  React.useEffect(() => {
    if (role !== "inspector") return;

    if (hasSupervisor && !previewIntervalRef.current) {
      const captureAndSend = () => {
        const remoteVideo = remoteVideoRef.current;
        const localVideo = localVideoRef.current;
        const remoteThumb = captureVideoThumb(remoteVideo, 320, 180);
        const localThumb = captureVideoThumb(localVideo, 160, 90);
        // Siempre enviar cuando hay supervisor, incluso si los thumbnails est├ín vac├¡os.
        // El supervisor necesita saber que el inspector est├í activo aunque no haya video.
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
      previewIntervalRef.current = setInterval(captureAndSend, 3000);
      captureAndSend(); // enviar inmediatamente
    } else if (!hasSupervisor && previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }

    return () => {
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
        previewIntervalRef.current = null;
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
                            {p.userId === connectedClientId ? "Asegurado en sesi├│n" : "Conexi├│n adicional"}
                          </span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger className="inline-flex">
                            <button
                              type="button"
                              onClick={() => {
                                kickPeer(p.userId, "El inspector ha finalizado tu conexi├│n a la videollamada.");
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
                <p>Volver a ventana peque├▒a</p>
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
            <p className="app-body font-medium">No se pudo establecer la conexi├│n</p>
            <p className="app-body text-white/50 mt-1">{error}</p>
          </div>
        )}
        {!minimized && state === "rejected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 px-6 text-center">
            <AlertTriangle className="h-12 w-12 mb-3 text-amber-500" />
            <p className="app-body font-medium text-amber-400">Videollamada no disponible</p>
            <p className="app-body text-white/60 mt-2 max-w-sm">
              {rejectedReason || "Ya existe una sesi├│n de videollamada en curso."}
            </p>
            <p className="app-body text-white/40 mt-3">
              Puede continuar revisando las evidencias y firmas de la inspecci├│n en las dem├ís pesta├▒as.
            </p>
          </div>
        )}
        {!minimized && state === "disconnected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 px-6 text-center">
            <WifiOff className="h-12 w-12 mb-3 text-amber-500" />
            <p className="app-body font-medium">El inspector desconect├│ la videollamada</p>
            <p className="app-body text-white/50 mt-1">
              Esperando a que el inspector vuelva a conectar.
            </p>
          </div>
        )}

        {/* Video local (PiP) ÔÇö oculto cuando la sesi├│n fue rechazada o minimizado */}
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
              T├║
            </div>
          )}
        </div>
        )}

        {/* Bot├│n ampliar (solo visible cuando NO est├í expandido) */}
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

      {/* Notificaci├│n de screenshot ÔÇö auto-dismiss a los 3s, sin botones */}
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
            <p>{audioOn ? "Silenciar micr├│fono" : "Activar micr├│fono"}</p>
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
            <p>{videoOn ? "Apagar c├ímara" : "Encender c├ímara"}</p>
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
              <p>{facingMode === "user" ? "Cambiar a c├ímara trasera" : "Cambiar a c├ímara frontal"}</p>
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
              <p>{recording ? "Detener grabaci├│n" : peerJoined ? "Grabar video en vivo" : "Grabar c├ímara local"}</p>
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
          Toca la c├ímara para capturar fotos del video en vivo
        </div>
      )}
    </div>
  );
}
