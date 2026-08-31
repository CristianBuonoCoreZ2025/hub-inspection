"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectorGroups,
  createInspectorGroup,
  updateInspectorGroup,
  deleteInspectorGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
} from "@/services/inspector-groups";
import { getUsers } from "@/services/users";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Trash2,
  UserPlus,
  ArrowLeft,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InspectorGroup } from "@/types";

export default function AgrupacionesInspectoresPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<InspectorGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedInspectorId, setSelectedInspectorId] = useState("");

  // ── Listado de agrupaciones ──
  const { data: groups, isLoading } = useQuery({
    queryKey: ["inspector-groups"],
    queryFn: getInspectorGroups,
  });

  // ── Miembros de la agrupación seleccionada ──
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", selectedGroupId],
    queryFn: () => getGroupMembers(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  // ── Usuarios (para selector de inspectores) ──
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  // Inspectores disponibles (rol inspector o internal, activos — excluye liquidadores e inactivos)
  const inspectorOptions = (users || [])
    .filter((u) => (u.role === "inspector" || u.role === "internal") && u.is_active)
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  // IDs ya en la agrupación (para no mostrarlos en el selector)
  const memberInspectorIds = new Set((members || []).map((m) => m.inspector_id));

  const createMutation = useMutation({
    mutationFn: () => createInspectorGroup(groupName.trim(), groupDescription.trim() || undefined),
    onSuccess: () => {
      toast.success("Agrupación creada");
      queryClient.invalidateQueries({ queryKey: ["inspector-groups"] });
      setShowCreateForm(false);
      setGroupName("");
      setGroupDescription("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateInspectorGroup(editingGroup!.id, groupName.trim(), groupDescription.trim() || undefined),
    onSuccess: () => {
      toast.success("Agrupación actualizada");
      queryClient.invalidateQueries({ queryKey: ["inspector-groups"] });
      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInspectorGroup(id),
    onSuccess: () => {
      toast.success("Agrupación eliminada");
      queryClient.invalidateQueries({ queryKey: ["inspector-groups"] });
      setSelectedGroupId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: () => addGroupMember(selectedGroupId!, selectedInspectorId),
    onSuccess: () => {
      toast.success("Inspector agregado");
      queryClient.invalidateQueries({ queryKey: ["group-members", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["inspector-groups"] });
      setSelectedInspectorId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeGroupMember(memberId),
    onSuccess: () => {
      toast.success("Inspector removido");
      queryClient.invalidateQueries({ queryKey: ["group-members", selectedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["inspector-groups"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Detalle de agrupación
  // ═══════════════════════════════════════════════════════════════
  if (selectedGroupId) {
    const group = groups?.find((g) => g.id === selectedGroupId);
    return (
      <div className="app-page">
        <div className="app-grid-header">
          <div className="app-grid-header-left">
            <button
              onClick={() => setSelectedGroupId(null)}
              className="app-grid-icon icn-purple hover:opacity-70 transition-opacity"
              aria-label="Volver"
            >
              <ArrowLeft />
            </button>
            <div className="app-grid-title-row">
              <h1 className="app-page-title shrink-0">{group?.name || "Agrupación"}</h1>
              {group?.description && (
                <span className="app-body text-muted-foreground">{group.description}</span>
              )}
            </div>
          </div>
          <div className="app-grid-header-right">
            {group && (
              <Button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Eliminar agrupación",
                    description: `¿Eliminar "${group.name}"? Los miembros serán removidos.`,
                    confirmLabel: "Eliminar",
                    destructive: true,
                  });
                  if (ok) deleteMutation.mutate(group.id);
                }}
                className="pg-btn-platinum"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            )}
          </div>
        </div>

        <div className="app-panel">
          <div className="flex flex-wrap items-end gap-3 pb-4">
            <div className="flex-1 min-w-48">
              <label className="app-data-label block pb-1">Agregar inspector</label>
              <Select value={selectedInspectorId} onValueChange={(v) => setSelectedInspectorId(v || "")}>
                <SelectTrigger className="app-input">
                  <SelectValue placeholder="Seleccionar inspector..." />
                </SelectTrigger>
                <SelectContent>
                  {inspectorOptions
                    .filter((u) => !memberInspectorIds.has(u.id))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => addMemberMutation.mutate()}
              disabled={!selectedInspectorId || addMemberMutation.isPending}
              className="pg-btn-platinum"
            >
              {addMemberMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Agregar
            </Button>
          </div>

          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="min-w-40">Inspector</th>
                  <th className="min-w-40 hidden sm:table-cell">Email</th>
                  <th className="min-w-20 text-center">Quitar</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <TableSkeleton rows={4} columns={3} />
                ) : (members || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      No hay inspectores en esta agrupación.
                    </td>
                  </tr>
                ) : (
                  (members || []).map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{m.inspector_name || "—"}</td>
                      <td className="whitespace-nowrap hidden sm:table-cell">{m.inspector_email || "—"}</td>
                      <td className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="btn-icon-sm text-red-500 hover:text-red-700"
                          onClick={() => removeMemberMutation.mutate(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Listado de agrupaciones
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-title-row">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h1 className="app-page-title">Agrupaciones de Inspectores</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          <Button
            onClick={() => {
              setEditingGroup(null);
              setGroupName("");
              setGroupDescription("");
              setShowCreateForm(true);
            }}
            className="pg-btn-platinum"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear
          </Button>
        </div>
      </div>

      {showCreateForm || editingGroup ? (
        <div className="app-panel">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <label className="app-data-label block pb-1">Nombre</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ej: Agrupación Celis"
                className="app-input"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="app-data-label block pb-1">Descripción (opcional)</label>
              <Input
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Descripción de la agrupación"
                className="app-input"
              />
            </div>
            <Button
              onClick={() => editingGroup ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!groupName.trim() || createMutation.isPending || updateMutation.isPending}
              className="pg-btn-platinum"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : editingGroup ? (
                <Pencil className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {editingGroup ? "Guardar" : "Crear"}
            </Button>
            <Button
              onClick={() => {
                setShowCreateForm(false);
                setEditingGroup(null);
                setGroupName("");
                setGroupDescription("");
              }}
              className="pg-btn-platinum"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="min-w-40">Nombre</th>
                <th className="min-w-50 hidden sm:table-cell">Descripción</th>
                <th className="min-w-20 text-center">Inspectores</th>
                <th className="min-w-20 text-center">Editar</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={4} columns={4} />
              ) : (groups || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No hay agrupaciones. Crea una para empezar.
                  </td>
                </tr>
              ) : (
                (groups || []).map((g) => (
                  <tr
                    key={g.id}
                    className="row-clickable"
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    <td className="whitespace-nowrap grid-cell-link">{g.name}</td>
                    <td className="whitespace-nowrap hidden sm:table-cell text-muted-foreground">
                      {g.description || "—"}
                    </td>
                    <td className="text-center">{g.member_count ?? 0}</td>
                    <td className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="btn-icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroup(g);
                          setGroupName(g.name);
                          setGroupDescription(g.description || "");
                          setShowCreateForm(false);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
