import { SignJWT, jwtVerify } from "jose";

if (!process.env.JWT_SECRET) {
  console.warn("[SECURITY] JWT_SECRET env var is not set. Using insecure default. Set JWT_SECRET before production deployment.");
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "parkkal-dental-secret-key-change-in-production"
);

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
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

export async function createOrgToken(payload: OrgSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyOrgToken(token: string): Promise<OrgSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
