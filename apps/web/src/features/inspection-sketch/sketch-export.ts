/**
 * Exportación del canvas Fabric a PNG base64.
 *
 * Mantiene el contrato del backend `/api/inspection/sketch`:
 *   onSave(dataUrl) donde dataUrl === "data:image/png;base64,...."
 *
 * Pasos:
 *  1. Deselecciona todo para que los handles de selección no queden en el PNG.
 *  2. Fuerza un render final.
 *  3. toDataURL con multiplier = devicePixelRatio para nitidez.
 *
 * El fondo blanco (configurado como backgroundColor del canvas) se incluye
 * automáticamente en el export, igual que el canvas viejo pintaba blanco.
 */

import type * as fabric from "fabric";

/**
 * Serializa el canvas Fabric a un data URL PNG base64.
 *
 * @param canvas Instancia Fabric viva.
 * @returns data URL `data:image/png;base64,...` o string vacío si no hay canvas.
 */
export function exportSketchToPng(canvas: fabric.Canvas | null): string {
  if (!canvas) return "";

  // 1. Quitar selección activa para que los handles no aparezcan en el PNG.
  canvas.discardActiveObject();
  // 2. Render final sincrónico.
  canvas.renderAll();

  // 3. Exportar PNG con multiplier = DPR para nitidez equivalente al canvas
  //    viejo (que hacía ctx.scale(dpr, dpr) sobre un canvas de w*dpr).
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: dpr,
    enableRetinaScaling: true,
  });

  return dataUrl;
}
