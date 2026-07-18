import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Sincroniza tipos de cambio desde mindicador.cl (wrapper gratuito del Banco Central de Chile).
 *
 * POST /api/currencies/sync-chile
 * Body: { startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", date?: "YYYY-MM-DD" }
 *
 * - Si viene `date`: solo esa fecha.
 * - Si vienen `startDate` y `endDate`: rango entre esas fechas.
 * - Si no viene nada: últimos 30 días desde hoy.
 *
 * Trae USD y UF para las fechas indicadas y los inserta en exchange_rates
 * para Chile (country_id del país con code='CL').
 *
 * mindicador.cl API:
 *   GET https://mindicador.cl/api/dolar/DD-MM-YYYY → { serie: [{ fecha, valor }] }
 *   GET https://mindicador.cl/api/uf/DD-MM-YYYY    → { serie: [{ fecha, valor }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dateStr = body.date as string | undefined;
    const startDateStr = body.startDate as string | undefined;
    const endDateStr = body.endDate as string | undefined;

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

    // Calcular fechas a sincronizar
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

    // Indicadores a sincronizar (código mindicador → código en nuestra tabla currencies)
    const indicators = [
      { apiCode: "dolar", currencyCode: "USD" },
      { apiCode: "uf", currencyCode: "UF" },
    ];

    const results: Array<{ date: string; currency: string; rate: number; status: "inserted" | "exists" | "error" }> = [];

    for (const date of dates) {
      // Convertir YYYY-MM-DD a DD-MM-YYYY para la API de mindicador
      const [yyyy, mm, dd] = date.split("-");
      const apiDate = `${dd}-${mm}-${yyyy}`;

      for (const ind of indicators) {
        try {
          // Verificar si ya existe un registro para esta fecha + moneda + país
          const { data: existing } = await supabase
            .from("exchange_rates")
            .select("id")
            .eq("country_id", chile.id)
            .eq("currency_code", ind.currencyCode)
            .eq("effective_date", date)
            .maybeSingle();

          if (existing) {
            results.push({ date, currency: ind.currencyCode, rate: 0, status: "exists" });
            continue;
          }

          // Fetch desde mindicador.cl
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

          const rate = serie[0].valor;

          // Insertar en exchange_rates
          const { error: insertErr } = await supabase
            .from("exchange_rates")
            .insert({
              country_id: chile.id,
              currency_code: ind.currencyCode,
              rate_to_base: rate,
              effective_date: date,
              source: "mindicador.cl",
            });

          if (insertErr) {
            // Puede ser duplicate key (constraint unique country_id + currency_code + effective_date)
            if (insertErr.code === "23505") {
              results.push({ date, currency: ind.currencyCode, rate, status: "exists" });
            } else {
              results.push({ date, currency: ind.currencyCode, rate, status: "error" });
            }
          } else {
            results.push({ date, currency: ind.currencyCode, rate, status: "inserted" });
          }
        } catch {
          results.push({ date, currency: ind.currencyCode, rate: 0, status: "error" });
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
