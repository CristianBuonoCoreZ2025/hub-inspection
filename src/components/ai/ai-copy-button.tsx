"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Botón pequeño para copiar el resultado del análisis de IA al portapapeles.
 * Muestra un check verde por 2 segundos tras copiar exitosamente.
 */
export function AiCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Análisis copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger render={<button onClick={handleCopy} className="ai-copy-btn" />}>
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Copiar análisis</p>
      </TooltipContent>
    </Tooltip>
  );
}
