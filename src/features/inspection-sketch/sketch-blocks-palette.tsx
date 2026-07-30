"use client";

/**
 * Paleta de bloques predefinidos con drag & drop al canvas.
 *
 * En desktop (>=640px) muestra una lista lateral arrastrable via HTML5 Drag
 * API nativa. En móvil (<640px) colapsa a un <select> (app-input) porque no
 * hay drag con mouse; al elegir, el bloque se agrega al centro del canvas.
 *
 * El drop real lo maneja el editor orquestador (sketch-editor.tsx) que
 * conoce la instancia Fabric y traduce coordenadas de pantalla a canvas.
 */

import { Sofa, UtensilsCrossed, Bath, ChefHat, BedDouble, Car, Briefcase, BrickWall, DoorOpen, AppWindow, ArrowUpDown } from "lucide-react";
import { ROOM_BLOCKS, STRUCTURE_BLOCKS } from "./sketch-blocks";
import type { BlockDefinition, BlockId } from "./sketch-types";

/** Icono lucide por id de bloque. */
const BLOCK_ICONS: Record<BlockId, typeof Sofa> = {
  living: Sofa,
  comedor: UtensilsCrossed,
  bano: Bath,
  cocina: ChefHat,
  dormitorio: BedDouble,
  garage: Car,
  oficina: Briefcase,
  muro: BrickWall,
  puerta: DoorOpen,
  ventana: AppWindow,
  escalera: ArrowUpDown,
};

interface SketchBlocksPaletteProps {
  /** Se llama cuando el usuario arrastra un bloque y lo suelta en el canvas. */
  onDropBlock: (blockId: BlockId, x: number, y: number) => void;
  /** Se llama cuando el usuario elige un bloque desde el select móvil. */
  onSelectBlock: (blockId: BlockId) => void;
}

function BlockItem({ block, draggable }: { block: BlockDefinition; draggable: boolean }) {
  const Icon = BLOCK_ICONS[block.id] ?? Sofa;
  return (
    <div
      className="sketch-block-item"
      draggable={draggable}
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

export function SketchBlocksPalette({ onDropBlock, onSelectBlock }: SketchBlocksPaletteProps) {
  return (
    <>
      {/* Paleta lateral (desktop >=640px) */}
      <aside className="sketch-palette">
        <p className="sketch-palette-title">Habitaciones</p>
        {ROOM_BLOCKS.map((block) => (
          <BlockItem key={block.id} block={block} draggable />
        ))}
        <p className="sketch-palette-title sketch-palette-title--section">
          Estructura
        </p>
        {STRUCTURE_BLOCKS.map((block) => (
          <BlockItem key={block.id} block={block} draggable />
        ))}
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
          <optgroup label="Habitaciones">
            {ROOM_BLOCKS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Estructura">
            {STRUCTURE_BLOCKS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </>
  );
}
