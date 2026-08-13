// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const INSPECTOR_EMAIL = "mauricio.aranguiz@mclarens.cl";
const INSPECTOR_PASSWORD = "Test1234!";
const SESSION_ID = "5bd3550c-54ec-4207-b346-944302fd4d87";
const BASE_URL = "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// iPhone 12 Pro
const MOBILE_DEVICE = {
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

test.use(MOBILE_DEVICE);

test.describe("Pruebas visuales de correcciones móviles", () => {
  test.beforeAll(async () => {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await sb
      .from("inspection_sessions")
      .update({
        inspector_id: "b5f8b980-44b3-44fc-a3a6-eb0292baf313",
        status: "scheduled",
        substate: "normal",
        cancellation_reason_id: null,
        cancellation_notes: null,
        cancelled_at: null,
        cancelled_by: null,
        started_at: null,
        ended_at: null,
      })
      .eq("id", SESSION_ID);
    console.log("📋 Sesión asignada para test visual");
  });

  test("Visual: touch targets + report responsive + logo", async ({ page }) => {
    test.setTimeout(180000);

    // ── PASO 1: Login ──
    console.log("📋 PASO 1: Login...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', INSPECTOR_EMAIL);
    await page.fill('input[name="password"]', INSPECTOR_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/mobile|\/dashboard/, { timeout: 15000 });
    console.log("✅ Login OK:", page.url());

    // ── PASO 2: Navegar a /mobile via SPA ──
    console.log("📋 PASO 2: Navegar a /mobile...");
    if (page.url().includes("/dashboard")) {
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        window.history.pushState({}, "", "/mobile");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(3000);
    }
    await page.evaluate(() => localStorage.removeItem("mobile-mode"));
    await page.evaluate(() => {
      window.history.pushState({}, "", "/mobile");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(3000);

    const mobileChoice = page.locator("text=Inspección mobile").first();
    if (await mobileChoice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mobileChoice.click();
      await page.waitForURL(/\/mobile\/inspecciones/, { timeout: 10000 });
      console.log("✅ Modo inspección mobile elegido");
    } else if (page.url().includes("/mobile/inspecciones")) {
      console.log("✅ Ya en lista de inspecciones");
    }

    // ── SCREENSHOT 1: Lista ──
    console.log("📸 SCREENSHOT 1: Lista de inspecciones");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/visual-01-lista.png", fullPage: true });

    // ── PASO 3: Buscar inspección en tabs ──
    console.log("📋 PASO 3: Buscar inspección...");
    const tabs = page.locator(".mobile-tab");
    await expect(tabs.first()).toBeVisible({ timeout: 15000 });
    const tabCount = await tabs.count();
    console.log(`✅ ${tabCount} tabs visibles`);

    let found = false;
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(1500);
      const card = page.locator("text=L-000000020").first();
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`✅ L-000000020 encontrada en tab ${i}`);
        await card.click();
        found = true;
        break;
      }
    }

    if (!found) {
      const anyCard = page.locator(".mobile-inspection-card").first();
      if (await anyCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log("⚠ Usando primera inspección disponible");
        await anyCard.click();
      } else {
        throw new Error("No se encontró ninguna inspección");
      }
    }

    // ── PASO 4: Detalle ──
    console.log("📋 PASO 4: Detalle de inspección...");
    await page.waitForURL(/\/mobile\/inspecciones\/.+/, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // ── SCREENSHOT 2: Detalle (resumen) ──
    console.log("📸 SCREENSHOT 2: Detalle - tab Resumen");
    await page.screenshot({ path: "tests/visual-02-detalle-resumen.png", fullPage: true });

    // ── PASO 5: Iniciar inspección ──
    console.log("📋 PASO 5: Iniciar inspección...");
    const startButton = page.locator("text=Iniciar inspección").first();
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();
    await expect(page.locator("text=Inspección iniciada")).toBeVisible({ timeout: 15000 });
    console.log("✅ Inspección iniciada");
    await page.waitForTimeout(2000);

    // ── SCREENSHOT 3: Activo ──
    console.log("📸 SCREENSHOT 3: Detalle con inspección activa");
    await page.screenshot({ path: "tests/visual-03-activo.png", fullPage: true });

    // ── PASO 6: Tab Evidencias ──
    console.log("📋 PASO 6: Tab Evidencias...");
    const fotosTab = page.locator(".mobile-tab:has-text('Fotos')").first();
    await fotosTab.click();
    await page.waitForTimeout(2000);

    // ── SCREENSHOT 4: Evidencias vacío ──
    console.log("📸 SCREENSHOT 4: Tab Evidencias (vacío)");
    await page.screenshot({ path: "tests/visual-04-evidencias-vacio.png", fullPage: true });

    // ── PASO 7: Subir foto ──
    console.log("📋 PASO 7: Subir foto...");
    const fs = require("fs");
    const path = require("path");
    const testImagePath = path.join(__dirname, "test-evidence.png");
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4p+UAAAAJUlEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAIC3AQAAAQIEhgAAAAAAAAB4G0nHAAAAAElFTkSuQmCC",
      "base64"
    );
    fs.writeFileSync(testImagePath, pngBuffer);

    const fileInput = page.locator('input[type="file"][accept="image/*,video/*,.pdf"]');
    await fileInput.setInputFiles(testImagePath);
    await expect(page.locator("text=subido").first()).toBeVisible({ timeout: 30000 });
    console.log("✅ Foto subida");
    await page.waitForTimeout(3000);

    // ── SCREENSHOT 5: Evidencias con foto ──
    console.log("📸 SCREENSHOT 5: Evidencias con foto (touch targets)");
    await page.screenshot({ path: "tests/visual-05-evidencias-con-foto.png", fullPage: true });

    // Verificar touch target del botón eliminar
    const deleteBtn = page.locator(".mobile-photo-delete-btn").first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const box = await deleteBtn.boundingBox();
      if (box) {
        console.log(`✅ Botón eliminar: ${Math.round(box.width)}x${Math.round(box.height)}px (mín 44px)`);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    } else {
      console.log("⚠ Botón eliminar no visible (puede no haber fotos)");
    }

    // ── PASO 8: Tab Informe ──
    console.log("📋 PASO 8: Tab Informe...");
    const informeTab = page.locator(".mobile-tab:has-text('Informe')").first();
    await informeTab.click();
    await page.waitForTimeout(3000);

    // ── SCREENSHOT 6: Informe responsive ──
    console.log("📸 SCREENSHOT 6: Tab Informe (responsive)");
    await page.screenshot({ path: "tests/visual-06-informe-responsive.png", fullPage: true });

    // Verificar que el reporte no desborda
    const reportPage = page.locator(".report-pdf-page").first();
    if (await reportPage.isVisible({ timeout: 5000 }).catch(() => false)) {
      const box = await reportPage.boundingBox();
      if (box) {
        console.log(`✅ Reporte: ${Math.round(box.width)}px ancho (viewport: 390px)`);
        expect(box.width).toBeLessThanOrEqual(390);
      }
    } else {
      console.log("⚠ Reporte no visible (puede requerir generación)");
    }

    // ── SCREENSHOT 7: Informe scroll ──
    console.log("📸 SCREENSHOT 7: Informe (scroll abajo)");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/visual-07-informe-scroll.png", fullPage: false });

    fs.unlinkSync(testImagePath);

    // ── Cleanup ──
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await sb.from("inspection_sessions").update({
      status: "scheduled",
      substate: "normal",
      inspector_id: "6e3d7a5e-d755-d7e8-fa29-f1c6770e019f",
      cancellation_reason_id: null,
      cancellation_notes: null,
      cancelled_at: null,
      cancelled_by: null,
      started_at: null,
      ended_at: null,
    }).eq("id", SESSION_ID);
    console.log("🧹 Cleanup done");

    console.log("\n🎉 PRUEBAS VISUALES COMPLETAS:");
    console.log("   📸 tests/visual-01-lista.png");
    console.log("   📸 tests/visual-02-detalle-resumen.png");
    console.log("   📸 tests/visual-03-activo.png");
    console.log("   📸 tests/visual-04-evidencias-vacio.png");
    console.log("   📸 tests/visual-05-evidencias-con-foto.png");
    console.log("   📸 tests/visual-06-informe-responsive.png");
    console.log("   📸 tests/visual-07-informe-scroll.png");
  });

  test.afterAll(async () => {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await sb.from("inspection_sessions").update({
      status: "scheduled",
      substate: "normal",
      inspector_id: "6e3d7a5e-d755-d7e8-fa29-f1c6770e019f",
      cancellation_reason_id: null,
      cancellation_notes: null,
      cancelled_at: null,
      cancelled_by: null,
      started_at: null,
      ended_at: null,
    }).eq("id", SESSION_ID);
  });
});
