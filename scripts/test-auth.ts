/**
 * Script de diagnóstico para verificar si el servicio de Auth de Nhost responde correctamente.
 * Hace una petición directa vía fetch, sin usar el SDK.
 */

const SUBDOMAIN = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const REGION = process.env.NEXT_PUBLIC_NHOST_REGION;

if (!SUBDOMAIN || !REGION) {
  console.error("❌ Faltan variables de entorno: NEXT_PUBLIC_NHOST_SUBDOMAIN y NEXT_PUBLIC_NHOST_REGION");
  process.exit(1);
}

async function testAuth() {
  const authUrl = `https://${SUBDOMAIN}.auth.${REGION}.nhost.run/v1/signup/email-password`;
  // También probar formato alternativo
  const authUrlAlt = `https://auth.${SUBDOMAIN}.nhost.run/v1/signup/email-password`;

  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = "Password123!";

  console.log(`\n🔍 Prueba 1: ${authUrl}`);
  console.log(`   Email: ${testEmail}`);

  try {
    const res1 = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    const body1 = await res1.json();
    console.log(`   Status: ${res1.status}`);
    console.log(`   Body:`, JSON.stringify(body1, null, 2));

    if (res1.status === 200) {
      console.log("\n✅ ÉXITO: El endpoint de registro funciona con el formato de URL 1");
      return;
    }
  } catch (err: unknown) {
    console.log(`   Error: ${(err as Error).message}`);
  }

  console.log(`\n🔍 Prueba 2: ${authUrlAlt}`);
  try {
    const res2 = await fetch(authUrlAlt, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    const body2 = await res2.json();
    console.log(`   Status: ${res2.status}`);
    console.log(`   Body:`, JSON.stringify(body2, null, 2));

    if (res2.status === 200) {
      console.log("\n✅ ÉXITO: El endpoint de registro funciona con el formato de URL 2");
      return;
    }
  } catch (err: unknown) {
    console.log(`   Error: ${(err as Error).message}`);
  }

  console.log("\n❌ FALLÓ: Ambos endpoints devolvieron error.");
  console.log("   Esto indica un problema del lado del servidor de Nhost Auth.");
  console.log("\n   Posibles causas:");
  console.log("   1. El servicio de auth de tu proyecto Nhost está caído o no inicializado.");
  console.log("   2. Nuestro trigger 'handle_new_user' en auth.users está causando el 500.");
  console.log("   3. La base de datos auth no se creó correctamente.");
  console.log("\n   Solución: Intenta crear un nuevo proyecto en Nhost");
  console.log("   O contacta soporte de Nhost con el ID de tu proyecto.");
}

testAuth();
