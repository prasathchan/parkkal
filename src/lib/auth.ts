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
} from "@/lib/auth-edge";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
