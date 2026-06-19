"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClaimTypeCauses } from "@/services/catalogs";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export default function ClaimTypeCausePage() {
  const [search, setSearch] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["tipos_siniestros_causas"],
    queryFn: getClaimTypeCauses,
  });

  const filtered = items?.filter((c) =>
    [c.cause_name].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Tipo-Causa</h1>
        <p className="app-page-lead">Relacion entre tipos de siniestro y causas.</p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
        </div>
      </div>

      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Causa</th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
            ) : filtered?.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
            ) : (
              filtered?.map((item) => (
                <tr key={item.id}>
                  <td><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /></td>
                  <td className="font-medium">{item.cause_name}</td>
                  <td></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
