"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDependencies, createDependency, deleteDependency } from "@/services/template-dependencies";
import { getActionTemplates } from "@/services/actions";
import { toast } from "sonner";
import { Plus, Trash2, Link2, ArrowRight } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DependenciasGestionPage() {
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");

  const { data: dependencies, isLoading } = useQuery({
    queryKey: ["template-dependencies"],
    queryFn: getDependencies,
  });

  const { data: templates } = useQuery({
    queryKey: ["action-templates-all"],
    queryFn: getActionTemplates,
  });

  const createMutation = useMutation({
    mutationFn: ({ parent, child }: { parent: string; child: string }) => createDependency(parent, child),
    onSuccess: () => {
      toast.success("Dependencia creada");
      queryClient.invalidateQueries({ queryKey: ["template-dependencies"] });
      setOpen(false);
      setParentId("");
      setChildId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDependency,
    onSuccess: () => {
      toast.success("Dependencia eliminada");
      queryClient.invalidateQueries({ queryKey: ["template-dependencies"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Templates activos para los selects
  const activeTemplates = useMemo(() =>
    (templates || []).filter(t => t.is_active).sort((a, b) => (a.code || "").localeCompare(b.code || "")),
    [templates]
  );

  // Mapa para buscar templates rapidamente
  const templateMap = useMemo(() => new Map(activeTemplates.map(t => [t.id, t])), [activeTemplates]);

  // Agrupar por template padre
  const grouped = useMemo(() => {
    const map = new Map<string, { parent: typeof activeTemplates[0]; children: typeof activeTemplates }>();
    for (const dep of dependencies || []) {
      const parent = templateMap.get(dep.parent_template_id);
      const child = templateMap.get(dep.child_template_id);
      if (!parent || !child) continue;
      if (!map.has(dep.parent_template_id)) {
        map.set(dep.parent_template_id, { parent, children: [] });
      }
      map.get(dep.parent_template_id)!.children.push(child);
    }
    return Array.from(map.values()).sort((a, b) => (a.parent.code || "").localeCompare(b.parent.code || ""));
  }, [dependencies, templateMap]);

  // Hijos ya usados (para no duplicar)
  const usedChildIds = useMemo(() => new Set((dependencies || []).map(d => d.child_template_id)), [dependencies]);

  // Para el select de hijos: excluir el padre seleccionado y los que ya son hijos de ese padre
  const availableChildren = useMemo(() => {
    const existingForParent = new Set(
      (dependencies || []).filter(d => d.parent_template_id === parentId).map(d => d.child_template_id)
    );
    return activeTemplates.filter(t => t.id !== parentId && !existingForParent.has(t.id));
  }, [activeTemplates, dependencies, parentId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentId || !childId) { toast.error("Selecciona ambas gestiones"); return; }
    if (parentId === childId) { toast.error("Una gestión no puede depender de sí misma"); return; }
    createMutation.mutate({ parent: parentId, child: childId });
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Dependencias de Gestiones</h1>
        <p className="app-page-lead">
          Define paquetes de gestiones que se crean automáticamente en cadena. Ej: Cobertura → Reserva → Ajuste.
          Estas relaciones son globales y aplican a todos los workflows.
        </p>
      </header>

      <div className="app-toolbar">
        <div className="flex-1" />
        {canCreate("catalogos") && (
          <Button onClick={() => { setParentId(""); setChildId(""); setOpen(true); }} className="btn-create btn-sm">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      <div className="app-panel">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Cargando...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No hay dependencias configuradas. Las gestiones dependientes no aparecerán en el workflow builder;
            se agregan automáticamente cuando se agrega la gestión padre.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ parent, children }) => (
              <div key={parent.id} className="rounded-xl border border-white/10 dark:border-white/5 bg-white/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <span className="font-mono text-[10px] font-bold text-violet-400">{(parent.code || "?").slice(0, 2)}</span>
                  </div>
                  <span className="font-medium">{parent.name}</span>
                  <span className="text-muted-foreground text-xs font-mono">({parent.code})</span>
                  <span className="ml-auto text-xs text-muted-foreground">{children.length} dependiente(s)</span>
                </div>
                <div className="ml-9 space-y-2">
                  {children.map((child, idx) => {
                    const dep = (dependencies || []).find(d => d.parent_template_id === parent.id && d.child_template_id === child.id);
                    return (
                      <div key={child.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Nivel {idx + 2}</span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 border border-sky-500/20">
                          <span className="font-mono text-[9px] font-bold text-sky-400">{(child.code || "?").slice(0, 2)}</span>
                        </div>
                        <span className="text-sm">{child.name}</span>
                        <span className="text-muted-foreground text-xs font-mono">({child.code})</span>
                        {canDelete("catalogos") && dep && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-danger btn-icon ml-auto"
                            onClick={() => { if (confirm(`¿Eliminar dependencia ${parent.code} → ${child.code}?`)) deleteMutation.mutate(dep.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-sky-500 text-white shadow-sm">
                <Link2 className="h-4 w-4" />
              </div>
              Nueva Dependencia
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-3">
              <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 px-3 py-2 text-xs text-muted-foreground">
                La gestión <strong>padre</strong> es la que se agrega al workflow. La gestión <strong>hija</strong> se crea
                automáticamente al emitir la padre, en estado pendiente.
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Gestión Padre (raíz) <span className="text-red-500">*</span></Label>
                <select
                  className="app-input w-full"
                  value={parentId}
                  onChange={(e) => { setParentId(e.target.value); setChildId(""); }}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {activeTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Gestión Hija (dependiente) <span className="text-red-500">*</span></Label>
                <select
                  className="app-input w-full"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  disabled={!parentId}
                  required
                >
                  <option value="">{!parentId ? "Primero selecciona padre..." : "Seleccionar..."}</option>
                  {availableChildren.map(t => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="btn-cancel btn-footer">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending} className="btn-save btn-footer">
                {createMutation.isPending ? "Guardando..." : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
