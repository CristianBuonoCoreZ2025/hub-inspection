import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * API route auxiliar para el export de siniestros.
 *
 * POST /api/export-claims-aux
 *   Body: { claimIds: string[] }
 *   → Usa la service role key para evitar RLS
 *   → Devuelve:
 *       {
 *         inspections: Record<claimId, { scheduled_at, started_at, ended_at, status, inspection_type }>,
 *         coordinations: Record<claimId, issued_on>
 *       }
 *
 * Las tablas inspection_sessions y claim_actions tienen RLS que bloquea
 * la lectura desde el navegador con la anon key. Esta route usa la
 * service role key para traer los datos en una sola llamada.
 */

const CIN_TEMPLATE_IDS = [
  "b2000002-0000-0000-0000-000000000001",
  "b2000001-0000-0000-0000-000000000001",
];

const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const claimIds: string[] = Array.isArray(body?.claimIds) ? body.claimIds : [];

    if (claimIds.length === 0) {
      return NextResponse.json({ inspections: {}, coordinations: {} });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      logger.error("[export-claims-aux] Faltan variables de entorno de Supabase");
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Generar lotes
    const batches: string[][] = [];
    for (let i = 0; i < claimIds.length; i += BATCH_SIZE) {
      batches.push(claimIds.slice(i, i + BATCH_SIZE));
    }

    // Lanzar todas las queries en paralelo
    const sessionPromises = batches.map((batch) =>
      supabase
        .from("inspection_sessions")
        .select("claim_id, scheduled_at, started_at, ended_at, status, inspection_type, created_at")
        .in("claim_id", batch)
        .order("created_at", { ascending: false })
    );

    const cinPromises = batches.map((batch) =>
      supabase
        .from("claim_actions")
        .select("claim_id, issued_on, action_template_id")
        .in("claim_id", batch)
        .in("action_template_id", CIN_TEMPLATE_IDS)
        .not("issued_on", "is", null)
        .order("issued_on", { ascending: false })
    );

    const [sessionResults, cinResults] = await Promise.all([
      Promise.all(sessionPromises),
      Promise.all(cinPromises),
    ]);

    // Procesar inspection_sessions — la más reciente por claim
    const inspections: Record<string, { scheduled_at: string | null; started_at: string | null; ended_at: string | null; status: string; inspection_type: string }> = {};
    for (const { data: sessions, error } of sessionResults) {
      if (error) {
        logger.error(`[export-claims-aux] Error inspection_sessions: ${error.message}`);
        continue;
      }
      if (sessions) {
        for (const s of sessions) {
          if (!inspections[s.claim_id]) {
            inspections[s.claim_id] = {
              scheduled_at: s.scheduled_at,
              started_at: s.started_at,
              ended_at: s.ended_at,
              status: s.status,
              inspection_type: s.inspection_type,
            };
          }
        }
      }
    }

    // Procesar CIN actions — la más reciente emitida por claim
    const coordinations: Record<string, string> = {};
    for (const { data: cinActions, error } of cinResults) {
      if (error) {
        logger.error(`[export-claims-aux] Error CIN: ${error.message}`);
        continue;
      }
      if (cinActions) {
        for (const a of cinActions) {
          if (!coordinations[a.claim_id]) {
            coordinations[a.claim_id] = a.issued_on;
          }
        }
      }
    }

    return NextResponse.json({ inspections, coordinations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[export-claims-aux] Error inesperado: ${msg}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
