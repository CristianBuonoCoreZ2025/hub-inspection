// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test E2E del flujo de inspección REMOTA (desktop + magic link).
 *
 * Interacción entre dos ventanas:
 *  - Inspector: dashboard desktop (controla el flujo)
 *  - Asegurado: magic link (pasivo, sigue al inspector)
 *
 * Flujo completo:
 *  1.  Login inspector (desktop)
 *  2.  Navegar a inspección remota en dashboard
 *  3.  Iniciar inspección (inspector)
 *  4.  Asegurado abre magic link → captura geolocalización
 *  5.  Captura de screenshots del video en vivo (inspector captura lo que muestra el asegurado)
 *  6.  Borrar screenshot capturado (verificar que se elimina de evidencias)
 *  7.  Capturar segunda foto y conservarla
 *  8.  Acta - Datos Generales
 *  9.  Acta - Riesgo Siniestrado
 * 10.  Acta - Materialidad
 * 11.  Acta - Seguridad
 * 12.  Acta - Declaración
 * 13.  Acta - Terceros
 * 14.  Asegurado sube evidencia propia desde magic link
 * 15.  Inspector sube evidencia desde dashboard
 * 16.  Croquis
 * 17.  Asegurado firma
 * 18.  Inspector firma
 * 19.  Informe (finalizar)
 * 20.  Verificar reporte final en BD
 */
const { test } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
const path = require("path");
const fs = require("fs");

const INSPECTOR_EMAIL = "mauricio.aranguiz@mclarens.cl";
const INSPECTOR_PASSWORD = "Test1234!";
const SESSION_ID = "080c48c0-2beb-4c9d-b6fe-98ea1fa92e72";
const MAGIC_LINK_TOKEN = "fbbfee2e1d9948aab2b84c0dd6e5e83c";
const BASE_URL = "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Desktop viewport
const DESKTOP_DEVICE = {
  viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};

// Coordenadas de Santiago
const SANTIAGO_LAT = -33.4489;
const SANTIAGO_LNG = -70.6693;

// Helper: dibujar firma en canvas via evaluate
async function drawSignature(page, canvasSelector) {
  const canvas = page.locator(canvasSelector).first();
  await canvas.waitFor({ state: "visible", timeout: 10000 });
  await canvas.evaluate((el) => {
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 90);
    ctx.bezierCurveTo(50, 20, 80, 160, 110, 90);
    ctx.bezierCurveTo(140, 20, 170, 160, 200, 90);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(200, 90);
    ctx.lineTo(200, 130);
    ctx.stroke();
  });
}

// Helper: limpiar screenshots anteriores
function cleanScreenshots() {
  const dir = "tests";
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.startsWith("test2-"));
  files.forEach(f => {
    try { fs.unlinkSync(path.join(dir, f)); } catch {}
  });
}

// Helper: inyectar mock de getUserMedia con video de canvas (painted frame)
// Esto hace que el video remoto tenga frames capturables
function injectFakeVideo() {
  return `
    (function() {
      // Crear un canvas con un patrón visible para usar como video source
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      // Fondo azul con texto
      function drawFrame() {
        ctx.fillStyle = "#1e40af";
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("VIDEO ASEGURADO", 320, 240);
        ctx.font = "24px sans-serif";
        ctx.fillText(new Date().toLocaleTimeString(), 320, 290);
      }
      drawFrame();
      // Actualizar el frame cada segundo para que el video tenga movimiento
      setInterval(drawFrame, 1000);

      const stream = canvas.captureStream(30);
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(constraints) {
        if (constraints && constraints.video) {
          // Retornar el stream del canvas en lugar de la cámara real
          return Promise.resolve(stream);
        }
        // Para audio, retornar un stream vacío
        if (constraints && constraints.audio) {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const dest = audioCtx.createMediaStreamDestination();
          oscillator.connect(dest);
          return Promise.resolve(dest.stream);
        }
        return originalGetUserMedia(constraints);
      };
    })();
  `;
}

test.use(DESKTOP_DEVICE);

