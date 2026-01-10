/**
 * StudyLoG.AI Backend - Middleware
 *
 * SECURITY: Authentication and authorization middleware using JWT verification.
 *
 * The authentication flow:
 * 1. Client sends Authorization: Bearer <token> header
 * 2. Token is extracted and verified (signature, expiration, claims)
 * 3. Cache provides fast-path validation for revocation checking
 * 4. User claims are extracted for authorization decisions
 *
 * See jwt.ts for JWT implementation details.
 */

import type { Env } from './types';
import { verifyToken, type VerifyResult, getTokenId, createToken } from './jwt';

// CORS headers for cross-origin requests
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');

  // In production, restrict to known origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8787',
    'https://studylog.ai',
    'https://*.studylog.ai',
  ];

  const isAllowed =
    origin === null ||
    origin === '*' ||
    allowedOrigins.some((allowed) => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });

  const allowedOrigin = isAllowed
    ? (origin ?? 'http://localhost:3000')
    : 'http://localhost:3000';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Rate limiting using KV
export async function rateLimiter(
  request: Request,
  env: Env
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate:${ip}`;

  const limit = parseInt(env.RATE_LIMIT_REQUESTS) || 100;
  const window = parseInt(env.RATE_LIMIT_WINDOW) || 60;

  try {
    const current = await env.RATE_LIMITS.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Limit: ${limit} per ${window}s`,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(window),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + window),
          },
        }
      );
    }

    // Increment counter
    await env.RATE_LIMITS.put(key, String(count + 1), {
      expirationTtl: window,
    });

    return null; // Continue processing
  } catch {
    // If KV fails, allow the request
    console.error('Rate limiter KV error');
    return null;
  }
}

// Error handler
export function errorHandler(error: unknown, request: Request): Response {
  console.error('Unhandled error:', error);

  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();

  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack }),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  );
}

// Request logging
export function logRequest(
  request: Request,
  response: Response,
  startTime: number
): void {
  const duration = Date.now() - startTime;
  const url = new URL(request.url);

  console.log(
    JSON.stringify({
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration,
      ip: request.headers.get('CF-Connecting-IP'),
      userAgent: request.headers.get('User-Agent'),
    })
  );
}

/**
 * Authentication result interface
 * Contains verified user claims from the JWT
 */
export interface AuthResult {
  studentId: string;
  userId: string;
  tokenId: string;
  roles?: string[];
  tier?: string;
  expiresAt: number;
}

/**
 * Authentication error types
 * Distinguishes between different authentication failure scenarios
 */
export type AuthError =
  | { code: 'NO_TOKEN'; message: string }
  | { code: 'INVALID_TOKEN'; message: string; reason: string }
  | { code: 'REVOKED_TOKEN'; message: string }
  | { code: 'MISSING_SECRET'; message: string };

/**
 * Result type for verifyAuth - either success or error
 */
export type VerifyAuthResult =
  | { authenticated: true; result: AuthResult }
  | { authenticated: false; error: AuthError };

