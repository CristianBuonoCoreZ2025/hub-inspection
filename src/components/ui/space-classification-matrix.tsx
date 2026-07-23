"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Grid3x3 } from "lucide-react";
import type { DamageSpace, PropertyClassification } from "@/types";

interface SpaceClassificationMatrixProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaces: DamageSpace[];
  classifications: PropertyClassification[];
  onSave: (updates: { id: string; applicable_classifications: string[] }[]) => void;
}

export function SpaceClassificationMatrix({
  open,
  onOpenChange,
  spaces,
  classifications,
  onSave,
}: SpaceClassificationMatrixProps) {
  // Inicializar matriz desde props
  const initialMatrix = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of spaces) {
      m.set(s.id, new Set<string>(s.applicable_classifications || ["Otros"]));
    }
    return m;
  }, [spaces]);

  const [matrix, setMatrix] = React.useState<Map<string, Set<string>>>(initialMatrix);

  // Reset cuando se abre
  const [lastOpen, setLastOpen] = React.useState(false);
  if (open && !lastOpen) {
    setLastOpen(true);
    setMatrix(initialMatrix);
  }
  if (!open && lastOpen) {
    setLastOpen(false);
  }

  const toggle = (spaceId: string, classificationName: string) => {
    setMatrix((prev) => {
      const m = new Map(prev);
      const set = new Set(m.get(spaceId) || []);
      if (set.has(classificationName)) {
        set.delete(classificationName);
      } else {
        set.add(classificationName);
      }
      // "Otros" siempre debe estar si no hay ninguna seleccionada
      if (set.size === 0) set.add("Otros");
      m.set(spaceId, set);
      return m;
    });
  };

  const handleSave = () => {
    const updates: { id: string; applicable_classifications: string[] }[] = [];
    for (const [spaceId, classSet] of matrix.entries()) {
      updates.push({ id: spaceId, applicable_classifications: Array.from(classSet) });
    }
    onSave(updates);
    onOpenChange(false);
  };

  const classNames = classifications.map((c) => c.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-md max-w-4xl" showCloseButton={false}>
        <div className="modal-header">
          <DialogTitle className="modal-title flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Matriz Espacios × Clasificaciones
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Marca qué espacios aplican a cada tipo de inmueble. Los cambios se guardan en la base de datos.
          </DialogDescription>
        </div>

        <div className="modal-body overflow-auto" style={{ maxHeight: "60vh" }}>
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-card z-10">Espacio</th>
                {classNames.map((cn) => (
                  <th key={cn} className="text-center min-w-[80px]">{cn}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spaces.map((space) => {
                const active = matrix.get(space.id) || new Set<string>();
                return (
                  <tr key={space.id}>
                    <td className="text-[11px] font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                      {space.name}
                    </td>
                    {classNames.map((cn) => {
                      const isActive = active.has(cn);
                      return (
                        <td key={cn} className="text-center">
                          <button
                            type="button"
                            onClick={() => toggle(space.id, cn)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                              isActive
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 hover:bg-emerald-200"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                            title={isActive ? "Activo" : "Inactivo"}
                          >
                            {isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <div className="text-[11px] text-muted-foreground">
            {spaces.length} espacios × {classNames.length} clasificaciones
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="pg-btn-platinum" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="pg-btn-platinum" onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
