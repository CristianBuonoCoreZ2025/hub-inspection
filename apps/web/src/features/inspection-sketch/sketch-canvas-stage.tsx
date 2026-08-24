"use client";

/**
 * Contenedor DOM del canvas Fabric. Maneja:
 *  - Inicialización segura de `fabric.Canvas` (client-side, dentro de useEffect).
 *  - Cleanup con `dispose()` para sobrevivir a React 19 Strict Mode (doble montaje).
 *  - ResizeObserver para que el canvas siga al contenedor y el contenido escale.
 *  - Aplicación de devicePixelRatio via `enableRetinaScaling` de Fabric.
 *
 * No renderiza UI de controles: eso vive en sketch-toolbar y sketch-palette.
 * Expone la instancia Fabric via ref para que el editor orquestador la use.
 */

import { useEffect, useRef } from "react";
import * as fabric from "fabric";

interface SketchCanvasStageProps {
  /** Recibe la instancia Fabric una vez creada (o null al desmontar). */
  onReady: (canvas: fabric.Canvas | null) => void;
  /** Altura fija en px (override del alto responsivo por breakpoint). */
  fixedHeight?: number;
}

export function SketchCanvasStage({ onReady, fixedHeight }: SketchCanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvasEl = canvasElRef.current;
    if (!container || !canvasEl) return;

    // Guard contra doble montaje de Strict Mode: si ya existe, no recrear.
    if (fabricRef.current) {
      onReady(fabricRef.current);
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 200);
    const height = fixedHeight ?? container.clientHeight ?? 400;

    const canvas = new fabric.Canvas(canvasEl, {
      width,
      height,
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
      // fabric 7: estos defaults cambiaron a true, los restauramos al comportamiento de fabric 6
      fireRightClick: false,
      fireMiddleClick: false,
      stopContextMenu: true,
    });
    // Retina scaling para nitidez (equivalente al ctx.scale(dpr,dpr) del canvas viejo).
    canvas.enableRetinaScaling = true;

    fabricRef.current = canvas;
    onReady(canvas);

    // ResizeObserver: el canvas sigue al contenedor; el contenido se mantiene
    // (no se reescala automáticamente, el usuario posiciona los objetos).
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 200);
        const h = fixedHeight ?? entry.contentRect.height ?? canvas.getHeight();
        if (w !== canvas.getWidth() || h !== canvas.getHeight()) {
          canvas.setDimensions({ width: w, height: h });
          canvas.requestRenderAll();
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      onReady(null);
      canvas.dispose();
      fabricRef.current = null;
    };
    // onReady y fixedHeight son estables en la práctica (el editor los
    // estabiliza con useCallback / props inmutables). Se omite del deps para
    // no recrear el canvas en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clase modificadora de altura fija cuando el consumidor pasa `height`.
  // La altura se pasa como CSS var (valor dinámico runtime, excepción
  // permitida por REGLA #2: no existe en tiempo de compilación).
  const stageClass = fixedHeight
    ? "sketch-stage sketch-stage--fixed-h"
    : "sketch-stage";
  const stageStyle = fixedHeight
    ? ({ "--sketch-stage-h": `${fixedHeight}px` } as React.CSSProperties)
    : undefined;

  return (
    <div className="sketch-stage-wrap">
      <div ref={containerRef} className={stageClass} style={stageStyle}>
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
