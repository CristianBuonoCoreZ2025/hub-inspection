// Intenta obtener métricas de Cloudflare TURN desde la API de Cloudflare.
const TURN_KEY_ID = "44b33167f86150b4df7b078b461afeb2";
const TURN_API_TOKEN = "bb30680ba0d0590adcbb4804df30d45b31e7b59a1b25ebe2ea4fe4bcf6081f2f";

async function main() {
  // 1) Listar credenciales generadas (para ver cuántas se han creado)
  console.log(`\n=== CREDENCIALES TURN GENERADAS ===\n`);
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials`, {
      headers: { Authorization: `Bearer ${TURN_API_TOKEN}` },
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      if (data.credentials) {
        console.log(`Total credenciales: ${data.credentials.length}`);
        for (const c of data.credentials.slice(0, 10)) {
          console.log(`  ${JSON.stringify(c)}`);
        }
      } else {
        console.log(`Respuesta: ${JSON.stringify(data).substring(0, 500)}`);
      }
    } else {
      const text = await res.text();
      console.log(`Error: ${text.substring(0, 300)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // 2) Intentar obtener analytics desde la API de Cloudflare (v4)
  // Necesitamos el account_id
  console.log(`\n=== ANALYTICS DESDE CLOUDFLARE API v4 ===\n`);

  // Intentar con el account_id que ya tenemos de R2
  const accountId = "5ef79ed2b9e3ed01846772938f928ce9";

  // Listar TURN keys
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/calls/turn_keys`, {
      headers: { Authorization: `Bearer ${TURN_API_TOKEN}` },
    });
    console.log(`List TURN keys: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2).substring(0, 2000));
    } else {
      const text = await res.text();
      console.log(`Error: ${text.substring(0, 500)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // 3) Intentar analytics de TURN
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/calls/turn_keys/${TURN_KEY_ID}/analytics`, {
      headers: { Authorization: `Bearer ${TURN_API_TOKEN}` },
    });
    console.log(`\nTURN analytics: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2).substring(0, 2000));
    } else {
      const text = await res.text();
      console.log(`Error: ${text.substring(0, 500)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // 4) Intentar con el endpoint de usage summary
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/usage?since=2026-08-25T18:00:00Z`, {
      headers: { Authorization: `Bearer ${TURN_API_TOKEN}` },
    });
    console.log(`\nUsage summary: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await res.text();
      console.log(`Error: ${text.substring(0, 500)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

main().catch(console.error);
