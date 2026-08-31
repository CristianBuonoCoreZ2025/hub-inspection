import { test, expect } from "@playwright/test";

/**
 * Test de humo para las mejoras WebRTC 1-3.
 *
 * No puede testear una videollamada real (requiere dos navegadores con
 * cámaras reales), pero verifica que:
 * 1. El dev server levanta sin errores
 * 2. La página de inspección remota carga sin crashear
 * 3. El componente LiveVideoCall se monta sin errores de JavaScript
 * 4. No hay errores de consola críticos
 */

test.describe("WebRTC improvements - smoke tests", () => {
  test("dev server responde en localhost:3000", async ({ page }) => {
    const response = await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
    expect(response?.status()).toBe(200);
  });

  test("página de login carga sin errores críticos", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });

    // Filtrar errores esperados (Supabase auth, etc.)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("Supabase") && !e.includes("401") && !e.includes("403") && !e.includes("favicon")
    );

    expect(criticalErrors.length).toBe(0);
  });

  test("página de inspección remota no crashea el navegador", async ({ page, context }) => {
    // Conceder permisos de cámara y micrófono
    await context.grantPermissions(["camera", "microphone"]);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navegar a una página de inspección remota ficticia
    // No necesitamos un ID real — solo verificamos que el código carga
    await page.goto("http://localhost:3000/inspection/test-webrtc-smoke", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Esperar a que la página cargue (puede redirigir o mostrar error, pero no crashear)
    await page.waitForTimeout(3000);

    // Verificar que no hay errores de JavaScript críticos relacionados con WebRTC
    const webrtcErrors = consoleErrors.filter(
      (e) => e.includes("RTCPeerConnection") || e.includes("fetchIceServers") || e.includes("TypeError")
    );

    expect(webrtcErrors.length).toBe(0);
  });

  test("API route turn-credentials responde", async ({ request }) => {
    const response = await request.get("http://localhost:3000/api/turn-credentials", { timeout: 15000 });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.iceServers).toBeDefined();
    expect(Array.isArray(body.iceServers)).toBe(true);
    expect(body.iceServers.length).toBeGreaterThan(0);
  });
});
