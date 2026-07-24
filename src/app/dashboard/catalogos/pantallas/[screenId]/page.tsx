"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  Code2,
  LayoutTemplate,
  Monitor,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getGestionScreens, updateGestionScreen, refreshPristineSnapshots } from "@/services/gestion-screens";

import {
  type ScreenField,
  type FieldCategory,
  widthClass,
  createField,
  OWN_FIELD_TYPES,
  OWN_FIELD_BASIC_TYPES,
  OWN_FIELD_COORD_TYPES,
  CLAIM_ENTITIES,
  CLAIM_ENTITIES_GENERAL,
  CLAIM_ENTITY_CARDS,
  CLAIM_ENTITIES_INSURED,
  CLAIM_ENTITIES_ADDRESS,
  CLAIM_ENTITIES_CONTACT,
  CLAIM_ENTITIES_RESERVE,
  ACTION_ENTITIES,
  COMPLEX_ENTITIES,
  CARD_FIELD_MAP,
} from "./types";
import { PaletteItem } from "./PaletteItem";
import { SortableFieldCard } from "./SortableFieldCard";
import { FieldPropertiesPanel } from "./FieldPropertiesPanel";
import { FieldPreview } from "./FieldPreview";

type ViewMode = "design" | "preview" | "json";

export default function ScreenBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const screenId = params.screenId as string;

  const [fields, setFields] = useState<ScreenField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ type: string; label: string; icon: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("design");
  const [dirty, setDirty] = useState(false);

  const { data: screens, isLoading } = useQuery({
    queryKey: ["gestion-screens"],
    queryFn: () => getGestionScreens(),
  });

  const screen = screens?.find((s) => s.id === screenId);

  const [loadedScreenId, setLoadedScreenId] = useState<string | null>(null);
  // Recargar campos cuando:
  // 1. Es la primera carga (loadedScreenId !== screen.id)
  // 2. El form_schema cambió en la BD y no hay cambios sin guardar
  // Esto permite que cambios externos a la pantalla se reflejen al refrescar
  if (screen && screen.id !== loadedScreenId && !dirty) {
    setLoadedScreenId(screen.id);
    const loaded = Array.isArray(screen.form_schema?.fields)
      ? (screen.form_schema.fields as ScreenField[])
      : [];
    setFields(loaded);
    setDirty(false);
  }

  const saveMut = useMutation({
    mutationFn: ({ id, schema }: { id: string; schema: Record<string, unknown> }) =>
      updateGestionScreen(id, schema),
    onSuccess: async () => {
      toast.success("Pantalla guardada");
      queryClient.invalidateQueries({ queryKey: ["gestion-screens"] });
      setDirty(false);

      // Refrescar snapshots de gestiones prístinas (sin datos, status=todo)
      // Las gestiones con datos o emitidas NO se tocan (protección contra inconsistencias).
      try {
        const result = await refreshPristineSnapshots();
        if (result.refreshed_count > 0) {
          toast.info(
            `${result.refreshed_count} gestión(es) prístina(s) refrescada(s) con la nueva pantalla. ` +
            `${result.protected_count} protegida(s) con datos.`
          );
          // Invalidar queries de gestiones para que se recarguen con el nuevo snapshot
          queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
          queryClient.invalidateQueries({ queryKey: ["claim-action"] });
        }
      } catch (err) {
        console.warn("[saveMut] No se pudieron refrescar snapshots prístinos:", err);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sensores para drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ═══ Operaciones sobre campos ═══

  const addField = useCallback((category: FieldCategory, type: string, label: string) => {
    const newField = createField(category, type, label);
    setFields((prev) => [...prev, newField]);
    setSelectedId(newField.id);
    setDirty(true);
  }, []);

  const updateField = useCallback((id: string, updates: Partial<ScreenField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    setDirty(true);
  }, []);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    setDirty(true);
  }, []);

  const reorderFields = useCallback((oldIndex: number, newIndex: number) => {
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
    setDirty(true);
  }, []);

  const duplicateField = useCallback((id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const orig = prev[idx];
      const copy: ScreenField = {
        ...orig,
        id: `${orig.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: `${orig.label} (copia)`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setSelectedId(copy.id);
      return next;
    });
    setDirty(true);
  }, []);

  // Desagrupar una card agrupada del siniestro en sus campos individuales.
  // Reemplaza la card en su posición por los N campos individuales que la componen.
  const ungroupField = useCallback((id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const card = prev[idx];
      const members = CARD_FIELD_MAP[card.type];
      if (!members) return prev;
      const stamp = Date.now();
      const newFields: ScreenField[] = members.map((m, i) => ({
        id: `${m.code}_${stamp}_${i}`,
        type: m.code,
        category: "simple_entity" as FieldCategory,
        label: m.label,
        width: m.width,
        required: false,
        readOnly: true,
      }));
      const next = [...prev];
      next.splice(idx, 1, ...newFields);
      if (newFields.length > 0) setSelectedId(newFields[0].id);
      return next;
    });
    setDirty(true);
  }, []);

  // ═══ DnD ═══

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.source === "palette") {
      // Buscar info del item en catálogos
      const all = [...OWN_FIELD_TYPES, ...CLAIM_ENTITIES, ...ACTION_ENTITIES, ...COMPLEX_ENTITIES];
      const item = all.find((t) => t.code === data.code);
      if (item) setActiveDrag({ type: data.code, label: item.label, icon: item.icon });
    } else if (data?.source === "canvas") {
      const field = fields.find((f) => f.id === e.active.id);
      if (field) {
        const all = [...OWN_FIELD_TYPES, ...CLAIM_ENTITIES, ...ACTION_ENTITIES, ...COMPLEX_ENTITIES];
        const item = all.find((t) => t.code === field.type);
        setActiveDrag({ type: field.type, label: field.label, icon: item?.icon || "□" });
      }
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Drop desde paleta → agregar campo
    if (activeData?.source === "palette") {
      const code = activeData.code as string;
      const isClaim = CLAIM_ENTITIES.some((t) => t.code === code);
      const isAction = ACTION_ENTITIES.some((t) => t.code === code);
      const isComplex = COMPLEX_ENTITIES.some((t) => t.code === code);

      const all = [...OWN_FIELD_TYPES, ...CLAIM_ENTITIES, ...ACTION_ENTITIES, ...COMPLEX_ENTITIES];
      const item = all.find((t) => t.code === code);
      if (!item) return;

      let category: FieldCategory = "own";
      if (isClaim || isAction) category = "simple_entity";
      if (isComplex) category = "complex_entity";

      addField(category, code, item.label);

      // Si se soltó sobre un campo existente, insertar antes de él
      if (overData?.source === "canvas" && overData.fieldId) {
        const overIdx = fields.findIndex((f) => f.id === overData.fieldId);
        if (overIdx >= 0) {
          // Mover el último (recién agregado) a la posición overIdx
          setFields((prev) => {
            const next = [...prev];
            const last = next.pop()!;
            next.splice(overIdx, 0, last);
            return next;
          });
        }
      }
      return;
    }

    // Reorder dentro del canvas
    if (activeData?.source === "canvas" && overData?.source === "canvas") {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === overData.fieldId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        reorderFields(oldIndex, newIndex);
      }
    }
  };

  const handleSave = () => {
    if (!screen) return;
    saveMut.mutate({ id: screen.id, schema: { fields } });
  };

  const handleBack = () => {
    if (dirty && !confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) return;
    router.push("/dashboard/catalogos/pantallas");
  };

  const selectedField = fields.find((f) => f.id === selectedId) || null;
  const dateFields = fields.filter((f) => f.type === "date" && f.id !== selectedId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Cargando pantalla...
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Monitor className="h-12 w-12 opacity-30" />
        <p>Pantalla no encontrada</p>
        <Button onClick={() => router.push("/dashboard/catalogos/pantallas")} className="pg-btn-platinum">
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background premium-bg-mesh">
      {/* ═══════════════════════════════════════════════════════════
          Top Bar — glassmorphism máximo
          ═══════════════════════════════════════════════════════════ */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 dark:border-white/5
                         bg-card/60 backdrop-blur-2xl saturate-150 px-4
                         shadow-[0_4px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
              <LayoutTemplate className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <h1 className="app-title">{screen.name}</h1>
              <p className="app-body text-muted-foreground font-mono">{screen.code}</p>
            </div>
          </div>
          {dirty && (
            <span className="ml-2 flex items-center gap-1 app-body text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Sin guardar
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle vista — glass */}
          <div className="flex items-center rounded-lg border border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5 backdrop-blur-md p-0.5">
            {([
              { mode: "design" as ViewMode, icon: LayoutTemplate, label: "Diseño" },
              { mode: "preview" as ViewMode, icon: Eye, label: "Vista" },
              { mode: "json" as ViewMode, icon: Code2, label: "JSON" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 app-body font-medium transition-all ${
                  viewMode === mode
                    ? "bg-card/80 backdrop-blur-sm text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (screen) {
                  const loaded = Array.isArray(screen.form_schema?.fields)
                    ? (screen.form_schema.fields as ScreenField[])
                    : [];
                  setFields(loaded);
                  setDirty(false);
                }
              }}
              className="pg-btn-platinum"
              title="Deshacer cambios"
            >
              Revertir
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMut.isPending || !dirty}
            className="pg-btn-platinum"
          >
            {saveMut.isPending ? "Guardando" : "Guardar"}
          </Button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          Cuerpo: 3 paneles
          ═══════════════════════════════════════════════════════════ */}
      {viewMode === "json" ? (
        <div className="flex-1 overflow-auto bg-zinc-950 p-6">
          <pre className="app-body text-zinc-300 font-mono leading-relaxed">
            {JSON.stringify({ fields }, null, 2)}
          </pre>
        </div>
      ) : viewMode === "preview" ? (
        <PreviewMode fields={fields} screenName={screen.name} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex flex-1 overflow-hidden">
            {/* ─── Panel izquierdo: Paleta — glass ─── */}
            <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/10 dark:border-white/5
                               bg-muted/20 backdrop-blur-2xl saturate-150">
              <div className="border-b border-white/10 dark:border-white/5 px-3 py-2">
                <p className="app-body font-semibold text-muted-foreground">Componentes</p>
                <p className="app-body text-muted-foreground/70 mt-0.5">Arrastra al lienzo →</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Campos propios */}
                <PaletteSection title="Campos propios" subtitle="Editables por el usuario" theme="blue">
                  <PaletteSubSection title="Básicos">
                    {OWN_FIELD_BASIC_TYPES.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                  <PaletteSubSection title="Coordinación de inspección">
                    {OWN_FIELD_COORD_TYPES.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                </PaletteSection>

                {/* Datos del siniestro */}
                <PaletteSection title="Datos del siniestro" subtitle="Solo lectura" theme="emerald">
                  <PaletteSubSection title="Generales">
                    {CLAIM_ENTITIES_GENERAL.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                  <PaletteSubSection title="Cards agrupadas">
                    {CLAIM_ENTITY_CARDS.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                  <PaletteSubSection title="Asegurado (individual)">
                    {CLAIM_ENTITIES_INSURED.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                  <PaletteSubSection title="Dirección del siniestro (individual)">
                    {CLAIM_ENTITIES_ADDRESS.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                  <PaletteSubSection title="Contacto (individual)">
                    {CLAIM_ENTITIES_CONTACT.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                  <PaletteSubSection title="Reserva">
                    {CLAIM_ENTITIES_RESERVE.map((t) => (
                      <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                    ))}
                  </PaletteSubSection>
                </PaletteSection>

                {/* Datos de la gestión */}
                <PaletteSection title="Datos de la gestión" subtitle="Solo lectura" theme="amber">
                  {ACTION_ENTITIES.map((t) => (
                    <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                  ))}
                </PaletteSection>

                {/* Entidades complejas */}
                <PaletteSection title="Entidades complejas" subtitle="Solo lectura · Estructuras" theme="violet">
                  {COMPLEX_ENTITIES.map((t) => (
                    <PaletteItem key={t.code} code={t.code} label={t.label} icon={t.icon} desc={t.desc} />
                  ))}
                </PaletteSection>
              </div>
            </aside>

            {/* ─── Panel central: Canvas — glass ─── */}
            <main className="flex flex-1 flex-col overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm">
              {/* Toolbar del canvas — glass */}
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 dark:border-white/5
                               bg-card/40 backdrop-blur-xl px-4">
                <div className="flex items-center gap-3">
                  <p className="app-body font-medium text-muted-foreground">Lienzo</p>
                  <span className="app-body text-muted-foreground">
                    {fields.length} campo{fields.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 app-body text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-white/10 bg-white/5 backdrop-blur-sm px-1 py-0.5 app-body">Espacio</kbd>
                    arrastrar
                  </span>
                </div>
              </div>

              {/* Canvas scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* "Hoja" del formulario — glass máximo */}
                <div className="mx-auto max-w-3xl rounded-xl border border-white/15 dark:border-white/10
                                bg-card/70 backdrop-blur-2xl saturate-150
                                shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                  <div className="border-b border-white/10 dark:border-white/5 px-5 py-3">
                    <p className="app-title">{screen.name}</p>
                    <p className="app-body text-muted-foreground">{screen.description || "Vista previa del formulario"}</p>
                  </div>

                  {fields.length === 0 ? (
                    <DropEmptyZone onAdd={addField} />
                  ) : (
                    <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-3 p-5">
                      {fields.map((field) => (
                        <div key={field.id} className={widthClass(field.width)}>
                          <SortableFieldCard
                            field={field}
                            selected={selectedId === field.id}
                            onSelect={() => setSelectedId(field.id)}
                            onRemove={() => removeField(field.id)}
                            onDuplicate={() => duplicateField(field.id)}
                          />
                        </div>
                      ))}

                      {/* Drop zone al final */}
                      <div className="col-span-[60]">
                        <DropZone />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </main>

            {/* ─── Panel derecho: Propiedades — glass ─── */}
            <aside className="flex w-[300px] shrink-0 flex-col border-l border-white/10 dark:border-white/5
                               bg-muted/20 backdrop-blur-2xl saturate-150">
              <div className="border-b border-white/10 dark:border-white/5 px-3 py-2">
                <p className="app-body font-semibold text-muted-foreground">Propiedades</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {selectedField ? (
                  <FieldPropertiesPanel
                    field={selectedField}
                    allFields={fields}
                    dateFields={dateFields}
                    onUpdate={(updates) => updateField(selectedField.id, updates)}
                    onRemove={() => removeField(selectedField.id)}
                    onDuplicate={() => duplicateField(selectedField.id)}
                    onUngroup={() => ungroupField(selectedField.id)}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <LayoutTemplate className="h-8 w-8 opacity-20" />
                    <p className="app-body px-4">
                      Selecciona un campo del lienzo para editar sus propiedades
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeDrag ? (
              <div className="flex items-center gap-2 rounded-lg border-2 border-primary/50
                              bg-card/80 backdrop-blur-2xl saturate-150 px-3 py-2
                              shadow-[0_8px_30px_rgba(0,0,0,0.12)] opacity-90">
                <span className="app-body">{activeDrag.icon}</span>
                <span className="app-body font-medium">{activeDrag.label}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sección de paleta
// ═══════════════════════════════════════════════════════════════

type PaletteTheme = "blue" | "emerald" | "violet" | "amber" | "slate";

function PaletteSection({
  title,
  subtitle,
  theme = "slate",
  children,
}: {
  title: string;
  subtitle: string;
  theme?: PaletteTheme;
  children: React.ReactNode;
}) {
  const themeClasses = {
    blue: "border-blue-300/40 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-900/15",
    emerald: "border-emerald-300/40 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-900/15",
    violet: "border-violet-300/40 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-900/15",
    amber: "border-amber-300/40 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/15",
    slate: "border-border/50 bg-card/40 dark:bg-card/30",
  };
  return (
    <div className={`rounded-lg border p-2.5 space-y-2.5 ${themeClasses[theme]}`}>
      <div>
        <p className="app-body font-semibold text-foreground/90">{title}</p>
        <p className="app-body text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PaletteSubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="app-body font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Zona de drop vacía
// ═══════════════════════════════════════════════════════════════

function DropEmptyZone({ onAdd }: { onAdd: (cat: FieldCategory, type: string, label: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-white/15 dark:border-white/10
                      bg-white/5 dark:bg-white/5 backdrop-blur-md">
        <LayoutTemplate className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="app-body font-medium text-muted-foreground">El lienzo está vacío</p>
        <p className="app-body text-muted-foreground/70 mt-1">
          Arrastra componentes desde el panel izquierdo
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
        {OWN_FIELD_TYPES.slice(0, 4).map((t) => (
          <button
            key={t.code}
            onClick={() => onAdd("own", t.code, t.label)}
            className="flex items-center gap-1.5 rounded-md border border-white/10 dark:border-white/5
                       bg-card/60 backdrop-blur-md px-2.5 py-1.5 app-body
                       hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Drop zone al final del canvas
// ═══════════════════════════════════════════════════════════════

function DropZone() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 py-3 app-body text-muted-foreground/50">
      Suelta aquí para agregar al final
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modo vista previa
// ═══════════════════════════════════════════════════════════════

function PreviewMode({ fields, screenName }: { fields: ScreenField[]; screenName: string }) {
  const ownFields = fields.filter((f) => f.category === "own");
  const simpleEntities = fields.filter((f) => f.category === "simple_entity");
  const complexEntities = fields.filter((f) => f.category === "complex_entity");

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl border border-white/15 dark:border-white/10
                        bg-card/70 backdrop-blur-2xl saturate-150 p-5
                        shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
          <h2 className="app-body font-semibold mb-1">{screenName}</h2>
          <p className="app-body text-muted-foreground mb-4">Vista previa del formulario</p>

          {simpleEntities.length > 0 && (
            <section className="mb-4">
              <h4 className="app-body font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Datos del Siniestro / Gestión
              </h4>
              <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-3">
                {simpleEntities.map((field) => (
                  <div key={field.id} className={widthClass(field.width)}>
                    <FieldPreview field={field} allFields={fields} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {ownFields.length > 0 && (
            <section className="mb-4">
              <h4 className="app-body font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Formulario
              </h4>
              <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-3">
                {ownFields.map((field) => (
                  <div key={field.id} className={widthClass(field.width)}>
                    <FieldPreview field={field} allFields={fields} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {complexEntities.length > 0 && (
            <section>
              <h4 className="app-body font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Entidades Complejas
              </h4>
              <div className="space-y-3">
                {complexEntities.map((field) => (
                  <div key={field.id}>
                    <FieldPreview field={field} allFields={fields} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {fields.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <LayoutTemplate className="h-10 w-10 opacity-20" />
              <p className="app-body mt-2">Sin campos para previsualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
