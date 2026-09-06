// Resumen de inspecciones remotas después del deploy de Cloudflare TURN.
// Estima transferencia basada en duración de overlap y bitrate típico WebRTC.
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

// Bitrate promedio WebRTC video: ~500 Kbps (64 KB/s) por dirección
// En una llamada P2P: cada lado envía ~500 Kbps y recibe ~500 Kbps
// TURN relay: el servidor relaya ambos sentidos, así que transfiere ~1 Mbps (128 KB/s) total
const TURN_RELAY_KB_PER_SEC = 128; // 1 Mbps bidireccional a través de TURN
const P2P_KB_PER_SEC = 128; // similar en P2P directo

async function main() {
  // Buscar sesiones remotas con actividad después del deploy
  const { data: sessions } = await supabase
    .from("inspection_sessions")
    .select(`
      id, inspection_number, status, started_at, ended_at, updated_at,
      inspector:profiles!inspection_sessions_inspector_id_fkey(full_name, email),
      claim:claims!inner(client_reference, liquidation_number)
    `)
    .eq("inspection_type", "remote")
    .gte("updated_at", "2026-08-25T18:35:00Z")
    .order("updated_at", { ascending: false })
    .limit(30);

  console.log(`\n${"=".repeat(110)}`);
  console.log(`INSPECCIONES REMOTAS DESPUÉS DEL DEPLOY DE CLOUDFLARE TURN (18:35 UTC, 25-ago-2026)`);
  console.log(`${"=".repeat(110)}\n`);

  const results = [];

  for (const sess of sessions) {
    const { data: logs } = await supabase
      .from("magic_link_connection_logs")
      .select("role, status, camera_permission, microphone_permission, connected_at, disconnected_at, ip_address, device_type, browser, os, os_version, disconnect_reason")
      .eq("session_id", sess.id)
      .order("created_at", { ascending: true });

    if (!logs || !logs.length) continue;

    const insuredSuccess = logs.filter((l) => l.role === "insured" && l.status === "success" && l.camera_permission === "granted");
    const adjusterSuccess = logs.filter((l) => l.role === "adjuster" && l.status === "success" && l.camera_permission === "granted");

    // Calcular overlap máximo (tiempo en que ambos estuvieron conectados con cámara)
    let maxOverlapSec = 0;
    if (insuredSuccess.length > 0 && adjusterSuccess.length > 0) {
      const insuredRanges = insuredSuccess.map((l) => ({
        start: new Date(l.connected_at).getTime(),
        end: l.disconnected_at ? new Date(l.disconnected_at).getTime() : Date.now(),
      }));
      const adjusterRanges = adjusterSuccess.map((l) => ({
        start: new Date(l.connected_at).getTime(),
        end: l.disconnected_at ? new Date(l.disconnected_at).getTime() : Date.now(),
      }));
      for (const ir of insuredRanges) {
        for (const ar of adjusterRanges) {
          const overlap = Math.min(ir.end, ar.end) - Math.max(ir.start, ar.start);
          if (overlap > maxOverlapSec) maxOverlapSec = overlap;
        }
      }
      maxOverlapSec = Math.round(maxOverlapSec / 1000);
    }

    const hadKicked = logs.some((l) => l.status === "kicked");
    const insuredCount = logs.filter((l) => l.role === "insured").length;
    const adjusterCount = logs.filter((l) => l.role === "adjuster").length;

    // Estimar datos transferidos
    const estimatedKB = maxOverlapSec > 0 ? maxOverlapSec * TURN_RELAY_KB_PER_SEC : 0;
    const estimatedMB = estimatedKB / 1024;

    const videoStatus = maxOverlapSec > 10 ? "✓ VIDEO OK" : maxOverlapSec > 0 ? "⚠ VIDEO PARCIAL" : "✗ SIN VIDEO";
    const usedTURN = maxOverlapSec > 10; // Asumimos TURN si hubo video exitoso después del deploy

    results.push({
      inspection: sess.inspection_number,
      ref: sess.claim?.client_reference,
      liquidation: sess.claim?.liquidation_number,
      inspector: sess.inspector?.full_name,
      inspectorEmail: sess.inspector?.email,
      status: sess.status,
      videoStatus,
      overlapSec: maxOverlapSec,
      estimatedMB,
      insuredCount,
      adjusterCount,
      hadKicked,
      logs: { insured: insuredSuccess, adjuster: adjusterSuccess, all: logs },
    });
  }

  // Imprimir tabla resumen
  console.log(`${"Caso".padEnd(25)} ${"Inspector".padEnd(25)} ${"Video".padEnd(15)} ${"Overlap".padEnd(10)} ${"~Datos".padEnd(12)} ${"Estado".padEnd(12)}`);
  console.log(`${"─".repeat(25)} ${"─".repeat(25)} ${"─".repeat(15)} ${"─".repeat(10)} ${"─".repeat(12)} ${"─".repeat(12)}`);

  for (const r of results) {
    const overlapStr = r.overlapSec > 0 ? `${r.overlapSec}s` : "—";
    const dataStr = r.estimatedMB > 0 ? `${r.estimatedMB.toFixed(1)} MB` : "—";
    console.log(`${r.inspection.padEnd(25)} ${(r.inspector || "—").padEnd(25)} ${r.videoStatus.padEnd(15)} ${overlapStr.padEnd(10)} ${dataStr.padEnd(12)} ${r.status.padEnd(12)}`);
  }

  // Detalle por caso
  console.log(`\n\n${"=".repeat(110)}`);
  console.log(`DETALLE POR CASO`);
  console.log(`${"=".repeat(110)}`);

  for (const r of results) {
    console.log(`\n${"─".repeat(90)}`);
    console.log(`Caso: ${r.inspection}  | Ref: ${r.ref}  | Liquidación: ${r.liquidation}`);
    console.log(`Inspector: ${r.inspector} (${r.inspectorEmail})`);
    console.log(`Estado sesión: ${r.status}`);
    console.log(`Video: ${r.videoStatus}  | Overlap: ${r.overlapSec}s  | Datos estimados: ${r.estimatedMB > 0 ? r.estimatedMB.toFixed(1) + " MB" : "—"}`);
    if (r.hadKicked) console.log(`⚠ Hubo kick (inspector expulsó a alguien)`);

    // Mostrar conexiones del asegurado
    const insuredLogs = r.logs.all.filter((l) => l.role === "insured");
    if (insuredLogs.length > 0) {
      console.log(`\n  Asegurado (${insuredLogs.length} conexiones):`);
      for (const l of insuredLogs) {
        const dur = l.disconnected_at ? Math.round((new Date(l.disconnected_at) - new Date(l.connected_at)) / 1000) : null;
        const durStr = dur !== null ? `${dur}s` : "activa";
        const dev = `${l.device_type} ${l.browser} ${l.os} ${l.os_version}`.replace(/\s+/g, " ").trim();
        console.log(`    ${l.connected_at.substring(11, 19)}  ${l.status.padEnd(12)} cámara=${l.camera_permission}  mic=${l.microphone_permission}  ${durStr.padEnd(8)}  ${dev}  IP=${l.ip_address}`);
      }
    }

    // Mostrar conexiones del inspector
    const adjusterLogs = r.logs.all.filter((l) => l.role === "adjuster");
    if (adjusterLogs.length > 0) {
      console.log(`\n  Inspector (${adjusterLogs.length} conexiones):`);
      for (const l of adjusterLogs) {
        const dur = l.disconnected_at ? Math.round((new Date(l.disconnected_at) - new Date(l.connected_at)) / 1000) : null;
        const durStr = dur !== null ? `${dur}s` : "activa";
        const dev = `${l.device_type} ${l.browser} ${l.os} ${l.os_version}`.replace(/\s+/g, " ").trim();
        console.log(`    ${l.connected_at.substring(11, 19)}  ${l.status.padEnd(12)} cámara=${l.camera_permission}  mic=${l.microphone_permission}  ${durStr.padEnd(8)}  ${dev}  IP=${l.ip_address}`);
      }
    }
  }

  // Resumen final
  console.log(`\n\n${"=".repeat(110)}`);
  console.log(`RESUMEN`);
  console.log(`${"=".repeat(110)}\n`);

  const videoOK = results.filter((r) => r.videoStatus === "✓ VIDEO OK");
  const videoPartial = results.filter((r) => r.videoStatus === "⚠ VIDEO PARCIAL");
  const noVideo = results.filter((r) => r.videoStatus === "✗ SIN VIDEO");
  const totalDataMB = results.reduce((sum, r) => sum + r.estimatedMB, 0);

  console.log(`Total inspecciones remotas con actividad post-deploy: ${results.length}`);
  console.log(`  ✓ Video exitoso (overlap > 10s): ${videoOK.length}`);
  console.log(`  ⚠ Video parcial (overlap < 10s): ${videoPartial.length}`);
  console.log(`  ✗ Sin video: ${noVideo.length}`);
  console.log(`\nDatos transferidos estimados: ${totalDataMB.toFixed(1)} MB (~${(totalDataMB * 0.05).toFixed(2)} USD en Cloudflare)`);
  console.log(`\nNota: La estimación de datos asume ~1 Mbps bidireccional a través de TURN.`);
  console.log(`      Cloudflare cobra $0.05/GB — el costo real puede ser menor si parte fue P2P directo (sin TURN).`);

  // Listar inspectores
  console.log(`\nInspectores con actividad:`);
  const inspectors = {};
  for (const r of results) {
    const key = r.inspector || "—";
    if (!inspectors[key]) inspectors[key] = { name: r.inspector, email: r.inspectorEmail, cases: [], videoOK: 0 };
    inspectors[key].cases.push(r.inspection);
    if (r.videoStatus === "✓ VIDEO OK") inspectors[key].videoOK++;
  }
  for (const [_, info] of Object.entries(inspectors)) {
    console.log(`  ${info.name} (${info.email}) — ${info.cases.length} casos, ${info.videoOK} con video OK`);
    console.log(`    Casos: ${info.cases.join(", ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
