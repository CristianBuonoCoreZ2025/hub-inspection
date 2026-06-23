"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRegions, getCities, getCommunes, createRegion, updateRegion, deleteRegion, createCity, updateCity, deleteCity, createCommune, updateCommune, deleteCommune } from "@/services/catalogs";
import { getCountries } from "@/services/countries";
import { ChevronRight, ArrowLeft, Globe, Building2, Landmark, Flag, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BreadcrumbItem {
  label: string;
  level: number;
}

export default function UbicacionesPage() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(0); // 0=paises, 1=regiones, 2=ciudades, 3=comunas
  const [selectedCountry, setSelectedCountry] = useState<{ id: string; name: string } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<{ id: string; name: string } | null>(null);
  const [selectedCity, setSelectedCity] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", parent_id: "" });

  const { data: countries, isLoading: loadingCountries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
  });

  const { data: regions, isLoading: loadingRegions } = useQuery({
    queryKey: ["regions", selectedCountry?.id],
    queryFn: () => getRegions(selectedCountry!.id),
    enabled: !!selectedCountry,
  });

  const { data: cities, isLoading: loadingCities } = useQuery({
    queryKey: ["cities", selectedRegion?.id],
    queryFn: () => getCities(selectedRegion!.id),
    enabled: !!selectedRegion,
  });

  const { data: communes, isLoading: loadingCommunes } = useQuery({
    queryKey: ["communes", selectedCity?.id],
    queryFn: () => getCommunes(selectedCity!.id),
    enabled: !!selectedCity,
  });

  // Mutations for Regions
  const createRegionMutation = useMutation({
    mutationFn: createRegion,
    onSuccess: () => { toast.success("Región creada"); queryClient.invalidateQueries({ queryKey: ["regions"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateRegionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateRegion>[1] }) => updateRegion(id, input),
    onSuccess: () => { toast.success("Región actualizada"); queryClient.invalidateQueries({ queryKey: ["regions"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteRegionMutation = useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => { toast.success("Región desactivada"); queryClient.invalidateQueries({ queryKey: ["regions"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutations for Cities
  const createCityMutation = useMutation({
    mutationFn: createCity,
    onSuccess: () => { toast.success("Ciudad creada"); queryClient.invalidateQueries({ queryKey: ["cities"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateCityMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCity>[1] }) => updateCity(id, input),
    onSuccess: () => { toast.success("Ciudad actualizada"); queryClient.invalidateQueries({ queryKey: ["cities"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteCityMutation = useMutation({
    mutationFn: deleteCity,
    onSuccess: () => { toast.success("Ciudad desactivada"); queryClient.invalidateQueries({ queryKey: ["cities"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  // Mutations for Communes
  const createCommuneMutation = useMutation({
    mutationFn: createCommune,
    onSuccess: () => { toast.success("Comuna creada"); queryClient.invalidateQueries({ queryKey: ["communes"] }); setOpen(false); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateCommuneMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCommune>[1] }) => updateCommune(id, input),
    onSuccess: () => { toast.success("Comuna actualizada"); queryClient.invalidateQueries({ queryKey: ["communes"] }); setOpen(false); setEditingId(null); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteCommuneMutation = useMutation({
    mutationFn: deleteCommune,
    onSuccess: () => { toast.success("Comuna desactivada"); queryClient.invalidateQueries({ queryKey: ["communes"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: "Paises", level: 0 }];
    if (selectedCountry) items.push({ label: selectedCountry.name, level: 1 });
    if (selectedRegion) items.push({ label: selectedRegion.name, level: 2 });
    if (selectedCity) items.push({ label: selectedCity.name, level: 3 });
    return items;
  }, [selectedCountry, selectedRegion, selectedCity]);

  const handleBreadcrumb = (targetLevel: number) => {
    setLevel(targetLevel);
    if (targetLevel === 0) {
      setSelectedCountry(null);
      setSelectedRegion(null);
      setSelectedCity(null);
    } else if (targetLevel === 1) {
      setSelectedRegion(null);
      setSelectedCity(null);
    } else if (targetLevel === 2) {
      setSelectedCity(null);
    }
  };

  const handleCountryClick = (country: { id: string; name: string }) => {
    setSelectedCountry(country);
    setLevel(1);
  };

  const handleRegionClick = (region: { id: string; name: string }) => {
    setSelectedRegion(region);
    setLevel(2);
  };

  const handleCityClick = (city: { id: string; name: string }) => {
    setSelectedCity(city);
    setLevel(3);
  };

  const isLoading = loadingCountries || loadingRegions || loadingCities || loadingCommunes;

  const currentData = useMemo(() => {
    switch (level) {
      case 0: return countries?.map(c => ({ id: c.id, name: c.name, code: c.code })) || [];
      case 1: return regions?.map(r => ({ id: r.id, name: r.name, code: r.code })) || [];
      case 2: return cities?.map(c => ({ id: c.id, name: c.name, code: null })) || [];
      case 3: return communes?.map(c => ({ id: c.id, name: c.name, code: null })) || [];
      default: return [];
    }
  }, [level, countries, regions, cities, communes]);

  const getLevelTitle = () => {
    switch (level) {
      case 0: return "Paises";
      case 1: return `Regiones de ${selectedCountry?.name}`;
      case 2: return `Ciudades de ${selectedRegion?.name}`;
      case 3: return `Comunas de ${selectedCity?.name}`;
    }
  };

  const getLevelIcon = () => {
    switch (level) {
      case 0: return <Globe className="h-5 w-5" />;
      case 1: return <Flag className="h-5 w-5" />;
      case 2: return <Building2 className="h-5 w-5" />;
      case 3: return <Landmark className="h-5 w-5" />;
    }
  };

  const getNextLevelLabel = () => {
    switch (level) {
      case 0: return "Ver regiones";
      case 1: return "Ver ciudades";
      case 2: return "Ver comunas";
      case 3: return null;
    }
  };

  const handleRowClick = (item: { id: string; name: string }) => {
    if (level === 0) handleCountryClick(item);
    else if (level === 1) handleRegionClick(item);
    else if (level === 2) handleCityClick(item);
  };

  const resetForm = () => setFormData({ name: "", code: "", parent_id: "" });

  const handleCreate = () => {
    setEditingId(null);
    resetForm();
    if (level === 1) setFormData({ ...formData, parent_id: selectedCountry?.id || "" });
    if (level === 2) setFormData({ ...formData, parent_id: selectedRegion?.id || "" });
    if (level === 3) setFormData({ ...formData, parent_id: selectedCity?.id || "" });
    setOpen(true);
  };

  const handleEdit = (item: { id: string; name: string; code?: string | null }) => {
    setEditingId(item.id);
    setFormData({ name: item.name, code: item.code || "", parent_id: "" });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    // Validate hierarchy before delete
    if (level === 1) {
      // Check if region has cities - need to query since cities not loaded at this level
      getCities(id).then((cityList) => {
        if (cityList && cityList.length > 0) {
          toast.error("No se puede eliminar esta región porque tiene ciudades asociadas. Elimine las ciudades primero.");
        } else {
          if (confirm("¿Desactivar esta región?")) {
            deleteRegionMutation.mutate(id);
          }
        }
      });
      return;
    }
    if (level === 2) {
      // Check if city has communes
      const hasChildren = communes && communes.some((c) => c.city_id === id);
      if (hasChildren) {
        toast.error("No se puede eliminar esta ciudad porque tiene comunas asociadas. Elimine las comunas primero.");
        return;
      }
    }
    if (confirm("¿Desactivar este registro?")) {
      if (level === 2) deleteCityMutation.mutate(id);
      if (level === 3) deleteCommuneMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (level === 0) return; // Paises no se editan aquí
    if (level === 1) {
      const input = { country_id: selectedCountry!.id, name: formData.name, code: formData.code || undefined };
      if (editingId) updateRegionMutation.mutate({ id: editingId, input });
      else createRegionMutation.mutate(input);
    }
    if (level === 2) {
      const input = { region_id: selectedRegion!.id, name: formData.name };
      if (editingId) updateCityMutation.mutate({ id: editingId, input });
      else createCityMutation.mutate(input);
    }
    if (level === 3) {
      const input = { city_id: selectedCity!.id, name: formData.name };
      if (editingId) updateCommuneMutation.mutate({ id: editingId, input });
      else createCommuneMutation.mutate(input);
    }
  };

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Ubicaciones</h1>
        <p className="app-page-lead">Catalogo jerarquico: Pais → Region → Ciudad → Comuna.</p>
      </header>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <button
              onClick={() => handleBreadcrumb(crumb.level)}
              className={`hover:text-foreground transition-colors ${idx === breadcrumbs.length - 1 ? 'font-medium text-foreground cursor-default' : 'hover:underline'}`}
              disabled={idx === breadcrumbs.length - 1}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {/* Level header */}
      <div className="flex items-center gap-2.5 mb-4">
        {level > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBreadcrumb(level - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
          {getLevelIcon()}
        </div>
        <h2 className="text-base font-semibold">{getLevelTitle()}</h2>
        <span className="ml-auto text-sm text-muted-foreground">
          {isLoading ? "Cargando..." : `${currentData.length} registros`}
        </span>
        {level > 0 && (
          <Button onClick={handleCreate} className="btn-create btn-sm ml-2">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        )}
      </div>

      {/* Data table */}
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Nombre</th>
              {level <= 1 && <th>Codigo</th>}
              <th className="w-[140px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Cargando...</td></tr>
            ) : currentData.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-8">No se encontraron registros.</td></tr>
            ) : (
              currentData.map((item) => (
                <tr key={item.id} className="group">
                  <td>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      {level === 0 ? <Globe className="h-4 w-4 text-muted-foreground" /> :
                       level === 1 ? <Flag className="h-4 w-4 text-muted-foreground" /> :
                       level === 2 ? <Building2 className="h-4 w-4 text-muted-foreground" /> :
                       <Landmark className="h-4 w-4 text-muted-foreground" />}
                    </span>
                  </td>
                  <td className="font-medium">{item.name}</td>
                  {level <= 1 && <td className="text-muted-foreground">{item.code || "—"}</td>}
                  <td>
                    <div className="flex items-center gap-1">
                      {level < 3 && (
                        <Button variant="ghost" size="sm" className="btn-neutral" onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}>
                          {getNextLevelLabel()} <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      )}
                      {level > 0 && (
                        <>
                          <Button variant="ghost" size="icon" className="btn-neutral btn-icon" onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="btn-danger btn-icon" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                {getLevelIcon()}
              </div>
              {editingId ? "Editar" : "Nuevo"} {level === 1 ? "Región" : level === 2 ? "Ciudad" : "Comuna"}
            </DialogTitle>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body space-y-4">
              <div className="modal-field">
                <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre" className="app-input" />
              </div>
              {level === 1 && (
                <div className="modal-field">
                  <Label className="app-field-label">Código</Label>
                  <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="Ej: RM" className="app-input" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="btn-cancel btn-footer">Cancelar</Button>
              <Button type="submit" size="sm" disabled={createRegionMutation.isPending || updateRegionMutation.isPending || createCityMutation.isPending || updateCityMutation.isPending || createCommuneMutation.isPending || updateCommuneMutation.isPending} className="btn-save btn-footer">
                {createRegionMutation.isPending || updateRegionMutation.isPending || createCityMutation.isPending || updateCityMutation.isPending || createCommuneMutation.isPending || updateCommuneMutation.isPending ? "Guardando..." : editingId ? "Guardar Cambios" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
