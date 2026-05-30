const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

async function main() {
  const client = createClient({ url: "file:local.db" });
  const migrationPath = path.join(__dirname, "../drizzle/migrations/0001_initial.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (e) {
      console.warn("Skipped:", e.message);
    }
  }

  console.log("✅ Local database set up at ./local.db");
  console.log("👤 Admin: admin@parkkal.com / Admin@123");
  client.close();
}

main().catch(console.error);
