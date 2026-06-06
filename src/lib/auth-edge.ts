import { SignJWT, jwtVerify } from "jose";

// Resolve the signing secret lazily so the "not set" warning fires at runtime
// (first token operation) rather than at module load / build time.
let cachedSecret: Uint8Array | null = null;
let warned = false;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  if (!process.env.JWT_SECRET) {
    if (!warned) {
      warned = true;
      console.error("[SECURITY] JWT_SECRET env var is not set. Using insecure default — DO NOT use in production.");
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
  }
  cachedSecret = new TextEncoder().encode(
    process.env.JWT_SECRET || "parkkal-dental-secret-key-change-in-production"
  );
  return cachedSecret;
}

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export interface OrgSessionPayload {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: string;
  orgRoleId?: string | null;
  // Permission strings embedded at login time to avoid a DB round-trip on every
  // permission check. Absent on tokens issued before this field was added —
  // hasPermission() falls back to a DB lookup in that case.
  permissions?: string[] | null;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function createOrgToken(payload: OrgSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyOrgToken(token: string): Promise<OrgSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as OrgSessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(request: Request): Promise<OrgSessionPayload | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/pkd_org_session=([^;]+)/);
  if (!match) return null;
  return verifyOrgToken(match[1]);
}

export async function getPreOrgSession(request: Request): Promise<JWTPayload | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/pkd_session=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1]);
}
