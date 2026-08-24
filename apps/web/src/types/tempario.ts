// ── Tempario de Construcción (DS27 Chile) ──
// Catálogo global desacoplado del módulo de inspecciones.
// Estructura: chapter → subchapter → task → price (por región × moneda × fecha)

export interface TemparioChapter {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemparioSubchapter {
  id: string;
  chapter_id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Join opcional
  chapter?: { id: string; code: string; name: string } | null;
}

export interface TemparioTask {
  id: string;
  chapter_id: string;
  subchapter_id: string | null;
  code: string;
  description: string;
  unit: string;
  crew_type: string | null;
  complexity: "facil" | "media" | "dificil";
  rendimiento: number;
  time_per_unit: number;
  category_sindical: string | null;
  source: string;
  source_ref: string | null;
  observations: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joins opcionales
  chapter?: { id: string; code: string; name: string } | null;
  subchapter?: { id: string; code: string; name: string } | null;
}

export interface TemparioPrice {
  id: string;
  task_id: string;
  region_id: string;
  currency_code: string;
  price: number;
  factor_zonal: number;
  effective_date: string;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joins opcionales
  task?: { id: string; code: string; description: string; unit: string } | null;
  region?: { id: string; code: string | null; name: string } | null;
  currency?: { code: string; name: string; symbol: string | null } | null;
}

// Fila aplanada para la grilla principal: task + un precio (región/moneda seleccionada)
export interface TemparioTaskWithPrice extends TemparioTask {
  price_id?: string | null;
  price?: number | null;
  factor_zonal?: number | null;
  currency_code?: string | null;
  region_id?: string | null;
  region_name?: string | null;
  effective_date?: string | null;
  price_source?: string | null;
}

export type TemparioComplexity = "facil" | "media" | "dificil";

export const TEMPARIO_COMPLEXITY_LABELS: Record<TemparioComplexity, string> = {
  facil: "Fácil",
  media: "Media",
  dificil: "Difícil",
};

export const TEMPARIO_UNITS: string[] = [
  "m2", "m3", "ml", "u", "gl", "kg", "h",
];

export const TEMPARIO_SOURCES: string[] = [
  "MINVU DS27",
  "Manual Convenios",
  "APU Chile",
  "MOP",
  "SII-PUC",
  "Otro",
];
