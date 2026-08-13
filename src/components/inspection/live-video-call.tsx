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
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Circle,
  Square,
  UserCheck,
  Trash2,
  X,
} from "lucide-react";
import { joinSignalingChannel, ICE_SERVERS, type SignalingRole, type SignalingMessage } from "@/lib/webrtc/signaling";
import { cn } from "@/lib/utils";

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
    return canvas.toDataURL("image/jpeg", 0.5);
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
    if (isIOS) return "Permiso denegado. En iPhone: Ajustes > Safari > Cámara/Micrófono > Permitir.";
    if (isAndroid) return "Permiso denegado. En Android: Configuración del navegador > Permisos > Cámara y micrófono > Permitir.";
    return "Permiso denegado. Habilite cámara y micrófono en la barra de direcciones o configuración del navegador.";
  }
  if (domErr?.name === "NotFoundError") return "No se encontró cámara o micrófono. Conecte uno o use subir fotos.";
  if (domErr?.name === "NotReadableError" || raw.toLowerCase().includes("could not start")) {
    return "La cámara o el micrófono están en uso por otra app. Cierre otras pestañas/programas y vuelva a intentar.";
  }
  return raw || "No se pudo acceder a la cámara/micrófono.";
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
  // El inspector trackea al cliente que ya está conectado para rechazar a un segundo
  const connectedClientRef = React.useRef<string | null>(null);
  // Peers ya rechazados (para no notificar al inspector más de una vez por el mismo peer)
  const rejectedPeersRef = React.useRef<Set<string>>(new Set());

  const [state, setState] = React.useState<ConnectionState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [rejectedReason, setRejectedReason] = React.useState<string | null>(null);
  const [videoOn, setVideoOn] = React.useState(true);
  const [audioOn, setAudioOn] = React.useState(true);
  const [peerJoined, setPeerJoined] = React.useState(false);
  const [screenshotting, setScreenshotting] = React.useState(false);
  const [lastScreenshot, setLastScreenshot] = React.useState<SavedEvidence | null>(null);
  const [screenshotCount, setScreenshotCount] = React.useState(0);
  const [deletingScreenshot, setDeletingScreenshot] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [peers, setPeers] = React.useState<ConnectedPeer[]>([]);
  const [connectedClientId, setConnectedClientId] = React.useState<string | null>(null);
  const peerJoinedNotifiedRef = React.useRef(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs estables para callbacks que se usan en suscripciones de larga duración
  const onPeersUpdateRef = React.useRef(onPeersUpdate);
  React.useEffect(() => {
    onPeersUpdateRef.current = onPeersUpdate;
  }, [onPeersUpdate]);

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
    let stream: MediaStream;
    let cameraPerm: "granted" | "denied" | "error" = "error";
    let microphonePerm: "granted" | "denied" | "error" = "error";
    let userMessage: string | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
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

      // Fallback a audio solo — no pedir video para no bloquear la cámara
      // del asegurado si están en el mismo equipo
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

    onMediaPermission?.({
      camera: cameraPerm,
      microphone: microphonePerm,
    });

    if (userMessage && stream.getTracks().length === 0) {
      setError(userMessage);
    }

    return stream;
  }, [onMediaPermission]);

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
      if (s === "connected") {
        setState("connected");
        setError(null);
      } else if (s === "connecting") {
        setState("connecting");
      } else if (s === "disconnected") {
        // No cambiar a "disconnected" inmediatamente si el video remoto sigue reproduciéndose.
        // WebRTC puede reportar "disconnected" temporalmente durante renegotiación o
        // cambios de red, aunque el media siga fluyendo.
        const remoteVideo = remoteVideoRef.current;
        const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
        if (!hasRemoteFrame) {
          setState("disconnected");
        }
      } else if (s === "failed") {
        // No mostrar "failed" inmediatamente. ICE restart ya se dispara en
        // oniceconnectionstatechange. Dar un grace period de 5s para que
        // ICE restart recupere la conexión. Si después de 5s sigue failed
        // y no hay video remoto, recién ahí mostrar el error.
        const remoteVideo = remoteVideoRef.current;
        const hasRemoteFrame = remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0;
        if (hasRemoteFrame) {
          // El video remoto sigue reproduciéndose — no es un fallo real
          console.warn("[LiveVideoCall] connectionState=failed pero video remoto activo — ignorando");
          return;
        }
        setState("connecting");
        setTimeout(() => {
          const pc2 = pcRef.current;
          const rv = remoteVideoRef.current;
          const hasFrame = rv && rv.readyState >= 2 && rv.videoWidth > 0;
          if (pc2 && pc2.connectionState === "failed" && !hasFrame) {
            setState("failed");
            setError("Conexión fallida. Verifica tu conexión a internet.");
          }
        }, 5000);
      } else if (s === "closed") {
        setState("disconnected");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      } else if (pc.iceConnectionState === "connected") {
        // ICE se recuperó — limpiar estado de error
        setState("connected");
        setError(null);
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
        // Kick: el inspector fuerza la desconexión de este peer
        if (msg.type === "kick") {
          if (msg.target === userId) {
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
        } else if (msg.type === "hangup") {
          // Inspector: si cuelga el cliente conectado, liberar el slot
          if (role === "inspector" && msg.role === "client") {
            if (connectedClientRef.current === msg.from) {
              connectedClientRef.current = null;
              setConnectedClientId(null);
            } else {
              // Hangup de un cliente que no es el conectado — ignorar
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
        } else if (msg.type === "screenshot") {
          // El otro par capturó una foto — refrescar para mostrarla en tiempo real
          if (msg.from !== userId) onScreenshotSaved?.();
        }
      } catch (err) {
        console.error("[LiveVideoCall] Error procesando signaling:", msg.type, err);
      }
    },
    [role, userId, onPeerJoined, onPeerRejected, onKicked, onScreenshotSaved],
  );

  // ── Inicializar todo al montar ──
  React.useEffect(() => {
    let cancelled = false;

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
        const pc = createPeerConnection();
        // Agregar tracks locales al peer connection en orden audio → video
        [...stream.getAudioTracks(), ...stream.getVideoTracks()].forEach((track) => {
          pc.addTrack(track, stream);
        });
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
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
    } else {
      // No hay video track (cámara no disponible) — liberar el stream actual
      // y volver a pedir video+audio
      stream.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setVideoOn(false);
      // Re-intentar obtener cámara
      navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      }).then((newStream) => {
        localStreamRef.current = newStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        setVideoOn(true);
        // Agregar tracks al peer connection existente
        if (pcRef.current) {
          newStream.getVideoTracks().forEach((track) => {
            pcRef.current!.addTrack(track, newStream);
          });
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

  // ── Colgar ──
  const handleHangup = () => {
    if (channelRef.current && !hangupSentRef.current) {
      channelRef.current.send({ type: "hangup", from: userId, role });
      hangupSentRef.current = true;
    }
    onHangup();
  };

  // ── Forzar desconexión de un peer (solo inspector) ──
  const kickPeer = (targetUserId: string, reason?: string) => {
    if (role !== "inspector" || !channelRef.current) return;
    channelRef.current.send({
      type: "kick",
      from: userId,
      role,
      target: targetUserId,
      reason: reason || "El inspector ha finalizado tu conexión a la videollamada.",
    });
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

  // ── Borrar screenshot capturado (lo elimina de evidencias) ──
  const deleteScreenshot = async () => {
    if (!lastScreenshot) return;
    setDeletingScreenshot(true);
    try {
      const res = await fetch(`/api/inspection/evidences/${lastScreenshot.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setScreenshotCount((c) => Math.max(0, c - 1));
      setLastScreenshot(null);
      onScreenshotSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al borrar foto");
    } finally {
      setDeletingScreenshot(false);
    }
  };

  // ── Grabación de sesión (solo inspector) ──
  const startRecording = () => {
    if (!remoteStreamRef.current) return;
    recordedChunksRef.current = [];
    const combined = new MediaStream();
    remoteStreamRef.current.getTracks().forEach((track) => combined.addTrack(track));
    if (localStreamRef.current) {
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
    recorder.onstop = () => {
      void uploadRecording();
    };
    recorder.start(1000);
    setRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecording(false);
  };

  const uploadRecording = async () => {
    const chunks = recordedChunksRef.current;
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
    const ext = blob.type.includes("mp4") ? ".mp4" : ".webm";
    const fileName = `grabacion-sesion-${Date.now()}${ext}`;
    try {
      // 1. Pedir URL presigned para subir directamente a R2
      //    (evita HTTP 413 por límite de body size de Vercel)
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

      // 2. Subir directamente a R2 via XHR (fetch falla con archivos grandes)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", blob.type);
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            // Progreso disponible si se necesita mostrar en UI
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status} (upload to R2)`));
        });
        xhr.addEventListener("error", () => reject(new Error("Error de red al subir a R2")));
        xhr.addEventListener("abort", () => reject(new Error("Subida cancelada")));
        xhr.send(blob);
      });

      // 3. Registrar la evidencia en la BD
      const regRes = await fetch("/api/inspection/evidences/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          url,
          fileCode,
          mimeType: blob.type,
          originalName: fileName,
          source: "live_video",
          fileSize: blob.size,
          userId,
          claimId,
        }),
      });
      if (!regRes.ok) throw new Error(`HTTP ${regRes.status} (register)`);
      const data = await regRes.json();
      if (data.evidence) {
        onRecordingSaved?.({ id: data.evidence.id, url: data.evidence.url, description: data.evidence.description });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir grabación");
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
    disconnected: "Desconectado",
    failed: "Fallido",
    rejected: "Sesión en uso",
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

  // ── Broadcast de thumbnails al supervisor ──
  // Cuando el inspector detecta un supervisor, captura thumbnails del video
  // remoto (asegurado) y local (inspector) cada 3 segundos y los envía via signaling.
  React.useEffect(() => {
    if (role !== "inspector") return;

    if (hasSupervisor && !previewIntervalRef.current) {
      const captureAndSend = () => {
        const remoteVideo = remoteVideoRef.current;
        const localVideo = localVideoRef.current;
        const remoteThumb = captureVideoThumb(remoteVideo, 320, 180);
        const localThumb = captureVideoThumb(localVideo, 160, 90);
        if ((remoteThumb || localThumb) && channelRef.current) {
          channelRef.current.send({
            type: "preview",
            from: userId,
            role,
            remoteThumb: remoteThumb || "",
            localThumb: localThumb || "",
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
              <button
                type="button"
                onClick={() => setShowPeersPanel((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors app-body"
                title="Ver conexiones activas"
              >
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                {clientPeers.length} {clientPeers.length === 1 ? "conectado" : "conectados"}
              </button>
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
                        <button
                          type="button"
                          onClick={() => {
                            kickPeer(p.userId, "El inspector ha finalizado tu conexión a la videollamada.");
                          }}
                          className="shrink-0 px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white app-body text-xs transition-colors"
                          title="Desconectar a este usuario"
                        >
                          Desconectar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
              title="Volver a ventana pequeña"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
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
          <button
            type="button"
            onClick={goFullscreen}
            className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 transition-colors"
            title="Ampliar"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Notificación de screenshot con preview y botón de borrar */}
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
          <button
            type="button"
            onClick={deleteScreenshot}
            disabled={deletingScreenshot}
            className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50"
            title="Borrar esta foto de evidencias"
          >
            {deletingScreenshot ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span className="text-[11px] font-medium">Borrar</span>
          </button>
          <button
            type="button"
            onClick={() => setLastScreenshot(null)}
            className="shrink-0 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            title="Cerrar notificación"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
        <button
          type="button"
          onClick={toggleAudio}
          className={`${ctrlBtn} rounded-full transition-colors ${
            audioOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
          }`}
          title={audioOn ? "Silenciar micrófono" : "Activar micrófono"}
        >
          {audioOn ? <Mic className={ctrlIcon} /> : <MicOff className={ctrlIcon} />}
        </button>

        <button
          type="button"
          onClick={toggleVideo}
          className={`${ctrlBtn} rounded-full transition-colors ${
            videoOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
          }`}
          title={videoOn ? "Apagar cámara" : "Encender cámara"}
        >
          {videoOn ? <Video className={ctrlIcon} /> : <VideoOff className={ctrlIcon} />}
        </button>

        {role === "inspector" && (
          <button
            type="button"
            onClick={captureScreenshot}
            disabled={screenshotting}
            className={`${ctrlBtn} rounded-full bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
            title={peerJoined ? "Capturar foto del video en vivo" : "Esperando video del asegurado..."}
          >
            {screenshotting ? (
              <Loader2 className={cn(ctrlIcon, "animate-spin")} />
            ) : (
              <Camera className={ctrlIcon} />
            )}
          </button>
        )}

        {role === "inspector" && (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!peerJoined}
            className={`${ctrlBtn} rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              recording ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
            }`}
            title={recording ? "Detener grabación" : "Grabar sesión"}
          >
            {recording ? <Square className={ctrlIcon} /> : <Circle className={cn(ctrlIcon, "fill-white")} />}
          </button>
        )}
        </>
        )}

        <button
          type="button"
          onClick={handleHangup}
          className={`${ctrlBtn} rounded-full bg-rose-600 hover:bg-rose-700 text-white transition-colors`}
          title="Colgar"
        >
          <PhoneOff className={ctrlIcon} />
        </button>
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
