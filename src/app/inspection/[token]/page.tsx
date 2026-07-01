"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getInspectionSessionByToken } from "@/services/inspections";
import {
  ClipboardCheck,
  Video,
  MapPin,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

export default function MagicLinkPage() {
  const params = useParams();
  const token = params.token as string;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["magic-link-session", token],
    queryFn: () => getInspectionSessionByToken(token),
    refetchInterval: 5000, // Refrescar cada 5s para ver cambios en tiempo real
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          <p className="text-slate-400 text-sm">Conectando a la inspección...</p>
        </div>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center max-w-md">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-rose-500/10 mb-4">
            <WifiOff className="h-8 w-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Link inválido o expirado</h1>
          <p className="text-slate-400 text-sm">
            El link de inspección no es válido o ha expirado. Contacte a su liquidador.
          </p>
        </div>
      </div>
    );
  }

  const claim = session.claim as any;
  const insured = claim?.claims_participants?.find((p: any) => p.type === "insured");
  const isExpired = session.magic_link_expires_at && new Date(session.magic_link_expires_at) < now;
  const isActive = session.status === "active";
  const isScheduled = session.status === "scheduled";
  const isCompleted = session.status === "completed";
  const isCancelled = session.status === "cancelled";

  const scheduledDate = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleString("es-CL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
              <ClipboardCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">Inspección Remota</p>
              <p className="text-[11px] text-slate-400">{session.inspection_number || session.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
                <Wifi className="h-3 w-3" /> En vivo
              </span>
            ) : isScheduled ? (
              <span className="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-400">
                <Clock className="h-3 w-3" /> Programada
              </span>
            ) : isCompleted ? (
              <span className="flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-1 text-[11px] font-medium text-slate-400">
                Completada
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-400">
                Cancelada
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Estado principal */}
        {isExpired ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
            <WifiOff className="h-10 w-10 mx-auto text-rose-400 mb-3" />
            <h2 className="text-lg font-semibold mb-1">Link expirado</h2>
            <p className="text-sm text-slate-400">
              Este link de inspección ha expirado. Contacte a su liquidador para obtener uno nuevo.
            </p>
          </div>
        ) : isCancelled ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
            <h2 className="text-lg font-semibold mb-1">Inspección cancelada</h2>
            <p className="text-sm text-slate-400">
              Esta inspección ha sido cancelada. Contacte a su liquidador para más información.
            </p>
          </div>
        ) : isCompleted ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-slate-400 mb-3" />
            <h2 className="text-lg font-semibold mb-1">Inspección completada</h2>
            <p className="text-sm text-slate-400">
              La inspección ha finalizado. Gracias por su colaboración.
            </p>
          </div>
        ) : isScheduled ? (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10">
                <Calendar className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Inspección programada</h2>
                <p className="text-[12px] text-slate-400">Su inspector lo contactará a la hora indicada</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 p-3">
                <Calendar className="h-4 w-4 text-sky-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Fecha y hora</p>
                  <p className="text-[13px] font-medium">{scheduledDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 p-3">
                <Video className="h-4 w-4 text-violet-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Modalidad</p>
                  <p className="text-[13px] font-medium">Remota (video llamada)</p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[12px] text-amber-300">
              <strong>Importante:</strong> Mantenga esta pestaña abierta. Cuando el inspector inicie la sesión,
              verá la inspección en tiempo real aquí mismo.
            </div>
          </div>
        ) : isActive ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 animate-pulse">
                <Video className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Inspección en curso</h2>
                <p className="text-[12px] text-slate-400">El inspector está realizando la inspección</p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-4">
              <p className="text-[13px] text-slate-300 mb-3">
                Su inspector está documentando la inspección. Lo que él ve en su pantalla,
                usted lo verá aquí en tiempo real:
              </p>
              <div className="aspect-video rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-2" />
                  <p className="text-[12px] text-slate-500">Esperando pantalla del inspector...</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Datos del siniestro */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Datos del Siniestro
          </h3>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">N° Interno</p>
              <p className="font-mono font-semibold text-sky-400">{claim?.liquidation_number || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Ref. Cliente</p>
              <p className="font-medium">{claim?.client_reference || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Asegurado</p>
              <p className="font-medium">{insured?.full_name || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Dirección</p>
              <p className="font-medium">{claim?.claim_address || "—"}</p>
            </div>
          </div>
        </div>

        {/* Contacto del inspector */}
        {session.interviewed_name && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Contacto
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-slate-500" />
                <span>{session.interviewed_name}</span>
              </div>
              {session.interviewed_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>{session.interviewed_email}</span>
                </div>
              )}
            </div>
            {session.inspector_observations && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Comentarios</p>
                <p className="text-[12px] text-slate-300 whitespace-pre-wrap">{session.inspector_observations}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-slate-600">
            Esta página se actualiza automáticamente. No necesita recargar.
          </p>
        </div>
      </main>
    </div>
  );
}
