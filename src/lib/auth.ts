/**
 * lib/auth.ts
 *
 * The main auth entry point for server-side code (API routes, server actions).
 *
 * WHY THIS FILE EXISTS:
 *   auth-edge.ts uses only Web Crypto (works in Edge Runtime and Node.js).
 *   bcrypt requires Node.js — it cannot run in Edge Runtime.
 *   So we split them: JWT functions go in auth-edge, bcrypt lives here.
 *
 *   This file re-exports everything from auth-edge so callers only need one import:
 *     import { getSession, hashPassword } from "@/lib/auth";
 *
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 *
 *   hashPassword(password)         → bcrypt hash (cost factor 12)
 *   verifyPassword(password, hash) → boolean
 *   + everything from auth-edge (getSession, createOrgToken, etc.)
 */
import bcrypt from "bcryptjs";

// Re-export all edge-safe JWT functions from auth-edge so existing imports keep working
export type { JWTPayload, OrgSessionPayload } from "@/lib/auth-edge";
export {
  createToken,
  createOrgToken,
  verifyToken,
  verifyOrgToken,
  getSession,
  getPreOrgSession,
  revokeToken,
  isTokenRevoked,
} from "@/lib/auth-edge";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
