"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, inviteUser, updateUser, deactivateUser } from "@/services/users";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validations";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/types";

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  supervisor: "Supervisor",
  adjuster: "Liquidador",
  client: "Cliente",
};

const roleColors: Record<UserRole, string> = {
  super_admin: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  supervisor: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  adjuster: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  client: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const form = useForm<InviteUserInput>({
    resolver: standardSchemaResolver(inviteUserSchema),
    defaultValues: { email: "", fullName: "", role: "adjuster" },
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
      // TODO: usar company_id real
      inviteMutation.mutate({ ...values, company_id: "" });
    }
  };

  const filtered = users?.filter((u) =>
    [u.full_name, u.email].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button onClick={() => { setEditingId(null); form.reset(); }}>
              <Plus className="mr-2 h-4 w-4" />
              Invitar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuario" : "Invitar Usuario"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!editingId && (
                <>
                  <div className="space-y-2">
                    <Label>Nombre Completo</Label>
                    <Input {...form.register("fullName")} />
                    {form.formState.errors.fullName && (
                      <p className="text-xs text-red-500">{form.formState.errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input {...form.register("email")} type="email" />
                    {form.formState.errors.email && (
                      <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  onValueChange={(v) => form.setValue("role", v as "admin" | "supervisor" | "adjuster")}
                  defaultValue={form.getValues("role")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="adjuster">Liquidador</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.role && (
                  <p className="text-xs text-red-500">{form.formState.errors.role.message}</p>
                )}
              </div>
              <DialogFooter>
                <DialogClose>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={inviteMutation.isPending || updateMutation.isPending}>
                  {inviteMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Enviar Invitación"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Usuarios del sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 pb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full max-w-sm"
            />
          </div>
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No se encontraron usuarios.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {user.full_name || "Sin nombre"}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={roleColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <UserCheck className="h-3 w-3" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500">
                            <UserX className="h-3 w-3" /> Inactivo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(user.id);
                              form.reset({
                                email: user.email || "",
                                fullName: user.full_name || "",
                                role: user.role as Exclude<UserRole, "super_admin" | "client">,
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (confirm("¿Desactivar este usuario?")) {
                                  deactivateMutation.mutate(user.id);
                                }
                              }}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
