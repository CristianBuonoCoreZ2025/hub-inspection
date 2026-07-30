"use client";

import React from "react";
import {
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  UserCheck,
  UserX,
  Eye,
  Clock,
} from "lucide-react";
import {
  joinSignalingChannel,
  type SignalingMessage,
  type SignalingRole,
} from "@/lib/webrtc/signaling";

interface SupervisorLiveViewProps {
  sessionId: string;
  userId: string;
  onLeave: () => void;
}

interface PeerInfo {
  userId: string;
  role: SignalingRole;
}

interface PreviewData {
  remoteThumb: string;
  localThumb: string;
  timestamp: number;
}

/**
 * Vista supervisora de una inspección remota en curso.
 *
 * Se une al canal de signaling como rol "supervisor" — sin cámara/micrófono.
 * Recibe thumbnails periódicos del video del inspector (lo que ve del asegurado
 * + su propia cámara) y los muestra en pantalla.
 *
 * Puede ver todos los peers conectados y forzar la desconexión de cualquiera.
 */
export function SupervisorLiveView({ sessionId, userId, onLeave }: SupervisorLiveViewProps) {
  const channelRef = React.useRef<ReturnType<typeof joinSignalingChannel> | null>(null);
  const [peers, setPeers] = React.useState<PeerInfo[]>([]);
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<number>(0);

  // Unirse al canal de signaling como supervisor
  React.useEffect(() => {
    const channel = joinSignalingChannel(sessionId, userId, "supervisor");
    channelRef.current = channel;

    const unsubMsg = channel.onMessage((msg: SignalingMessage) => {
      if (msg.type === "preview") {
        setPreview({
          remoteThumb: msg.remoteThumb,
          localThumb: msg.localThumb,
          timestamp: Date.now(),
        });
        setLastUpdate(Date.now());
      }
      if (msg.type === "hangup") {
        // Alguien colgó — limpiar preview si era el inspector
        if (msg.role === "inspector") {
          setPreview(null);
        }
      }
    });

    const unsubPresence = channel.onPresence((newPeers) => {
      setPeers(newPeers);
      setConnected(newPeers.some((p) => p.role === "inspector"));
    });

    return () => {
      unsubMsg();
      unsubPresence();
      void channel.leave();
      channelRef.current = null;
    };
  }, [sessionId, userId]);

  // Detectar si el preview está stale (más de 10s sin actualizar)
  const [isStale, setIsStale] = React.useState(false);
  React.useEffect(() => {
    if (!lastUpdate) return;
    const id = setInterval(() => {
      setIsStale(Date.now() - lastUpdate > 10000);
    }, 2000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  const kickPeer = (targetUserId: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "kick",
      from: userId,
      role: "supervisor",
      target: targetUserId,
      reason: "El supervisor ha finalizado tu conexión a la videollamada.",
    });
  };

  const inspectorPeer = peers.find((p) => p.role === "inspector");
  const clientPeers = peers.filter((p) => p.role === "client");
  const supervisorPeers = peers.filter((p) => p.role === "supervisor" && p.userId !== userId);

  // Reloj para actualizar el "hace Xs" del timestamp del preview
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (ts: number) => {
    const sec = Math.floor((now - ts) / 1000);
    if (sec < 60) return `hace ${sec}s`;
    return `hace ${Math.floor(sec / 60)}min`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-rose-500" />
            )}
            <span className="app-body font-medium text-white/90">
              {connected ? "Supervisión activa" : "Esperando inspector..."}
            </span>
          </div>
          {preview && !isStale && (
            <span className="flex items-center gap-1.5 app-body text-white/50">
              <Clock className="h-3 w-3" />
              {formatTime(lastUpdate)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="app-body text-white/40 flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            Modo supervisor
          </span>
          <button
            type="button"
            onClick={onLeave}
            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors app-body"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Cuerpo: previews de video */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black p-6 gap-4 overflow-auto">
        {!connected && (
          <div className="flex flex-col items-center text-white/50">
            <Loader2 className="h-10 w-10 mb-3 animate-spin" />
            <p className="app-body">Esperando a que el inspector se conecte...</p>
          </div>
        )}

        {connected && !preview && (
          <div className="flex flex-col items-center text-white/50">
            <Video className="h-10 w-10 mb-3 opacity-50" />
            <p className="app-body">El inspector está conectado. Esperando primera imagen...</p>
          </div>
        )}

        {connected && preview && isStale && (
          <div className="flex flex-col items-center text-amber-400/80">
            <AlertTriangle className="h-10 w-10 mb-3" />
            <p className="app-body">La señal de video se ha interrumpido.</p>
            <p className="app-body text-white/40 mt-1">Última imagen: {formatTime(lastUpdate)}</p>
          </div>
        )}

        {connected && preview && !isStale && (
          <div className="flex flex-col gap-4 w-full max-w-3xl">
            {/* Video remoto (asegurado) */}
            <div className="flex flex-col gap-2">
              <span className="app-body text-white/60 font-medium flex items-center gap-1.5">
                <Video className="h-4 w-4 text-sky-400" />
                Cámara del asegurado
              </span>
              {preview.remoteThumb ? (
                // thumbnail base64 dinámico, no optimizable con next/image
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.remoteThumb}
                  alt="Video del asegurado"
                  className="w-full rounded-lg border border-zinc-700"
                />
              ) : (
                <div className="w-full aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                  <VideoOff className="h-8 w-8 text-white/20" />
                </div>
              )}
            </div>

            {/* Video local (inspector) */}
            <div className="flex flex-col gap-2">
              <span className="app-body text-white/60 font-medium flex items-center gap-1.5">
                <Video className="h-4 w-4 text-violet-400" />
                Cámara del inspector
              </span>
              {preview.localThumb ? (
                // thumbnail base64 dinámico, no optimizable con next/image
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.localThumb}
                  alt="Video del inspector"
                  className="w-full max-w-sm rounded-lg border border-zinc-700"
                />
              ) : (
                <div className="w-full max-w-sm aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                  <VideoOff className="h-8 w-8 text-white/20" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panel de peers conectados */}
      <div className="border-t border-white/10 bg-black/40 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="h-4 w-4 text-emerald-400" />
          <span className="app-body font-medium text-white/80">
            {peers.length} {peers.length === 1 ? "participante" : "participantes"} conectado{peers.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {inspectorPeer && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/30">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="app-body text-white/70">Inspector</span>
            </div>
          )}
          {clientPeers.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sky-500/10 border border-sky-500/30"
            >
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="app-body text-white/70">Asegurado</span>
              <button
                type="button"
                onClick={() => kickPeer(p.userId)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600/80 hover:bg-rose-600 text-white app-body text-xs transition-colors"
                title="Desconectar a este asegurado"
              >
                <UserX className="h-3 w-3" />
                Desconectar
              </button>
            </div>
          ))}
          {supervisorPeers.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="app-body text-white/70">Otro supervisor</span>
            </div>
          ))}
          {!inspectorPeer && clientPeers.length === 0 && supervisorPeers.length === 0 && (
            <span className="app-body text-white/30">Sin participantes conectados</span>
          )}
        </div>
      </div>
    </div>
  );
}
