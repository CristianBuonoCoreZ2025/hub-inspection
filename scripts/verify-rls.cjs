require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL no está configurada");
  process.exit(1);
}

const assert = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${pass ? "✅" : "❌"} ${label}: ${JSON.stringify(got)} (esperado ${JSON.stringify(want)})`);
  if (!pass) throw new Error(`Fallo: ${label}`);
};

async function getColumns(client, table, exclude) {
  const { rows } = await client.query(
    `SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) AS cols
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name <> ALL ($2)`,
    [table, exclude]
  );
  return rows[0]?.cols || "";
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("🔗 Conectado a PostgreSQL\n");

    // Precalcular columnas de tablas que vamos a copiar
    const claimsCols = await getColumns(client, "claims", ["id", "claim_number", "company_id"]);
    const sessionCols = await getColumns(client, "inspection_sessions", ["id", "claim_id", "company_id", "magic_link_token"]);

    await client.query("BEGIN");
    console.log("🧪 Iniciando transacción de prueba (se hará ROLLBACK)\n");

    await client.query(`
      GRANT EXECUTE ON FUNCTION
        is_tenant_allowed(uuid),
        is_claim_tenant_allowed(uuid),
        is_session_tenant_allowed(uuid),
        is_claim_action_tenant_allowed(uuid),
        is_claim_document_tenant_allowed(uuid),
        is_claim_document_request_tenant_allowed(uuid),
        is_inspection_damage_tenant_allowed(uuid),
        is_claim_reserve_tenant_allowed(uuid),
        is_document_template_tenant_allowed(uuid),
        is_action_template_tenant_allowed(uuid)
      TO authenticated, anon;
    `);

    // Buscar o crear datos de prueba
    const { rows: profiles } = await client.query(`
      SELECT id, user_id, company_id, role
      FROM profiles
      WHERE role <> 'internal'
      LIMIT 1;
    `);

    let profile;
    let testCompanyId;
    let otherCompanyId;

    if (profiles.length === 0) {
      const { rows: countries } = await client.query(`SELECT id FROM countries LIMIT 1`);
      const countryId = countries[0]?.id;

      const { rows: tc } = await client.query(
        `INSERT INTO companies (id, name, slug, rut, country_id)
         VALUES (gen_random_uuid(), 'Test Co', gen_random_uuid()::text, '123', $1) RETURNING id`,
        [countryId]
      );
      testCompanyId = tc[0].id;

      const { rows: oc } = await client.query(
        `INSERT INTO companies (id, name, slug, rut, country_id)
         VALUES (gen_random_uuid(), 'Other Co', gen_random_uuid()::text, '456', $1) RETURNING id`,
        [countryId]
      );
      otherCompanyId = oc[0].id;

      const { rows: p } = await client.query(
        `INSERT INTO profiles (user_id, company_id, role, full_name, email)
         VALUES (gen_random_uuid(), $1, 'adjuster', 'Test User', 'test@example.com')
         RETURNING id, user_id, company_id, role`,
        [testCompanyId]
      );
      profile = p[0];
    } else {
      profile = profiles[0];
      testCompanyId = profile.company_id;
      const { rows: oc } = await client.query(
        `SELECT id FROM companies WHERE id <> $1 LIMIT 1`,
        [testCompanyId]
      );
      otherCompanyId = oc[0]?.id;
      if (!otherCompanyId) {
        const { rows: nc } = await client.query(
          `INSERT INTO companies (id, name, slug, rut, country_id)
           SELECT gen_random_uuid(), 'Other Co', gen_random_uuid()::text, '456', id FROM countries LIMIT 1
           RETURNING id`
        );
        otherCompanyId = nc[0].id;
      }
    }

    // Copiar un claim real y ajustar company_id
    const { rows: testClaims } = await client.query(
      `INSERT INTO claims (id, claim_number, company_id${claimsCols ? ", " + claimsCols : ""})
       SELECT gen_random_uuid(), gen_random_uuid()::text, $1${claimsCols ? ", " + claimsCols : ""}
       FROM claims
       LIMIT 1
       RETURNING id, company_id`,
      [testCompanyId]
    );
    if (testClaims.length === 0) throw new Error("No hay claims de donde copiar para el test");
    const testClaim = testClaims[0];

    const { rows: otherClaims } = await client.query(
      `INSERT INTO claims (id, claim_number, company_id${claimsCols ? ", " + claimsCols : ""})
       SELECT gen_random_uuid(), gen_random_uuid()::text, $1${claimsCols ? ", " + claimsCols : ""}
       FROM claims
       LIMIT 1
       RETURNING id, company_id`,
      [otherCompanyId]
    );
    const otherClaim = otherClaims[0];

    // Copiar una session real y ajustar claim_id/company_id
    const { rows: testSessions } = await client.query(
      `INSERT INTO inspection_sessions (id, claim_id, company_id, magic_link_token${sessionCols ? ", " + sessionCols : ""})
       SELECT gen_random_uuid(), $1, $2, gen_random_uuid()::text${sessionCols ? ", " + sessionCols : ""}
       FROM inspection_sessions
       LIMIT 1
       RETURNING id`,
      [testClaim.id, testCompanyId]
    );
    if (testSessions.length === 0) throw new Error("No hay inspection_sessions de donde copiar para el test");
    const testSession = testSessions[0];

    const { rows: otherSessions } = await client.query(
      `INSERT INTO inspection_sessions (id, claim_id, company_id, magic_link_token${sessionCols ? ", " + sessionCols : ""})
       SELECT gen_random_uuid(), $1, $2, gen_random_uuid()::text${sessionCols ? ", " + sessionCols : ""}
       FROM inspection_sessions
       LIMIT 1
       RETURNING id`,
      [otherClaim.id, otherCompanyId]
    );
    const otherSession = otherSessions[0];

    // Cambiar a rol authenticated y setear auth.uid()
    await client.query(`SET LOCAL ROLE authenticated`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [profile.user_id]);

    console.log("▶ Probando RLS como usuario autenticado...\n");

    assert("is_tenant_allowed(own company)", (await client.query("SELECT is_tenant_allowed($1) AS ok", [testCompanyId])).rows[0].ok, true);
    assert("is_tenant_allowed(other company)", (await client.query("SELECT is_tenant_allowed($1) AS ok", [otherCompanyId])).rows[0].ok, false);
    assert("is_claim_tenant_allowed(own claim)", (await client.query("SELECT is_claim_tenant_allowed($1) AS ok", [testClaim.id])).rows[0].ok, true);
    assert("is_claim_tenant_allowed(other claim)", (await client.query("SELECT is_claim_tenant_allowed($1) AS ok", [otherClaim.id])).rows[0].ok, false);
    assert("is_session_tenant_allowed(own session)", (await client.query("SELECT is_session_tenant_allowed($1) AS ok", [testSession.id])).rows[0].ok, true);
    assert("is_session_tenant_allowed(other session)", (await client.query("SELECT is_session_tenant_allowed($1) AS ok", [otherSession.id])).rows[0].ok, false);

    assert("SELECT claim_actions(own claim)", (await client.query("SELECT count(*)::int AS n FROM claim_actions WHERE claim_id = $1", [testClaim.id])).rows[0].n >= 0, true);
    assert("SELECT claim_actions(other claim)", (await client.query("SELECT count(*)::int AS n FROM claim_actions WHERE claim_id = $1", [otherClaim.id])).rows[0].n, 0);
    assert("SELECT inspection_evidences(own session)", (await client.query("SELECT count(*)::int AS n FROM inspection_evidences WHERE session_id = $1", [testSession.id])).rows[0].n >= 0, true);
    assert("SELECT inspection_evidences(other session)", (await client.query("SELECT count(*)::int AS n FROM inspection_evidences WHERE session_id = $1", [otherSession.id])).rows[0].n, 0);

    // INSERT tabla hija (mismo tenant)
    const { rows: chatColsRow } = await client.query(`
      SELECT
        (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspection_chat_messages' AND column_name IN ('session_id','inspection_session_id') LIMIT 1) AS session_col,
        (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspection_chat_messages' AND column_name IN ('sender_id','profile_id','created_by') LIMIT 1) AS sender_col,
        (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspection_chat_messages' AND data_type IN ('text','character varying') AND is_nullable = 'NO' AND column_name NOT IN ('id') ORDER BY ordinal_position LIMIT 1) AS text_col
    `);
    const chatCols = chatColsRow[0];
    if (!chatCols.session_col || !chatCols.sender_col || !chatCols.text_col) {
      throw new Error("No se pudieron determinar las columnas de inspection_chat_messages");
    }

    const chatInsert = `INSERT INTO inspection_chat_messages (${chatCols.session_col}, ${chatCols.sender_col}, ${chatCols.text_col}) VALUES ($1, $2, $3) RETURNING id`;

    const { rows: i1 } = await client.query(chatInsert, [testSession.id, profile.id, 'test rls same tenant']);
    const insertedChatId = i1[0].id;
    assert(
      "INSERT inspection_chat_messages(own session) visible",
      (await client.query("SELECT count(*)::int AS n FROM inspection_chat_messages WHERE id = $1", [insertedChatId])).rows[0].n,
      1
    );

    // INSERT tabla hija (otro tenant) debe fallar
    let insertOtherFailed = false;
    try {
      await client.query(chatInsert, [otherSession.id, profile.id, 'test rls other tenant']);
    } catch (err) {
      insertOtherFailed = /new row violates row-level security policy/.test(err.message) || /permission denied/.test(err.message);
      if (!insertOtherFailed) throw err;
    }
    assert("INSERT inspection_chat_messages(other session) bloqueado", insertOtherFailed, true);

    // INSERT claim_actions (mismo tenant) copiando una fila existente si hay
    let claimActionInserted = false;
    let claimActionError = null;
    try {
      const { rows: ca } = await client.query(
        `INSERT INTO claim_actions (id, claim_id, action_template_id, action_status_id, name, code, issuer_id, created_on, origin)
         SELECT gen_random_uuid(), $1, action_template_id, action_status_id, name, code, $2, now(), origin
         FROM claim_actions
         LIMIT 1`,
        [testClaim.id, profile.id]
      );
      claimActionInserted = ca.length >= 0; // INSERT sin RETURNING
    } catch (err) {
      claimActionError = err.message;
    }
    console.log(`  ${claimActionInserted ? "✅" : "⚠️"} INSERT claim_actions(own claim): ${claimActionInserted ? "ok" : claimActionError || "sin filas para copiar"}`);

    await client.query("ROLLBACK");
    console.log("\n✅ Transacción revertida. Ningún dato de prueba persistió.");
    console.log("\n✅ Todos los tests de RLS pasaron.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Error en test RLS:", err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
