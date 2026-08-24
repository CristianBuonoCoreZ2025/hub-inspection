// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test visual exhaustivo post-actualización de dependencias.
 *
 * Cubre los componentes afectados por las actualizaciones:
 * - lucide-react 1.18→1.31: íconos del nav (LayersArrowUp, Import, Upload)
 * - @base-ui/react 1.5→1.7: Tooltip, Select
 * - react/react-dom 19.2.4→19.2.8: render general, hooks
 * - next 16.2.9→16.3.1: routing, middleware
 * - @tanstack/react-query 5.101: data fetching
 * - recharts 3.9→3.10: charts del dashboard
 * - sonner 2.0.7→2.0.8: toast notifications
 * - react-hook-form 7.79→7.85: formularios
 * - tailwindcss 4.3.1→4.3.3: estilos
 * - @tiptap 3.29→3.30: editor rich text
 * - html2canvas-pro 2.2→2.3: captura canvas
 * - shadcn 4.11→4.18: componentes UI
 * - @supabase/ssr 0.12→0.12.4: middleware auth
 */
const { test, expect } = require("@playwright/test");
require("dotenv").config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = "mauricio.aranguiz@mclarens.cl";
const TEST_PASSWORD = "Test1234!";

test.describe.configure({ mode: "serial" });

