// Session + password helpers for the shared team-password gate.
//
// Built on the Web Crypto API (`crypto.subtle`) rather than `node:crypto` so
// the same code runs in proxy.ts and in API routes on any host (Vercel,
// Netlify, `next start`) and any runtime (Node.js or Edge).
//
// The session cookie holds a signed, expiring token — never SESSION_SECRET
// itself. Shape: `team.<expiresAtMs>.<hex HMAC-SHA256(SESSION_SECRET, "team.<expiresAtMs>")>`.
// A leaked cookie stops working when it expires, and rotating SESSION_SECRET
// logs everyone out immediately.

export const SESSION_COOKIE = "spire_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

const TOKEN_PREFIX = "team";
const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Server is missing the SESSION_SECRET env var");
  return secret;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Constant-time comparison of two equal-length strings (exits early only on length). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  secret = getSecret(),
  now = Date.now()
): Promise<string> {
  const payload = `${TOKEN_PREFIX}.${now + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${await hmacSha256Hex(secret, payload)}`;
}

/** False if the token is missing, malformed, expired, or not signed with `secret`. */
export async function verifySessionToken(
  token: string | undefined | null,
  secret = getSecret(),
  now = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [prefix, expiresAtStr, signature] = parts;
  if (prefix !== TOKEN_PREFIX || !/^\d+$/.test(expiresAtStr)) return false;
  if (now > Number(expiresAtStr)) return false;
  const expected = await hmacSha256Hex(secret, `${prefix}.${expiresAtStr}`);
  return timingSafeEqualStr(signature, expected);
}

/**
 * Checks a candidate against the configured password. Both sides are hashed
 * first so the comparison is constant-time and doesn't leak the length.
 */
export async function checkPassword(
  candidate: string,
  expected = process.env.TEAM_PASSWORD
): Promise<boolean> {
  if (!expected) throw new Error("Server is missing the TEAM_PASSWORD env var");
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return timingSafeEqualStr(bytesToHex(a), bytesToHex(b));
}
