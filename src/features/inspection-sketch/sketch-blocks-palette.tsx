"use client";

/**
 * Paleta de bloques predefinidos con drag & drop al canvas.
 *
 * Renderiza los bloques agrupados por categoría (habitaciones, oficina,
 * estacionamiento, maquinaria, negocio, exterior, estructura) usando
 * CATEGORY_ORDER y BLOCKS_BY_CATEGORY del catálogo.
 *
 * En desktop (>=640px) muestra una lista lateral arrastrable via HTML5 Drag
 * API nativa. En móvil (<640px) colapsa a un <select> (app-input) porque no
 * hay drag con mouse; al elegir, el bloque se agrega al centro del canvas.
 */

import {
  Sofa, UtensilsCrossed, Bath, ChefHat, BedDouble, Car, Building2,
  Armchair, Archive, Users, ParkingSquare, Bike, Cog, Fuel, Monitor,
  Store, ShoppingCart, Gift, TreePine, Flower2, Road,
  BrickWall, DoorOpen, AppWindow, ArrowUpDown,
} from "lucide-react";
import { BLOCKS_BY_CATEGORY } from "./sketch-blocks";
import { CATEGORY_ORDER } from "./sketch-types";
import type { BlockDefinition, BlockId } from "./sketch-types";

/** Icono lucide por id de bloque. */
const BLOCK_ICONS: Partial<Record<BlockId, typeof Sofa>> = {
  // Habitaciones
  living: Sofa, comedor: UtensilsCrossed, bano: Bath, cocina: ChefHat,
  dormitorio: BedDouble, garage: Car, "oficina-room": Building2,
  // Oficina
  escritorio: Armchair, silla: Armchair, archivador: Archive,
  reunion: Users, recepcion: Store,
  // Estacionamiento
  vehiculo: Car, plaza: ParkingSquare, rampa: Road, bicicleta: Bike,
  // Maquinaria
  motor: Cog, tanque: Fuel, panel: Monitor, equipo: Cog,
  // Negocio
  mostrador: Store, estanteria: Archive, caja: ShoppingCart, exhibidor: Gift,
  // Exterior
  arbol: TreePine, jardin: Flower2, vereda: Road, porton: DoorOpen,
  // Estructura
  muro: BrickWall, puerta: DoorOpen, ventana: AppWindow, escalera: ArrowUpDown,
};

interface SketchBlocksPaletteProps {
  /** Se llama cuando el usuario elige un bloque desde el select móvil. */
  onSelectBlock: (blockId: BlockId) => void;
}

function BlockItem({ block }: { block: BlockDefinition }) {
  const Icon = BLOCK_ICONS[block.id] ?? Sofa;
  return (
    <div
      className="sketch-block-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/sketch-block", block.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <span
        className="sketch-block-swatch"
        // Excepción REGLA #2: color dinámico del catálogo de bloques.
        style={{ backgroundColor: block.fill, borderColor: block.stroke }}
      />
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="sketch-block-label">{block.label}</span>
    </div>
  );
}

export function SketchBlocksPalette({ onSelectBlock }: SketchBlocksPaletteProps) {
  return (
    <>
      {/* Paleta lateral (desktop >=640px) */}
      <aside className="sketch-palette">
        {CATEGORY_ORDER.map((cat) => {
          const blocks = BLOCKS_BY_CATEGORY[cat.id];
          if (!blocks || blocks.length === 0) return null;
          return (
            <div key={cat.id} className="sketch-palette-category">
              <p className="sketch-palette-title">{cat.label}</p>
              {blocks.map((block) => (
                <BlockItem key={block.id} block={block} />
              ))}
            </div>
          );
        })}
      </aside>

      {/* Select colapsado (móvil <640px) */}
      <div className="sketch-palette-mobile">
        <select
          className="app-input"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value as BlockId | "";
            if (id) onSelectBlock(id);
            e.target.value = "";
          }}
          aria-label="Agregar bloque"
        >
          <option value="" disabled>
            Agregar bloque...
          </option>
          {CATEGORY_ORDER.map((cat) => {
            const blocks = BLOCKS_BY_CATEGORY[cat.id];
            if (!blocks || blocks.length === 0) return null;
            return (
              <optgroup key={cat.id} label={cat.label}>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
    </>
  );
}
