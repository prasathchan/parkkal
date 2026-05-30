import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

export function getDb(env?: { DB: D1Database }) {
  // In Cloudflare Workers, DB binding is passed via env
  // In local dev with Next.js, we access via process.env cast
  const d1 = env?.DB ?? (process.env as unknown as { DB: D1Database }).DB;
  if (!d1) {
    throw new Error(
      "D1 database binding not found. Ensure DB is bound in wrangler.toml or set via env."
    );
  }
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof getDb>;
