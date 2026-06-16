"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompanies, createCompany, updateCompany, deleteCompany } from "@/services/companies";
import { companySchema, type CompanyInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export default function CompaniesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: getCompanies,
  });

  const form = useForm<CompanyInput>({
    resolver: standardSchemaResolver(companySchema),
    defaultValues: { name: "", slug: "", rut: "", address: "", phone: "", email: "", primaryColor: "" },
  });

  const createMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      toast.success("Empresa creada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CompanyInput> }) =>
      updateCompany(id, data),
    onSuccess: () => {
      toast.success("Empresa actualizada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      toast.success("Empresa eliminada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: CompanyInput) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const filtered = companies?.filter((c) =>
    [c.name, c.slug, c.rut, c.address].filter(Boolean).join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Empresas</h1>
        <p className="app-page-lead">Gestión de empresas y marcas del sistema.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button onClick={() => { setEditingId(null); form.reset(); }} className="btn-create btn-sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="modal-md">
            <div className="modal-header">
              <DialogTitle>{editingId ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input {...form.register("slug")} placeholder="mi-empresa" disabled={!!editingId} />
                  {form.formState.errors.slug && (
                    <p className="text-xs text-red-500">{form.formState.errors.slug.message}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>RUT</Label>
                  <Input {...form.register("rut")} placeholder="12.345.678-9" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...form.register("email")} type="email" placeholder="contacto@empresa.cl" />
                  {form.formState.errors.email && (
                    <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input {...form.register("address")} placeholder="Av. Principal 123, Santiago" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input {...form.register("phone")} placeholder="+56 9 1234 5678" />
                </div>
                <div className="space-y-2">
                  <Label>Color Primario</Label>
                  <Input {...form.register("primaryColor")} placeholder="#0f172a" />
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <DialogClose>
                <Button type="button" className="btn-cancel">Cancelar</Button>
              </DialogClose>
              <Button type="submit" className="btn-save" disabled={createMutation.isPending || updateMutation.isPending} onClick={form.handleSubmit(onSubmit)}>
                {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Empresa"}
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
                <th>RUT</th>
                <th>Contacto</th>
                <th>Color</th>
                <th className="w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : filtered?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted-foreground py-4">
                      No se encontraron empresas.
                    </td>
                  </tr>
                ) : (
                  filtered?.map((company) => (
                    <tr key={company.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {company.name}
                        </div>
                      </td>
                      <td>{company.rut || "—"}</td>
                      <td>
                        <div className="flex flex-col gap-0.5 text-[12px]">
                          {company.email && <span>{company.email}</span>}
                          {company.phone && <span className="text-muted-foreground">{company.phone}</span>}
                          {!company.email && !company.phone && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td>
                        {company.primary_color ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-4 w-4 rounded-full border"
                              style={{ backgroundColor: company.primary_color }}
                            />
                            {company.primary_color}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-neutral btn-icon"
                            onClick={() => {
                              setEditingId(company.id);
                              form.reset({
                                name: company.name,
                                slug: company.slug,
                                rut: company.rut || "",
                                address: company.address || "",
                                phone: company.phone || "",
                                email: company.email || "",
                                primaryColor: company.primary_color || "",
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-danger btn-icon"
                            onClick={() => {
                              if (confirm("¿Eliminar esta empresa?")) {
                                deleteMutation.mutate(company.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
