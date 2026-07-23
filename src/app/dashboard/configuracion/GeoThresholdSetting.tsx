"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invalidateSystemSettingCache } from "@/services/settings";

export default function GeoThresholdSetting() {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = React.useState("500");

  const { data: threshold, isLoading } = useQuery({
    queryKey: ["geo-threshold"],
    queryFn: async () => {
      const res = await fetch("/api/settings/geo-threshold");
      const data = await res.json();
      return typeof data.threshold === "number" ? data.threshold : 500;
    },
  });

  React.useEffect(() => {
    if (threshold == null) return;
    const id = setTimeout(() => setInputValue(String(threshold)), 0);
    return () => clearTimeout(id);
  }, [threshold]);

  const updateMutation = useMutation({
    mutationFn: async (value: number) => {
      const res = await fetch("/api/settings/geo-threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateSystemSettingCache("geo_threshold_meters");
      queryClient.invalidateQueries({ queryKey: ["geo-threshold"] });
      toast.success("Umbral de geolocalización actualizado");
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar"),
  });

  const handleSave = () => {
    const parsed = Number(inputValue);
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("El umbral debe ser un número mayor a 0");
      return;
    }
    updateMutation.mutate(parsed);
  };

  return (
    <section className="app-panel">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Umbral de geolocalización</h2>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Distancia máxima en metros entre la ubicación capturada y la dirección del siniestro
        para considerar la inspección como verificada.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label className="text-[11px] text-muted-foreground">Metros</Label>
          <Input
            type="number"
            min={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="500"
            className="app-input"
            disabled={isLoading}
          />
        </div>
        <Button
          type="button"
          className="pg-btn-platinum"
          onClick={handleSave}
          disabled={isLoading || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Guardar
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Ejemplos: 10m (muy estricto), 100m, 500m (estándar), 5000m (zonas rurales).
      </p>
    </section>
  );
}
