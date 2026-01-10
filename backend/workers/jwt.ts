/**
 * StudyLoG.AI Backend - JWT Utilities
 *
 * SECURITY IMPLEMENTATION NOTES:
 * ===============================
 *
 * This module implements JWT (JSON Web Token) creation and verification using
 * the Web Crypto API available in Cloudflare Workers. No external dependencies
 * are required.
 *
 * ALGORITHM: HS256 (HMAC with SHA-256)
 * - HMAC was chosen over RS256/ES256 because:
 *   1. Symmetric encryption is sufficient for a single-service architecture
 *   2. Faster verification (important for edge computing)
 *   3. Simpler key management (one secret vs key rotation for public/private)
 *   4. JWT_SECRET is already provisioned via Cloudflare Workers Secrets
 *
 * CLOCK SKEW TOLERANCE: 60 seconds
 * - Accounts for time differences between token issuance and verification
 * - Prevents token rejection due to minor clock drift
 *
 * TOKEN FLOW:
 * 1. User authenticates via /auth/login or /auth/register
 * 2. Server issues JWT signed with JWT_SECRET
 * 3. Client includes JWT in Authorization: Bearer <token> header
 * 4. Server verifies signature, expiration, and claims
 * 5. Cache is used as a fast-path validation layer (token revocation)
 *
 * SECURITY CONSIDERATIONS:
 * - JWT_SECRET must be at least 32 bytes (256 bits) for HMAC-SHA256
 * - Tokens include nbf (not before) to prevent pre-issued token usage
 * - Tokens include iat (issued at) for audit trail
 * - Tokens include exp (expiration) - default 7 days, configurable
 * - Tokens include jti (JWT ID) for revocation tracking
 * - Verification checks: signature -> expiration -> not-before -> claims
 *
 * @module jwt
 */

/**
 * JWT Claims interface
 * Represents the standard JWT registered claims plus custom application claims
 */
export interface JWTClaims {
  // Standard registered claims (RFC 7519)
  iss: string;    // Issuer - who created the token
  sub: string;    // Subject - who the token is about (user_id)
  aud: string;    // Audience - who should accept the token
  exp: number;    // Expiration time (seconds since epoch)
  nbf: number;    // Not before (seconds since epoch)
  iat: number;    // Issued at (seconds since epoch)
  jti: string;    // JWT ID - unique identifier for this token

  // Custom application claims
  user_id: string;      // User's unique identifier
  roles?: string[];     // User's roles/permissions
  tier?: string;        // Subscription tier
}

/**
 * Decoded JWT token structure
 * Contains the header, payload, and signature components
 */
export interface DecodedToken {
  header: {
    alg: string;  // Algorithm (HS256)
    typ: string;  // Type (JWT)
  };
  payload: JWTClaims;
  signature: string;
}

/**
 * Token verification result
 * Used to communicate verification success or specific failure reasons
 */
export type VerifyResult =
  | { valid: true; claims: JWTClaims }
  | { valid: false; reason: 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'EXPIRED' | 'NOT_YET_VALID' | 'MALFORMED' };

/**
 * Token creation options
 * Allows customization of token lifetime and issuer
 */
export interface CreateTokenOptions {
  issuer?: string;      // Issuer identifier (default: 'studylog.ai')
  audience?: string;    // Audience identifier (default: 'studylog-api')
  expiresIn?: number;   // Token lifetime in seconds (default: 604800 = 7 days)
  clockSkew?: number;   // Clock skew tolerance in seconds (default: 60)
}

/**
 * Default configuration values
 */
const DEFAULTS = {
  ALGORITHM: 'HS256',
  TYPE: 'JWT',
  ISSUER: 'studylog.ai',
  AUDIENCE: 'studylog-api',
  EXPIRES_IN: 604800, // 7 days in seconds
  CLOCK_SKEW: 60, // 60 seconds tolerance
} as const;

/**
 * Creates a JWT token for the given user
 *
 * SECURITY: Token is signed using HMAC-SHA256 with the JWT_SECRET.
 * The secret is never exposed outside the Worker environment.
 *
 * @param userId - The user's unique identifier
 * @param secret - The JWT secret key (from Cloudflare Workers Secrets)
 * @param options - Optional token configuration
 * @returns Promise resolving to the encoded JWT string
 *
 * @example
 * ```typescript
 * const token = await createToken('user-123', env.JWT_SECRET, {
 *   roles: ['student', 'premium'],
 *   tier: 'forge'
 * });
 * ```
 */
export async function createToken(
  userId: string,
  secret: string,
  options: CreateTokenOptions & { roles?: string[]; tier?: string } = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const issuer = options.issuer ?? DEFAULTS.ISSUER;
  const audience = options.audience ?? DEFAULTS.AUDIENCE;
  const expiresIn = options.expiresIn ?? DEFAULTS.EXPIRES_IN;

  // Generate unique JWT ID for revocation tracking
  const jti = crypto.randomUUID();

  // Build the payload with all claims
  const payload: JWTClaims = {
    // Registered claims
    iss: issuer,
    sub: userId,
    aud: audience,
    iat: now,
    nbf: now,
    exp: now + expiresIn,
    jti,

    // Custom claims
    user_id: userId,
    roles: options.roles,
    tier: options.tier,
  };

  // Encode header and payload
  const header = { alg: DEFAULTS.ALGORITHM, typ: DEFAULTS.TYPE };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature: HMACSHA256(secret, header.payload)
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256(secret, data);

  return `${data}.${signature}`;
}

