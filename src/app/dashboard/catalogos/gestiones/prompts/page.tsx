"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { getAiPrompts, updateAiPrompt } from "@/services/ai-prompts";
import { getBusinessLines } from "@/services/catalogs";
import { toast } from "sonner";
import { Search, Pencil, Sparkles, FileText, ImageIcon } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AiPrompt } from "@/types";

export default function PromptsPage() {
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    business_line_id: string;
    prompt_type: "image" | "document";
    name: string;
    system_prompt: string;
    user_prompt: string;
    refinement_prompt: string;
  }>({ business_line_id: "", prompt_type: "image", name: "", system_prompt: "", user_prompt: "", refinement_prompt: "" });

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["ai-prompts"],
    queryFn: getAiPrompts,
  });

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: getBusinessLines,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAiPrompt>[1] }) => updateAiPrompt(id, input),
    onSuccess: () => { toast.success("Prompt actualizado"); queryClient.invalidateQueries({ queryKey: ["ai-prompts"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = prompts?.filter((p) =>
    [p.name, p.prompt_type, p.business_line?.name || "Genérico"].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(filtered);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!formData.system_prompt.trim()) { toast.error("El system prompt es requerido"); return; }
    if (!formData.user_prompt.trim()) { toast.error("El user prompt es requerido"); return; }

    updateMutation.mutate({
      id: editingId,
      input: {
        name: formData.name,
        system_prompt: formData.system_prompt,
        user_prompt: formData.user_prompt,
        refinement_prompt: formData.refinement_prompt || null,
      },
    });
  };

  const openEdit = (p: AiPrompt) => {
    setEditingId(p.id);
    setFormData({
      business_line_id: p.business_line_id || "",
      prompt_type: p.prompt_type,
      name: p.name,
      system_prompt: p.system_prompt,
      user_prompt: p.user_prompt,
      refinement_prompt: p.refinement_prompt || "",
    });
    setOpen(true);
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-violet-500 to-purple-500">
            <Sparkles />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Prompts IA</h1>
          </div>
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
                <th>Tipo</th>
                <th>Línea de Negocio</th>
                <th>Nombre</th>
                <th>System Prompt</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
              ) : paginatedData.map((p) => (
                <tr key={p.id}>
                  <td><StatusBadge status="active" label="Activo" /></td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                      {p.prompt_type === "image" ? (
                        <><ImageIcon className="h-3.5 w-3.5 text-blue-500" /> Imagen</>
                      ) : (
                        <><FileText className="h-3.5 w-3.5 text-emerald-500" /> Documento</>
                      )}
                    </span>
                  </td>
                  <td>
                    {p.business_line?.name ? (
                      <span className="font-medium">{p.business_line.name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Genérico (todas)</span>
                    )}
                  </td>
                  <td className="font-medium">{p.name}</td>
                  <td className="max-w-100">
                    <div className="truncate text-muted-foreground text-[11px]" title={p.system_prompt}>
                      {p.system_prompt.slice(0, 120)}...
                    </div>
                  </td>
                  <td>
                    <div className="app-row-actions">
                      {canEdit("catalogos") && (
                        <button type="button" className="btn-icon-sm" onClick={() => openEdit(p)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Modal crear/editar */}
      <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
        <DialogContent className="modal-lg" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              Editar Prompt
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Fila 1: Tipo + Línea + Nombre en 3 columnas */}
              <div className="modal-grid-3">
                <div className="modal-field">
                  <Label className="app-field-label">Tipo</Label>
                  <Select
                    value={formData.prompt_type}
                    onValueChange={(v) => setFormData({ ...formData, prompt_type: (v as "image" | "document") || "image" })}
                    disabled={!!editingId}
                    items={[
                      { value: "image", label: "Imagen" },
                      { value: "document", label: "Documento" },
                    ]}
                  >
                    <SelectTrigger className="app-input h-7" disabled={!!editingId}>
                      <SelectValue placeholder="Tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagen</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="modal-field">
                  <Label className="app-field-label">Línea de Negocio</Label>
                  <Select
                    value={formData.business_line_id || "__generic"}
                    onValueChange={(v) => setFormData({ ...formData, business_line_id: v === "__generic" ? "" : (v ?? "") })}
                    disabled={!!editingId}
                    items={[
                      { value: "__generic", label: "Genérico" },
                      ...(businessLines || []).map((bl) => ({ value: bl.id, label: bl.name })),
                    ]}
                  >
                    <SelectTrigger className="app-input h-7" disabled={!!editingId}>
                      <SelectValue placeholder="Línea..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__generic">Genérico</SelectItem>
                      {businessLines?.map((bl) => (
                        <SelectItem key={bl.id} value={bl.id}>{bl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="modal-field">
                  <Label className="app-field-label">Nombre</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ej: Hogar - Imágenes"
                    className="app-input"
                  />
                </div>
              </div>

              {/* System Prompt — altura fija con scroll */}
              <div className="modal-field-full mt-3">
                <Label className="app-field-label">System Prompt</Label>
                <Textarea
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  placeholder="Eres un liquidador de seguros experto..."
                  className="ai-prompt-textarea"
                />
              </div>

              {/* User Prompt — altura fija con scroll */}
              <div className="modal-field-full mt-3">
                <Label className="app-field-label">User Prompt</Label>
                <Textarea
                  value={formData.user_prompt}
                  onChange={(e) => setFormData({ ...formData, user_prompt: e.target.value })}
                  placeholder="Analiza esta foto de siniestro y entrega el informe técnico..."
                  className="ai-prompt-textarea-sm"
                />
              </div>

              {/* Refinement Prompt (solo image) — altura fija con scroll */}
              {formData.prompt_type === "image" && (
                <div className="modal-field-full mt-3">
                  <Label className="app-field-label">Prompt de Refinamiento</Label>
                  <Textarea
                    value={formData.refinement_prompt}
                    onChange={(e) => setFormData({ ...formData, refinement_prompt: e.target.value })}
                    placeholder="Eres un liquidador senior. Recibes el análisis crudo..."
                    className="ai-prompt-textarea"
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <Button type="button" className="pg-btn-platinum" onClick={() => { setOpen(false); setEditingId(null); }}>
                Cancelar
              </Button>
              <Button type="submit" className="pg-btn-platinum">
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
