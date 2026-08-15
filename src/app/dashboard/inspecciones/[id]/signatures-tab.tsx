"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getSignatures, updateInspectionSession } from "@/services/inspections";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { User, ShieldCheck, Lock, UserX, AlertTriangle } from "lucide-react";

function SignatureCanvas({ onSave, label }: { onSave: (dataUrl: string) => Promise<void>; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // ResizeObserver: ajusta el canvas al contenedor con devicePixelRatio para nitidez
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(200, rect.width);
      const h = 180;
      // Guardar contenido actual
      const prevData = canvas.toDataURL();
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0a0a0a";
        // Restaurar contenido
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = prevData;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    lastPosRef.current = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    // Dibujar un punto inicial para taps simples
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    // Smoothing: línea cuadrática entre el punto anterior y el actual
    if (lastPosRef.current) {
      const midX = (lastPosRef.current.x + pos.x) / 2;
      const midY = (lastPosRef.current.y + pos.y) / 2;
      ctx.quadraticCurveTo(lastPosRef.current.x, lastPosRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    lastPosRef.current = pos;
  };

  const stop = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = async () => {
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length < 1000) {
      toast.error("La firma está vacía");
      return;
    }
    setSaving(true);
    try {
      await onSave(dataUrl);
    } catch {
      // El error ya lo maneja el parent con toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-panel space-y-3">
      <h4 className="text-[13px] font-semibold">{label}</h4>
      <div ref={containerRef} className="rounded-lg border bg-white w-full">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none block"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={clear} className="pg-btn-platinum" disabled={saving}>Limpiar</button>
        <button onClick={save} className="pg-btn-platinum" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

export default function SignaturesTab({ sessionId, sessionStatus, magicLinkToken, inspectionType, signatureWaiverReason, signatureCapturedAt }: { sessionId: string; sessionStatus?: string; magicLinkToken?: string; inspectionType?: "onsite" | "remote"; signatureWaiverReason?: string | null; signatureCapturedAt?: string | null }) {
  const queryClient = useQueryClient();
  const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";
  const [showWaiverInput, setShowWaiverInput] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");

  const waiverMutation = useMutation({
    mutationFn: async (reason: string) => {
      return updateInspectionSession(sessionId, { signature_waiver_reason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["signatures", sessionId] });
      if (magicLinkToken) queryClient.invalidateQueries({ queryKey: ["magic-link-live", magicLinkToken] });
      toast.success("Exención de firma registrada");
      setShowWaiverInput(false);
    },
    onError: (err: Error) => toast.error(err.message || "Error al registrar exención"),
  });

  const handleWaiver = () => {
    if (!waiverReason.trim()) {
      toast.error("Ingrese el motivo de la exención");
      return;
    }
    waiverMutation.mutate(waiverReason.trim());
  };

  const handleRemoveWaiver = () => {
    waiverMutation.mutate("");
  };

  const captureMutation = useMutation({
    mutationFn: async (capturedAt: string | null) => {
      return updateInspectionSession(sessionId, { signature_captured_at: capturedAt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["signatures", sessionId] });
      if (magicLinkToken) queryClient.invalidateQueries({ queryKey: ["magic-link-live", magicLinkToken] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al capturar firma"),
  });

  const handleCapture = () => {
    captureMutation.mutate(new Date().toISOString());
  };

  const handleReleaseCapture = () => {
    captureMutation.mutate(null);
  };

  const { data: signatures, isLoading } = useQuery({
    queryKey: ["signatures", sessionId],
    queryFn: () => getSignatures(sessionId),
  });

  // Realtime: cuando el asegurado firma, recargar inmediatamente
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`signatures-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inspection_signatures",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["signatures", sessionId] });
          queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
          const role = (payload.new as { role?: string } | null)?.role;
          if (role === "insured") toast.success("El asegurado ha firmado");
          if (role === "adjuster") toast.success("El ajustador ha firmado");
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  const handleSave = async (role: "insured" | "adjuster", dataUrl: string) => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const file = new File([blob], `signature_${role}_${Date.now()}.png`, { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);
    formData.append("role", role);
    const res = await fetch("/api/inspection/sign/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error || "Error al subir firma");
      throw new Error(body.error || "Error al subir firma");
    }
    // Invalidar queries para sincronizar dashboard y magic link
    await queryClient.invalidateQueries({ queryKey: ["signatures", sessionId] });
    await queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
    if (magicLinkToken) await queryClient.invalidateQueries({ queryKey: ["magic-link-live", magicLinkToken] });
    toast.success("Firma guardada");
  };

  const insuredSig = signatures?.find((s) => s.role === "insured");
  const adjusterSig = signatures?.find((s) => s.role === "adjuster");

  return (
    <div className="app-stack">
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando firmas...</div>
      ) : (
        <>
          {/* Banner de solo lectura */}
          {readOnly && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Inspección finalizada — las firmas son de solo lectura
            </div>
          )}

          {/* Firmas existentes */}
          {(insuredSig || adjusterSig) && (
            <div className="app-panel">
              <h3 className="app-section-title">
                Firmas Guardadas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {insuredSig && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[13px] font-medium">Asegurado</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={insuredSig.signature_url} alt="Firma asegurado" className="w-full h-[100px] object-contain bg-white rounded border" />
                    <p className="text-[11px] text-muted-foreground mt-1">{new Date(insuredSig.signed_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</p>
                  </div>
                )}
                {adjusterSig && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[13px] font-medium">Ajustador</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={adjusterSig.signature_url} alt="Firma ajustador" className="w-full h-[100px] object-contain bg-white rounded border" />
                    <p className="text-[11px] text-muted-foreground mt-1">{new Date(adjusterSig.signed_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botón Capturar/Liberar firma (inspector) */}
          {!readOnly && insuredSig && (
            <div className="app-panel">
              <div className="flex items-center gap-3">
                {signatureCapturedAt ? (
                  <button
                    type="button"
                    onClick={handleReleaseCapture}
                    disabled={captureMutation.isPending}
                    className="pg-btn-platinum flex items-center gap-2"
                  >
                    {captureMutation.isPending ? "Liberando..." : "Liberar"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={captureMutation.isPending}
                    className="pg-btn-platinum text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
                  >
                    {captureMutation.isPending ? "Capturando..." : "Capturar"}
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {signatureCapturedAt
                    ? "Firma capturada — el asegurado ya no puede modificarla."
                    : "Al capturar, el asegurado ya no podrá modificar la firma."}
                </p>
              </div>
            </div>
          )}

          {/* Canvas de firma (oculto si readOnly, capturada o remota) */}
          {!readOnly && !insuredSig && !signatureCapturedAt && inspectionType !== "remote" && (
            <SignatureCanvas label="Firma del Asegurado" onSave={(url) => handleSave("insured", url)} />
          )}
          {!readOnly && !insuredSig && !signatureCapturedAt && inspectionType === "remote" && !signatureWaiverReason && (
            <div className="app-panel space-y-3">
              <p className="text-muted-foreground app-body">
                La firma del asegurado se realiza desde el enlace mágico.
              </p>
              {/* Exención de firma */}
              <div className="border-t pt-3">
                {!showWaiverInput ? (
                  <button
                    type="button"
                    onClick={() => setShowWaiverInput(true)}
                    className="flex items-center gap-2 text-amber-600 dark:text-amber-400 app-body font-medium hover:underline"
                  >
                    <UserX className="h-4 w-4" />
                    Asegurado no puede firmar
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label className="app-body font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Motivo de exención de firma
                    </label>
                    <textarea
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      placeholder="Ej: Asegurado no disponible, se niega a firmar, sin conexión..."
                      className="w-full rounded-lg border border-border bg-background p-2 app-body resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleWaiver}
                        disabled={waiverMutation.isPending}
                        className="pg-btn-platinum text-amber-700 dark:text-amber-300"
                      >
                        {waiverMutation.isPending ? "Guardando..." : "Confirmar exención"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowWaiverInput(false); setWaiverReason(""); }}
                        className="pg-btn-platinum"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Mostrar waiver existente */}
          {signatureWaiverReason && (
            <div className="app-panel border-amber-300/40">
              <div className="flex items-start gap-3">
                <UserX className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="app-body font-medium text-amber-700 dark:text-amber-300">
                    Firma del asegurado eximida
                  </p>
                  <p className="app-body text-muted-foreground mt-1">
                    {signatureWaiverReason}
                  </p>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={handleRemoveWaiver}
                      disabled={waiverMutation.isPending}
                      className="app-body text-muted-foreground hover:text-foreground mt-2 underline"
                    >
                      {waiverMutation.isPending ? "Quitando..." : "Quitar exención"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {!readOnly && !adjusterSig && (
            <SignatureCanvas label="Firma del Ajustador" onSave={(url) => handleSave("adjuster", url)} />
          )}
        </>
      )}
    </div>
  );
}
