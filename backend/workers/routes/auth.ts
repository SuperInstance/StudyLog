/**
 * StudyLoG.AI Backend - Authentication Routes
 *
 * SECURITY: This module handles user authentication using JWT tokens.
 * - Passwords are hashed using SHA-256 with a salt (consider upgrading to bcrypt/argon2)
 * - JWT tokens are signed with HMAC-SHA256 using JWT_SECRET
 * - Tokens include expiration, not-before, and revocation support
 *
 * TODO: Upgrade password hashing to bcrypt/argon2 for production use.
 * The current SHA-256 implementation is vulnerable to rainbow table attacks
 * if the salt is compromised. Use Web Crypto API's PBKDF2 or a dedicated library.
 */

import { Router } from '../router';
import type { Env } from '../types';
import { createAuthToken, revokeToken } from '../middleware';

export const authRoutes = new Router();

// POST /register - Create new account
authRoutes.post('/register', async (request, env: Env) => {
  try {
    const body = await request.json() as {
      email: string;
      password: string;
      displayName: string;
    };

    const { email, password, displayName } = body;

    if (!email || !password || !displayName) {
      return Response.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_EMAIL', message: 'Invalid email format' } },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      return Response.json(
        { success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    // Check if email exists
    const existing = await env.STUDENT_STATE.prepare(
      'SELECT id FROM students WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return Response.json(
        { success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create student
    const id = crypto.randomUUID();
    await env.STUDENT_STATE.prepare(`
      INSERT INTO students (id, email, password_hash, display_name)
      VALUES (?, ?, ?, ?)
    `).bind(id, email, passwordHash, displayName).run();

    // Initialize with player phase
    await env.STUDENT_STATE.prepare(`
      INSERT INTO learner_phases (id, student_id, phase)
      VALUES (?, ?, 'player')
    `).bind(crypto.randomUUID(), id).run();

    // Create JWT token with 7-day expiration
    const token = await createAuthToken(id, env, {
      roles: ['student'],
      tier: 'free',
      expiresIn: 86400 * 7, // 7 days
    });

    return Response.json({
      success: true,
      data: {
        token,
        student: { id, email, displayName, tier: 'free' },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { success: false, error: { code: 'REGISTRATION_FAILED', message: 'Registration failed' } },
      { status: 500 }
    );
  }
});

// POST /login - Authenticate
authRoutes.post('/login', async (request, env) => {
  try {
    const body = await request.json() as { email: string; password: string };
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Missing email or password' } },
        { status: 400 }
      );
    }

    // Find student
    const student = await env.STUDENT_STATE.prepare(`
      SELECT id, email, display_name, password_hash, tier
      FROM students WHERE email = ?
    `).bind(email).first<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      tier: string;
    }>();

    if (!student) {
      // Use generic error message to prevent username enumeration
      return Response.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, student.password_hash);
    if (!valid) {
      // Use generic error message to prevent username enumeration
      return Response.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Update last login
    await env.STUDENT_STATE.prepare(`
      UPDATE students SET last_login_at = datetime('now') WHERE id = ?
    `).bind(student.id).run();

    // Create JWT token with user's tier and 7-day expiration
    const token = await createAuthToken(student.id, env, {
      roles: ['student'],
      tier: student.tier,
      expiresIn: 86400 * 7, // 7 days
    });

    return Response.json({
      success: true,
      data: {
        token,
        student: {
          id: student.id,
          email: student.email,
          displayName: student.display_name,
          tier: student.tier,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { success: false, error: { code: 'LOGIN_FAILED', message: 'Login failed' } },
      { status: 500 }
    );
  }
});

// POST /logout - End session
authRoutes.post('/logout', async (request, env) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Revoke the JWT token by adding it to the revocation cache
    await revokeToken(token, env);
  }

  return Response.json({ success: true });
});

// GET /me - Get current user
authRoutes.get('/me', async (request, env) => {
  const { verifyAuth } = await import('../middleware');
  const auth = await verifyAuth(request, env);

  if (!auth.authenticated) {
    return Response.json(
      { success: false, error: { code: auth.error.code, message: auth.error.message } },
      { status: auth.error.code === 'MISSING_SECRET' ? 500 : 401 }
    );
  }

  const student = await env.STUDENT_STATE.prepare(`
    SELECT id, email, display_name, tier, created_at
    FROM students WHERE id = ?
  `).bind(auth.result.studentId).first();

  if (!student) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: { student } });
});

// Simple password hashing (use bcrypt/argon2 in production)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'studylog-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}
