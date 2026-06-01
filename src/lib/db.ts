import * as schema from "@/db/schema";

export function getDb(env?: { DB: D1Database }) {
  if (env?.DB) {
    const { drizzle } = require("drizzle-orm/d1");
    return drizzle(env.DB, { schema });
  }

  if (process.env.NODE_ENV !== "production") {
    const { createClient } = require("@libsql/client");
    const { drizzle } = require("drizzle-orm/libsql");
    const client = createClient({ url: "file:local.db" });
    return drizzle(client, { schema });
  }

  const d1 = (process.env as unknown as { DB: D1Database }).DB;
  if (!d1) throw new Error("D1 database binding not found.");
  const { drizzle } = require("drizzle-orm/d1");
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof getDb>;
