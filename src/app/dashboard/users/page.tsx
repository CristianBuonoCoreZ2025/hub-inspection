"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getUsers, inviteUser, updateUser, deactivateUser, addSecondaryRole, removeSecondaryRole } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { setUserClients } from "@/services/user-clients";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validations";
import type { Company, Profile, UserClient, UserRole, SecondaryRole, UserSecondaryRole } from "@/types";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, useWatch } from "react-hook-form";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, UserX, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

const roleLabels: Record<UserRole, string> = {
 internal: "Interno",
 adjuster: "Liquidador",
 inspector: "Inspector",
 assistant: "Asistente",
 auditor: "Auditor",
 dispatcher: "Despachador",
};

const roleTones: Record<UserRole, "blue" | "emerald" | "amber" | "sky" | "slate" | "violet" | "rose"> = {
 internal: "blue",
 adjuster: "emerald",
 inspector: "amber",
 assistant: "sky",
 auditor: "violet",
 dispatcher: "rose",
};

const roleDescriptions: Record<UserRole, string> = {
 internal: "Administrador del sistema. Ve todo, edita todo, gestiona usuarios y empresas.",
 adjuster: "Liquidador asociado a uno o más clientes. Ve siniestros donde es el ajustador.",
 inspector: "Inspector asociado a uno o más clientes. Completa inspecciones donde está a cargo.",
 assistant: "Asistente del liquidador. Realiza gestiones asignadas en los siniestros.",
 auditor: "Auditor de siniestros. Revisa y aprueba gestiones que requieren auditoría.",
 dispatcher: "Despachador. Asigna y despacha gestiones a los responsables correspondientes.",
};

// Roles que pueden ser perfiles secundarios (nunca "internal")
const secondaryRoleOptions: { value: SecondaryRole; label: string }[] = [
 { value: "inspector", label: "Inspector" },
 { value: "adjuster", label: "Liquidador" },
 { value: "assistant", label: "Asistente" },
 { value: "auditor", label: "Auditor" },
 { value: "dispatcher", label: "Despachador" },
];

// Roles que requieren asignar clientes
const rolesWithClients: UserRole[] = ["adjuster", "inspector", "assistant", "auditor", "dispatcher"];

