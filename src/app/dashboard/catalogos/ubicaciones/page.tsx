"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRegions, getCities, getCommunes } from "@/services/catalogs";
import { getCountries } from "@/services/countries";
import { ChevronRight, ArrowLeft, Globe, Building2, Landmark, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  level: number;
}

export default function UbicacionesPage() {
  const [level, setLevel] = useState(0); // 0=paises, 1=regiones, 2=ciudades, 3=comunas
  const [selectedCountry, setSelectedCountry] = useState<{ id: string; name: string } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<{ id: string; name: string } | null>(null);
  const [selectedCity, setSelectedCity] = useState<{ id: string; name: string } | null>(null);

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
                <tr key={item.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => level < 3 && handleRowClick(item)}>
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
                    {level < 3 && (
                      <Button variant="ghost" size="sm" className="btn-neutral opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}>
                        {getNextLevelLabel()} <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
