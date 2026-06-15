"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaims, createClaim, updateClaim, deleteClaim } from "@/services/claims";
import { claimSchema, type ClaimInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";

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
import type { ClaimStatus } from "@/types";

const statusLabels: Record<ClaimStatus, string> = {
  created: "Creado",
  scheduled: "Agendado",
  in_progress: "En proceso",
  pending_info: "Pendiente",
  in_review: "En revisión",
  signed: "Firmado",
  closed: "Cerrado",
};

const statusColors: Record<ClaimStatus, string> = {
  created: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  pending_info: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  in_review: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  signed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: claims, isLoading } = useQuery({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
  });

  const form = useForm<ClaimInput>({
    resolver: standardSchemaResolver(claimSchema),
    defaultValues: {
      claimNumber: "",
      policyNumber: "",
      insuranceCompany: "",
      insuredName: "",
      insuredEmail: "",
      insuredPhone: "",
      address: "",
      city: "",
      claimDate: "",
      claimType: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createClaim,
    onSuccess: () => {
      toast.success("Siniestro creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClaimInput> }) =>
      updateClaim(id, data),
    onSuccess: () => {
      toast.success("Siniestro actualizado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClaim,
    onSuccess: () => {
      toast.success("Siniestro eliminado");
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: ClaimInput) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values });
    } else {
      // TODO: usar company_id real del perfil de usuario
      createMutation.mutate({ ...values, company_id: "" });
    }
  };

  const filteredClaims = claims?.filter((c) =>
    [c.claim_number, c.insured_name, c.address, c.city]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Siniestros</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button onClick={() => { setEditingId(null); form.reset(); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Siniestro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Siniestro" : "Nuevo Siniestro"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número Siniestro</Label>
                  <Input {...form.register("claimNumber")} />
                  {form.formState.errors.claimNumber && (
                    <p className="text-xs text-red-500">{form.formState.errors.claimNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Número Póliza</Label>
                  <Input {...form.register("policyNumber")} />
                  {form.formState.errors.policyNumber && (
                    <p className="text-xs text-red-500">{form.formState.errors.policyNumber.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Compañía de Seguros</Label>
                <Input {...form.register("insuranceCompany")} />
              </div>
              <div className="space-y-2">
                <Label>Nombre Asegurado</Label>
                <Input {...form.register("insuredName")} />
                {form.formState.errors.insuredName && (
                  <p className="text-xs text-red-500">{form.formState.errors.insuredName.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...form.register("insuredEmail")} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input {...form.register("insuredPhone")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input {...form.register("address")} />
                {form.formState.errors.address && (
                  <p className="text-xs text-red-500">{form.formState.errors.address.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input {...form.register("city")} />
                  {form.formState.errors.city && (
                    <p className="text-xs text-red-500">{form.formState.errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Fecha Siniestro</Label>
                  <Input {...form.register("claimDate")} type="date" />
                  {form.formState.errors.claimDate && (
                    <p className="text-xs text-red-500">{form.formState.errors.claimDate.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo Siniestro</Label>
                <Input {...form.register("claimType")} placeholder="Ej: Daños por agua" />
                {form.formState.errors.claimType && (
                  <p className="text-xs text-red-500">{form.formState.errors.claimType.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input {...form.register("notes")} />
              </div>
              <DialogFooter>
                <DialogClose>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear Siniestro"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lista de siniestros registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 pb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, nombre, dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full max-w-sm"
            />
          </div>
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Asegurado</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredClaims?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No se encontraron siniestros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClaims?.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {claim.claim_number}
                        </div>
                      </TableCell>
                      <TableCell>{claim.insured_name}</TableCell>
                      <TableCell>{claim.address}, {claim.city}</TableCell>
                      <TableCell>{new Date(claim.claim_date).toLocaleDateString("es-CL")}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[claim.status]}>
                          {statusLabels[claim.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(claim.id);
                              form.reset({
                                claimNumber: claim.claim_number,
                                policyNumber: claim.policy_number,
                                insuranceCompany: claim.insurance_company || "",
                                insuredName: claim.insured_name,
                                insuredEmail: claim.insured_email || "",
                                insuredPhone: claim.insured_phone || "",
                                address: claim.address,
                                city: claim.city,
                                claimDate: claim.claim_date,
                                claimType: claim.claim_type,
                                notes: claim.notes || "",
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm("¿Eliminar este siniestro?")) {
                                deleteMutation.mutate(claim.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
