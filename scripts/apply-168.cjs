const { Client } = require("pg");

const client = new Client({
  connectionString: "postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
});

async function run() {
  await client.connect();
  console.log("Connected to DB");

  try {
    await client.query("ALTER TABLE inspection_reports ALTER COLUMN report_url DROP NOT NULL;");
    console.log("OK: report_url is now nullable");
  } catch (e) {
    if (e.message.includes("already")) {
      console.log("report_url already nullable");
    } else {
      console.log("report_url:", e.message);
    }
  }

  try {
    await client.query("ALTER TABLE inspection_reports ALTER COLUMN claim_id DROP NOT NULL;");
    console.log("OK: claim_id is now nullable");
  } catch (e) {
    if (e.message.includes("already")) {
      console.log("claim_id already nullable");
    } else {
      console.log("claim_id:", e.message);
    }
  }

  await client.end();
  console.log("Done!");
}

run().catch(console.error);
