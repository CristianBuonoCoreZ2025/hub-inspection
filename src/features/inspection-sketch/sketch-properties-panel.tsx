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
import { X, Save } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
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

  const allFields = getPropertyFields(
    Object.keys(targetMeta.properties) as PropertyName[]
  );
  const fields = allFields.filter((f) => !(targetMeta.category === "spaces" && f.name === "length"));

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));

    let updatedValue: string | number | null = value || null;
    if (["width", "height", "length"].includes(name)) {
      const n = Number(value);
      updatedValue = value === "" || Number.isNaN(n) ? null : n;
    }
    const updatedProps = { ...targetMeta.properties, [name]: updatedValue };
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

  const PIXELS_PER_METER = 40;

  function handleSave() {
    const numericProps: Record<string, number | null> = {};
    for (const key of ["width", "height", "length"]) {
      const v = values[key];
      if (v === "" || v == null) {
        numericProps[key] = null;
      } else {
        const n = Number(v);
        numericProps[key] = Number.isNaN(n) || n <= 0 ? null : n;
      }
    }

    const name = values.name || targetMeta.name;
    setEntityMeta(targetObj, {
      name,
      properties: { ...targetMeta.properties, ...numericProps },
    });

    let shape: fabric.Object | undefined;
    let textObj: fabric.Text | undefined;
    if (targetObj instanceof fabric.Group) {
      const children = targetObj.getObjects();
      shape = children.find(
        (o) => o instanceof fabric.Rect || o instanceof fabric.Circle || o instanceof fabric.Ellipse
      );
      textObj = children.find((o) => o instanceof fabric.Text) as fabric.Text | undefined;
    } else {
      shape = targetObj;
    }

    if (shape instanceof fabric.Rect) {
      if (textObj) {
        textObj.set({
          left: (shape.left ?? 0) + (shape.width ?? 0) / 2,
          top: (shape.top ?? 0) + (shape.height ?? 0) / 2,
          originX: "center",
          originY: "center",
        });
      }
    }

    if (shape instanceof fabric.Circle) {
      const r = numericProps.width ?? numericProps.length;
      if (r != null) shape.set({ radius: r * PIXELS_PER_METER });
    }

    if (shape instanceof fabric.Line) {
      const len = numericProps.length ?? numericProps.width;
      if (len != null) {
        const x1 = shape.x1 ?? 0;
        const y1 = shape.y1 ?? 0;
        const x2 = x1 + len * PIXELS_PER_METER;
        shape.set({ x2, y2: y1 });
      }
    }

    if (textObj) {
      const dimText = [numericProps.width, numericProps.height].filter((v): v is number => v != null).join("x");
      const newText = dimText ? `${name}\n${dimText}` : name;
      textObj.set({ text: newText });
    }

    if (targetObj instanceof fabric.Group) {
      targetObj.triggerLayout();
    }

    targetObj.setCoords();
    canvas?.requestRenderAll();
    onClose();
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
        <Tooltip>
          <TooltipTrigger render={
            <button
              type="button"
              className="sketch-mode-btn"
              onClick={onClose}
              aria-label="Cerrar propiedades"
            />
          }>
            <X className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Cerrar</p>
          </TooltipContent>
        </Tooltip>
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
                  <Tooltip key={c.id}>
                    <TooltipTrigger className="inline-flex">
                      <button
                        type="button"
                        className={`sketch-mode-btn ${(values[field.name] ?? "yellow") === c.id ? "is-active" : ""}`}
                        onClick={() => handleChange("color", c.id)}
                        aria-label={`Color ${c.label}`}
                      >
                        <span
                          className="sketch-block-swatch"
                          // Excepción REGLA #2: color dinámico de la paleta.
                          style={{ backgroundColor: c.hex }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{c.label}</p>
                    </TooltipContent>
                  </Tooltip>
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

      <div className="sketch-properties-footer mt-3">
        <Button onClick={handleSave} className="w-full gap-2" type="button" size="sm">
          <Save className="size-4" />
          Guardar
        </Button>
      </div>
    </div>
  );
}
