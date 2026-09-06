import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "fs/promises";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.production") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HEADLESS = process.env.HEADLESS !== "false";
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
const SESSION_IDS = process.env.SESSION_IDS ? process.env.SESSION_IDS.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

if (!APP_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan variables de entorno. Necesitas: ADMIN_EMAIL, ADMIN_PASSWORD");
  console.error("  APP_URL se resuelve de APP_URL / NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_VERCEL_URL");
  console.error("  SUPABASE_URL se resuelve de SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

async function getSessionsToRegenerate() {
  if (SESSION_IDS && SESSION_IDS.length > 0) {
    return SESSION_IDS.map((sessionId) => ({ reportId: null, sessionId }));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Obtener todos los reportes finalizados con report_url no nulo.
  // Nos quedamos con el mas reciente por session_id.
  const { data, error } = await supabase
    .from("inspection_reports")
    .select("id, session_id, report_url, generated_at")
    .eq("status", "final")
    .not("report_url", "is", null)
    .order("generated_at", { ascending: false });

  if (error) throw error;

  const seen = new Set();
  const result = [];
  for (const row of data || []) {
    if (seen.has(row.session_id)) continue;
    seen.add(row.session_id);
    result.push({ reportId: row.id, sessionId: row.session_id });
    if (LIMIT && result.length >= LIMIT) break;
  }
  return result;
}

async function login(page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log("Login exitoso");
}

async function clickTab(page, tabName) {
  const tab = page.locator(`button:has-text("${tabName}")`).first();
  await tab.waitFor({ state: "visible", timeout: 30000 });
  await tab.click();
  // Esperar a que el tab se renderice (clase activa del border).
  await page.waitForTimeout(500);
}

async function regenerateReport(page, sessionId) {
  await page.goto(`${APP_URL}/dashboard/inspecciones/${sessionId}`, { waitUntil: "networkidle" });

  await clickTab(page, "Informe");

  // El ReportTab carga sesion-full. Esperamos que aparezcan las acciones del informe.
  const regenerateBtn = page.locator('.report-actions button:has-text("Regenerar")').first();
  await regenerateBtn.waitFor({ state: "visible", timeout: 60000 });

  await regenerateBtn.click();

  // Esperar a que termine de regenerar: el boton deja de estar disabled y/o el texto cambia.
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent?.includes("Regenerar"));
      return btn && !btn.disabled;
    },
    { timeout: 180000 }
  );

  // Pequena pausa adicional para asegurar que el upload a R2 termino.
  await page.waitForTimeout(1500);
}

async function main() {
  const items = await getSessionsToRegenerate();
  console.log(`Encontrados ${items.length} informes para regenerar`);

  if (items.length === 0) {
    console.log("No hay informes para regenerar");
    return;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);

  const logs = [];
  const start = Date.now();

  for (let i = 0; i < items.length; i++) {
    const { sessionId } = items[i];
    try {
      await regenerateReport(page, sessionId);
      logs.push({ sessionId, status: "ok" });
      console.log(`[${i + 1}/${items.length}] OK: ${sessionId} (${Math.round((Date.now() - start) / 1000)}s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push({ sessionId, status: "error", error: msg });
      console.error(`[${i + 1}/${items.length}] ERROR: ${sessionId} - ${msg}`);
      // Screenshot de error para debugging
      try {
        const fileName = `regenerate-error-${sessionId}.png`;
        await page.screenshot({ path: fileName, fullPage: true });
        console.log(`  Screenshot guardado: ${fileName}`);
      } catch {}
    }

    // Guardar log parcial cada 10
    if ((i + 1) % 10 === 0 || i === items.length - 1) {
      await writeFile("regenerate-pdfs-log.json", JSON.stringify(logs, null, 2), "utf-8");
    }
  }

  await browser.close();
  console.log(`\nTerminado. Total: ${items.length}. OK: ${logs.filter((l) => l.status === "ok").length}. Errores: ${logs.filter((l) => l.status === "error").length}.`);
  console.log("Log: regenerate-pdfs-log.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