/**
 * Verifies JWT authentication from the Authorization header
 *
 * SECURITY IMPLEMENTATION:
 * This function performs comprehensive JWT verification:
 *
 * 1. Token Extraction:
 *    - Parses Authorization: Bearer <token> header
 *    - Returns NO_TOKEN error if header is missing or malformed
 *
 * 2. Signature Verification:
 *    - Uses HMAC-SHA256 to verify token was signed with JWT_SECRET
 *    - Protects against token forgery
 *    - Returns INVALID_TOKEN with reason if signature check fails
 *
 * 3. Timing Validation:
 *    - Checks expiration (exp) with 60-second clock skew tolerance
 *    - Checks not-before (nbf) to prevent pre-issued token usage
 *    - Returns INVALID_TOKEN with EXPIRED or NOT_YET_VALID reason
 *
 * 4. Revocation Check:
 *    - Queries KV cache for revoked token IDs
 *    - Allows immediate token invalidation without changing JWT_SECRET
 *    - Returns REVOKED_TOKEN if found in revocation list
 *
 * 5. Claims Validation:
 *    - Ensures required claims (user_id, jti) are present
 *    - Returns INVALID_TOKEN with MALFORMED reason if claims missing
 *
 * ERROR RESPONSES:
 * - NO_TOKEN (401): No Authorization header provided
 * - INVALID_TOKEN (401): Token is malformed, has invalid signature, or is expired
 * - REVOKED_TOKEN (401): Token was explicitly revoked
 * - MISSING_SECRET (500): JWT_SECRET not configured (server error)
 *
 * @param request - The incoming HTTP request
 * @param env - Cloudflare Workers environment bindings
 * @returns Promise resolving to authentication result or error
 *
 * @example
 * ```typescript
 * const auth = await verifyAuth(request, env);
 * if (!auth.authenticated) {
 *   return Response.json({ error: auth.error }, { status: 401 });
 * }
 * console.log('User:', auth.result.studentId);
 * ```
 */
export async function verifyAuth(
  request: Request,
  env: Env
): Promise<VerifyAuthResult> {
  // Step 1: Extract token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Authentication required. Provide Authorization: Bearer <token> header.',
      },
    };
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  // Step 2: Verify JWT_SECRET is configured
  if (!env.JWT_SECRET) {
    // Log security event - misconfigured server
    console.error('[SECURITY] JWT_SECRET not configured in environment');
    return {
      authenticated: false,
      error: {
        code: 'MISSING_SECRET',
        message: 'Server configuration error. Contact administrator.',
      },
    };
  }

  // Step 3: Verify JWT signature, expiration, and claims
  let verifyResult: VerifyResult;
  try {
    verifyResult = await verifyToken(token, env.JWT_SECRET);
  } catch (error) {
    // Catch unexpected errors during verification
    console.error('[SECURITY] Token verification error:', error);
    return {
      authenticated: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token verification failed.',
        reason: 'VERIFICATION_ERROR',
      },
    };
  }

  // Step 4: Handle verification failures
  if (!verifyResult.valid) {
    // Map verification failure reasons to appropriate error responses
    const reasonMap: Record<string, string> = {
      INVALID_FORMAT: 'Token format is invalid',
      INVALID_SIGNATURE: 'Token signature is invalid',
      EXPIRED: 'Token has expired. Please log in again.',
      NOT_YET_VALID: 'Token is not yet valid.',
      MALFORMED: 'Token payload is malformed',
    };

    return {
      authenticated: false,
      error: {
        code: 'INVALID_TOKEN',
        message: reasonMap[verifyResult.reason] || 'Invalid token',
        reason: verifyResult.reason,
      },
    };
  }

  // Step 5: Check if token has been revoked
  // The revocation cache stores revoked JWT IDs (jti) for fast lookup
  const claims = verifyResult.claims;
  const revokedKey = `revoked:${claims.jti}`;

  try {
    const isRevoked = await env.SESSION_CACHE.get(revokedKey);
    if (isRevoked === '1') {
      // Log security event - revoked token usage attempt
      console.warn(`[SECURITY] Revoked token used: jti=${claims.jti}, user=${claims.user_id}`);
      return {
        authenticated: false,
        error: {
          code: 'REVOKED_TOKEN',
          message: 'Token has been revoked. Please log in again.',
        },
      };
    }
  } catch (error) {
    // If KV check fails, allow the request (fail-open for reliability)
    // but log the error for monitoring
    console.error('[SECURITY] Revocation check failed:', error);
  }

  // Step 6: Return authenticated user context
  return {
    authenticated: true,
    result: {
      studentId: claims.user_id,
      userId: claims.user_id,
      tokenId: claims.jti,
      roles: claims.roles,
      tier: claims.tier,
      expiresAt: claims.exp,
    },
  };
}

