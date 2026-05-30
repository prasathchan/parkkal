import * as schema from "@/db/schema";

export function getDb(env?: { DB: D1Database }) {
  if (env?.DB) {
    // Cloudflare Workers production
    const { drizzle } = require("drizzle-orm/d1");
    return drizzle(env.DB, { schema });
  }

  if (process.env.NODE_ENV !== "production") {
    // Local development — use better-sqlite3
    const Database = require("better-sqlite3");
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    const sqlite = new Database("./local.db");
    return drizzle(sqlite, { schema });
  }

  // Cloudflare Workers via process.env cast (fallback)
  const d1 = (process.env as unknown as { DB: D1Database }).DB;
  if (!d1) {
    throw new Error("D1 database binding not found.");
  }
  const { drizzle } = require("drizzle-orm/d1");
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof getDb>;