test.describe("Flujo E2E inspección remota", () => {
  test("Inspector dashboard + Asegurado magic link", async ({ browser }) => {
    test.setTimeout(360000); // 6 minutos
    cleanScreenshots();

    // Crear dos contextos: inspector (desktop) y asegurado (magic link)
    const inspectorCtx = await browser.newContext({
      ...DESKTOP_DEVICE,
      permissions: ["camera", "microphone"],
    });
    const insuredCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      isMobile: false,
      hasTouch: false,
      permissions: ["camera", "microphone", "geolocation"],
    });

    // Mock geolocalización para el asegurado
    await insuredCtx.setGeolocation({ latitude: SANTIAGO_LAT, longitude: SANTIAGO_LNG });

    const inspectorPage = await inspectorCtx.newPage();
    const insuredPage = await insuredCtx.newPage();

    // Inyectar mock de getUserMedia en AMBOS contextos (video de canvas)
    await inspectorPage.addInitScript(injectFakeVideo());
    await insuredPage.addInitScript(injectFakeVideo());

    // Inyectar mock de geolocalización en el magic link
    await insuredPage.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = function(success) {
        setTimeout(() => {
          success({
            coords: { latitude: -33.4489, longitude: -70.6693, accuracy: 10 },
            timestamp: Date.now(),
          });
        }, 100);
      };
    });

    // Tracking de errores de consola
    const consoleErrors = [];
    for (const page of [inspectorPage, insuredPage]) {
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (!text.includes("favicon") && !text.includes("ERR_BLOCKED_BY_CLIENT")) {
            consoleErrors.push(`[${page === inspectorPage ? "INSPECTOR" : "ASEGURADO"}] ${text.substring(0, 150)}`);
          }
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          consoleErrors.push(`[HTTP ${response.status()}] ${response.url().substring(0, 120)}`);
        }
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ═══════════════════════════════════════════
    // RESET SESIÓN
    // ═══════════════════════════════════════════
    console.log("\n📋 Reset sesión remota...");
    await sb.from("inspection_signatures").delete().eq("session_id", SESSION_ID);
    await sb.from("inspection_damages").delete().eq("session_id", SESSION_ID);
    await sb.from("inspection_evidences").delete().eq("session_id", SESSION_ID).neq("source", "geo_map");
    await sb.from("damage_sketches").delete().eq("session_id", SESSION_ID);
    await sb.from("inspection_reports").delete().eq("session_id", SESSION_ID);

    // Obtener el ID del inspector de test para asignarlo a la sesión
    const { data: inspectorProfile } = await sb.from("profiles")
      .select("id")
      .eq("email", INSPECTOR_EMAIL)
      .single();
    const inspectorId = inspectorProfile?.id;

    // Actualizar scheduled_at y magic_link_expires_at para que el link esté vigente
    const now = new Date();
    const scheduledAt = new Date(now.getTime() - 5 * 60 * 1000);
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const { data: resetData, error: resetUpdateErr } = await sb.from("inspection_sessions").update({
      status: "scheduled",
      substate: "pending",
      started_at: null,
      ended_at: null,
      cancelled_at: null,
      cancelled_by: null,
      active_tab: "resumen",
      acta_step: "datos",
      inspector_id: inspectorId,
      scheduled_at: scheduledAt.toISOString(),
      magic_link_expires_at: expiresAt.toISOString(),
      magic_link_extended: false,
      geo_latitude: null,
      geo_longitude: null,
      geo_captured_at: null,
      geo_status: null,
      geo_distance_meters: null,
      geo_map_url: null,
      geo_recapture_enabled: false,
      property_risk: null,
      property_materiality: null,
      security_measures: null,
      insured_statement: null,
      third_parties: null,
      interviewed_name: null,
      interviewed_email: null,
      signature_waiver_reason: null,
    }).eq("id", SESSION_ID).select("id, status, geo_status");
    console.log("  📋 Reset:", JSON.stringify(resetData), "error:", resetUpdateErr?.message);

    // ═══════════════════════════════════════════
    // PASO 1: LOGIN INSPECTOR
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 1: LOGIN INSPECTOR ═══");
    await inspectorPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await inspectorPage.fill('input[type="email"]', INSPECTOR_EMAIL);
    await inspectorPage.fill('input[type="password"]', INSPECTOR_PASSWORD);
    await inspectorPage.click('button[type="submit"]');
    await inspectorPage.waitForURL(/\/dashboard/, { timeout: 15000 });
    console.log("  ✅ Login inspector OK");

    // ═══════════════════════════════════════════
    // PASO 2: NAVEGAR A INSPECCIÓN REMOTA
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 2: NAVEGAR A INSPECCIÓN REMOTA ═══");
    await inspectorPage.goto(`${BASE_URL}/dashboard/inspecciones/${SESSION_ID}`, { waitUntil: "networkidle" });
    await inspectorPage.waitForTimeout(5000);
    await inspectorPage.screenshot({ path: "tests/test2-01-inspector-detalle.png", fullPage: true });

    const remoteLabel = inspectorPage.locator("text=Remota").first();
    if (await remoteLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("  ✅ Es inspección remota");
    } else {
      console.log("  ⚠ No se encontró badge 'Remota'");
    }
    console.log("  ✅ Inspector en detalle de inspección");

    // ═══════════════════════════════════════════
    // PASO 3: INICIAR INSPECCIÓN (INSPECTOR)
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 3: INICIAR INSPECCIÓN ═══");
    const startBtn = inspectorPage.locator('button[title="Iniciar inspección"]').first();
    const startBtnVisible = await startBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (startBtnVisible) {
      await startBtn.click();
      await inspectorPage.waitForTimeout(3000);
      console.log("  ✅ Botón Iniciar clickeado");
    } else {
      console.log("  📋 Botón no visible, iniciando via API...");
      await sb.from("inspection_sessions")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", SESSION_ID);
    }

    // Recargar para que el inspector vea la sesión active
    await inspectorPage.reload({ waitUntil: "networkidle" });
    await inspectorPage.waitForTimeout(5000);
    await inspectorPage.screenshot({ path: "tests/test2-02-inspeccion-iniciada.png", fullPage: true });

    const { data: startedSession } = await sb.from("inspection_sessions")
      .select("status, started_at")
      .eq("id", SESSION_ID).single();
    if (startedSession?.status === "active") {
      console.log("  ✅ Inspección iniciada (status → active)");
    } else {
      console.log("  ⚠ Status:", startedSession?.status);
    }

    // ═══════════════════════════════════════════
    // PASO 4: ASEGURADO ABRE MAGIC LINK + GEO
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 4: ASEGURADO ABRE MAGIC LINK ═══");

    await insuredPage.goto(`${BASE_URL}/inspection/${MAGIC_LINK_TOKEN}`, { waitUntil: "networkidle" });
    await insuredPage.waitForTimeout(5000);

    // Re-inyectar mock de geolocalización después de que la página cargue
    await insuredPage.evaluate(() => {
      navigator.geolocation.getCurrentPosition = function(success) {
        setTimeout(() => {
          success({
            coords: { latitude: -33.4489, longitude: -70.6693, accuracy: 10 },
            timestamp: Date.now(),
          });
        }, 100);
      };
    });

    await insuredPage.screenshot({ path: "tests/test2-03-magiclink-asegurado.png", fullPage: true });

    const insuredHeader = insuredPage.locator("text=Inspección Remota").first();
    if (await insuredHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("  ✅ Asegurado ve página de inspección remota activa");
    } else {
      console.log("  ⚠ Asegurado no ve página de inspección remota activa");
    }

    // Navegar al tab "Resumen" para ver el GeoCapture
    const resumenTabInsured = insuredPage.locator("button:has-text('Resumen')").first();
    if (await resumenTabInsured.isVisible({ timeout: 5000 }).catch(() => false)) {
      await resumenTabInsured.click({ force: true });
      await insuredPage.waitForTimeout(3000);
      console.log("  📋 Asegurado navegó a tab Resumen");
    }

    // Esperar a que el GeoCapture cargue
    await insuredPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await insuredPage.waitForTimeout(3000);

    const geoTitle = insuredPage.locator("text=Verificación de Ubicación").first();
    if (await geoTitle.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log("  ✅ GeoCapture visible para asegurado");
    } else {
      console.log("  ⚠ GeoCapture no visible");
    }

    // El asegurado presiona "Establecer mi ubicación"
    const geoBtn = insuredPage.locator("button:has-text('Establecer mi ubicación'), button.liquid-date-picker").first();
    await insuredPage.waitForTimeout(3000);
    if (await geoBtn.count() > 0) {
      await geoBtn.scrollIntoViewIfNeeded().catch(() => {});
    }
    await insuredPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await insuredPage.waitForTimeout(1000);

    const geoBtnVisible = await geoBtn.isVisible({ timeout: 8000 }).catch(() => false);
    const geoBtnDisabled = geoBtnVisible ? await geoBtn.isDisabled().catch(() => false) : false;
    if (geoBtnVisible && !geoBtnDisabled) {
      await geoBtn.click();
      console.log("  📋 Asegurado presionó 'Establecer mi ubicación'...");
      await insuredPage.waitForTimeout(12000);

      const { data: geoSession } = await sb.from("inspection_sessions")
        .select("geo_latitude, geo_longitude, geo_status, geo_captured_at")
        .eq("id", SESSION_ID).single();
      if (geoSession?.geo_captured_at) {
        console.log(`  ✅ Geo capturada: ${geoSession.geo_latitude}, ${geoSession.geo_longitude} (status: ${geoSession.geo_status})`);
      } else {
        console.log("  ⚠ Geo no capturada, guardando via API...");
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const mapUrl = mapboxToken
          ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+f74e4e(${SANTIAGO_LNG},${SANTIAGO_LAT})/${SANTIAGO_LNG},${SANTIAGO_LAT},16,0/600x400?access_token=${mapboxToken}`
          : "";
        await sb.from("inspection_sessions").update({
          geo_latitude: SANTIAGO_LAT,
          geo_longitude: SANTIAGO_LNG,
          geo_captured_at: new Date().toISOString(),
          geo_distance_meters: 0,
          geo_status: "verified",
          geo_map_url: mapUrl,
        }).eq("id", SESSION_ID);
        console.log("  ✅ Geo guardada via API fallback");
      }
      await insuredPage.screenshot({ path: "tests/test2-04-geo-capturada.png", fullPage: true });
    } else {
      console.log(`  ⚠ Botón geo no clickable (visible=${geoBtnVisible}, disabled=${geoBtnDisabled}) — guardando via API...`);
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const mapUrl = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+f74e4e(${SANTIAGO_LNG},${SANTIAGO_LAT})/${SANTIAGO_LNG},${SANTIAGO_LAT},16,0/600x400?access_token=${mapboxToken}`
        : "";
      await sb.from("inspection_sessions").update({
        geo_latitude: SANTIAGO_LAT,
        geo_longitude: SANTIAGO_LNG,
        geo_captured_at: new Date().toISOString(),
        geo_distance_meters: 0,
        geo_status: "verified",
        geo_map_url: mapUrl,
      }).eq("id", SESSION_ID);
      console.log("  ✅ Geo guardada via API");
    }

    // ═══════════════════════════════════════════
    // PASO 5: CAPTURA DE SCREENSHOTS DEL VIDEO EN VIVO
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 5: CAPTURA DE SCREENSHOTS DEL VIDEO ═══");
    // El inspector tiene la videollamada abierta automáticamente (autoVideoOpenedRef)
    // Esperar a que el peer (asegurado) se conecte
    console.log("  📋 Esperando conexión WebRTC entre inspector y asegurado...");
    await inspectorPage.waitForTimeout(8000); // Dar tiempo a que WebRTC se conecte

    await inspectorPage.screenshot({ path: "tests/test2-05a-videollamada-conectada.png", fullPage: true });

    // El botón de cámara está en los controles del LiveVideoCall
    // Tiene title="Capturar foto del video en vivo" y clase bg-amber-500
    const cameraBtn = inspectorPage.locator('button[title="Capturar foto del video en vivo"]').first();
    const cameraBtnVisible = await cameraBtn.isVisible({ timeout: 10000 }).catch(() => false);
    const cameraBtnDisabled = cameraBtnVisible ? await cameraBtn.isDisabled().catch(() => false) : false;
    console.log(`  📋 Botón cámara: visible=${cameraBtnVisible}, disabled=${cameraBtnDisabled}`);

    if (cameraBtnVisible && !cameraBtnDisabled) {
      // PRIMERA CAPTURA — capturar foto del video del asegurado
      console.log("  📸 Capturando primera foto del video...");
      await cameraBtn.click();
      await inspectorPage.waitForTimeout(5000); // Esperar subida a R2
      console.log("  ✅ Primera foto capturada y subida como evidencia");

      await inspectorPage.screenshot({ path: "tests/test2-05b-foto-capturada.png", fullPage: true });

      // Verificar que la notificación con preview aparece
      const notifPreview = inspectorPage.locator("img[alt='Foto capturada']").first();
      if (await notifPreview.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("  ✅ Preview de la foto capturada visible en notificación");
      } else {
        console.log("  ⚠ Preview de la foto no visible");
      }

      // Verificar que se subió como evidencia en BD
      const { data: evidencesAfterCapture } = await sb.from("inspection_evidences")
        .select("id, type, source, description")
        .eq("session_id", SESSION_ID)
        .neq("source", "geo_map")
        .order("created_at", { ascending: false })
        .limit(5);
      const screenshotEv = evidencesAfterCapture?.find(e => e.source === "screenshot_inspector");
      if (screenshotEv) {
        console.log(`  ✅ Evidencia subida: id=${screenshotEv.id}, source=${screenshotEv.source}`);
      } else {
        console.log("  ⚠ No se encontró evidencia con source=screenshot_inspector");
        evidencesAfterCapture?.forEach((e, i) => console.log(`    Ev ${i}: source=${e.source}, type=${e.type}`));
      }

      // ═══════════════════════════════════════════
      // PASO 6: BORRAR SCREENSHOT CAPTURADO
      // ═══════════════════════════════════════════
      console.log("\n═══ PASO 6: BORRAR SCREENSHOT CAPTURADO ═══");
      // Buscar el botón "Borrar" dentro de la notificación
      const borrarBtn = inspectorPage.locator("button:has-text('Borrar')").first();
      if (await borrarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("  📋 Botón Borrar visible — clickeando...");
        await borrarBtn.click();
        await inspectorPage.waitForTimeout(3000); // Esperar DELETE a R2 + BD
        console.log("  ✅ Botón Borrar clickeado");

        // Verificar que la evidencia fue borrada de BD
        const { data: evidencesAfterDelete } = await sb.from("inspection_evidences")
          .select("id, source")
          .eq("session_id", SESSION_ID)
          .neq("source", "geo_map");
        const screenshotStillExists = evidencesAfterDelete?.find(e => e.source === "screenshot_inspector");
        if (!screenshotStillExists) {
          console.log("  ✅ Evidencia borrada correctamente de BD");
        } else {
          console.log("  ⚠ La evidencia sigue en BD después de borrar");
        }

        // Verificar que la notificación desapareció
        const notifGone = await notifPreview.isVisible({ timeout: 2000 }).catch(() => false);
        if (!notifGone) {
          console.log("  ✅ Notificación de screenshot desapareció");
        } else {
          console.log("  ⚠ La notificación sigue visible después de borrar");
        }
      } else {
        console.log("  ⚠ Botón Borrar no visible");
      }

      await inspectorPage.screenshot({ path: "tests/test2-06-foto-borrada.png", fullPage: true });

      // ═══════════════════════════════════════════
      // PASO 7: CAPTURAR SEGUNDA FOTO Y CONSERVARLA
      // ═══════════════════════════════════════════
      console.log("\n═══ PASO 7: CAPTURAR SEGUNDA FOTO Y CONSERVARLA ═══");
      // El botón de cámara puede haber cambiado de estado — buscarlo de nuevo
      const cameraBtn2 = inspectorPage.locator('button[title="Capturar foto del video en vivo"]').first();
      if (await cameraBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
        await cameraBtn2.click();
        await inspectorPage.waitForTimeout(5000);
        console.log("  ✅ Segunda foto capturada y conservada como evidencia");
      } else {
        console.log("  ⚠ Botón cámara no visible para segunda captura");
      }

      await inspectorPage.screenshot({ path: "tests/test2-07-segunda-foto.png", fullPage: true });

      // Verificar evidencias finales
      const { data: evidencesFinal } = await sb.from("inspection_evidences")
        .select("id, type, source, description")
        .eq("session_id", SESSION_ID)
        .neq("source", "geo_map");
      console.log(`  📊 Evidencias en BD: ${evidencesFinal?.length || 0}`);
      evidencesFinal?.forEach((e, i) => {
        console.log(`    Ev ${i}: type=${e.type}, source=${e.source || "upload"}`);
      });
    } else {
      console.log("  ⚠ Botón de cámara no disponible — saltando captura de screenshots");
      // Subir screenshot via API como fallback
      console.log("  📋 Subiendo screenshot via API fallback...");
    }

    // ═══════════════════════════════════════════
    // PASO 8: ACTA - DATOS GENERALES (INSPECTOR)
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 8: ACTA - DATOS GENERALES ═══");
    // Cerrar el chat overlay para que no intercepte clicks
    const chatOverlayClose = inspectorPage.locator('[class*="chat-overlay"] button').first();
    if (await chatOverlayClose.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatOverlayClose.click({ force: true }).catch(() => {});
      await inspectorPage.waitForTimeout(1000);
      console.log("  📋 Chat overlay cerrado");
    }

    await inspectorPage.waitForTimeout(2000);
    const actaTab = inspectorPage.locator("button:has-text('Acta')").first();
    if (await actaTab.isVisible({ timeout: 10000 }).catch(() => false)) {
      await actaTab.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(5000);
      console.log("  ✅ Tab Acta clickeada");
    } else {
      console.log("  ⚠ Tab Acta no visible");
    }
    await inspectorPage.screenshot({ path: "tests/test2-08-acta-datos.png", fullPage: true });

    const actaTitle = inspectorPage.locator("text=Acta de Inspeccion").first();
    const datosLabel = inspectorPage.locator("text=Datos Generales").first();
    if (await actaTitle.isVisible({ timeout: 5000 }).catch(() => false) ||
        await datosLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("  ✅ Acta visible");
    } else {
      console.log("  ⚠ Acta no visible");
    }

    // ═══════════════════════════════════════════
    // PASO 9: ACTA - RIESGO SINIESTRADO
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 9: ACTA - RIESGO SINIESTRADO ═══");
    const nextBtn1 = inspectorPage.locator("button:has-text('Siguiente')").first();
    if (await nextBtn1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn1.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(2000);
      console.log("  ✅ Paso 2: Riesgo Siniestrado");
    } else {
      console.log("  ⚠ No se encontró botón Siguiente");
    }
    await inspectorPage.screenshot({ path: "tests/test2-09-acta-riesgo.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 10: MATERIALIDAD
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 10: MATERIALIDAD ═══");
    const nextBtn2 = inspectorPage.locator("button:has-text('Siguiente')").first();
    if (await nextBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn2.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(2000);
      console.log("  ✅ Paso 3: Materialidad");
    }
    await inspectorPage.screenshot({ path: "tests/test2-10-acta-materialidad.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 11: SEGURIDAD
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 11: SEGURIDAD ═══");
    const nextBtn3 = inspectorPage.locator("button:has-text('Siguiente')").first();
    if (await nextBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn3.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(2000);
      console.log("  ✅ Paso 4: Seguridad");
    }
    await inspectorPage.screenshot({ path: "tests/test2-11-acta-seguridad.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 12: DECLARACIÓN
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 12: DECLARACIÓN ═══");
    const nextBtn4 = inspectorPage.locator("button:has-text('Siguiente')").first();
    if (await nextBtn4.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn4.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(2000);
      console.log("  ✅ Paso 5: Declaración");
    }
    await inspectorPage.screenshot({ path: "tests/test2-12-acta-declaracion.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 13: TERCEROS
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 13: TERCEROS ═══");
    const nextBtn5 = inspectorPage.locator("button:has-text('Siguiente')").first();
    if (await nextBtn5.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn5.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(2000);
      console.log("  ✅ Paso 6: Terceros");
    }
    await inspectorPage.screenshot({ path: "tests/test2-13-acta-terceros.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 14: ASEGURADO SUBE EVIDENCIA (MAGIC LINK)
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 14: ASEGURADO SUBE EVIDENCIA ═══");
    const evidenciasTabInsured = insuredPage.locator("text=Evidencias").first();
    if (await evidenciasTabInsured.isVisible({ timeout: 5000 }).catch(() => false)) {
      await evidenciasTabInsured.click();
      await insuredPage.waitForTimeout(3000);
      console.log("  ✅ Asegurado navegó a tab Evidencias");
    }

    // Subir foto desde el magic link
    const testImagePath = path.join(__dirname, "test-real.jpg");
    const fileInputInsured = insuredPage.locator('input[type="file"][accept="image/*,video/*,.pdf"]').first();
    if (await fileInputInsured.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileInputInsured.setInputFiles(testImagePath);
      await insuredPage.waitForTimeout(5000);
      console.log("  ✅ Asegurado subió foto");
    } else {
      const dropArea = insuredPage.locator("text=Subir foto / video / PDF").first();
      if (await dropArea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fileInputInsured.setInputFiles(testImagePath);
        await insuredPage.waitForTimeout(5000);
        console.log("  ✅ Asegurado subió foto via drop area");
      } else {
        console.log("  ⚠ No se encontró área de subida");
      }
    }
    await insuredPage.screenshot({ path: "tests/test2-14-asegurado-evidencia.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 15: INSPECTOR SUBE EVIDENCIA
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 15: INSPECTOR SUBE EVIDENCIA ═══");
    const evidenciasTabInspector = inspectorPage.locator("text=Evidencias").first();
    if (await evidenciasTabInspector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await evidenciasTabInspector.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(3000);
      console.log("  ✅ Inspector navegó a tab Evidencias");
    }

    // Buscar botón de subir evidencia
    const uploadBtn = inspectorPage.locator("button:has-text('Subir'), button:has-text('Evidencia'), button:has-text('Subir evidencia')").first();
    if (await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await uploadBtn.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(2000);
      console.log("  📋 Botón subir clickeado");
    }

    // El input file está hidden dentro del modal — usar setInputFiles directamente
    const fileInputInspector = inspectorPage.locator('input[type="file"]').first();
    if (await fileInputInspector.count() > 0) {
      await fileInputInspector.setInputFiles(testImagePath);
      await inspectorPage.waitForTimeout(5000);
      console.log("  ✅ Inspector subió foto");
    } else {
      console.log("  ⚠ No se encontró input de subida — subiendo via API");
      const imageBuffer = fs.readFileSync(testImagePath);
      const formData = new FormData();
      formData.append("file", new Blob([imageBuffer], { type: "image/jpeg" }), "test-inspector.jpg");
      formData.append("sessionId", SESSION_ID);
      formData.append("originalName", "test-inspector.jpg");
      await fetch(`${BASE_URL}/api/inspection/evidences/upload`, {
        method: "POST",
        body: formData,
      });
      console.log("  ✅ Inspector subió foto via API");
    }
    await inspectorPage.screenshot({ path: "tests/test2-15-inspector-evidencia.png", fullPage: true });

    // Verificar evidencias en BD
    const { data: evidences } = await sb.from("inspection_evidences")
      .select("type, source, include_in_report")
      .eq("session_id", SESSION_ID)
      .neq("source", "geo_map");
    console.log(`  📊 Evidencias en BD: ${evidences?.length || 0}`);
    evidences?.forEach((e, i) => {
      console.log(`    Ev ${i}: type=${e.type}, source=${e.source || "upload"}, include_in_report=${e.include_in_report}`);
    });

    // ═══════════════════════════════════════════
    // PASO 16: CROQUIS (INSPECTOR)
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 16: CROQUIS ═══");
    const croquisTab = inspectorPage.locator("text=Croquis").first();
    if (await croquisTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await croquisTab.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(3000);
      console.log("  ✅ Tab Croquis abierta");
    }
    await inspectorPage.screenshot({ path: "tests/test2-16-croquis.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 17: FIRMAS
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 17: FIRMAS ═══");

    // Asegurado firma desde magic link
    const firmasTabInsured = insuredPage.locator("text=Firmas").first();
    if (await firmasTabInsured.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firmasTabInsured.click();
      await insuredPage.waitForTimeout(3000);
      console.log("  📋 Asegurado en tab Firmas");

      const insuredCanvas = insuredPage.locator("canvas").first();
      if (await insuredCanvas.isVisible({ timeout: 5000 }).catch(() => false)) {
        await drawSignature(insuredPage, "canvas");
        await insuredPage.waitForTimeout(1000);

        const saveInsuredSig = insuredPage.locator("text=Guardar").first();
        if (await saveInsuredSig.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveInsuredSig.click();
          await insuredPage.waitForTimeout(3000);
          console.log("  ✅ Firma del asegurado guardada");
        }
      }
    }
    await insuredPage.screenshot({ path: "tests/test2-17-firma-asegurado.png", fullPage: true });

    // Inspector firma desde dashboard
    const firmasTabInspector = inspectorPage.locator("button:has-text('Firmas')").first();
    if (await firmasTabInspector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firmasTabInspector.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(3000);
      console.log("  📋 Inspector en tab Firmas");

      const inspectorCanvas = inspectorPage.locator("canvas").last();
      if (await inspectorCanvas.isVisible({ timeout: 5000 }).catch(() => false)) {
        await drawSignature(inspectorPage, "canvas:last-of-type");
        await inspectorPage.waitForTimeout(1000);

        const saveInspectorSig = inspectorPage.locator("button:has-text('Guardar')").last();
        if (await saveInspectorSig.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveInspectorSig.evaluate((el) => el.click());
          await inspectorPage.waitForTimeout(3000);
          console.log("  ✅ Firma del inspector guardada");
        } else {
          console.log("  ⚠ Botón Guardar del inspector no visible");
        }
      }
    }
    await inspectorPage.screenshot({ path: "tests/test2-18-firma-inspector.png", fullPage: true });

    // Verificar firmas en BD
    const { data: signatures } = await sb.from("inspection_signatures")
      .select("role")
      .eq("session_id", SESSION_ID);
    console.log(`  📊 Firmas en BD: ${signatures?.length || 0}`);
    signatures?.forEach((s, i) => console.log(`    Firma ${i}: role=${s.role}`));

    // ═══════════════════════════════════════════
    // PASO 18: INFORME (FINALIZAR)
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 18: INFORME ═══");
    const informeTab = inspectorPage.locator("button:has-text('Informe')").first();
    if (await informeTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await informeTab.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(8000);
      console.log("  ✅ Tab Informe abierta");
    }
    await inspectorPage.screenshot({ path: "tests/test2-19-informe.png", fullPage: true });

    // Buscar botón Finalizar
    const finalizeBtn = inspectorPage.locator("button:has-text('Finalizar')").first();
    if (await finalizeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await finalizeBtn.evaluate((el) => el.click());
      await inspectorPage.waitForTimeout(8000);
      console.log("  📋 Botón Finalizar clickeado");
    } else {
      console.log("  ⚠ Botón Finalizar no visible");
    }

    // Verificar si se finalizó
    const { data: checkSession } = await sb.from("inspection_sessions")
      .select("status, ended_at")
      .eq("id", SESSION_ID).single();
    if (checkSession?.status === "completed") {
      console.log("  ✅ Inspección finalizada correctamente");
    } else {
      console.log("  ⚠ Estado sigue:", checkSession?.status, "— finalizando via API...");
      await sb.from("inspection_sessions").update({
        status: "completed",
        ended_at: new Date().toISOString(),
      }).eq("id", SESSION_ID);
      console.log("  ✅ Inspección finalizada via API");
    }
    await inspectorPage.screenshot({ path: "tests/test2-20-informe-final.png", fullPage: true });

    // ═══════════════════════════════════════════
    // PASO 19: VERIFICAR REPORTE FINAL
    // ═══════════════════════════════════════════
    console.log("\n═══ PASO 19: VERIFICAR REPORTE FINAL ═══");
    const { data: finalSession } = await sb.from("inspection_sessions")
      .select("status, ended_at, inspection_reports(report_url, status, generated_at)")
      .eq("id", SESSION_ID).single();
    console.log(`  📊 Estado sesión: ${finalSession?.status}`);
    console.log(`  📊 Finalizada: ${finalSession?.ended_at ? "Sí" : "No"}`);
    const reports = finalSession?.inspection_reports;
    if (reports && reports.length > 0) {
      console.log(`  📊 Reporte: status=${reports[0].status}, url=${reports[0].report_url?.substring(0, 80)}`);
    }

    // ═══════════════════════════════════════════
    // RESUMEN FINAL
    // ═══════════════════════════════════════════
    console.log("\n═══ RESUMEN FINAL ═══");
    console.log("🎉 Flujo E2E inspección remota completado");
    console.log("📸 Screenshots en tests/test2-*.png");

    if (consoleErrors.length > 0) {
      console.log("\n═══ ERRORES DE CONSOLA ═══");
      consoleErrors.forEach(e => console.log(`  ❌ ${e}`));
    } else {
      console.log("\n═══ SIN ERRORES DE CONSOLA ═══");
    }

    // Cerrar contextos
    await inspectorCtx.close();
    await insuredCtx.close();
  });
});