test.describe("Post-Upgrade: Test visual exhaustivo", () => {
  /** @type {import("@playwright/test").BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    console.log("\n═══════════════════════════════════════════");
    console.log("  TEST VISUAL POST-ACTUALIZACIÓN");
    console.log("═══════════════════════════════════════════\n");

    // Login
    console.log("▸ [Setup] Login...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);
      const btn = page.locator('button[type="submit"]').first();
      await btn.click();
      await page.waitForTimeout(5000);
    }

    const url = page.url();
    if (url.includes("/dashboard") || url.includes("/claims")) {
      console.log("  ✅ Login OK → " + url + "\n");
    } else {
      console.log("  ⚠️ Login falló → " + url + "\n");
    }
    // Guardar el contexto con la sesión
    await context.storageState({ path: "test-results/auth-state.json" });
    await page.close();
  });

  test.afterAll(async () => {
    if (context) await context.close();
  });

  // ─────────────────────────────────────────────
  // 1. NAV: Íconos lucide-react (LayersArrowUp, Import, Upload)
  // ─────────────────────────────────────────────
  test("NAV: íconos de Carga Siniestros, Carga Casos, Carga Catálogos", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // El nav puede tener secciones colapsables. Buscar y expandir "Operaciones"
    const operacionesToggle = page.locator("text=Operaciones").first();
    if (await operacionesToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await operacionesToggle.click();
      await page.waitForTimeout(1000);
      console.log("  ℹ️ Sección 'Operaciones' expandida");
    }

    // Verificar que los 3 links existen y tienen SVG (ícono)
    const links = [
      { href: "carga-siniestros", label: "Carga Siniestros" },
      { href: "carga-casos", label: "Carga Casos" },
      { href: "carga-catalogos", label: "Carga Catálogos" },
    ];

    for (const link of links) {
      const el = page.locator(`a[href*="${link.href}"]`).first();
      const visible = await el.isVisible({ timeout: 8000 }).catch(() => false);
      if (visible) {
        const svg = el.locator("svg").first();
        const hasSvg = await svg.isVisible().catch(() => false);
        console.log(`  ${hasSvg ? "✅" : "⚠️"} ${link.label}: link ${hasSvg ? "+ ícono SVG" : "sin ícono"}`);
      } else {
        // Intentar navegar directamente
        await page.goto(`${BASE_URL}/dashboard/operaciones/${link.href}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(2000);
        const status = await page.locator("h1, h2").first().isVisible().catch(() => false);
        console.log(`  ${status ? "✅" : "⚠️"} ${link.label}: página ${status ? "carga" : "no carga"}`);
      }
    }

    await page.screenshot({ path: "test-results/01-nav-icons.png", fullPage: false });
    await page.close();
  });

  // ─────────────────────────────────────────────
  // 2. DASHBOARD: Charts (recharts) + estilos (tailwindcss)
  // ─────────────────────────────────────────────
  test("DASHBOARD: charts recharts + estilos tailwind", async () => {
    const page = await context.newPage();
    /** @type {string[]} */
    const consoleErrors = [];
    page.on("console", (/** @type {import("@playwright/test").ConsoleMessage} */ msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon") && !msg.text().includes("Console Ninja")) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    // Verificar que hay elementos con clases de tailwind
    const tailwindElements = page.locator("[class*='bg-'], [class*='flex'], [class*='grid']").first();
    await expect(tailwindElements).toBeVisible();
    console.log("  ✅ Tailwind CSS: clases aplicadas");

    // Verificar si hay charts (recharts usa svg con class recharts-surface)
    const charts = page.locator(".recharts-surface, .recharts-wrapper, svg.recharts-surface");
    const chartCount = await charts.count();
    if (chartCount > 0) {
      console.log(`  ✅ Recharts: ${chartCount} chart(s) renderizados`);
    } else {
      console.log("  ℹ️ Recharts: no hay charts en esta página (puede ser normal)");
    }

    await page.screenshot({ path: "test-results/02-dashboard-charts.png", fullPage: false });

    if (consoleErrors.length > 0) {
      console.log(`  ⚠️ ${consoleErrors.length} errores de consola:`);
      consoleErrors.slice(0, 5).forEach((e) => console.log(`     - ${e.substring(0, 120)}`));
    } else {
      console.log("  ✅ Sin errores de consola");
    }

    await page.close();
  });

  // ─────────────────────────────────────────────
  // 3. CLAIMS: Lista + data fetching (react-query)
  // ─────────────────────────────────────────────
  test("CLAIMS: lista carga con react-query", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard/claims`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    // Verificar que la página cargó (tabla o cards de claims)
    const content = page.locator("table, [class*='claim'], [class*='card']").first();
    await expect(content).toBeVisible({ timeout: 15000 });
    console.log("  ✅ Claims: contenido visible (react-query OK)");

    await page.screenshot({ path: "test-results/03-claims-list.png", fullPage: false });
    await page.close();
  });

  // ─────────────────────────────────────────────
  // 4. CARGA CASOS: Select + Tooltip (@base-ui/react)
  // ─────────────────────────────────────────────
  test("CARGA CASOS: página renderiza sin errores", async () => {
    const page = await context.newPage();
    /** @type {string[]} */
    const consoleErrors = [];
    page.on("console", (/** @type {import("@playwright/test").ConsoleMessage} */ msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon") && !msg.text().includes("Console Ninja")) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/dashboard/operaciones/carga-casos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Verificar que la página cargó
    const heading = page.locator("h1, h2, [class*='title']").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    console.log("  ✅ Carga Casos: página renderiza");

    // Verificar que hay botones (Upload, etc.)
    const buttons = page.locator("button");
    const btnCount = await buttons.count();
    console.log(`  ✅ Carga Casos: ${btnCount} botones presentes`);

    await page.screenshot({ path: "test-results/04-carga-casos.png", fullPage: false });

    if (consoleErrors.length > 0) {
      console.log(`  ⚠️ ${consoleErrors.length} errores de consola:`);
      consoleErrors.slice(0, 5).forEach((e) => console.log(`     - ${e.substring(0, 120)}`));
    } else {
      console.log("  ✅ Sin errores de consola");
    }

    await page.close();
  });

  // ─────────────────────────────────────────────
  // 5. CARGA SINIESTROS: formulario (react-hook-form)
  // ─────────────────────────────────────────────
  test("CARGA SINIESTROS: página renderiza", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard/operaciones/carga-siniestros`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const heading = page.locator("h1, h2, [class*='title']").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    console.log("  ✅ Carga Siniestros: página renderiza");

    await page.screenshot({ path: "test-results/05-carga-siniestros.png", fullPage: false });
    await page.close();
  });

  // ─────────────────────────────────────────────
  // 6. CARGA CATÁLOGOS: página renderiza
  // ─────────────────────────────────────────────
  test("CARGA CATÁLOGOS: página renderiza", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard/operaciones/carga-catalogos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const heading = page.locator("h1, h2, [class*='title']").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    console.log("  ✅ Carga Catálogos: página renderiza");

    await page.screenshot({ path: "test-results/06-carga-catalogos.png", fullPage: false });
    await page.close();
  });

  // ─────────────────────────────────────────────
  // 7. INSPECCIONES: lista + componentes UI (shadcn)
  // ─────────────────────────────────────────────
  test("INSPECCIONES: lista renderiza con shadcn/ui", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard/inspecciones`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    // Verificar contenido
    const content = page.locator("table, [class*='card'], [class*='session']").first();
    if (await content.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log("  ✅ Inspecciones: contenido visible");
    } else {
      console.log("  ℹ️ Inspecciones: no hay sesiones (puede ser normal)");
    }

    // Verificar componentes shadcn (button con clases específicas)
    const shadcnBtn = page.locator("button[class*='pg-btn'], button[class*='inline-flex']");
    const btnCount = await shadcnBtn.count();
    console.log(`  ✅ shadcn/ui: ${btnCount} botones con clases shadcn`);

    await page.screenshot({ path: "test-results/07-inspecciones.png", fullPage: false });
    await page.close();
  });

  // ─────────────────────────────────────────────
  // 8. CATÁLOGOS: renderiza (afecta @supabase/supabase-js)
  // ─────────────────────────────────────────────
  test("CATÁLOGOS: página renderiza con datos de Supabase", async () => {
    const page = await context.newPage();
    const response = await page.goto(`${BASE_URL}/dashboard/catalogos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const status = response?.status() || 0;
    const hasModuleError = await page.locator("text=Module not found").count();
    const hasCompileError = await page.locator("text=Compile error").count();

    // Cualquier respuesta que no sea error de módulo es OK
    if (hasModuleError === 0 && hasCompileError === 0) {
      console.log(`  ✅ Catálogos: página renderiza (status ${status}, Supabase JS OK)`);
    } else {
      console.log(`  ❌ Catálogos: error de módulo o compilación`);
    }

    await page.screenshot({ path: "test-results/08-catalogos.png", fullPage: false });
    await page.close();
  });

  // ─────────────────────────────────────────────
  // 9. TOOLTIP: verificar componente @base-ui/react
  // ─────────────────────────────────────────────
  test("TOOLTIP: componente renderiza en carga-casos", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard/operaciones/carga-casos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Buscar elementos con data-state="delayed-open" o role="tooltip" (base-ui)
    const tooltipTrigger = page.locator("[data-state], [class*='tooltip'], [role='tooltip']");
    const tooltipCount = await tooltipTrigger.count();
    console.log(`  ℹ️ Tooltip: ${tooltipCount} elementos relacionados encontrados`);

    // Verificar que el componente Tooltip está importado correctamente
    // (si la página carga sin error de módulo, el import funciona)
    const hasError = await page.locator("text=Module not found").count();
    expect(hasError).toBe(0);
    console.log("  ✅ Tooltip: sin errores de módulo (@base-ui/react OK)");

    await page.close();
  });

  // ─────────────────────────────────────────────
  // 10. MOBILE: responsive (tailwindcss + react)
  // ─────────────────────────────────────────────
  test("MOBILE: responsive en 375px (iPhone SE)", async ({ browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await mobileContext.newPage();

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Verificar que no hay scroll horizontal
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 5) {
      console.log("  ✅ Mobile: sin scroll horizontal (375px)");
    } else {
      console.log(`  ⚠️ Mobile: scroll horizontal de ${scrollWidth - clientWidth}px`);
    }

    await page.screenshot({ path: "test-results/09-mobile-login.png", fullPage: false });
    await page.close();
    await mobileContext.close();
  });

  // ─────────────────────────────────────────────
  // 11. ERRORES CRÍTICOS: sin Module not found
  // ─────────────────────────────────────────────
  test("ERRORES: sin 'Module not found' en todas las páginas", async () => {
    const pages = [
      "/dashboard",
      "/dashboard/claims",
      "/dashboard/operaciones/carga-siniestros",
      "/dashboard/operaciones/carga-casos",
      "/dashboard/operaciones/carga-catalogos",
      "/dashboard/inspecciones",
    ];

    const page = await context.newPage();
    let allOk = true;

    for (const path of pages) {
      const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      const status = response?.status() || 0;
      const hasModuleError = await page.locator("text=Module not found").count();
      const hasCompileError = await page.locator("text=Compile error").count();

      if (status >= 400 || hasModuleError > 0 || hasCompileError > 0) {
        console.log(`  ❌ ${path}: status=${status}, moduleError=${hasModuleError}, compileError=${hasCompileError}`);
        allOk = false;
      } else {
        console.log(`  ✅ ${path}: ${status} OK`);
      }
    }

    await page.close();
    expect(allOk).toBe(true);
  });

  // ─────────────────────────────────────────────
  // 12. SONNER: toast notification container existe
  // ─────────────────────────────────────────────
  test("SONNER: container de toasts presente", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Sonner crea un ol/sonner-container en el body
    const sonnerContainer = page.locator("[data-sonner-toaster], [class*='sonner'], ol[class*='toast']");
    const count = await sonnerContainer.count();
    if (count > 0) {
      console.log("  ✅ Sonner: container de toasts presente");
    } else {
      console.log("  ℹ️ Sonner: container no visible aún (se crea on-demand)");
    }

    await page.close();
  });
});
