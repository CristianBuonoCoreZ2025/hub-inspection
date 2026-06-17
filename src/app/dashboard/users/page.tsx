"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, inviteUser, updateUser, deactivateUser } from "@/services/users";
import { getCompanies } from "@/services/companies";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validations";
import type { Company } from "@/types";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, UserX, UserCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/types";

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  supervisor: "Supervisor",
  adjuster: "Liquidador",
  inspector: "Inspector",
  client: "Empresa",
};

const roleColors: Record<UserRole, string> = {
  super_admin: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  supervisor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  adjuster: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  inspector: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  client: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<InviteUserInput>({
    resolver: standardSchemaResolver(inviteUserSchema),
    defaultValues: { email: "", fullName: "", role: "adjuster", companyId: "" },
  });

  const selectedRole = form.watch("role");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const inviteMutation = useMutation({
    mutationFn: (input: InviteUserInput & { company_id: string }) => inviteUser(input),
    onSuccess: () => {
      toast.success("Invitación enviada");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUser(id, { role }),
    onSuccess: () => {
      toast.success("Usuario actualizado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setEditingId(null);
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
      updateMutation.mutate({ id: editingId, role: values.role });
    } else {
      const company_id = values.role === "client" ? values.companyId || "" : "";
      inviteMutation.mutate({ ...values, company_id });
    }
  };

  const filtered = users?.filter((u) =>
    [u.full_name, u.email].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Usuarios</h1>
        <p className="app-page-lead">Gestión de usuarios y permisos del sistema.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => { setEditingId(null); form.reset(); setOpen(true); }} className="btn-create btn-sm">
            <Plus className="mr-2 h-4 w-4" />
            Invitar Usuario
          </Button>

          {/* ── MODAL Usuarios — 480px (formulario simple) ── */}
          <DialogContent className="modal-sm">
            <div className="modal-header">
              <DialogTitle className="text-lg font-semibold">
                {editingId ? "Editar Usuario" : "Invitar Usuario"}
              </DialogTitle>
            </div>

            <div className="modal-body">
              <div className="space-y-5">
                {!editingId && (
                  <div className="space-y-5">
                    <div>
                      <Label className="app-field-label">Nombre completo <span className="text-red-500">*</span></Label>
                      <Input {...form.register("fullName")} placeholder="Juan Pérez" className="app-input" />
                      {form.formState.errors.fullName && (
                        <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.fullName.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="app-field-label">Email <span className="text-red-500">*</span></Label>
                      <Input {...form.register("email")} type="email" placeholder="juan@empresa.cl" className="app-input" />
                      {form.formState.errors.email && (
                        <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="app-field-label">Rol <span className="text-red-500">*</span></Label>
                  <Select onValueChange={(v) => form.setValue("role", v as "admin" | "supervisor" | "adjuster" | "inspector" | "client")} defaultValue={form.getValues("role")}>
                    <SelectTrigger className="app-input h-11"><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador (Interno)</SelectItem>
                      <SelectItem value="supervisor">Supervisor (Interno)</SelectItem>
                      <SelectItem value="adjuster">Liquidador (Interno)</SelectItem>
                      <SelectItem value="inspector">Inspector</SelectItem>
                      <SelectItem value="client">Empresa (Cliente)</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.role && (
                    <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.role.message}</p>
                  )}
                </div>
                {selectedRole === "client" && (
                  <div>
                    <Label className="app-field-label">Empresa asignada <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(v) => form.setValue("companyId", v ?? "")} defaultValue={form.getValues("companyId")}>
                      <SelectTrigger className="app-input h-11"><SelectValue placeholder="Selecciona una empresa" /></SelectTrigger>
                      <SelectContent>
                        {companies?.map((c: Company) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.companyId && (
                      <p className="mt-1.5 text-xs text-red-500">Debe seleccionar una empresa para el cliente</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <Button type="button" variant="outline" className="btn-cancel btn-footer" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className="btn-save btn-footer" disabled={inviteMutation.isPending || updateMutation.isPending} onClick={form.handleSubmit(onSubmit)}>
                {inviteMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Enviar Invitación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="app-panel">
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No se encontraron usuarios.</td></tr>
              ) : (
                filtered?.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {user.full_name || "Sin nombre"}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td><Badge className={roleColors[user.role]}>{roleLabels[user.role]}</Badge></td>
                    <td>
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><UserCheck className="h-3 w-3" /> Activo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500"><UserX className="h-3 w-3" /> Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => {
                          setEditingId(user.id);
                          form.reset({ email: user.email || "", fullName: user.full_name || "", role: user.role as Exclude<UserRole, "super_admin" | "client">, companyId: "" });
                          setOpen(true);
                        }}><Pencil className="h-4 w-4" /></Button>
                        {user.is_active && (
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
      </div>
    </div>
  );
}
