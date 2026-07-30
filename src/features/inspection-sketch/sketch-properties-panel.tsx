"use client";

/**
 * Panel de propiedades — aparece al hacer doble clic sobre una entidad.
 *
 * Panel pequeño, no formulario largo. Muestra solo las propiedades mínimas
 * del tipo de entidad (nombre, medidas, tipo, destino, textura, color).
 * Las medidas son opcionales: si no se llenan, no se muestran sobre el plano.
 * Nunca se muestra información vacía.
 *
 * Ver PLAN_CANVAS_MIGRATION.md § 10 (Propiedades) y § 12 (Texturas).
 */

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type * as fabric from "fabric";
import { getEntityMeta, setEntityMeta } from "./entity-renderer";
import { getPropertyFields } from "./entity-properties";
import { getTexturePattern, TEXTURE_OPTIONS } from "./sketch-textures";
import { updateAnnotationText, updateAnnotationColor } from "./sketch-annotations";
import { ANNOTATION_COLORS } from "./entity-types";
import type { PropertyName, TextureId, AnnotationColor } from "./entity-types";

interface SketchPropertiesPanelProps {
  /** Objeto Fabric seleccionado (doble clic). */
  obj: fabric.Object | null;
  /** Lienzo para repintar tras cambios. */
  canvas: fabric.Canvas | null;
  /** Se llama al cerrar el panel. */
  onClose: () => void;
}

export function SketchPropertiesPanel({ obj, canvas, onClose }: SketchPropertiesPanelProps) {
  // Derivar metadata del objeto seleccionado (sin useEffect + setState).
  const meta = useMemo(() => (obj ? getEntityMeta(obj) : null), [obj]);

  // Valores editables locales. Se inicializan desde meta cuando cambia obj.
  const [values, setValues] = useState<Record<string, string>>({});

  // Resetear valores cuando cambia el objeto (key por obj identity).
  const objKey = obj?.__uid ?? "";
  const [lastKey, setLastKey] = useState("");
  if (objKey !== lastKey) {
    setLastKey(objKey);
    if (meta) {
      const initial: Record<string, string> = {};
      for (const [key, val] of Object.entries(meta.properties)) {
        initial[key] = val !== null ? String(val) : "";
      }
      if (meta.properties.name === undefined) {
        initial.name = meta.name;
      }
      setValues(initial);
    } else {
      setValues({});
    }
  }

  if (!obj || !meta) return null;

  const fields = getPropertyFields(
    // Reconstruir PropertyName[] desde las properties del catálogo via meta.
    Object.keys(meta.properties) as PropertyName[]
  );

  /** Actualiza una propiedad y repinta. */
  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Actualizar metadata.
    const updatedProps = { ...meta.properties, [name]: value || null };
    setEntityMeta(obj, { properties: updatedProps });

    // Casos especiales.
    if (name === "name") {
      setEntityMeta(obj, { name: value });
      // Actualizar el texto visible en el bloque (si es un Group con Text).
      if (obj instanceof fabric.Group) {
        const objects = obj.getObjects();
        const textObj = objects.find((o) => o instanceof fabric.Text || o instanceof fabric.Textbox);
        if (textObj instanceof fabric.Text || textObj instanceof fabric.Textbox) {
          textObj.set({ text: value });
        }
      }
    }

    if (name === "texture") {
      const textureId = value as TextureId;
      setEntityMeta(obj, { texture: textureId });
      // Aplicar textura al rectángculo del bloque.
      if (obj instanceof fabric.Group) {
        const rect = obj.getObjects()[0];
        if (rect instanceof fabric.Rect) {
          const pattern = getTexturePattern(textureId);
          if (pattern) {
            rect.set({ fill: pattern });
          } else {
            // Sin textura: restaurar fill del catálogo.
            rect.set({ fill: meta.properties.__originalFill ?? rect.fill });
          }
        }
      }
    }

    if (name === "color" && meta.category === "annotations") {
      const colorId = value as AnnotationColor;
      updateAnnotationColor(obj, colorId);
    }

    if (name === "text" && meta.category === "annotations") {
      updateAnnotationText(obj, value);
      setEntityMeta(obj, { name: value });
    }

    canvas?.requestRenderAll();
  }

  return (
    <div className="sketch-properties-panel">
      <div className="sketch-properties-header">
        <span className="sketch-properties-title">
          {meta.category === "spaces" ? "Espacio" :
           meta.category === "structure" ? "Estructura" :
           meta.category === "objects" ? "Objeto" :
           meta.category === "equipment" ? "Equipamiento" :
           "Anotación"}
        </span>
        <button
          type="button"
          className="sketch-mode-btn"
          onClick={onClose}
          title="Cerrar"
          aria-label="Cerrar propiedades"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="sketch-properties-body">
        {fields.map((field) => (
          <div key={field.name} className="sketch-properties-field">
            <label className="sketch-properties-label">{field.label}</label>
            {field.inputType === "select" && field.options ? (
              <select
                className="app-input sketch-properties-input"
                value={values[field.name] ?? ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
              >
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.inputType === "texture" ? (
              <select
                className="app-input sketch-properties-input"
                value={values[field.name] ?? "none"}
                onChange={(e) => handleChange("texture", e.target.value)}
              >
                {TEXTURE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            ) : field.inputType === "color" ? (
              <div className="sketch-properties-colors">
                {ANNOTATION_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`sketch-mode-btn ${(values[field.name] ?? "yellow") === c.id ? "is-active" : ""}`}
                    onClick={() => handleChange("color", c.id)}
                    title={c.label}
                    aria-label={`Color ${c.label}`}
                  >
                    <span
                      className="sketch-block-swatch"
                      // Excepción REGLA #2: color dinámico de la paleta.
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="sketch-properties-input-wrap">
                <input
                  type={field.inputType === "number" ? "number" : "text"}
                  className="app-input sketch-properties-input"
                  value={values[field.name] ?? ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.optional ? "Opcional" : ""}
                />
                {field.suffix && (
                  <span className="sketch-properties-suffix">{field.suffix}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
