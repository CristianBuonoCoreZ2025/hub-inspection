// Analiza las inspecciones remotas recientes después del cambio a Cloudflare TURN.
// Muestra: caso, inspector, si hubo video, y datos transferidos.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..", "..");

const envFile = readFileSync(resolve(root, ".env.production"), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1) Buscar sesiones remotas activas o completadas recientemente (después de 18:35 UTC)
  console.log(`\n${"=".repeat(100)}`);
  console.log(`INSPECCIONES REMOTAS DESPUÉS DEL DEPLOY DE CLOUDFLARE TURN (18:35 UTC)`);
  console.log(`${"=".repeat(100)}\n`);

  const { data: sessions, error: sErr } = await supabase
    .from("inspection_sessions")
    .select(`
      id, inspection_number, status, inspection_type, started_at, ended_at,
      created_at, updated_at, inspector_id,
      inspector:profiles!inspection_sessions_inspector_id_fkey(id, full_name, email),
      claim:claims!inner(id, client_reference, claim_number, liquidation_number, company:companies!claims_company_id_fkey(name))
    `)
    .eq("inspection_type", "remote")
    .gte("updated_at", "2026-08-25T18:35:00Z")
    .order("updated_at", { ascending: false })
    .limit(30);

  if (sErr) { console.error("Error:", sErr.message); return; }
  if (!sessions || !sessions.length) {
    console.log("No se encontraron sesiones remotas recientes.");
    return;
  }

  console.log(`Sesiones remotas encontradas: ${sessions.length}\n`);

  for (const sess of sessions) {
    console.log(`\n${"─".repeat(90)}`);
    console.log(`CASO: ${sess.inspection_number}`);
    console.log(`  Claim ref: ${sess.claim?.client_reference}  | Liquidación: ${sess.claim?.liquidation_number}`);
    console.log(`  Empresa: ${sess.claim?.company?.name}`);
    console.log(`  Inspector: ${sess.inspector?.full_name} (${sess.inspector?.email})`);
    console.log(`  Estado sesión: ${sess.status}`);
    console.log(`  Iniciada: ${sess.started_at || "—"}`);
    console.log(`  Finalizada: ${sess.ended_at || "—"}`);
    console.log(`  Actualizada: ${sess.updated_at}`);

    // Buscar logs de conexión de esta sesión
    const { data: logs } = await supabase
      .from("magic_link_connection_logs")
      .select("*")
      .eq("session_id", sess.id)
      .order("created_at", { ascending: true });

    if (logs && logs.length) {
      console.log(`\n  LOGS DE CONEXIÓN (${logs.length}):`);

      // Agrupar por IP para identificar dispositivos
      const insuredLogs = logs.filter((l) => l.role === "insured");
      const adjusterLogs = logs.filter((l) => l.role === "adjuster");

      console.log(`\n  ── Asegurado (${insuredLogs.length} conexiones):`);
      for (const l of insuredLogs) {
        const duration = l.disconnected_at
          ? Math.round((new Date(l.disconnected_at).getTime() - new Date(l.connected_at).getTime()) / 1000)
          : null;
        const durStr = duration !== null ? `${duration}s` : "activa";
        const device = `${l.device_type} ${l.browser} ${l.browser_version} ${l.os} ${l.os_version}`.trim();
        console.log(`    [${l.connected_at}]  status=${l.status}  cámara=${l.camera_permission}  mic=${l.microphone_permission}  duración=${durStr}`);
        console.log(`      IP=${l.ip_address}  device=${device}`);
        if (l.disconnect_reason) console.log(`      disconnect: ${l.disconnect_reason}`);
      }

      console.log(`\n  ── Inspector/Adjuster (${adjusterLogs.length} conexiones):`);
      for (const l of adjusterLogs) {
        const duration = l.disconnected_at
          ? Math.round((new Date(l.disconnected_at).getTime() - new Date(l.connected_at).getTime()) / 1000)
          : null;
        const durStr = duration !== null ? `${duration}s` : "activa";
        const device = `${l.device_type} ${l.browser} ${l.browser_version} ${l.os} ${l.os_version}`.trim();
        console.log(`    [${l.connected_at}]  status=${l.status}  cámara=${l.camera_permission}  mic=${l.microphone_permission}  duración=${durStr}`);
        console.log(`      IP=${l.ip_address}  device=${device}`);
        if (l.disconnect_reason) console.log(`      disconnect: ${l.disconnect_reason}`);
      }

      // Determinar si hubo video exitoso
      const insuredSuccess = insuredLogs.filter((l) => l.status === "success" && l.camera_permission === "granted");
      const adjusterSuccess = adjusterLogs.filter((l) => l.status === "success" && l.camera_permission === "granted");
      const hadKicked = logs.some((l) => l.status === "kicked");
      const hadFailed = logs.some((l) => l.status === "failed");

      console.log(`\n  ── ANÁLISIS:`);
      if (insuredSuccess.length > 0 && adjusterSuccess.length > 0) {
        // Calcular tiempo de overlap
        const insuredRanges = insuredSuccess.map((l) => ({
          start: new Date(l.connected_at).getTime(),
          end: l.disconnected_at ? new Date(l.disconnected_at).getTime() : Date.now(),
        }));
        const adjusterRanges = adjusterSuccess.map((l) => ({
          start: new Date(l.connected_at).getTime(),
          end: l.disconnected_at ? new Date(l.disconnected_at).getTime() : Date.now(),
        }));

        let maxOverlap = 0;
        for (const ir of insuredRanges) {
          for (const ar of adjusterRanges) {
            const overlap = Math.min(ir.end, ar.end) - Math.max(ir.start, ar.start);
            if (overlap > maxOverlap) maxOverlap = overlap;
          }
        }

        if (maxOverlap > 5000) {
          console.log(`    ✓ AMBOS conectados simultáneamente por ${Math.round(maxOverlap / 1000)}s — video probablemente exitoso`);
        } else {
          console.log(`    ⚠ Ambos tuvieron success pero sin overlap significativo (overlap=${Math.round(maxOverlap / 1000)}s)`);
        }
      } else if (insuredSuccess.length > 0 && adjusterSuccess.length === 0) {
        console.log(`    ⚠ Asegurado conectó con cámara pero inspector no tuvo cámara granted`);
      } else if (insuredSuccess.length === 0 && adjusterSuccess.length > 0) {
        console.log(`    ⚠ Inspector conectó con cámara pero asegurado no tuvo cámara granted`);
      } else {
        console.log(`    ✗ Ningún lado tuvo cámara granted — no hubo video`);
      }

      if (hadKicked) console.log(`    ⚠ Hubo un kick (inspector expulsó a un cliente)`);
      if (hadFailed) console.log(`    ✗ Hubo conexiones fallidas`);
    } else {
      console.log(`\n  Sin logs de conexión.`);
    }
  }

  // 2) Intentar obtener métricas de Cloudflare TURN
  console.log(`\n\n${"=".repeat(100)}`);
  console.log(`MÉTRICAS DE CLOUDFLARE TURN (transferencia de datos)`);
  console.log(`${"=".repeat(100)}\n`);

  const keyId = env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !apiToken) {
    console.log("No hay credenciales de Cloudflare configuradas.");
    return;
  }

  // Listar TURN keys para ver si hay analytics
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Credenciales generadas (historial):`);
      if (data.credentials && Array.isArray(data.credentials)) {
        for (const c of data.credentials.slice(0, 20)) {
          console.log(`  ${JSON.stringify(c)}`);
        }
      } else {
        console.log(`  Respuesta: ${JSON.stringify(data).substring(0, 500)}`);
      }
    } else {
      console.log(`  Status: ${res.status}`);
      const text = await res.text();
      console.log(`  ${text.substring(0, 300)}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  // Intentar endpoint de analytics
  try {
    const res2 = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/usage`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (res2.ok) {
      const data2 = await res2.json();
      console.log(`\nUso de TURN:`);
      console.log(JSON.stringify(data2, null, 2));
    } else {
      console.log(`\nEndpoint /usage: ${res2.status}`);
    }
  } catch (e) {
    console.log(`\nEndpoint /usage no disponible: ${e.message}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
