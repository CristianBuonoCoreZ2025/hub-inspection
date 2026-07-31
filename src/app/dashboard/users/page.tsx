"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getUsers, updateUser, deactivateUser, addSecondaryRole, removeSecondaryRole } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { getCountries } from "@/services/countries";
import { setUserClients, removeUserClientsNotInList } from "@/services/user-clients";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validations";
import type { Company, Profile, UserClient, UserRole, SecondaryRole, UserSecondaryRole } from "@/types";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, useWatch } from "react-hook-form";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Search, Pencil, UserX, Users, Star, Trash2, RotateCcw } from "lucide-react";

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

// Roles que requieren asignar clientes (incluye internal para usuarios admin multi-company)
const rolesWithClients: UserRole[] = ["internal", "adjuster", "inspector", "assistant", "auditor", "dispatcher"];

type UserFilter = "active" | "inactive" | "deleted";

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
 const [userFilter, setUserFilter] = useState<UserFilter>("active");
 const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
 const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
 const [originalEmail, setOriginalEmail] = useState("");
 const [editForm, setEditForm] = useState({
 fullName: "",
 firstName: "",
 middleName: "",
 lastName: "",
 email: "",
 phone: "",
 rut: "",
 countryId: "",
 role: "adjuster" as UserRole,
 });

 const form = useForm<InviteUserInput>({
 resolver: standardSchemaResolver(inviteUserSchema),
 defaultValues: { firstName: "", middleName: "", lastName: "", email: "", countryId: "", role: "adjuster", clientIds: [], phone: "", rut: "" } as InviteUserInput,
 });

 // Sincronizar clientes seleccionados con el formulario para que la validación del botón Guardar/Invitar pase
 useEffect(() => {
   form.setValue("clientIds", selectedClientIds, { shouldValidate: true });
 }, [selectedClientIds, form]);

 const watchedRole = useWatch({ control: form.control, name: "role" });
 const watchedCountryId = useWatch({ control: form.control, name: "countryId" });
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
 mutationFn: async (input: InviteUserInput) => {
 const res = await fetch("/api/users/invite", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(input),
 });
 const result = await res.json();
 if (!res.ok) throw new Error(result.error || "Error al invitar usuario");
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
 mutationFn: async ({ id, userId, data, clientIds, secondaryRoleIds, originalEmail }: { id: string; userId: string; data: Partial<Profile>; clientIds: string[]; secondaryRoleIds: string[]; originalEmail: string }) => {
 // Si el email cambió, sincronizar en auth.users + profiles ANTES de actualizar el resto.
 // Sin esto, profiles.email y auth.users.email quedan desincronizados y el usuario
 // no puede entrar con el nuevo correo.
 const newEmail = (data.email || "").trim().toLowerCase();
 const oldEmail = originalEmail.trim().toLowerCase();
 if (newEmail && oldEmail && newEmail !== oldEmail) {
 const res = await fetch("/api/users/update-email", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ profileId: id, newEmail }),
 });
 const result = await res.json();
 if (!res.ok) throw new Error(result.error || "Error al actualizar el correo en Auth");
 }
 // Actualizar el resto de campos del profile (sin re-escribir email si ya se sincronizó arriba,
 // pero no pasa nada si se vuelve a escribir el mismo valor).
 await updateUser(id, data);
 if (rolesWithClients.includes(data.role as UserRole)) {
 await setUserClients(userId, clientIds);
 await removeUserClientsNotInList(userId, clientIds);
 }
 // Si el nuevo rol no requiere clientes, eliminar todos sus roles secundarios
 if (!rolesWithClients.includes(data.role as UserRole)) {
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

 const reactivateMutation = useMutation({
 mutationFn: async (profileId: string) => {
 const res = await fetch("/api/users/reactivate", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ profileId }),
 });
 const result = await res.json();
 if (!res.ok) throw new Error(result.error || "Error al reactivar");
 return result;
 },
 onSuccess: () => {
 toast.success("Usuario reactivado");
 queryClient.invalidateQueries({ queryKey: ["users"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const deleteUserMutation = useMutation({
 mutationFn: async (profileId: string) => {
 const res = await fetch("/api/users/delete", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ profileId }),
 });
 const result = await res.json();
 if (!res.ok) throw new Error(result.error || "Error al eliminar");
 return result;
 },
 onSuccess: () => {
 toast.success("Usuario eliminado");
 queryClient.invalidateQueries({ queryKey: ["users"] });
 setDeleteConfirmId(null);
 setDeleteConfirmEmail("");
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
 originalEmail,
 });
 } else {
 inviteMutation.mutate({ ...values, clientIds: selectedClientIds });
 }
 };

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
 setOriginalEmail(user.email || "");
 form.reset({
 firstName: user.first_name || "",
 middleName: "",
 lastName: user.last_name || "",
 email: user.email || "",
 countryId: user.country_id || "",
 role: user.role,
 clientIds: [],
 phone: user.phone || "",
 rut: user.rut || "",
 } as InviteUserInput);
 setEditForm({
 fullName: user.full_name || "",
 firstName: user.first_name || "",
 middleName: "",
 lastName: user.last_name || "",
 email: user.email || "",
 phone: user.phone || "",
 rut: user.rut || "",
 countryId: user.country_id || "",
 role: user.role,
 });
 const existingClientIds = user.user_clients?.map((uc: { company_id: string }) => uc.company_id) || [];
 setSelectedClientIds(existingClientIds);
 form.setValue("clientIds", existingClientIds, { shouldValidate: true });
 setSecondaryRoles(user.secondary_roles || []);
 setNewSecRole("");
 setNewSecCompany("");
 setOpen(true);
 };

 const openCreate = () => {
 setEditingId(null);
 setEditingUserId(null);
 setOriginalEmail("");
 form.reset({ firstName: "", middleName: "", lastName: "", email: "", countryId: "", role: "adjuster", clientIds: [], phone: "", rut: "" } as InviteUserInput);
 setEditForm({
 fullName: "",
 firstName: "",
 middleName: "",
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

 const handleDeleteClick = (user: Profile & { user_clients: UserClient[]; secondary_roles?: UserSecondaryRole[] }) => {
 setDeleteConfirmId(user.id);
 setDeleteConfirmEmail("");
 };

 const handleDeleteConfirm = () => {
 if (!deleteConfirmId) return;
 const target = users?.find((u) => u.id === deleteConfirmId);
 if (!target) return;
 if (deleteConfirmEmail.trim().toLowerCase() !== (target.email || "").trim().toLowerCase()) {
 toast.error("El email no coincide. Escribe exactamente el email del usuario.");
 return;
 }
 deleteUserMutation.mutate(deleteConfirmId);
 };

 // Filtrar por estado
 const filteredByStatus = users?.filter((u) => {
 if (userFilter === "active") return u.is_active && !u.deleted_at;
 if (userFilter === "inactive") return !u.is_active && !u.deleted_at;
 if (userFilter === "deleted") return !!u.deleted_at;
 return true;
 });

 const filtered = filteredByStatus?.filter((u) =>
 [u.full_name, u.email].join(" ").toLowerCase().includes(search.toLowerCase())
 );

 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered || [], {
 name: (u) => u.full_name || "",
 email: (u) => u.email || "",
 role: (u) => u.role,
 status: (u) => (u.deleted_at ? "zzz" : u.is_active ? "active" : "inactive"),
 });

 const { paginatedData, page, totalPages, total, pageSize, setPage, setPageSize } = usePagination(sorted, 20);

 // Cliente principal de un usuario (el que coincide con company_id)
 const isPrimaryClient = (user: Profile, companyId: string) => user.company_id === companyId;

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-violet-500 to-purple-500">
 <Users />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Usuarios</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 {canCreate("users") && (
 <Button onClick={openCreate} className="pg-btn-platinum">
 Invitar
 </Button>
 )}
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
 <Label className="app-field-label">Primer nombre <span className="text-red-500">*</span></Label>
 <Input
 className="app-input"
 value={editForm.firstName ?? ""}
 onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
 placeholder="Juan"
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Segundo nombre</Label>
 <Input
 className="app-input"
 value={editForm.middleName ?? ""}
 onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
 placeholder="Carlos (opcional)"
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Apellido <span className="text-red-500">*</span></Label>
 <Input
 className="app-input"
 value={editForm.lastName ?? ""}
 onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
 placeholder="Pérez"
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Email <span className="text-red-500">*</span></Label>
 <Input
 type="email"
 className="app-input"
 value={editForm.email ?? ""}
 onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
 placeholder="juan@empresa.cl"
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Teléfono</Label>
 <Input
 className="app-input"
 value={editForm.phone ?? ""}
 onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
 placeholder="+56 9 1234 5678"
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">RUT</Label>
 <Input
 className="app-input"
 value={editForm.rut ?? ""}
 onChange={(e) => setEditForm({ ...editForm, rut: e.target.value })}
 placeholder="12.345.678-9"
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">País</Label>
 <Select
 value={editForm.countryId || null}
 onValueChange={(v) => {
                    const value = v || "";
                    setEditForm({ ...editForm, countryId: value });
                    form.setValue("countryId", value, { shouldValidate: true });
                  }}
 items={countries?.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })) || []}
 >
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
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
 {/* ── Modo creación: 3 nombres + email + país + teléfono + RUT ── */}
 <div className="modal-field">
 <Label className="app-field-label">Primer nombre <span className="text-red-500">*</span></Label>
 <Input {...form.register("firstName")} placeholder="Juan" className="app-input" />
 {form.formState.errors.firstName && (
 <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>
 )}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Segundo nombre</Label>
 <Input {...form.register("middleName")} placeholder="Carlos (opcional)" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Apellido <span className="text-red-500">*</span></Label>
 <Input {...form.register("lastName")} placeholder="Pérez" className="app-input" />
 {form.formState.errors.lastName && (
 <p className="text-xs text-red-500">{form.formState.errors.lastName.message}</p>
 )}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Email <span className="text-red-500">*</span></Label>
 <Input {...form.register("email")} type="email" placeholder="juan@empresa.cl" className="app-input" />
 {form.formState.errors.email && (
 <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
 )}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Teléfono</Label>
 <Input {...form.register("phone")} placeholder="+56 9 1234 5678" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">RUT</Label>
 <Input {...form.register("rut")} placeholder="12.345.678-9" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">País <span className="text-red-500">*</span></Label>
 <Select
 value={watchedCountryId || null}
 onValueChange={(v) => form.setValue("countryId", v || "")}
 items={countries?.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })) || []}
 >
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
 <SelectContent>
 {countries?.map((c: { id: string; name: string }) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 {form.formState.errors.countryId && (
 <p className="text-xs text-red-500">{form.formState.errors.countryId.message}</p>
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
 setSecondaryRoles([]);
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
 <SelectTrigger className="app-input"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
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
 <p className="text-[11px] text-muted-foreground mb-2">
 Marca los clientes. El más antiguo queda como principal automáticamente.
 </p>
 <div className="user-client-toggle-grid">
 {companies?.map((c: Company) => {
 const selected = selectedClientIds.includes(c.id);
 return (
 <button
 key={c.id}
 type="button"
 onClick={() => toggleClient(c.id)}
 className={selected ? "user-client-toggle-chip user-client-toggle-chip-on" : "user-client-toggle-chip user-client-toggle-chip-off"}
 >
 {c.name}
 </button>
 );
 })}
 </div>
 {selectedClientIds.length === 0 && (
 <p className="text-xs text-amber-600 mt-1">
 Debes seleccionar al menos un cliente para este rol
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
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
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
 <SelectTrigger className="app-input"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
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
 onClick={form.handleSubmit(onSubmit, (errors) => {
   const firstError = Object.values(errors)[0]?.message as string | undefined;
   toast.error(firstError || "Revisa los campos obligatorios");
 })}
 >
 {inviteMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar" : "Invitar"}
 </button>
 </div>
 </DialogContent>
 </Dialog>

 {/* ── MODAL Confirmar eliminación (doble confirmación) ── */}
 <Dialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) { setDeleteConfirmId(null); setDeleteConfirmEmail(""); } }} dismissible={false}>
 <DialogContent className="modal-sm" showCloseButton={false}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm">
 <Trash2 className="h-4 w-4" />
 </div>
 Eliminar Usuario
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 Esta acción no se puede deshacer. El usuario se marcará como eliminado.
 </DialogDescription>
 </div>
 <div className="modal-body">
 <p className="text-sm text-muted-foreground mb-3">
 Para confirmar, escribe exactamente el email del usuario:
 </p>
 <p className="text-sm font-medium mb-2">
 {users?.find((u) => u.id === deleteConfirmId)?.email}
 </p>
 <Input
 value={deleteConfirmEmail}
 onChange={(e) => setDeleteConfirmEmail(e.target.value)}
 placeholder="email del usuario"
 className="app-input"
 />
 </div>
 <div className="modal-footer">
 <button type="button" className="pg-btn-platinum" onClick={() => { setDeleteConfirmId(null); setDeleteConfirmEmail(""); }}>
 Cancelar
 </button>
 <button
 type="button"
 className="pg-btn-danger"
 disabled={deleteUserMutation.isPending || !deleteConfirmEmail}
 onClick={handleDeleteConfirm}
 >
 {deleteUserMutation.isPending ? "Eliminando..." : "Eliminar definitivamente"}
 </button>
 </div>
 </DialogContent>
 </Dialog>

 <div className="app-panel">
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="liquid-search" />
 </div>
 {/* ── Filtro de estado ── */}
 <div className="user-filter-tabs">
 <button
 type="button"
 className={userFilter === "active" ? "user-filter-tab user-filter-tab-active" : "user-filter-tab"}
 onClick={() => setUserFilter("active")}
 >
 Activos
 </button>
 <button
 type="button"
 className={userFilter === "inactive" ? "user-filter-tab user-filter-tab-active" : "user-filter-tab"}
 onClick={() => setUserFilter("inactive")}
 >
 Desactivados
 </button>
 <button
 type="button"
 className={userFilter === "deleted" ? "user-filter-tab user-filter-tab-active" : "user-filter-tab"}
 onClick={() => setUserFilter("deleted")}
 >
 Eliminados
 </button>
 </div>
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <SortableTh sortKey="name" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Nombre</SortableTh>
 <SortableTh sortKey="email" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Email</SortableTh>
 <SortableTh sortKey="role" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Tipo</SortableTh>
 <th>Clientes</th>
 <SortableTh sortKey="status" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Estado</SortableTh>
 <th className="w-30"></th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={6} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No se encontraron usuarios.</td></tr>
 ) : (
 paginatedData.map((user) => {
 const isDeleted = !!user.deleted_at;
 return (
 <tr key={user.id} className={isDeleted ? "user-row-deleted" : !user.is_active ? "user-row-inactive" : ""}>
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
 ? user.user_clients.map((uc: UserClient) => (
 <span key={uc.company_id} className="user-client-badge-wrap">
 {isPrimaryClient(user, uc.company_id) && (
 <Star className="user-client-primary-icon" />
 )}
 {uc.company?.name}
 </span>
 ))
 : !rolesWithClients.includes(user.role) ? "—" : "Sin asignar"}
 </td>
 <td>
 {isDeleted ? (
 <StatusBadge status="inactive" label="Eliminado" />
 ) : (
 <StatusBadge status={user.is_active ? "active" : "inactive"} label={user.is_active ? "Activo" : "Inactivo"} />
 )}
 </td>
 <td>
 <div className="app-row-actions">
 {isDeleted ? (
 canEdit("users") && (
 <button type="button" className="btn-icon-sm" onClick={() => reactivateMutation.mutate(user.id)} title="Reactivar">
 <RotateCcw className="h-4 w-4" />
 </button>
 )
 ) : (
 <>
 {canEdit("users") && (
 <button type="button" className="btn-icon-sm" onClick={() => openEdit(user)} title="Editar">
 <Pencil className="h-4 w-4" />
 </button>
 )}
 {canDelete("users") && user.is_active && (
 <button type="button" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar este usuario?")) deactivateMutation.mutate(user.id); }} title="Desactivar">
 <UserX className="h-4 w-4" />
 </button>
 )}
 {canDelete("users") && !user.is_active && (
 <button type="button" className="btn-icon-sm btn-danger-hover" onClick={() => handleDeleteClick(user)} title="Eliminar">
 <Trash2 className="h-4 w-4" />
 </button>
 )}
 {canEdit("users") && !user.is_active && (
 <button type="button" className="btn-icon-sm" onClick={() => reactivateMutation.mutate(user.id)} title="Reactivar">
 <RotateCcw className="h-4 w-4" />
 </button>
 )}
 </>
 )}
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>
 </div>
 );
}
