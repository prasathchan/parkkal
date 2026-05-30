const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

// We inline bcryptjs since it may not be in PATH
const bcrypt = require(path.join(__dirname, "../node_modules/bcryptjs"));

async function main() {
  const client = createClient({ url: "file:local.db" });

  // Create tables from migration (skip INSERT lines — we'll seed manually)
  const migrationPath = path.join(__dirname, "../drizzle/migrations/0001_initial.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  const statements = sql
    .split(";")
    .map(s => s.trim())
    .filter(s => s && !s.startsWith("INSERT") && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (e) {
      console.warn("Skipped:", e.message);
    }
  }

  // Seed admin user with correct password hash
  const password = "Admin@123";
  const hash = await bcrypt.hash(password, 10);

  try {
    await client.execute({
      sql: `INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["usr_admin_001", "Admin User", "admin@parkkal.com", hash, "ADMIN", Date.now()],
    });
    console.log("✅ Local database set up at ./local.db");
    console.log("👤 Admin: admin@parkkal.com / Admin@123");
  } catch (e) {
    console.error("Seed error:", e.message);
  }

  client.close();
}

main().catch(console.error);
