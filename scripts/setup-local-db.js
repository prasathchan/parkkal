const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const db = new Database("./local.db");

const migrationPath = path.join(__dirname, "../drizzle/migrations/0001_initial.sql");
const sql = fs.readFileSync(migrationPath, "utf-8");

// Split on semicolons and run each statement
const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
for (const stmt of statements) {
  try {
    db.exec(stmt + ";");
  } catch (e) {
    console.warn("Skipped:", e.message);
  }
}

console.log("✅ Local database set up at ./local.db");
console.log("👤 Admin user: admin@parkkal.com / Admin@123");
db.close();
