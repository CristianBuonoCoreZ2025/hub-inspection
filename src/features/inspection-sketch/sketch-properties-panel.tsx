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
import * as fabric from "fabric";
import { getEntityMeta, setEntityMeta } from "./entity-renderer";
import { getPropertyFields } from "./entity-properties";
import { getTexturePattern, TEXTURE_OPTIONS } from "./sketch-textures";
import { updateAnnotationText, updateAnnotationColor } from "./sketch-annotations";
import { ANNOTATION_COLORS } from "./entity-types";
import type { PropertyName, TextureId, AnnotationColor, EntityMetadata } from "./entity-types";

interface SketchPropertiesPanelProps {
  obj: fabric.Object | null;
  canvas: fabric.Canvas | null;
  onClose: () => void;
}

/** Calcula los valores iniciales desde la metadata. */
function computeInitialValues(meta: EntityMetadata): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const [key, val] of Object.entries(meta.properties)) {
    initial[key] = val !== null ? String(val) : "";
  }
  if (meta.properties.name === undefined) {
    initial.name = meta.name;
  }
  return initial;
}

export function SketchPropertiesPanel({ obj, canvas, onClose }: SketchPropertiesPanelProps) {
  const meta = useMemo(() => (obj ? getEntityMeta(obj) : null), [obj]);
  const [values, setValues] = useState<Record<string, string>>({});

  // Resetear valores cuando cambia el objeto. Usamos el cacheKey de Fabric
  // como identidad del objeto (cambia cuando se selecciona otro objeto).
  const objKey = useMemo(() => {
    if (!obj) return "";
    // Usar una propiedad estable del objeto como key.
    return `${obj.left}-${obj.top}-${obj.width}-${obj.height}`;
  }, [obj]);

  const [lastKey, setLastKey] = useState("");
  if (objKey !== lastKey) {
    setLastKey(objKey);
    if (meta) {
      setValues(computeInitialValues(meta));
    } else {
      setValues({});
    }
  }

  if (!obj || !meta) return null;

  // Capturar referencias no-null para los closures.
  const targetObj = obj;
  const targetMeta = meta;

  const fields = getPropertyFields(
    Object.keys(targetMeta.properties) as PropertyName[]
  );

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));

    const updatedProps = { ...targetMeta.properties, [name]: value || null };
    setEntityMeta(targetObj, { properties: updatedProps });

    if (name === "name") {
      setEntityMeta(targetObj, { name: value });
      if (targetObj instanceof fabric.Group) {
        const textObj = targetObj.getObjects().find((o) => o.type === "text" || o.type === "textbox");
        if (textObj) {
          textObj.set({ text: value });
        }
      }
    }

    if (name === "texture") {
      const textureId = value as TextureId;
      setEntityMeta(targetObj, { texture: textureId });
      if (targetObj instanceof fabric.Group) {
        const rect = targetObj.getObjects()[0];
        if (rect instanceof fabric.Rect) {
          const pattern = getTexturePattern(textureId);
          if (pattern) {
            rect.set({ fill: pattern });
          }
        }
      }
    }

    if (name === "color" && targetMeta.category === "annotations") {
      const colorId = value as AnnotationColor;
      updateAnnotationColor(targetObj, colorId);
    }

    if (name === "text" && targetMeta.category === "annotations") {
      updateAnnotationText(targetObj, value);
      setEntityMeta(targetObj, { name: value });
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