/**
 * Creates a JWT token for a user
 *
 * This is a convenience wrapper around the jwt.createToken function
 * that integrates with the cache layer for session management.
 *
 * @param userId - The user's unique identifier
 * @param env - Cloudflare Workers environment bindings
 * @param options - Optional token configuration
 * @returns Promise resolving to the JWT token string
 *
 * @example
 * ```typescript
 * const token = await createAuthToken(user.id, env, {
 *   roles: ['student', 'premium'],
 *   tier: 'forge'
 * });
 * ```
 */
export async function createAuthToken(
  userId: string,
  env: Env,
  options: {
    roles?: string[];
    tier?: string;
    expiresIn?: number;
  } = {}
): Promise<string> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured in environment');
  }

  return createToken(userId, env.JWT_SECRET, {
    roles: options.roles,
    tier: options.tier,
    expiresIn: options.expiresIn,
  });
}

/**
 * Revokes a JWT token by adding its ID to the revocation cache
 *
 * This allows immediate invalidation of tokens without waiting for
 * natural expiration. Useful for:
 * - User-initiated logout
 * - Security incidents (password compromise, etc.)
 * - Admin actions (account suspension)
 *
 * @param token - The JWT token to revoke
 * @param env - Cloudflare Workers environment bindings
 * @param ttl - Optional TTL for revocation record (defaults to token's remaining lifetime)
 * @returns Promise resolving to true if revocation succeeded
 *
 * @example
 * ```typescript
 * await revokeToken(token, env);
 * ```
 */
export async function revokeToken(
  token: string,
  env: Env,
  ttl?: number
): Promise<boolean> {
  const tokenId = getTokenId(token);
  if (!tokenId) {
    return false;
  }

  try {
    // Calculate TTL from token expiration if not provided
    let expirationTtl = ttl;
    if (expirationTtl === undefined) {
      // Import here to avoid circular dependency
      const { decodeToken } = await import('./jwt');
      try {
        const decoded = decodeToken(token);
        const now = Math.floor(Date.now() / 1000);
        expirationTtl = Math.max(0, decoded.payload.exp - now);
      } catch {
        // If we can't decode the token, use a default 7-day TTL
        expirationTtl = 604800;
      }
    }

    await env.SESSION_CACHE.put(`revoked:${tokenId}`, '1', {
      expirationTtl,
    });

    console.log(`[SECURITY] Token revoked: jti=${tokenId}`);
    return true;
  } catch (error) {
    console.error('[SECURITY] Token revocation failed:', error);
    return false;
  }
}

/**
 * Require authentication middleware
 *
 * Use this middleware to protect routes that require authentication.
 * Returns a 401 response if authentication fails, or the AuthResult if successful.
 *
 * @param request - The incoming HTTP request
 * @param env - Cloudflare Workers environment bindings
 * @returns Promise resolving to either a 401 Response or AuthResult
 *
 * @example
 * ```typescript
 * const auth = await requireAuth(request, env);
 * if (auth instanceof Response) {
 *   return auth; // 401 Unauthorized response
 * }
 * // auth is AuthResult - user is authenticated
 * console.log('User:', auth.studentId);
 * ```
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<Response | AuthResult> {
  const auth = await verifyAuth(request, env);

  if (!auth.authenticated) {
    // Map error codes to appropriate HTTP status codes
    const statusCodes: Record<string, number> = {
      NO_TOKEN: 401,
      INVALID_TOKEN: 401,
      REVOKED_TOKEN: 401,
      MISSING_SECRET: 500,
    };

    const statusCode = statusCodes[auth.error.code] ?? 401;

    return Response.json(
      {
        success: false,
        error: {
          code: auth.error.code,
          message: auth.error.message,
          ...(auth.error.code === 'INVALID_TOKEN' && { reason: auth.error.reason }),
        },
      },
      { status: statusCode }
    );
  }

  return auth.result;
}
