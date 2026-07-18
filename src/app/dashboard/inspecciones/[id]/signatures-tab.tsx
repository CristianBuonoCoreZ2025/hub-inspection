"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSignatures } from "@/services/inspections";
import { toast } from "sonner";
import { User, ShieldCheck } from "lucide-react";

function SignatureCanvas({ onSave, label }: { onSave: (dataUrl: string) => void; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
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

  const save = () => {
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length < 1000) {
      toast.error("La firma está vacía");
      return;
    }
    onSave(dataUrl);
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
        <button onClick={clear} className="pg-btn-platinum">Limpiar</button>
        <button onClick={save} className="pg-btn-platinum">Guardar</button>
      </div>
    </div>
  );
}

export default function SignaturesTab({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();

  const { data: signatures, isLoading } = useQuery({
    queryKey: ["signatures", sessionId],
    queryFn: () => getSignatures(sessionId),
  });

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
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["signatures", sessionId] });
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
                    <p className="text-[11px] text-muted-foreground mt-1">{new Date(insuredSig.signed_at).toLocaleString("es-CL")}</p>
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
                    <p className="text-[11px] text-muted-foreground mt-1">{new Date(adjusterSig.signed_at).toLocaleString("es-CL")}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Canvas de firma */}
          {!insuredSig && (
            <SignatureCanvas label="Firma del Asegurado" onSave={(url) => handleSave("insured", url)} />
          )}
          {!adjusterSig && (
            <SignatureCanvas label="Firma del Ajustador" onSave={(url) => handleSave("adjuster", url)} />
          )}
        </>
      )}
    </div>
  );
}
