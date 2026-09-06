const { Client } = require('pg');

const liquidationNumbers = [
  "L-000001623","L-000001752","L-000001744","L-000001629","L-000001480",
  "L-000001828","L-000001827","L-000001619","L-000001826","L-000001627",
  "L-000001516","L-000001749","L-000001748","L-000000867","L-000001747",
  "L-000002218","L-000002216","L-000002215","L-000002213","L-000002210",
  "L-000002208","L-000002207","L-000002206","L-000002205","L-000002204",
  "L-000002203","L-000002202","L-000002201","L-000002200","L-000002195",
  "L-000002192","L-000002181","L-000002180","L-000002150","L-000002149",
  "L-000002148","L-000002147","L-000002146","L-000002145","L-000002144",
  "L-000002143","L-000002142","L-000002141","L-000002140","L-000002139",
  "L-000002138","L-000002137","L-000002136","L-000002135","L-000002134",
  "L-000002133","L-000002132","L-000002131","L-000002130","L-000002129",
  "L-000002128","L-000002127","L-000002126","L-000002125","L-000002124",
  "L-000002123","L-000002122","L-000002121","L-000002014","L-000002120",
  "L-000002119","L-000002118","L-000002117","L-000002116","L-000002115",
  "L-000002114","L-000002113","L-000002112","L-000002111","L-000002110",
  "L-000001843","L-000002109","L-000002108","L-000002107","L-000002106",
  "L-000002013","L-000001985","L-000001984","L-000001824","L-000001983",
  "L-000001982","L-000001981","L-000001980","L-000001976","L-000001973",
  "L-000001966","L-000001958","L-000001831","L-000001830","L-000001829",
  "L-000001825","L-000001801","L-000001800","L-000001799","L-000001785",
  "L-000001780","L-000001777","L-000001754","L-000001753","L-000001751",
  "L-000001750","L-000001746","L-000001745","L-000001743","L-000001742",
  "L-000001741","L-000001942","L-000001950","L-000001915","L-000001638",
  "L-000001637","L-000001636","L-000001635","L-000001634","L-000001633",
  "L-000001632","L-000001624","L-000001631","L-000001630","L-000001628",
  "L-000001626","L-000001625","L-000001622","L-000001621","L-000001620",
  "L-000001618","L-000001617","L-000001616","L-000001615","L-000001614",
  "L-000001581","L-000001580","L-000001579","L-000001489","L-000001481",
];

async function main() {
  const c = new Client({
    connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // 1. Buscar el profile ID de Juan Carlos Esquivel
  const userRes = await c.query(
    "SELECT id, full_name, email, role FROM profiles WHERE full_name ILIKE '%esquivel%' OR full_name ILIKE '%juan carlos esquivel%'"
  );
  console.log("Usuarios encontrados:", JSON.stringify(userRes.rows, null, 2));

  if (userRes.rows.length === 0) {
    console.error("No se encontro a Juan Carlos Esquivel");
    await c.end();
    return;
  }

  const auditorId = userRes.rows[0].id;
  console.log(`Auditor ID: ${auditorId} (${userRes.rows[0].full_name})`);

  // 2. Actualizar todos los claims con esos liquidation_numbers
  const updateRes = await c.query(
    "UPDATE claims SET auditor_id = $1 WHERE liquidation_number = ANY($2) RETURNING id, liquidation_number, auditor_id",
    [auditorId, liquidationNumbers]
  );

  console.log(`Claims actualizados: ${updateRes.rowCount} de ${liquidationNumbers.length}`);

  // 3. Verificar cuales no se encontraron
  const updatedNumbers = new Set(updateRes.rows.map(r => r.liquidation_number));
  const notFound = liquidationNumbers.filter(n => !updatedNumbers.has(n));
  if (notFound.length > 0) {
    console.log(`No encontrados (${notFound.length}):`, notFound.join(", "));
  }

  await c.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
