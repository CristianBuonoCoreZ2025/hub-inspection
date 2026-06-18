"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSignatures, createSignature } from "@/services/inspections";
import { uploadFileToStorage } from "@/lib/nhost/storage-upload";
import { toast } from "sonner";
import { CheckCircle, User, ShieldCheck } from "lucide-react";

function SignatureCanvas({ onSave, label }: { onSave: (dataUrl: string) => void; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = () => {
    setIsDrawing(false);
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
      <div className="rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={150}
          className="w-full cursor-crosshair touch-none"
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
        <button onClick={clear} className="btn-cancel btn-sm">Limpiar</button>
        <button onClick={save} className="btn-save btn-sm"><CheckCircle className="mr-1 h-3.5 w-3.5" /> Guardar Firma</button>
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

  const createMutation = useMutation({
    mutationFn: createSignature,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signatures", sessionId] });
      toast.success("Firma guardada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = async (role: "insured" | "adjuster", dataUrl: string) => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const file = new File([blob], `signature_${role}_${Date.now()}.png`, { type: "image/png" });
    const path = `signatures/${sessionId}/${role}_${Date.now()}.png`;
    const url = await uploadFileToStorage(file, path);
    createMutation.mutate({
      session_id: sessionId,
      role,
      signature_url: url,
      signed_at: new Date().toISOString(),
      ip_address: null,
      user_agent: null,
    });
  };

  const insuredSig = signatures?.find((s) => s.role === "insured");
  const adjusterSig = signatures?.find((s) => s.role === "adjuster");

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="app-panel text-center py-8 text-muted-foreground text-sm">Cargando firmas...</div>
      ) : (
        <>
          {/* Firmas existentes */}
          {(insuredSig || adjusterSig) && (
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Firmas Guardadas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insuredSig && (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[13px] font-medium">Asegurado</span>
                    </div>
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
