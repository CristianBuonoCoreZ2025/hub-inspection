/**
 * Crea o prepara un inspector local con un siniestro y una inspección asignados,
 * y le asigna una clave conocida para poder probar el login como inspector.
 *
 * Uso:
 *   node scripts/seed-local-inspector.cjs
 *
 * Datos generados:
 *   - Email: gabriel.labra@mclarens.cl
 *   - Clave: Test1234!
 *   - Empresa: McLarens
 *   - Siniestro: L-TEST-0001
 *   - Inspección: INS-TEST-0001
 */

require("dotenv").config({ path: ".env.local" });

const { Client } = require("pg");
const bcrypt = require("bcrypt");
const { randomUUID } = require("crypto");

const TEST_EMAIL = "gabriel.labra@mclarens.cl";
const TEST_PASSWORD = "Test1234!";

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

async function main() {
  const isLocal = /(127\.0\.0\.1|localhost):\d+/.test(DB);
  const client = new Client({
    connectionString: DB,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    // 1. Asegurar que la compañía McLarens existe
    const companyRes = await client.query(
      "SELECT id FROM companies WHERE slug = 'mclarens' LIMIT 1"
    );
    let companyId;
    if (companyRes.rows.length === 0) {
      companyId = randomUUID();
      await client.query(
        "INSERT INTO companies (id, name, slug) VALUES ($1, $2, $3)",
        [companyId, "McLarens", "mclarens"]
      );
      console.log("Compañía creada:", companyId);
    } else {
      companyId = companyRes.rows[0].id;
    }

    // 2. Buscar o crear auth.user
    let authRes = await client.query(
      "SELECT id FROM auth.users WHERE email = $1 LIMIT 1",
      [TEST_EMAIL]
    );
    let userId;
    const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 10);
    const now = new Date().toISOString();

    if (authRes.rows.length === 0) {
      userId = randomUUID();
      await client.query(
        `INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, confirmed_at, created_at, updated_at,
          raw_app_meta_data
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
          $2, $3, $4, $4, $4, $4, '{"provider":"email","providers":["email"]}'
        )`,
        [userId, TEST_EMAIL, passwordHash, now]
      );
      console.log("auth.user creado:", userId);
    } else {
      userId = authRes.rows[0].id;
      await client.query(
        "UPDATE auth.users SET encrypted_password = $1, updated_at = $2 WHERE id = $3",
        [passwordHash, now, userId]
      );
      console.log("auth.user actualizado:", userId);
    }

    // 3. Buscar o crear profile del inspector
    let profileRes = await client.query(
      "SELECT id, company_id FROM profiles WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    let profileId;
    if (profileRes.rows.length === 0) {
      profileId = randomUUID();
      await client.query(
        `INSERT INTO profiles (
          id, user_id, company_id, full_name, first_name, last_name,
          email, role, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'inspector', true, $8, $8)`,
        [profileId, userId, companyId, "Gabriel Labra", "Gabriel", "Labra", TEST_EMAIL, now]
      );
      console.log("profile creado:", profileId);
    } else {
      profileId = profileRes.rows[0].id;
      await client.query(
        "UPDATE profiles SET company_id = $1, role = 'inspector', is_active = true WHERE id = $2",
        [companyId, profileId]
      );
      console.log("profile actualizado:", profileId);
    }

    // 4. user_clients para que is_profile_visible permita verlo
    await client.query(
      `INSERT INTO user_clients (user_id, company_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, company_id) DO NOTHING`,
      [userId, companyId]
    );

    // 5. Crear siniestro asignado al inspector
    const liquidationNumber = "L-TEST-0001";
    const claimRes = await client.query(
      "SELECT id FROM claims WHERE liquidation_number = $1",
      [liquidationNumber]
    );
    let claimId;
    if (claimRes.rows.length === 0) {
      claimId = randomUUID();
      await client.query(
        `INSERT INTO claims (
          id, claim_number, policy_number, claim_date, company_id,
          liquidation_number, inspector_id, adjuster_id, claim_address,
          client_reference, created_at, updated_at
        ) VALUES (
          $1, 'TEST-CLAIM-001', 'TEST-POL-001', NOW(), $2,
          $3, $4, $4, 'Calle de prueba 123, Santiago', 'REF-TEST-001', NOW(), NOW()
        )`,
        [claimId, companyId, liquidationNumber, profileId]
      );
      console.log("siniestro creado:", claimId, liquidationNumber);
    } else {
      claimId = claimRes.rows[0].id;
      await client.query(
        "UPDATE claims SET inspector_id = $1, adjuster_id = $1, company_id = $2 WHERE id = $3",
        [profileId, companyId, claimId]
      );
      console.log("siniestro actualizado:", claimId);
    }

    // 6. Crear gestión (claim_action) asociada al siniestro
    const actionCode = "L-TEST-0001-HINS-001";
    const actionRes = await client.query(
      "SELECT id FROM claim_actions WHERE code = $1",
      [actionCode]
    );
    let actionId;
    if (actionRes.rows.length === 0) {
      const afRes = await client.query("SELECT id FROM action_features LIMIT 1");
      const actionFeaturesId = afRes.rows[0]?.id;
      if (!actionFeaturesId) {
        throw new Error("No hay action_features en la base de datos para crear la gestión");
      }
      actionId = randomUUID();
      await client.query(
        `INSERT INTO claim_actions (
          id, claim_id, action_features_id, name, code, created_on,
          is_blocker, is_active, is_automatic, origin, has_document, has_pdf
        ) VALUES (
          $1, $2, $3, 'Inspección de prueba', $4, NOW(),
          false, true, false, 'M', false, false
        )`,
        [actionId, claimId, actionFeaturesId, actionCode]
      );
      console.log("gestión creada:", actionId, actionCode);
    } else {
      actionId = actionRes.rows[0].id;
      console.log("gestión existente:", actionId, actionCode);
    }

    // 7. Crear inspección asignada al inspector y vinculada al siniestro y gestión
    const inspectionNumber = "INS-TEST-0001";
    const sessionRes = await client.query(
      "SELECT id FROM inspection_sessions WHERE inspection_number = $1",
      [inspectionNumber]
    );
    let sessionId;
    if (sessionRes.rows.length === 0) {
      sessionId = randomUUID();
      await client.query(
        `INSERT INTO inspection_sessions (
          id, claim_id, company_id, inspector_id, inspection_number,
          claim_action_id, magic_link_token, status, inspection_date, inspection_time,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'completed', NOW()::date, '10:00',
          NOW(), NOW()
        )`,
        [sessionId, claimId, companyId, profileId, inspectionNumber, actionId, randomUUID()]
      );
      console.log("inspección creada:", sessionId, inspectionNumber);
    } else {
      sessionId = sessionRes.rows[0].id;
      await client.query(
        "UPDATE inspection_sessions SET inspector_id = $1, claim_id = $2, company_id = $3, claim_action_id = $4 WHERE id = $5",
        [profileId, claimId, companyId, actionId, sessionId]
      );
      console.log("inspección actualizada:", sessionId);
    }

    await client.query("COMMIT");

    console.log("\n✅ Inspector listo para probar:");
    console.log("   Email:", TEST_EMAIL);
    console.log("   Clave:", TEST_PASSWORD);
    console.log("   Siniestro:", liquidationNumber);
    console.log("   Inspección:", inspectionNumber);
    console.log("   Profile ID:", profileId);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
