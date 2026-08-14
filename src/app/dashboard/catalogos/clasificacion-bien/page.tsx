"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
  getPropertyClassifications,
  createPropertyClassification,
  updatePropertyClassification,
  deletePropertyClassification,
  getHousingDestinations,
  getClassificationDestinations,
  setClassificationDestinations,
} from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Ban, Home, Boxes, Settings2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import type { PropertyClassification } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldConfigEditor, type FieldConfig } from "@/components/ui/field-config-editor";

interface FormData {
  name: string;
  description: string;
}

export default function PropertyClassificationPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: "", description: "" });
  const [configOpen, setConfigOpen] = useState(false);
  const [configItem, setConfigItem] = useState<PropertyClassification | null>(null);
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [relationsItem, setRelationsItem] = useState<PropertyClassification | null>(null);
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<Set<string>>(new Set());

  const { data: items, isLoading } = useQuery({
    queryKey: ["clasificacion_bien"],
    queryFn: getPropertyClassifications,
  });
  const { data: housingDestinations = [] } = useQuery({
    queryKey: ["housing-destinations"],
    queryFn: getHousingDestinations,
  });
  const { data: classificationDestinations = [] } = useQuery({
    queryKey: ["classification-destinations"],
    queryFn: getClassificationDestinations,
  });

  const createMutation = useMutation({
    mutationFn: createPropertyClassification,
    onSuccess: () => {
      toast.success("Clasificación del Bien creada");
      queryClient.invalidateQueries({ queryKey: ["clasificacion_bien"] });
      queryClient.invalidateQueries({ queryKey: ["property-classifications"] });
      setOpen(false);
      setFormData({ name: "", description: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updatePropertyClassification>[1] }) => updatePropertyClassification(id, input),
    onSuccess: () => {
      toast.success("Clasificación del Bien actualizada");
      queryClient.invalidateQueries({ queryKey: ["clasificacion_bien"] });
      queryClient.invalidateQueries({ queryKey: ["property-classifications"] });
      setOpen(false);
      setEditingId(null);
      setFormData({ name: "", description: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: FieldConfig }) => updatePropertyClassification(id, { field_config: config as unknown as Record<string, unknown> }),
    onSuccess: () => {
      toast.success("Configuración de campos actualizada");
      queryClient.invalidateQueries({ queryKey: ["clasificacion_bien"] });
      queryClient.invalidateQueries({ queryKey: ["property-classifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setRelationsMutation = useMutation({
    mutationFn: async ({ id, destinationIds, removedDestTypes, currentFieldConfig }: {
      id: string;
      destinationIds: string[];
      removedDestTypes: string[];
      currentFieldConfig?: Record<string, unknown>;
    }) => {
      // 1. Guardar las nuevas relaciones
      await setClassificationDestinations(id, destinationIds);

      // 2. Si se quitaron tipos de destino, limpiar esa columna del field_config
      if (removedDestTypes.length > 0 && currentFieldConfig) {
        const cfg = { ...currentFieldConfig } as Record<string, unknown>;

        // Limpiar show: si es objeto, vaciar los arrays de los tipos removidos
        const show = cfg.show;
        if (show && typeof show === "object" && !Array.isArray(show)) {
          const showObj = { ...(show as Record<string, string[]>) };
          for (const t of removedDestTypes) {
            showObj[t] = [];
          }
          cfg.show = showObj;
        }

        // Limpiar labels: si un label es objeto, borrar la clave del tipo removido
        const labels = cfg.labels;
        if (labels && typeof labels === "object") {
          const labelsObj = { ...(labels as Record<string, unknown>) };
          for (const [key, value] of Object.entries(labelsObj)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              const labelObj = { ...(value as Record<string, string>) };
              for (const t of removedDestTypes) {
                delete labelObj[t];
              }
              // Si quedó vacío, dejar string vacío o borrar
              if (Object.keys(labelObj).length === 0) {
                delete labelsObj[key];
              } else {
                labelsObj[key] = labelObj;
              }
            }
          }
          cfg.labels = labelsObj;
        }

        await updatePropertyClassification(id, { field_config: cfg });
      }
    },
    onSuccess: () => {
      toast.success("Destinos relacionados actualizados");
      queryClient.invalidateQueries({ queryKey: ["classification-destinations"] });
      queryClient.invalidateQueries({ queryKey: ["clasificacion_bien"] });
      queryClient.invalidateQueries({ queryKey: ["property-classifications"] });
      setRelationsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePropertyClassification,
    onSuccess: () => {
      toast.success("Clasificación del Bien desactivada");
      queryClient.invalidateQueries({ queryKey: ["clasificacion_bien"] });
      queryClient.invalidateQueries({ queryKey: ["property-classifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = items?.filter((c) =>
    [c.name, c.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (c) => c.name,
    description: (c) => c.description,
  }, "name");
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  // Destinos relacionados para una clasificación
  const getRelatedDestinationNames = (classificationId: string): string => {
    const relatedIds = classificationDestinations
      .filter((r) => r.classification_id === classificationId)
      .map((r) => r.destination_id);
    const names = housingDestinations
      .filter((d) => relatedIds.includes(d.id))
      .map((d) => d.name);
    return names.length > 0 ? names.join(", ") : "—";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nombre es requerido");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openRelations = (item: PropertyClassification) => {
    setRelationsItem(item);
    const relatedIds = new Set(
      classificationDestinations
        .filter((r) => r.classification_id === item.id)
        .map((r) => r.destination_id)
    );
    setSelectedDestinationIds(relatedIds);
    setRelationsOpen(true);
  };

  const toggleDestination = (destId: string) => {
    setSelectedDestinationIds((prev) => {
      const next = new Set(prev);
      if (next.has(destId)) {
        next.delete(destId);
      } else {
        next.add(destId);
      }
      return next;
    });
  };

  const handleSaveRelations = () => {
    if (!relationsItem) return;
    const newDestinationIds = Array.from(selectedDestinationIds);

    // Calcular qué tipos de destino se mantienen vs se quitaron
    const newDestTypes = new Set<string>();
    for (const destId of newDestinationIds) {
      const dest = housingDestinations.find((d) => d.id === destId);
      if (dest?.destination_type) newDestTypes.add(dest.destination_type);
    }

    // Tipos que tenía antes (según relaciones actuales)
    const oldDestTypes = new Set<string>();
    for (const r of classificationDestinations.filter((r) => r.classification_id === relationsItem.id)) {
      const dest = housingDestinations.find((d) => d.id === r.destination_id);
      if (dest?.destination_type) oldDestTypes.add(dest.destination_type);
    }

    // Tipos que se quitaron → limpiar esa columna del field_config
    const removedTypes = [...oldDestTypes].filter((t) => !newDestTypes.has(t));

    setRelationsMutation.mutate({
      id: relationsItem.id,
      destinationIds: newDestinationIds,
      removedDestTypes: removedTypes,
      currentFieldConfig: relationsItem.field_config,
    });
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-violet">
            <Boxes />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Clasificación del Bien</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          {canCreate("catalogos") && (
            <Button onClick={() => { setEditingId(null); setFormData({ name: "", description: "" }); setOpen(true); }} className="pg-btn-platinum">
              Nueva
            </Button>
          )}
        </div>
      </div>

      <div className="app-panel">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
            </div>
          </div>
          <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="w-10"></th>
                <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
                <SortableTh sortKey="description" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descripción</SortableTh>
                <th>Destinos relacionados</th>
                <th className="w-30"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id}>
                    <td><StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Activo" : "Inactivo"} /></td>
                    <td className="font-medium">{item.name}</td>
                    <td className="font-medium">{item.description}</td>
                    <td className="font-medium text-muted-foreground">{getRelatedDestinationNames(item.id)}</td>
                    <td>
                      <div className="app-row-actions">
                        {canEdit("catalogos") && (
                          <button type="button" className="btn-icon-sm" onClick={() => {
                            setEditingId(item.id);
                            setFormData({ name: item.name || "", description: item.description || "" });
                            setOpen(true);
                          }}><Pencil className="h-4 w-4" /></button>
                        )}
                        {canEdit("catalogos") && (
                          <button type="button" className="btn-icon-sm" onClick={() => openRelations(item)} title="Destinos relacionados">
                            <Home className="h-4 w-4" />
                          </button>
                        )}
                        {canEdit("catalogos") && (
                          <button type="button" className="btn-icon-sm" onClick={() => {
                            setConfigItem(item);
                            setConfigOpen(true);
                          }}><Settings2 className="h-4 w-4" /></button>
                        )}
                        {canDelete("catalogos") && (
                          <button type="button" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("Desactivar?")) deleteMutation.mutate(item.id); }}>
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icn-sky text-white shadow-sm">
                <Home className="h-4 w-4" />
              </div>
              {editingId ? "Editar" : "Nueva"} Clasificación del Bien
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body modal-grid">
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Descripción</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción" className="app-input" />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="pg-btn-platinum">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending} className="pg-btn-platinum">
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog destinos relacionados */}
      <Dialog open={relationsOpen} onOpenChange={setRelationsOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icn-violet text-white shadow-sm">
                <Home className="h-4 w-4" />
              </div>
              Destinos relacionados — {relationsItem?.name}
            </DialogTitle>
          </div>
          <div className="modal-body">
            <p className="text-sm text-muted-foreground mb-3">
              Selecciona los destinos del bien donde aplica esta clasificación.
            </p>
            <div className="space-y-2">
              {housingDestinations.map((dest) => {
                const isSelected = selectedDestinationIds.has(dest.id);
                const destType = dest.destination_type === "residential" ? "Habitacional" : dest.destination_type === "commercial" ? "Comercial" : "—";
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => toggleDestination(dest.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-sm font-medium">{dest.name}</span>
                    <span className="text-xs text-muted-foreground">{destType}</span>
                  </button>
                );
              })}
              {housingDestinations.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay destinos configurados.</p>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" size="sm" onClick={() => setRelationsOpen(false)} className="pg-btn-platinum">Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSaveRelations} disabled={setRelationsMutation.isPending} className="pg-btn-platinum">
              {setRelationsMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog configuración de campos */}
      {configItem && (
        <FieldConfigEditor
          open={configOpen}
          onOpenChange={setConfigOpen}
          currentConfig={configItem.field_config as FieldConfig | undefined}
          onSave={(config) => updateConfigMutation.mutate({ id: configItem.id, config })}
          itemName={configItem.name}
        />
      )}
    </div>
  );
}