export default function UsersPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const [search, setSearch] = useState("");
 const [open, setOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editingUserId, setEditingUserId] = useState<string | null>(null);
 const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
 const [secondaryRoles, setSecondaryRoles] = useState<UserSecondaryRole[]>([]);
 const [newSecRole, setNewSecRole] = useState<SecondaryRole | "">("");
 const [newSecCompany, setNewSecCompany] = useState<string>("");
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
 const selectedRole = editingId ? editForm.role : (watchedRole || "adjuster");

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
 mutationFn: async ({ id, userId, data, clientIds, secondaryRoleIds }: { id: string; userId: string; data: Partial<Profile>; clientIds: string[]; secondaryRoleIds: string[] }) => {
 await updateUser(id, data);
 if (rolesWithClients.includes(data.role as UserRole)) {
 await setUserClients(userId, clientIds);
 }
 // Si el usuario pasa a internal, eliminar todos sus roles secundarios
 if (data.role === "internal") {
 for (const srId of secondaryRoleIds) {
 await removeSecondaryRole(srId);
 }
 }
 },
 onSuccess: () => {
 toast.success("Usuario actualizado");
 queryClient.invalidateQueries({ queryKey: ["users"] });
 setOpen(false);
 setEditingId(null);
 setEditingUserId(null);
 setSelectedClientIds([]);
 setSecondaryRoles([]);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const addSecRoleMut = useMutation({
 mutationFn: ({ profileId, role, companyId }: { profileId: string; role: SecondaryRole; companyId?: string }) =>
 addSecondaryRole(profileId, role, companyId),
 onSuccess: (data) => {
 toast.success("Rol secundario agregado");
 setSecondaryRoles((prev) => [...prev, data]);
 queryClient.invalidateQueries({ queryKey: ["users"] });
 setNewSecRole("");
 setNewSecCompany("");
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const removeSecRoleMut = useMutation({
 mutationFn: (id: string) => removeSecondaryRole(id),
 onSuccess: (_data, deletedId) => {
 toast.success("Rol secundario eliminado");
 setSecondaryRoles((prev) => prev.filter((sr) => sr.id !== deletedId));
 queryClient.invalidateQueries({ queryKey: ["users"] });
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
 secondaryRoleIds: secondaryRoles.map((sr) => sr.id),
 });
 } else {
 inviteMutation.mutate({ ...values, company_id: "", clientIds: selectedClientIds });
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

 const openEdit = (user: Profile & { user_clients: UserClient[]; secondary_roles?: UserSecondaryRole[] }) => {
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
 setSecondaryRoles(user.secondary_roles || []);
 setNewSecRole("");
 setNewSecCompany("");
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
 setSecondaryRoles([]);
 setNewSecRole("");
 setNewSecCompany("");
 setOpen(true);
 };

 const showClientsSection = rolesWithClients.includes(selectedRole);

 // Roles secundarios disponibles: excluir el rol principal y los ya asignados
 const availableSecRoles = secondaryRoleOptions.filter(
 (r) => r.value !== editForm.role && !secondaryRoles.some((sr) => sr.role === r.value && (!sr.company_id || !newSecCompany || sr.company_id === newSecCompany))
 );

 const handleAddSecRole = () => {
 if (!editingId || !newSecRole) return;
 addSecRoleMut.mutate({
 profileId: editingId,
 role: newSecRole,
 companyId: newSecCompany || undefined,
 });
 };

 const handleRemoveSecRole = (id: string) => {
 removeSecRoleMut.mutate(id);
 };

 return (
 <div className="app-page">
 <div className="app-page-header">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-500 text-white shadow-sm">
 <Users className="h-5 w-5" />
 </div>
 <div>
 <h1 className="app-page-title">Usuarios</h1>
 <p className="app-page-lead">Gestión de usuarios del sistema.</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {canCreate("users") && (
 <Button onClick={openCreate} className="pg-btn-platinum">
 Invitar
 </Button>
 )}
 </div>
 </div>
 </div>

 <div className="app-toolbar">
 <div className="flex items-center gap-2">
 <div className="relative w-full sm:w-[160px] shrink-0">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
 </div>
 </div>
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
 value={editForm.countryId || null}
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
 // Al cambiar el perfil principal, limpiar todos los roles secundarios
 setSecondaryRoles([]);
 // Si cambia a internal, limpiar también la vinculación con clientes
 if (role === "internal") setSelectedClientIds([]);
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
 { value: "auditor", label: "Auditor" },
 { value: "dispatcher", label: "Despachador" },
 ]}
 >
 <SelectTrigger className="app-input h-7"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="internal">Interno (Administrador)</SelectItem>
 <SelectItem value="adjuster">Liquidador</SelectItem>
 <SelectItem value="inspector">Inspector</SelectItem>
 <SelectItem value="assistant">Asistente</SelectItem>
 <SelectItem value="auditor">Auditor</SelectItem>
 <SelectItem value="dispatcher">Despachador</SelectItem>
 </SelectContent>
 </Select>
 <p className="text-[11px] text-muted-foreground mt-1">{roleDescriptions[selectedRole]}</p>
 </div>

 {showClientsSection && (
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">
 Clientes asignados
 <span className="text-red-500"> *</span>
 </Label>
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
 {selectedClientIds.length === 0 && (
 <p className="text-xs text-amber-600 mt-1">
 Debe seleccionar al menos un cliente
 </p>
 )}
 </div>
 )}

 {/* ── Roles secundarios (solo en edición, nunca para internal) ── */}
 {editingId && editForm.role !== "internal" && (
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Perfiles Secundarios</Label>
 <p className="text-[11px] text-muted-foreground mb-2">
 Perfiles adicionales para aparecer en combos de asignación. No controlan acceso a páginas.
 No se puede repetir el perfil principal ni asignar &quot;Interno&quot;.
 </p>

 {/* Lista de roles secundarios actuales */}
 {secondaryRoles.length > 0 && (
 <div className="space-y-1 mb-2">
 {secondaryRoles.map((sr) => (
 <div key={sr.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/40 text-xs">
 <div className="flex items-center gap-2">
 <span className="font-medium">{secondaryRoleOptions.find((r) => r.value === sr.role)?.label || sr.role}</span>
 {sr.company && <span className="text-muted-foreground">· {sr.company.name}</span>}
 {!sr.company_id && <span className="text-muted-foreground">· Todos los clientes</span>}
 </div>
 <button
 type="button"
 onClick={() => handleRemoveSecRole(sr.id)}
 disabled={removeSecRoleMut.isPending}
 className="text-red-500 hover:text-red-700 text-[11px]"
 >
 Quitar
 </button>
 </div>
 ))}
 </div>
 )}

 {/* Formulario para agregar nuevo rol secundario */}
 {availableSecRoles.length > 0 ? (
 <div className="flex items-end gap-2">
 <div className="flex-1">
 <Label className="app-field-label text-[10px]">Perfil</Label>
 <Select
 value={newSecRole || null}
 onValueChange={(v) => setNewSecRole(v as SecondaryRole)}
 items={availableSecRoles.map((r) => ({ value: r.value, label: r.label }))}
 >
 <SelectTrigger className="app-input h-7"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
 <SelectContent>
 {availableSecRoles.map((r) => (
 <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex-1">
 <Label className="app-field-label text-[10px]">Cliente (opcional)</Label>
 <Select
 value={newSecCompany || null}
 onValueChange={(v) => setNewSecCompany(v || "")}
 items={[
 { value: "", label: "Todos los clientes" },
 ...(companies?.map((c: Company) => ({ value: c.id, label: c.name })) || []),
 ]}
 >
 <SelectTrigger className="app-input h-7"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="">Todos los clientes</SelectItem>
 {companies?.map((c: Company) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <button
 type="button"
 onClick={handleAddSecRole}
 disabled={!newSecRole || addSecRoleMut.isPending}
 className="pg-btn-platinum h-7 px-3 text-xs shrink-0"
 >
 {addSecRoleMut.isPending ? "..." : "Agregar"}
 </button>
 </div>
 ) : (
 <p className="text-[11px] text-muted-foreground">
 {secondaryRoles.length > 0 ? "Todos los perfiles secundarios disponibles ya están asignados." : "No hay perfiles secundarios disponibles para este rol principal."}
 </p>
 )}
 </div>
 )}
 </div>
 </div>

 <div className="modal-footer">
 <button type="button" className="pg-btn-platinum" onClick={() => setOpen(false)}>
 Cancelar
 </button>
 <button
 type="button"
 className="pg-btn-platinum"
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
 <td><StatusBadge tone={roleTones[user.role]} label={roleLabels[user.role]} /></td>
 <td className="text-muted-foreground">
 {user.user_clients && user.user_clients.length > 0
 ? user.user_clients.map((uc: UserClient) => uc.company?.name).filter(Boolean).join(", ")
 : user.role === "internal" ? "—" : "Sin asignar"}
 </td>
 <td>
 <StatusBadge status={user.is_active ? "active" : "inactive"} label={user.is_active ? "Activo" : "Inactivo"} />
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
