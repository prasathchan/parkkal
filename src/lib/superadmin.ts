/**
 * lib/superadmin.ts
 *
 * Guard for superadmin-only server actions and API routes.
 * A superadmin is a user with users.isSuperAdmin = 1.
 * They operate across all organizations.
 */

import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export async function isSuperAdmin(db: DrizzleD1Database, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.isSuperAdmin === 1;
}
