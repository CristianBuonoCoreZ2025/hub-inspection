"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDependencies, createDependency, deleteDependency } from "@/services/template-dependencies";
import { getActionTemplates } from "@/services/actions";
import { toast } from "sonner";
import { Plus, Trash2, Link2, ArrowRight, ChevronRight } from "lucide-react";
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
  const [parentCode, setParentCode] = useState("");
  const [childCode, setChildCode] = useState("");

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
      setParentCode("");
      setChildCode("");
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

  // Templates activos: extraer codigos unicos con su nombre
  const codeMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    for (const t of (templates || []).filter(t => t.is_active && t.code)) {
      if (!m.has(t.code!)) m.set(t.code!, { code: t.code!, name: t.name });
    }
    return Array.from(m.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [templates]);

  // Agrupar por codigo padre y construir cadenas
  const chains = useMemo(() => {
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, string[]>();

    for (const dep of dependencies || []) {
      childToParent.set(dep.child_code, dep.parent_code);
      if (!parentToChildren.has(dep.parent_code)) parentToChildren.set(dep.parent_code, []);
      parentToChildren.get(dep.parent_code)!.push(dep.child_code);
    }

    // Encontrar raices (padres que no son hijos de nadie)
    const roots: string[] = [];
    for (const dep of dependencies || []) {
      if (!childToParent.has(dep.parent_code)) {
        if (!roots.includes(dep.parent_code)) roots.push(dep.parent_code);
      }
    }

    // Construir cadena completa desde cada raiz
    function buildChain(code: string, level: number): { code: string; level: number }[] {
      const result: { code: string; level: number }[] = [{ code, level }];
      const children = parentToChildren.get(code) || [];
      for (const child of children) {
        result.push(...buildChain(child, level + 1));
      }
      return result;
    }

    return roots.map(root => ({
      root,
      chain: buildChain(root, 0),
    }));
  }, [dependencies]);

  // Codigos hijos ya usados (para no duplicar)
  const usedChildCodes = useMemo(() => new Set((dependencies || []).map(d => d.child_code)), [dependencies]);

  // Para el select de hijos: excluir el padre y los que ya son hijos de ese padre
  const availableChildren = useMemo(() => {
    const existingForParent = new Set(
      (dependencies || []).filter(d => d.parent_code === parentCode).map(d => d.child_code)
    );
    return codeMap.filter(c => c.code !== parentCode && !existingForParent.has(c.code));
  }, [codeMap, dependencies, parentCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentCode || !childCode) { toast.error("Selecciona ambas gestiones"); return; }
    if (parentCode === childCode) { toast.error("Una gestión no puede depender de sí misma"); return; }
    createMutation.mutate({ parent: parentCode, child: childCode });
  };

  const nameFor = (code: string) => codeMap.find(c => c.code === code)?.name || code;
  const depIdFor = (parent: string, child: string) =>
    (dependencies || []).find(d => d.parent_code === parent && d.child_code === child)?.id;

  return (
    <div className="app-page">
      {/* Header glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
                      bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                      shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                      px-5 py-4">
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl
                          bg-linear-to-br from-violet-500/20 to-sky-500/20 backdrop-blur-sm
                          border border-white/10">
            <Link2 className="h-5 w-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Dependencias de Gestiones</h1>
            <p className="text-[13px] text-muted-foreground">
              Paquetes de gestiones que se crean en cadena. Globales: aplican a todos los workflows.
            </p>
          </div>
          {canCreate("catalogos") && (
            <Button onClick={() => { setParentCode(""); setChildCode(""); setOpen(true); }} className="btn-create btn-sm">
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          )}
        </div>
      </div>

      {/* Cadenas de dependencias */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</div>
      ) : chains.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
                        bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl px-5 py-12 text-center">
          <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
          <Link2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay dependencias configuradas.
            <br />
            Las gestiones dependientes se crean automáticamente al emitir la gestión padre.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {chains.map(({ root, chain }) => (
            <div key={root}
                 className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
                            bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                            shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2)]
                            p-4">
              <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-violet-500/5 blur-2xl" />

              {/* Cadena visual */}
              <div className="relative flex flex-wrap items-center gap-2">
                {chain.map((item, idx) => {
                  const isRoot = item.level === 0;
                  const isLast = idx === chain.length - 1;
                  const depId = item.level > 0 ? depIdFor(chain[idx - 1].code, item.code) : undefined;
                  return (
                    <div key={`${item.code}-${idx}`} className="flex items-center gap-2">
                      {/* Nodo */}
                      <div className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2
                                       border transition-all duration-200
                                       ${isRoot
                                         ? "bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/15"
                                         : "bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/15"}`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[10px] font-bold
                                         ${isRoot
                                           ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                                           : "bg-sky-500/20 text-sky-400 border border-sky-500/30"}`}>
                          {item.code.slice(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-semibold leading-tight">{item.code}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{nameFor(item.code)}</span>
                        </div>
                        {isRoot && (
                          <span className="ml-1 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-400">
                            RAÍZ
                          </span>
                        )}
                        {!isRoot && canDelete("catalogos") && depId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-danger btn-icon ml-1 h-6 w-6"
                            onClick={() => {
                              if (confirm(`¿Eliminar dependencia ${chain[idx - 1].code} → ${item.code}?`))
                                deleteMutation.mutate(depId);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {/* Conector */}
                      {!isLast && (
                        <div className="flex items-center gap-0.5 text-muted-foreground/50">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info */}
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span>Nivel 1 (raíz)</span>
                </div>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <span>Se crea automáticamente al emitir la padre</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear */}
      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-sm !bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border-white/20 dark:!border-white/10 !shadow-2xl">
          <div className="modal-header">
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-sky-500 text-white shadow-sm">
                <Link2 className="h-4 w-4" />
              </div>
              Nueva Dependencia
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-3">
              <div className="rounded-xl bg-violet-500/5 border border-violet-500/10 px-3 py-2.5 text-[11px] text-muted-foreground">
                La gestión <strong className="text-violet-400">padre</strong> es la que se agrega al workflow.
                La gestión <strong className="text-sky-400">hija</strong> se crea automáticamente al emitir la padre,
                en estado pendiente.
              </div>
              <div>
                <Label className="app-field-label">Gestión Padre (raíz) <span className="text-red-500">*</span></Label>
                <select
                  className="app-input w-full"
                  value={parentCode}
                  onChange={(e) => { setParentCode(e.target.value); setChildCode(""); }}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {codeMap.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="app-field-label">Gestión Hija (dependiente) <span className="text-red-500">*</span></Label>
                <select
                  className="app-input w-full"
                  value={childCode}
                  onChange={(e) => setChildCode(e.target.value)}
                  disabled={!parentCode}
                  required
                >
                  <option value="">{!parentCode ? "Primero selecciona padre..." : "Seleccionar..."}</option>
                  {availableChildren.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
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
