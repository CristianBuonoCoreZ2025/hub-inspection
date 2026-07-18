import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Sincroniza tipos de cambio desde mindicador.cl (wrapper gratuito del Banco Central de Chile).
 *
 * POST /api/currencies/sync-chile
 * Body: { year?: number, month?: number (0-11), currency?: "USD"|"UF", date?: "YYYY-MM-DD", startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }
 *
 * - `currency`: si se pasa, solo sincroniza esa moneda. Si no, sincroniza ambas.
 * - Si viene `year` (sin month): trae todo el año en 1-2 llamadas
 * - Si viene `year` + `month`: trae ese mes (filtra del año)
 * - Si viene `date`: solo esa fecha
 * - Si vienen `startDate` y `endDate`: rango entre esas fechas
 * - Si no viene nada: últimos 30 días desde hoy
 *
 * mindicador.cl API:
 *   GET https://mindicador.cl/api/dolar           → serie completa
 *   GET https://mindicador.cl/api/dolar/2024      → todo el año 2024
 *   GET https://mindicador.cl/api/dolar/DD-MM-YYYY → fecha específica
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dateStr = body.date as string | undefined;
    const startDateStr = body.startDate as string | undefined;
    const endDateStr = body.endDate as string | undefined;
    const year = body.year as number | undefined;
    const month = body.month as number | undefined; // 0-11
    const currencyFilter = body.currency as string | undefined; // "USD" | "UF"
    const force = body.force as boolean | undefined; // si true, actualiza registros existentes

    // Obtener el country_id de Chile
    const supabase = createAdminClient();
    const { data: chile, error: chileErr } = await supabase
      .from("countries")
      .select("id, code")
      .eq("code", "CL")
      .single();

    if (chileErr || !chile) {
      return NextResponse.json({ error: "No se encontró Chile en la base de datos" }, { status: 500 });
    }

    // Indicadores a sincronizar (filtrar por currency si se especifica)
    const allIndicators = [
      { apiCode: "dolar", currencyCode: "USD" },
      { apiCode: "uf", currencyCode: "UF" },
    ];
    const indicators = currencyFilter
      ? allIndicators.filter(i => i.currencyCode === currencyFilter)
      : allIndicators;

    const results: Array<{ date: string; currency: string; rate: number; status: "inserted" | "exists" | "error" }> = [];

    // ── Modo año completo o mes específico: una sola llamada por indicador ──
    if (year !== undefined && month === undefined) {
      // Año completo: GET /api/dolar/2024 → serie con todos los días del año
      for (const ind of indicators) {
        try {
          const apiUrl = `https://mindicador.cl/api/${ind.apiCode}/${year}`;
          const resp = await fetch(apiUrl, { next: { revalidate: 0 } });
          if (!resp.ok) {
            results.push({ date: `${year}-01-01`, currency: ind.currencyCode, rate: 0, status: "error" });
            continue;
          }
          const data = await resp.json();
          const serie = data.serie as Array<{ fecha: string; valor: number }>;
          if (!serie || serie.length === 0) {
            results.push({ date: `${year}-01-01`, currency: ind.currencyCode, rate: 0, status: "error" });
            continue;
          }
          // Insertar cada fecha de la serie
          for (const item of serie) {
            const date = item.fecha.split("T")[0];
            await upsertRate(supabase, chile.id, ind.currencyCode, date, item.valor, results, force);
          }
        } catch {
          results.push({ date: `${year}-01-01`, currency: ind.currencyCode, rate: 0, status: "error" });
        }
      }
    } else if (year !== undefined && month !== undefined) {
      // Mes específico: traer todo el año y filtrar el mes
      // (mindicador.cl no soporta query por mes, solo por año o por día)
      for (const ind of indicators) {
        try {
          const apiUrl = `https://mindicador.cl/api/${ind.apiCode}/${year}`;
          const resp = await fetch(apiUrl, { next: { revalidate: 0 } });
          if (!resp.ok) {
            results.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-01`, currency: ind.currencyCode, rate: 0, status: "error" });
            continue;
          }
          const data = await resp.json();
          const serie = data.serie as Array<{ fecha: string; valor: number }>;
          if (!serie || serie.length === 0) {
            results.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-01`, currency: ind.currencyCode, rate: 0, status: "error" });
            continue;
          }
          // Filtrar solo el mes solicitado
          const monthStr = String(month + 1).padStart(2, "0");
          for (const item of serie) {
            const date = item.fecha.split("T")[0];
            if (date.split("-")[1] !== monthStr) continue;
            await upsertRate(supabase, chile.id, ind.currencyCode, date, item.valor, results, force);
          }
        } catch {
          results.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-01`, currency: ind.currencyCode, rate: 0, status: "error" });
        }
      }
    } else {
      // ── Modo fecha específica o rango: una llamada por día por indicador ──
      const dates: string[] = [];
      if (dateStr) {
        dates.push(dateStr);
      } else if (startDateStr && endDateStr) {
        const start = new Date(startDateStr + "T00:00:00");
        const end = new Date(endDateStr + "T00:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split("T")[0]);
        }
      } else {
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split("T")[0]);
        }
      }

      for (const date of dates) {
        const [yyyy, mm, dd] = date.split("-");
        const apiDate = `${dd}-${mm}-${yyyy}`;

        for (const ind of indicators) {
          try {
            const apiUrl = `https://mindicador.cl/api/${ind.apiCode}/${apiDate}`;
            const resp = await fetch(apiUrl, { next: { revalidate: 0 } });

            if (!resp.ok) {
              results.push({ date, currency: ind.currencyCode, rate: 0, status: "error" });
              continue;
            }

            const data = await resp.json();
            const serie = data.serie as Array<{ fecha: string; valor: number }>;

            if (!serie || serie.length === 0) {
              results.push({ date, currency: ind.currencyCode, rate: 0, status: "error" });
              continue;
            }

            await upsertRate(supabase, chile.id, ind.currencyCode, date, serie[0].valor, results);
          } catch {
            results.push({ date, currency: ind.currencyCode, rate: 0, status: "error" });
          }
        }
      }
    }

    const inserted = results.filter(r => r.status === "inserted").length;
    const exists = results.filter(r => r.status === "exists").length;
    const errors = results.filter(r => r.status === "error").length;

    logger.info(`Sync BCCh: ${inserted} insertados, ${exists} ya existían, ${errors} errores`);

    return NextResponse.json({
      success: true,
      summary: { inserted, exists, errors, total: results.length },
      details: results.filter(r => r.status === "inserted" || r.status === "error"),
    });
  } catch (err) {
    logger.error("Error en sync-chile:", err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

/**
 * Inserta una tasa si no existe, o la marca como "exists" si ya está.
 * Si force=true, actualiza el registro existente en vez de saltarlo.
 */
async function upsertRate(
  supabase: ReturnType<typeof createAdminClient>,
  countryId: string,
  currencyCode: string,
  date: string,
  rate: number,
  results: Array<{ date: string; currency: string; rate: number; status: "inserted" | "exists" | "error" | "updated" }>,
  force = false,
) {
  // Verificar si ya existe
  const { data: existing } = await supabase
    .from("exchange_rates")
    .select("id")
    .eq("country_id", countryId)
    .eq("currency_code", currencyCode)
    .eq("effective_date", date)
    .maybeSingle();

  if (existing) {
    if (force) {
      // Actualizar el registro existente
      const { error: updateErr } = await supabase
        .from("exchange_rates")
        .update({ rate_to_base: rate, source: "mindicador.cl" })
        .eq("id", existing.id);
      if (updateErr) {
        results.push({ date, currency: currencyCode, rate, status: "error" });
      } else {
        results.push({ date, currency: currencyCode, rate, status: "updated" });
      }
      return;
    }
    results.push({ date, currency: currencyCode, rate, status: "exists" });
    return;
  }

  const { error: insertErr } = await supabase
    .from("exchange_rates")
    .insert({
      country_id: countryId,
      currency_code: currencyCode,
      rate_to_base: rate,
      effective_date: date,
      source: "mindicador.cl",
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      results.push({ date, currency: currencyCode, rate, status: "exists" });
    } else {
      results.push({ date, currency: currencyCode, rate, status: "error" });
    }
  } else {
    results.push({ date, currency: currencyCode, rate, status: "inserted" });
  }
}
