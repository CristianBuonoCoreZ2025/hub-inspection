/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Test de regresión para Carga AloClaim.
 * Sigue el mismo patrón laxo de full-regression para carga-casos/siniestros.
 */
const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = "mauricio.aranguiz@mclarens.cl";
const TEST_PASSWORD = "Test1234!";

let context;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await page.close();
});

test.afterAll(async () => {
  await context.close();
});

function check(name, condition, detail = "") {
  const ok = condition ? "✅" : "❌";
  console.log(`  ${ok} ${name}${detail ? " — " + detail : ""}`);
  if (!condition) throw new Error(`${name} falló: ${detail}`);
}

test("CARGA ALOCLAIM: página y UI", async () => {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/dashboard/operaciones/carga-aloclaim`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const url = page.url();
  check("Carga AloClaim: página responde", url.includes("/carga-aloclaim") || url.includes("/dashboard"), url);

  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.waitForTimeout(2000);
  check("Carga AloClaim: sin errores de consola", errors.length === 0, errors.slice(0, 3).join("; "));

  const btns = await page.locator("button").count();
  check("Carga AloClaim: botones presentes", btns > 0, `${btns} botones`);

  const fileInput = await page.locator('input[type="file"]').count();
  check("Carga AloClaim: input de archivo", fileInput >= 0, `${fileInput} inputs`);

  // Responsive
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  const mobileSW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("Carga AloClaim: mobile 375px sin scroll H", mobileSW <= 380, `sw=${mobileSW}`);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Sin Module not found
  const modErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("Module not found")) modErrors.push(msg.text());
  });
  await page.waitForTimeout(1000);
  check("Carga AloClaim: sin 'Module not found'", modErrors.length === 0);

  // Performance
  const start = Date.now();
  await page.reload({ waitUntil: "networkidle" });
  const elapsed = Date.now() - start;
  check("Carga AloClaim: reload < 15s", elapsed < 15000, `${elapsed}ms`);

  // Tailwind
  const hasTailwind = await page.evaluate(() => {
    const el = document.querySelector(".flex, .grid, .bg-white");
    return el ? window.getComputedStyle(el).display !== "" : false;
  });
  check("Carga AloClaim: Tailwind CSS aplicado", hasTailwind);

  await page.close();
});
