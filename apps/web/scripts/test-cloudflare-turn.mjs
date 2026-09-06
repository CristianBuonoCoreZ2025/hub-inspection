// Test directo de la API de Cloudflare TURN — verifica que las credenciales funcionan.
const TURN_KEY_ID = "44b33167f86150b4df7b078b461afeb2";
const TURN_API_TOKEN = "bb30680ba0d0590adcbb4804df30d45b31e7b59a1b25ebe2ea4fe4bcf6081f2f";

async function main() {
  console.log(`\n=== TEST CLOUDFLARE TURN API ===\n`);
  console.log(`Key ID: ${TURN_KEY_ID}`);
  console.log(`API Token: ${TURN_API_TOKEN.substring(0, 8)}...${TURN_API_TOKEN.substring(-8)}\n`);

  const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`;
  console.log(`POST ${url}\n`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }), // 24 horas
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}\n`);

    if (!res.ok) {
      const text = await res.text();
      console.log(`Error response: ${text}`);
      return;
    }

    const data = await res.json();
    console.log(`Respuesta de Cloudflare:`);
    console.log(JSON.stringify(data, null, 2));

    console.log(`\n=== VERIFICACIÓN ===\n`);
    if (data.iceServers && Array.isArray(data.iceServers)) {
      console.log(`✓ iceServers recibidos: ${data.iceServers.length}`);
      for (const server of data.iceServers) {
        if (server.urls) {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          for (const u of urls) console.log(`  - ${u}`);
        }
        if (server.username) console.log(`  username: ${server.username.substring(0, 20)}...`);
        if (server.credential) console.log(`  credential: ${server.credential.substring(0, 20)}...`);
      }
      console.log(`\n✓ TODO FUNCIONA — listo para implementar en el código`);
    } else {
      console.log(`✗ Formato inesperado en la respuesta`);
    }
  } catch (e) {
    console.error(`Error de red: ${e.message}`);
  }
}

main().catch(console.error);
