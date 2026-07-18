import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Sincroniza tipos de cambio desde mindicador.cl (wrapper gratuito del Banco Central de Chile).
 *
 * POST /api/currencies/sync-chile
 * Body: { date?: "YYYY-MM-DD" }  // si no se pasa, usa hoy
 *
 * Trae USD y UF para la fecha indicada (o un rango) y los inserta en exchange_rates
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

    // Fechas a sincronizar: si viene una fecha, solo esa; si no, últimos 30 días
    const dates: string[] = [];
    if (dateStr) {
      dates.push(dateStr);
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
