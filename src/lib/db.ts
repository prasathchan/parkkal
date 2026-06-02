/// <reference types="@cloudflare/workers-types" />
import * as schema from "@/db/schema";

function getD1(): D1Database {
  // In Cloudflare Workers, bindings are not in process.env — use getCloudflareContext()
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  } catch {
    // not in a Cloudflare Worker context (e.g. during next build static analysis)
  }
  throw new Error("D1 database binding not found. Ensure DB is bound in wrangler.toml.");
}

export function getDb(env?: { DB: D1Database }) {
  if (env?.DB) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/d1");
    return drizzle(env.DB, { schema });
  }

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/libsql");
    const client = createClient({ url: "file:local.db" });
    return drizzle(client, { schema });
  }

  const d1 = getD1();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/d1");
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof getDb>;
