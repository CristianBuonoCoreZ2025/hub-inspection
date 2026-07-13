"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getUsers, inviteUser, updateUser, deactivateUser } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { setUserClients } from "@/services/user-clients";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validations";
import type { Company, Profile, UserClient, UserRole } from "@/types";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, useWatch } from "react-hook-form";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Plus, Search, Pencil, UserX, UserCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roleLabels: Record<UserRole, string> = {
  internal: "Interno",
  adjuster: "Liquidador",
  inspector: "Inspector",
  assistant: "Asistente",
  client_operator: "Operativo",
};

const roleColors: Record<UserRole, string> = {
  internal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  adjuster: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  inspector: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  assistant: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  client_operator: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const roleDescriptions: Record<UserRole, string> = {
  internal: "Administrador del sistema. Ve todo, edita todo, gestiona usuarios y empresas.",
  adjuster: "Liquidador asociado a uno o más clientes. Ve siniestros donde es el ajustador.",
  inspector: "Inspector asociado a uno o más clientes. Completa inspecciones donde está a cargo.",
  assistant: "Asistente del liquidador. Realiza gestiones asignadas en los siniestros.",
  client_operator: "Operativo del cliente. Solo vista de los siniestros de su empresa.",
};

// Roles que requieren asignar clientes
const rolesWithClients: UserRole[] = ["adjuster", "inspector", "assistant", "client_operator"];

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({
    fullName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    rut: "",
    countryId: "",
    role: "adjuster" as UserRole,
  });

  const form = useForm<InviteUserInput>({
    resolver: standardSchemaResolver(inviteUserSchema),
    defaultValues: { email: "", fullName: "", role: "adjuster", companyId: "", clientIds: [] },
  });

  const watchedRole = useWatch({ control: form.control, name: "role" });
  const selectedRole = editingId ? editForm.role : watchedRole;

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => getCountries(),
  });

  const inviteMutation = useMutation({
    mutationFn: async (input: InviteUserInput & { company_id: string }) => {
      const result = await inviteUser(input);
      // After invite, set user_clients if clientIds provided
      if (input.clientIds && input.clientIds.length > 0 && result.user?.id) {
        await setUserClients(result.user.id, input.clientIds);
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Usuario invitado. Se envió un código de activación a su correo.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      form.reset();
      setSelectedClientIds([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, userId, data, clientIds }: { id: string; userId: string; data: Partial<Profile>; clientIds: string[] }) => {
      await updateUser(id, data);
      if (rolesWithClients.includes(data.role as UserRole)) {
        await setUserClients(userId, clientIds);
      }
    },
    onSuccess: () => {
      toast.success("Usuario actualizado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setEditingId(null);
      setEditingUserId(null);
      setSelectedClientIds([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      toast.success("Usuario desactivado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: InviteUserInput) => {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        userId: editingUserId || "",
        data: {
          full_name: editForm.fullName,
          first_name: editForm.firstName || null,
          last_name: editForm.lastName || null,
          email: editForm.email,
          phone: editForm.phone || null,
          rut: editForm.rut || null,
          country_id: editForm.countryId || null,
          role: editForm.role,
        },
        clientIds: selectedClientIds,
      });
    } else {
      const company_id = values.role === "client_operator" ? selectedClientIds[0] || "" : "";
      inviteMutation.mutate({ ...values, company_id, clientIds: selectedClientIds });
    }
  };

  const filtered = users?.filter((u) =>
    [u.full_name, u.email].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    name: (u) => u.full_name,
    email: (u) => u.email,
    role: (u) => u.role,
    status: (u) => u.is_active,
  }, "name");
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const toggleClient = (companyId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const openEdit = (user: Profile & { user_clients: UserClient[] }) => {
    setEditingId(user.id);
    setEditingUserId(user.user_id);
    form.reset({
      email: user.email || "",
      fullName: user.full_name || "",
      role: user.role,
      companyId: user.company_id || "",
      clientIds: [],
    });
    setEditForm({
      fullName: user.full_name || "",
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
      phone: user.phone || "",
      rut: user.rut || "",
      countryId: user.country_id || "",
      role: user.role,
    });
    const existingClientIds = user.user_clients?.map((uc: { company_id: string }) => uc.company_id) || [];
    setSelectedClientIds(existingClientIds);
    setOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setEditingUserId(null);
    form.reset({ email: "", fullName: "", role: "adjuster", companyId: "", clientIds: [] });
    setEditForm({
      fullName: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      rut: "",
      countryId: "",
      role: "adjuster" as UserRole,
    });
    setSelectedClientIds([]);
    setOpen(true);
  };

  const showClientsSection = rolesWithClients.includes(selectedRole);

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Usuarios</h1>
        <div className="app-grid-filters">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="app-input h-8 max-w-[180px]" />
        </div>
        {canCreate("users") && (
          <Button onClick={openCreate} className="btn-create btn-sm shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Invitar
          </Button>
        )}
      </div>

      {/* ── MODAL Usuarios ── */}
        <Dialog open={open} onOpenChange={setOpen} dismissible={false}>
          <DialogContent className="modal-md" showCloseButton={false}>
            <div className="modal-header">
              <DialogTitle className="modal-title flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                  <Users className="h-4 w-4" />
                </div>
                {editingId ? "Editar Usuario" : "Invitar Usuario"}
              </DialogTitle>
              <DialogDescription className="modal-subtitle">
                Gestiona los permisos y datos del usuario en el sistema.
              </DialogDescription>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                {editingId ? (
                  <div key="edit-mode" className="contents">
                    {/* ── Modo edición: campos completos ── */}
                    <div className="modal-field">
                      <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                      <Input
                        className="app-input h-7"
                        value={editForm.firstName ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        placeholder="Juan"
                      />
                    </div>
                    <div className="modal-field">
                      <Label className="app-field-label">Apellido</Label>
                      <Input
                        className="app-input h-7"
                        value={editForm.lastName ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        placeholder="Pérez"
                      />
                    </div>
                    <div className="modal-field modal-field-full">
                      <Label className="app-field-label">Nombre completo <span className="text-red-500">*</span></Label>
                      <Input
                        className="app-input h-7"
                        value={editForm.fullName ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <div className="modal-field">
                      <Label className="app-field-label">Email <span className="text-red-500">*</span></Label>
                      <Input
                        type="email"
                        className="app-input h-7"
                        value={editForm.email ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="juan@empresa.cl"
                      />
                    </div>
                    <div className="modal-field">
                      <Label className="app-field-label">Teléfono</Label>
                      <Input
                        className="app-input h-7"
                        value={editForm.phone ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                    <div className="modal-field">
                      <Label className="app-field-label">RUT</Label>
                      <Input
                        className="app-input h-7"
                        value={editForm.rut ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, rut: e.target.value })}
                        placeholder="12.345.678-9"
                      />
                    </div>
                    <div className="modal-field">
                      <Label className="app-field-label">País</Label>
                      <Select
                        value={editForm.countryId ?? ""}
                        onValueChange={(v) => setEditForm({ ...editForm, countryId: v || "" })}
                        items={countries?.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })) || []}
                      >
                        <SelectTrigger className="app-input h-7"><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
                        <SelectContent>
                          {countries?.map((c: { id: string; name: string }) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div key="create-mode" className="contents">
                    {/* ── Modo creación: campos mínimos ── */}
                    <div className="modal-field modal-field-full">
                      <Label className="app-field-label">Nombre completo <span className="text-red-500">*</span></Label>
                      <Input {...form.register("fullName")} placeholder="Juan Pérez" className="app-input h-7" />
                      {form.formState.errors.fullName && (
                        <p className="text-xs text-red-500">{form.formState.errors.fullName.message}</p>
                      )}
                    </div>
                    <div className="modal-field modal-field-full">
                      <Label className="app-field-label">Email <span className="text-red-500">*</span></Label>
                      <Input {...form.register("email")} type="email" placeholder="juan@empresa.cl" className="app-input h-7" />
                      {form.formState.errors.email && (
                        <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="modal-field modal-field-full">
                  <Label className="app-field-label">Tipo de Usuario <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(v) => {
                      const role = v as UserRole;
                      if (editingId) {
                        setEditForm({ ...editForm, role });
                      } else {
                        form.setValue("role", role);
                      }
                      if (!rolesWithClients.includes(role)) setSelectedClientIds([]);
                    }}
                    items={[
                      { value: "internal", label: "Interno (Administrador)" },
                      { value: "adjuster", label: "Liquidador" },
                      { value: "inspector", label: "Inspector" },
                      { value: "assistant", label: "Asistente" },
                      { value: "client_operator", label: "Operativo (Cliente)" },
                    ]}
                  >
                    <SelectTrigger className="app-input h-7"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Interno (Administrador)</SelectItem>
                      <SelectItem value="adjuster">Liquidador</SelectItem>
                      <SelectItem value="inspector">Inspector</SelectItem>
                      <SelectItem value="assistant">Asistente</SelectItem>
                      <SelectItem value="client_operator">Operativo (Cliente)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">{roleDescriptions[selectedRole]}</p>
                </div>

                {showClientsSection && (
                  <div className="modal-field modal-field-full">
                    <Label className="app-field-label">
                      {selectedRole === "client_operator" ? "Empresa asignada" : "Clientes asignados"}
                      <span className="text-red-500"> *</span>
                    </Label>
                    {selectedRole === "client_operator" ? (
                      <Select
                        value={selectedClientIds[0] ?? ""}
                        onValueChange={(v) => setSelectedClientIds(v ? [v] : [])}
                        items={companies?.map((c: Company) => ({ value: c.id, label: c.name })) || []}
                      >
                        <SelectTrigger className="app-input h-7"><SelectValue placeholder="Selecciona una empresa" /></SelectTrigger>
                        <SelectContent>
                          {companies?.map((c: Company) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-1 max-h-[200px] overflow-y-auto rounded-lg border border-border p-2">
                        {companies?.map((c: Company) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={selectedClientIds.includes(c.id)}
                              onChange={() => toggleClient(c.id)}
                              className="size-3.5 rounded border-input"
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedClientIds.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {selectedRole === "client_operator" ? "Debe seleccionar una empresa" : "Debe seleccionar al menos un cliente"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-save"
                disabled={inviteMutation.isPending || updateMutation.isPending}
                onClick={form.handleSubmit(onSubmit)}
              >
                {inviteMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Invitar"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

      <div className="app-panel">
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
                <SortableTh sortKey="email" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Email</SortableTh>
                <SortableTh sortKey="role" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Tipo</SortableTh>
                <th>Clientes</th>
                <SortableTh sortKey="status" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Estado</SortableTh>
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron usuarios.</td></tr>
              ) : (
                paginatedData.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {user.full_name || "Sin nombre"}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td><Badge className={roleColors[user.role]}>{roleLabels[user.role]}</Badge></td>
                    <td className="text-muted-foreground">
                      {user.user_clients && user.user_clients.length > 0
                        ? user.user_clients.map((uc: UserClient) => uc.company?.name).filter(Boolean).join(", ")
                        : user.role === "internal" ? "—" : "Sin asignar"}
                    </td>
                    <td>
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600"><UserCheck className="h-3 w-3" /> Activo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500"><UserX className="h-3 w-3" /> Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="app-row-actions">
                        {canEdit("users") && (
                          <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete("users") && user.is_active && (
                          <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => { if (confirm("¿Desactivar este usuario?")) deactivateMutation.mutate(user.id); }}>
                            <UserX className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
