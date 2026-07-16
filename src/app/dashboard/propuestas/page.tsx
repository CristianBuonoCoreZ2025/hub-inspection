"use client";

import { Search, ChevronDown, Trash2, Eye, Pencil, Download, FileText, FileSpreadsheet, Printer, Plus, Save, Filter } from "lucide-react";
import "./propuestas.css";

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <h2 className="showcase-section-title">{title}</h2>
      <p className="showcase-section-desc">{desc}</p>
    </>
  );
}

function Card({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <div className="showcase-card">
      <span className="showcase-card-label">{label}</span>
      <span className="showcase-card-name">{name}</span>
      <div className="showcase-demo">{children}</div>
    </div>
  );
}

export default function PropuestasPage() {
  return (
    <div className="showcase-page">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Propuestas Gráficas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          4 tipos de botones · 5 inputs · 5 combos · 5 botones de grilla — Liquid Glass
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          4 TIPOS DE BOTONES
          ═══════════════════════════════════════════════════════════ */}
      <section className="showcase-section">
        <SectionTitle
          title="Botones"
          desc="4 tipos: Común y Común icono (teal) · Platino y Platino icono (slate). Todos 125px."
        />
        <div className="showcase-grid">
          <Card label="Común · sin icono" name="Glass Teal 125px">
            <button className="pg-btn-common">Nuevo</button>
            <button className="pg-btn-common">Guardar</button>
            <button className="pg-btn-common">Eliminar</button>
            <button className="pg-btn-common">Salir</button>
          </Card>

          <Card label="Común icono · con icono" name="Glass Teal 145px">
            <button className="pg-btn-common-icon">
              <Plus className="size-3.5" />
              Crear
            </button>
            <button className="pg-btn-common-icon">
              <Save className="size-3.5" />
              Guardar
            </button>
            <button className="pg-btn-common-icon">
              <Filter className="size-3.5" />
              Filtrar
            </button>
          </Card>

          <Card label="Platino · sin icono" name="Glass Slate 125px">
            <button className="pg-btn-platinum">Cancelar</button>
            <button className="pg-btn-platinum">Cerrar</button>
            <button className="pg-btn-platinum">Atrás</button>
            <button className="pg-btn-platinum">Saltar</button>
          </Card>

          <Card label="Platino icono · con icono" name="Glass Slate 145px">
            <button className="pg-btn-platinum-icon">
              <FileText className="size-3.5" />
              PDF
            </button>
            <button className="pg-btn-platinum-icon">
              <FileSpreadsheet className="size-3.5" />
              Excel
            </button>
            <button className="pg-btn-platinum-icon">
              <Download className="size-3.5" />
              Descargar
            </button>
            <button className="pg-btn-platinum-icon">
              <Printer className="size-3.5" />
              Imprimir
            </button>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          5 PROPUESTAS DE INPUTS
          ═══════════════════════════════════════════════════════════ */}
      <section className="showcase-section">
        <SectionTitle
          title="Inputs"
          desc="Campos de texto con Liquid Glass — blur, bordes sutiles, focus con glow azul."
        />
        <div className="showcase-grid">
          <Card label="I1 · Base" name="Glass Standard">
            <input className="pg-input-1" placeholder="Nombre del siniestro..." />
          </Card>

          <Card label="I2 · Búsqueda" name="Glass Pill">
            <input className="pg-input-2" placeholder="Buscar siniestro..." />
          </Card>

          <Card label="I3 · Hundido" name="Glass Pozo">
            <input className="pg-input-3" placeholder="Número de póliza..." />
          </Card>

          <Card label="I4 · Con icono" name="Glass + Icono">
            <div className="pg-input-wrap-4 w-full">
              <Search className="size-3.5 pg-input-icon-4" />
              <input className="pg-input-4" placeholder="Buscar asegurado..." />
            </div>
          </Card>

          <Card label="I5 · Flotante" name="Glass Premium">
            <input className="pg-input-5" placeholder="RUT del asegurado..." />
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          5 PROPUESTAS DE COMBO BOX
          ═══════════════════════════════════════════════════════════ */}
      <section className="showcase-section">
        <SectionTitle
          title="Combo Box"
          desc="Selects con Liquid Glass — mismo lenguaje visual que los inputs."
        />
        <div className="showcase-grid">
          <Card label="C1 · Base" name="Glass Standard">
            <button type="button" className="pg-combo-1 w-full">
              <span>Estado: Activo</span>
              <ChevronDown className="size-3.5 opacity-50" />
            </button>
          </Card>

          <Card label="C2 · Redondeado" name="Glass Pill">
            <button type="button" className="pg-combo-2 w-full">
              <span>Línea de negocio</span>
              <ChevronDown className="size-3.5 opacity-50" />
            </button>
          </Card>

          <Card label="C3 · Hundido" name="Glass Pozo">
            <button type="button" className="pg-combo-3 w-full">
              <span>Compañía</span>
              <ChevronDown className="size-3.5 opacity-50" />
            </button>
          </Card>

          <Card label="C4 · Flotante" name="Glass Premium">
            <button type="button" className="pg-combo-4 w-full">
              <span>País: Chile</span>
              <ChevronDown className="size-3.5 opacity-50" />
            </button>
          </Card>

          <Card label="C5 · Con badge" name="Glass + Indicador">
            <button type="button" className="pg-combo-5 w-full">
              <span className="pg-combo-5-dot" />
              <span>Estado: En revisión</span>
              <ChevronDown className="size-3.5 pg-combo-5-arrow" />
            </button>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          5 PROPUESTAS DE BOTONES DE GRILLA
          ═══════════════════════════════════════════════════════════ */}
      <section className="showcase-section">
        <SectionTitle
          title="Botones de Grilla"
          desc="Acciones dentro de tablas — íconos discretos que revelan Liquid Glass al hover."
        />
        <div className="showcase-grid">
          <Card label="G1 · Ícono" name="Glass Icon Cuadrado">
            <button className="pg-grid-1"><Eye className="size-3.5" /></button>
            <button className="pg-grid-1"><Pencil className="size-3.5" /></button>
            <button className="pg-grid-1"><Download className="size-3.5" /></button>
          </Card>

          <Card label="G2 · Ícono" name="Glass Icon Pill">
            <button className="pg-grid-2"><Eye className="size-3.5" /></button>
            <button className="pg-grid-2"><Pencil className="size-3.5" /></button>
            <button className="pg-grid-2"><Download className="size-3.5" /></button>
          </Card>

          <Card label="G3 · Ícono" name="Glass Icon Solid">
            <button className="pg-grid-3"><Eye className="size-3.5" /></button>
            <button className="pg-grid-3"><Pencil className="size-3.5" /></button>
            <button className="pg-grid-3"><Download className="size-3.5" /></button>
          </Card>

          <Card label="G4 · Peligro" name="Glass Icon Danger">
            <button className="pg-grid-4"><Trash2 className="size-3.5" /></button>
            <button className="pg-grid-4"><Trash2 className="size-3.5" /></button>
            <button className="pg-grid-4"><Trash2 className="size-3.5" /></button>
          </Card>

          <Card label="G5 · Chip" name="Glass Chip Action">
            <button className="pg-grid-5"><Eye className="size-3" />Ver</button>
            <button className="pg-grid-5"><Pencil className="size-3" />Editar</button>
            <button className="pg-grid-5"><Download className="size-3" />PDF</button>
          </Card>
        </div>
      </section>
    </div>
  );
}
