import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * API route para guardar stats de WebRTC en Supabase.
 *
 * POST /api/webrtc-stats
 *   Body: {
 *     sessionId: string,
 *     userId: string,
 *     role: string,
 *     outboundBitrate: number,
 *     inboundBitrate: number,
 *     packetLossPct: number,
 *     jitterMs: number,
 *     rttMs: number,
 *     iceCandidateType: string,
 *     connectionState: string,
 *   }
 *
 * Usa service role key para bypass RLS.
 */

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("webrtc_stats").insert({
      session_id: body.sessionId,
      user_id: body.userId,
      role: body.role,
      outbound_bitrate: body.outboundBitrate || 0,
      inbound_bitrate: body.inboundBitrate || 0,
      packet_loss_pct: body.packetLossPct || 0,
      jitter_ms: body.jitterMs || 0,
      rtt_ms: body.rttMs || 0,
      ice_candidate_type: body.iceCandidateType || "unknown",
      connection_state: body.connectionState || "unknown",
    });

    if (error) {
      logger.error(`[webrtc-stats] Error guardando stats: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[webrtc-stats] Error inesperado: ${msg}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/webrtc-stats?sessionId=xxx
 * Devuelve las últimas stats de una sesión.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("webrtc_stats")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stats: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[webrtc-stats] Error inesperado: ${msg}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