/**
 * Verifies a JWT token and returns the claims if valid
 *
 * SECURITY: Performs comprehensive validation:
 * 1. Format validation (three dot-separated parts)
 * 2. Signature verification using HMAC-SHA256
 * 3. Expiration check (exp) with clock skew tolerance
 * 4. Not-before check (nbf) with clock skew tolerance
 *
 * @param token - The JWT string to verify
 * @param secret - The JWT secret key (must match the signing secret)
 * @param options - Optional verification configuration
 * @returns Promise resolving to verification result
 *
 * @example
 * ```typescript
 * const result = await verifyToken(token, env.JWT_SECRET);
 * if (result.valid) {
 *   console.log('User:', result.claims.user_id);
 * } else {
 *   console.log('Reason:', result.reason);
 * }
 * ```
 */
export async function verifyToken(
  token: string,
  secret: string,
  options: CreateTokenOptions = {}
): Promise<VerifyResult> {
  // Step 1: Validate token format (must be three parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Step 2: Decode and validate header
  let header: { alg: string; typ: string };
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== DEFAULTS.ALGORITHM || header.typ !== DEFAULTS.TYPE) {
      return { valid: false, reason: 'MALFORMED' };
    }
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  // Step 3: Decode payload
  let payload: JWTClaims;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  // Step 4: Verify signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await hmacSha256(secret, data);

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeEqual(signature, expectedSignature)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  // Step 5: Validate timing claims with clock skew tolerance
  const now = Math.floor(Date.now() / 1000);
  const clockSkew = options.clockSkew ?? DEFAULTS.CLOCK_SKEW;

  // Check expiration (exp + skew allows recently expired tokens)
  if (payload.exp < now - clockSkew) {
    return { valid: false, reason: 'EXPIRED' };
  }

  // Check not-before (nbf - skew allows tokens that are just valid)
  if (payload.nbf > now + clockSkew) {
    return { valid: false, reason: 'NOT_YET_VALID' };
  }

  // Step 6: Validate required claims exist
  if (!payload.iss || !payload.sub || !payload.aud || !payload.user_id) {
    return { valid: false, reason: 'MALFORMED' };
  }

  // All validations passed
  return { valid: true, claims: payload };
}

/**
 * Decodes a JWT token without verification
 *
 * WARNING: This does NOT verify the signature. Use verifyToken() for
 * security-critical operations. This is useful for debugging or when
 * you need to inspect token claims before full verification.
 *
 * @param token - The JWT string to decode
 * @returns The decoded header, payload, and signature
 * @throws Error if the token is malformed
 */
export function decodeToken(token: string): DecodedToken {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  return {
    header: JSON.parse(base64UrlDecode(encodedHeader)),
    payload: JSON.parse(base64UrlDecode(encodedPayload)),
    signature,
  };
}

/**
 * Extracts the JWT ID (jti) from a token
 * Useful for cache-based token revocation lookups
 *
 * @param token - The JWT string
 * @returns The JWT ID or undefined if malformed
 */
export function getTokenId(token: string): string | undefined {
  try {
    const decoded = decodeToken(token);
    return decoded.payload.jti;
  } catch {
    return undefined;
  }
}

/**
 * Checks if a token is expired without verifying the signature
 * Useful for cache invalidation decisions
 *
 * @param token - The JWT string
 * @param clockSkew - Clock skew tolerance in seconds
 * @returns True if the token is expired
 */
export function isTokenExpired(token: string, clockSkew: number = DEFAULTS.CLOCK_SKEW): boolean {
  try {
    const decoded = decodeToken(token);
    const now = Math.floor(Date.now() / 1000);
    return decoded.payload.exp < now - clockSkew;
  } catch {
    return true;
  }
}

// ============================================================================
// CRYPTO UTILITIES (Cloudflare Workers Web Crypto API)
// ============================================================================

/**
 * Computes HMAC-SHA256 hash of the given data
 *
 * @param secret - The secret key for HMAC
 * @param data - The data to hash
 * @returns Promise resolving to the base64url-encoded hash
 */
async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();

  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',                    // Key format
    encoder.encode(secret),   // Key data
    { name: 'HMAC', hash: 'SHA-256' }, // Algorithm
    false,                    // Extractable (false for security)
    ['sign']                  // Key usages
  );

  // Sign the data
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  // Convert to base64url encoding
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

/**
 * Performs constant-time string comparison
 *
 * SECURITY: Prevents timing attacks when comparing signatures.
 * Two arrays are compared in a way that doesn't short-circuit on
 * the first mismatch, preventing attackers from using timing
 * differences to guess valid signatures.
 *
 * @param a - First string (base64url-encoded signature)
 * @param b - Second string (base64url-encoded signature)
 * @returns True if strings are equal
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  // XOR all bytes together - if any differ, result is non-zero
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Encodes a string to base64url format
 *
 * Base64url is a variant of base64 that:
 * - Uses '-' instead of '+'
 * - Uses '_' instead of '/'
 * - Removes trailing '=' padding
 *
 * This is the encoding specified for JWT in RFC 7519.
 *
 * @param input - The string to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncode(input: string): string {
  // For strings, convert to bytes first
  const bytes = new TextEncoder().encode(input);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Encodes a Uint8Array to base64url format
 *
 * @param input - The byte array to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncodeBytes(input: Uint8Array): string {
  const binary = Array.from(input, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decodes a base64url string back to its original value
 *
 * @param input - The base64url-encoded string
 * @returns Decoded string
 */
function base64UrlDecode(input: string): string {
  // Convert base64url to standard base64
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

  // Restore padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }

  // Decode and handle UTF-8
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
