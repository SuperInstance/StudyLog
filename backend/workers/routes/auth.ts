/**
 * StudyLoG.AI Backend - Authentication Routes
 */

import { Router } from '../router';
import type { Env } from '../types';

export const authRoutes = new Router();

// POST /register - Create new account
authRoutes.post('/register', async (request, env) => {
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

    // Hash password (in production, use proper bcrypt/argon2)
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

    // Create session token
    const token = crypto.randomUUID();
    await env.SESSION_CACHE.put(
      `session:${token}`,
      JSON.stringify({ studentId: id }),
      { expirationTtl: 86400 * 7 } // 7 days
    );

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
      return Response.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, student.password_hash);
    if (!valid) {
      return Response.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Update last login
    await env.STUDENT_STATE.prepare(`
      UPDATE students SET last_login_at = datetime('now') WHERE id = ?
    `).bind(student.id).run();

    // Create session
    const token = crypto.randomUUID();
    await env.SESSION_CACHE.put(
      `session:${token}`,
      JSON.stringify({ studentId: student.id }),
      { expirationTtl: 86400 * 7 }
    );

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
    await env.SESSION_CACHE.delete(`session:${token}`);
  }

  return Response.json({ success: true });
});

// GET /me - Get current user
authRoutes.get('/me', async (request, env) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const session = await env.SESSION_CACHE.get(`session:${token}`);

  if (!session) {
    return Response.json(
      { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } },
      { status: 401 }
    );
  }

  const { studentId } = JSON.parse(session);
  const student = await env.STUDENT_STATE.prepare(`
    SELECT id, email, display_name, tier, created_at
    FROM students WHERE id = ?
  `).bind(studentId).first();

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
