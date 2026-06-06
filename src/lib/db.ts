/// <reference types="@cloudflare/workers-types" />
import * as schema from "@/db/schema";

function getD1(): D1Database {
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

// Cache the dev client at module scope — libsql opens a real TCP/file connection and
// recreating it on every API call wastes connections in long-running dev servers.
let devDbCache: ReturnType<typeof createDevDb> | null = null;

function createDevDb() {
  // Use variable-based require to prevent esbuild from bundling this dev-only package
  // into the Cloudflare Workers build (static require() strings are always resolved at bundle time).
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-eval
  const { createClient } = eval("require")("@libsql/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-eval
  const { drizzle } = eval("require")("drizzle-orm/libsql");
  const url = process.env.DATABASE_URL || "file:local.db";
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export function getDb(env?: { DB: D1Database }) {
  if (env?.DB) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/d1");
    return drizzle(env.DB, { schema });
  }

  if (process.env.NODE_ENV !== "production") {
    if (!devDbCache) devDbCache = createDevDb();
    return devDbCache;
  }

  const d1 = getD1();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/d1");
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof getDb>;
