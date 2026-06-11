/**
 * lib/db.ts
 *
 * Database connection factory + atomic cascade helper.
 *
 * We use Cloudflare D1 (SQLite) in production and @libsql/client locally.
 * Call getDb() in any API route to get the database instance.
 *
 * ── Transactions ─────────────────────────────────────────────────────────────
 * D1 does NOT support db.transaction() with async callbacks (Drizzle ORM API).
 * However, D1 DOES support the batch API: db.batch([stmt1, stmt2, ...]) which
 * executes all statements atomically in a single transaction.
 *
 * Use runCascade() for any multi-statement delete sequence that must be atomic:
 *
 *   await runCascade(db, [
 *     db.delete(visitItems).where(eq(visitItems.visitId, id)),
 *     db.delete(visits).where(eq(visits.id, id)),
 *   ]);
 *
 * In production (D1): statements run as a single atomic transaction.
 * In dev (libsql):    statements run sequentially (acceptable in dev).
 *
 * @example
 *   const db = getDb();
 *   const rows = await db.select().from(patients).where(eq(patients.id, id));
 */
/// <reference types="@cloudflare/workers-types" />
import * as schema from "@/db/schema";
import env from "@/lib/env";

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
  const url = env.DATABASE_URL ?? "file:local.db";
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export function getDb(cfEnv?: { DB: D1Database }) {
  if (cfEnv?.DB) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/d1");
    return drizzle(cfEnv.DB, { schema });
  }

  if (env.NODE_ENV !== "production") {
    if (!devDbCache) devDbCache = createDevDb();
    return devDbCache;
  }

  const d1 = getD1();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/d1");
  return drizzle(d1, { schema });
}

export type DbInstance = ReturnType<typeof getDb>;

// ─── runCascade ───────────────────────────────────────────────────────────────
/**
 * Execute a list of Drizzle query builders atomically.
 *
 * Pass **unresolved** builders — do not `await` them before passing in.
 *
 * - **D1 (production):** uses D1's `db.batch()` — all statements execute in a
 *   single transaction. If any statement fails, none are committed.
 *   D1 limits one batch to 100 statements; large cascades are automatically
 *   split into 100-statement chunks (each chunk is atomic within itself).
 * - **libsql (dev):** executes sequentially. No transaction guarantee in dev,
 *   but that is acceptable because dev data is throwaway.
 *
 * @example
 *   await runCascade(db, [
 *     db.delete(visitItems).where(eq(visitItems.visitId, id)),
 *     db.delete(payments).where(eq(payments.visitId, id)),
 *     db.delete(visits).where(eq(visits.id, id)),
 *   ]);
 */
// Drizzle builders are thenable objects — D1's batch API and the libsql
// transaction path both accept them without needing a concrete generic type.
// Using PromiseLike<unknown>[] avoids importing private Drizzle internals.
type DrizzleBuilder = PromiseLike<unknown>;

interface D1BatchDb {
  batch(builders: DrizzleBuilder[]): Promise<unknown>;
}

interface LibsqlTxDb {
  transaction(fn: (tx: { run: (b: DrizzleBuilder) => Promise<unknown> }) => Promise<void>): Promise<void>;
}

export async function runCascade(
  db: DbInstance,
  builders: DrizzleBuilder[]
): Promise<void> {
  if (builders.length === 0) return;

  // D1 production path: use the batch API for atomicity
  if ("batch" in db && typeof (db as unknown as D1BatchDb).batch === "function") {
    const d1 = db as unknown as D1BatchDb;
    const BATCH_LIMIT = 100; // D1 hard limit per batch request
    for (let i = 0; i < builders.length; i += BATCH_LIMIT) {
      await d1.batch(builders.slice(i, i + BATCH_LIMIT));
    }
    return;
  }

  // libsql dev fallback: wrap in a transaction for dev/test parity with D1 batch
  if ("transaction" in db && typeof (db as unknown as LibsqlTxDb).transaction === "function") {
    const libsql = db as unknown as LibsqlTxDb;
    await libsql.transaction(async (tx) => {
      for (const builder of builders) {
        await tx.run(builder);
      }
    });
    return;
  }

  // Final fallback: sequential execution (no transaction guarantee)
  for (const builder of builders) {
    await builder;
  }
}
