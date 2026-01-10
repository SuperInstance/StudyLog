/**
 * Bazaar Worker - Community marketplace for creations
 *
 * Features:
 * - Share creations (simulations, puzzles, agents, extensions)
 * - Like/comment system
 * - Fork/merge flow
 * - Fuse Grade verification (quality levels 1-4)
 * - Grain token rewards
 */

// Simple ID generator (nano-id replacement for Cloudflare Workers)
function nanoid(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface Creation {
  id: string;
  author_id: string;
  title: string;
  description?: string;
  type: 'simulation' | 'puzzle' | 'agent' | 'extension' | 'godot-scene';
  millfile?: string;
  content_hash?: string;
  storage_path?: string;
  quality: number;  // 1-4 Fuse Grade
  is_public: boolean;
  forks_count: number;
  likes_count: number;
  comments_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  student_id: string;
  bio?: string;
  reputation: number;
  grain_tokens: number;
  creations_shared: number;
  forks_made: number;
  quality_verifications: number;
  created_at: string;
  updated_at: string;
}

export interface Fork {
  id: string;
  parent_id: string;
  child_id: string;
  forker_id: string;
  merged: boolean;
  merge_requested_at?: string;
  merged_at?: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  creation_id: string;
  user_id: string;
  type: 'like' | 'comment' | 'verification' | 'fork';
  content?: string;
  grain_tokens: number;
  created_at: string;
}

export interface MergeRequest {
  id: string;
  fork_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  title?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

// ═══════════════════════════════════════════════════════════
// Millfile Parser (TOML format)
// ═══════════════════════════════════════════════════════════

export interface Millfile {
  meta: {
    title: string;
    author: string;
    description?: string;
    quality: number;
  };
  simulation?: {
    godot_version?: string;
    scene?: string;
    components?: string[];
  };
  ai?: {
    model_used?: string;
    work_ratio?: number;
    verified?: boolean;
  };
  permissions?: {
    fork_enabled?: boolean;
    merge_enabled?: boolean;
    commercial_use?: boolean;
  };
}

/**
 * Simple TOML parser for Millfile format
 * Note: For production, use a proper TOML library
 */
export function parseMillfile(toml: string): Millfile {
  const result: Record<string, Record<string, any>> = {};
  const lines = toml.split('\n');
  let currentSection: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Section header
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (currentSection && !result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key value pair
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch && currentSection !== undefined) {
      const key = kvMatch[1];
      const value = kvMatch[2];
      if (!value) continue;
      let parsedValue: any = value.trim().replace(/^["']|["']$/g, '');

      // Parse numbers and booleans
      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      else if (!isNaN(Number(parsedValue))) parsedValue = Number(parsedValue);
      else if (parsedValue.startsWith('[')) {
        try {
          parsedValue = JSON.parse(parsedValue);
        } catch {
          // Keep as string if JSON parse fails
        }
      }

      if (currentSection !== undefined && key !== undefined) {
        const section = result[currentSection];
        if (section) {
          section[key] = parsedValue;
        }
      }
    }
  }

  return result as unknown as Millfile;
}

/**
 * Generate TOML from Millfile object
 */
export function stringifyMillfile(millfile: Millfile): string {
  const lines: string[] = [];

  for (const [section, data] of Object.entries(millfile)) {
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        lines.push(`${key} = "${value}"`);
      } else if (typeof value === 'boolean') {
        lines.push(`${key} = ${value ? 'true' : 'false'}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key} = ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key} = ${value}`);
      }
    }
    lines.push('');  // blank line between sections
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════
// Bazaar Service - API handlers
// ═══════════════════════════════════════════════════════════

export class BazaarService {
  constructor(private db: D1Database, _r2: R2Bucket) {}

  /**
   * Get or create user profile
   */
  async getUserProfile(studentId: string): Promise<UserProfile | null> {
    let profile = await this.db.prepare(
      'SELECT * FROM user_profiles WHERE student_id = ?'
    ).bind(studentId).first();

    // Create profile if doesn't exist
    if (!profile) {
      const id = nanoid();
      await this.db.prepare(
        'INSERT INTO user_profiles (id, student_id) VALUES (?, ?)'
      ).bind(id, studentId).run();

      profile = {
        id,
        student_id: studentId,
        reputation: 0,
        grain_tokens: 0,
        creations_shared: 0,
        forks_made: 0,
        quality_verifications: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return profile as unknown as UserProfile;
  }

  /**
   * Browse creations with filters
   */
  async browseCreations(options: {
    type?: string;
    quality?: number;
    author_id?: string;
    limit?: number;
    offset?: number;
    sort?: 'created' | 'likes' | 'downloads' | 'quality';
  } = {}): Promise<{ creations: Creation[]; total: number }> {
    const { type, quality, author_id, limit = 20, offset = 0, sort = 'created' } = options;

    let query = 'SELECT * FROM creations WHERE is_public = 1';
    const params: any[] = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (quality) {
      query += ' AND quality >= ?';
      params.push(quality);
    }
    if (author_id) {
      query += ' AND author_id = ?';
      params.push(author_id);
    }

    // Sorting
    const sortColumn = sort === 'likes' ? 'likes_count' :
                       sort === 'downloads' ? 'downloads_count' :
                       sort === 'quality' ? 'quality' : 'created_at';
    query += ` ORDER BY ${sortColumn} DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const creations = await this.db.prepare(query).bind(...params).all();

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM creations WHERE is_public = 1';
    const countParams: any[] = [];
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    if (quality) {
      countQuery += ' AND quality >= ?';
      countParams.push(quality);
    }
    if (author_id) {
      countQuery += ' AND author_id = ?';
      countParams.push(author_id);
    }

    const countResult = await this.db.prepare(countQuery).bind(...countParams).first();

    return {
      creations: (creations.results || []) as unknown as Creation[],
      total: (countResult?.count as number) || 0
    };
  }

  /**
   * Get single creation by ID
   */
  async getCreation(id: string): Promise<Creation | null> {
    const creation = await this.db.prepare(
      'SELECT * FROM creations WHERE id = ?'
    ).bind(id).first();

    return (creation as unknown as Creation) || null;
  }

  /**
   * Create a new creation
   */
  async createCreation(data: {
    author_id: string;
    title: string;
    description?: string | null;
    type: Creation['type'];
    millfile?: string | null;
    storage_path?: string | null;
  }): Promise<Creation> {
    const id = nanoid();
    const millfileObj = data.millfile ? parseMillfile(data.millfile) : null;

    await this.db.prepare(`
      INSERT INTO creations (
        id, author_id, title, description, type, millfile,
        storage_path, quality, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      id,
      data.author_id,
      data.title,
      data.description ?? null,
      data.type,
      data.millfile ?? null,
      data.storage_path ?? null,
      millfileObj?.meta?.quality ?? 1
    ).run();

    // Update user profile stats
    await this.db.prepare(`
      UPDATE user_profiles
      SET creations_shared = creations_shared + 1, updated_at = datetime('now')
      WHERE student_id = ?
    `).bind(data.author_id).run();

    return (await this.getCreation(id))!;
  }

  /**
   * Fork a creation
   */
  async forkCreation(parentId: string, forkerId: string, title: string): Promise<Creation> {
    const parent = await this.getCreation(parentId);
    if (!parent) {
      throw new Error('Creation not found');
    }

    // Check if already forked
    const existingFork = await this.db.prepare(`
      SELECT child_id FROM forks WHERE parent_id = ? AND forker_id = ?
    `).bind(parentId, forkerId).first();

    if (existingFork) {
      return (await this.getCreation(existingFork.child_id as string))!;
    }

    // Create new creation (the fork)
    const fork = await this.createCreation({
      author_id: forkerId,
      title: title ?? `${parent.title} (fork)`,
      description: parent.description ?? null,
      type: parent.type,
      millfile: parent.millfile ?? null,
      storage_path: parent.storage_path ?? null
    });

    // Create fork relationship
    const forkId = nanoid();
    await this.db.prepare(`
      INSERT INTO forks (id, parent_id, child_id, forker_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(forkId, parentId, fork.id, forkerId).run();

    // Update parent's fork count
    await this.db.prepare(`
      UPDATE creations SET forks_count = forks_count + 1 WHERE id = ?
    `).bind(parentId).run();

    // Update forker's profile
    await this.db.prepare(`
      UPDATE user_profiles
      SET forks_made = forks_made + 1, updated_at = datetime('now')
      WHERE student_id = ?
    `).bind(forkerId).run();

    // Record as feedback type
    await this.addFeedback({
      creation_id: parentId,
      user_id: forkerId,
      type: 'fork'
    });

    return fork;
  }

  /**
   * Add feedback (like, comment, verification)
   */
  async addFeedback(data: {
    creation_id: string;
    user_id: string;
    type: 'like' | 'comment' | 'verification' | 'fork';
    content?: string;
  }): Promise<Feedback> {
    // Check if already exists
    const existing = await this.db.prepare(`
      SELECT id FROM feedback WHERE creation_id = ? AND user_id = ? AND type = ?
    `).bind(data.creation_id, data.user_id, data.type).first();

    if (existing) {
      throw new Error('Feedback already exists');
    }

    const id = nanoid();
    await this.db.prepare(`
      INSERT INTO feedback (id, creation_id, user_id, type, content, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(id, data.creation_id, data.user_id, data.type, data.content || null).run();

    // Update creation counters
    if (data.type === 'like') {
      await this.db.prepare(`
        UPDATE creations SET likes_count = likes_count + 1 WHERE id = ?
      `).bind(data.creation_id).run();
    } else if (data.type === 'comment') {
      await this.db.prepare(`
        UPDATE creations SET comments_count = comments_count + 1 WHERE id = ?
      `).bind(data.creation_id).run();
    }

    // Award grain tokens for quality feedback
    const tokens = data.type === 'verification' ? 5 :
                   data.type === 'comment' ? 2 : 1;

    await this.db.prepare(`
      UPDATE user_profiles
      SET grain_tokens = grain_tokens + ?, reputation = reputation + ?
      WHERE student_id = ?
    `).bind(tokens, tokens, data.user_id).run();

    return (await this.db.prepare(
      'SELECT * FROM feedback WHERE id = ?'
    ).bind(id).first()) as Feedback;
  }

  /**
   * Create merge request
   */
  async createMergeRequest(data: {
    fork_id: string;
    title?: string;
    description?: string;
  }): Promise<MergeRequest> {
    const id = nanoid();

    await this.db.prepare(`
      INSERT INTO merge_requests (id, fork_id, title, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).bind(id, data.fork_id, data.title || null, data.description || null).run();

    // Update fork
    await this.db.prepare(`
      UPDATE forks SET merge_requested_at = datetime('now') WHERE id = ?
    `).bind(data.fork_id).run();

    return (await this.db.prepare(
      'SELECT * FROM merge_requests WHERE id = ?'
    ).bind(id).first()) as MergeRequest;
  }

  /**
   * Update Fuse Grade (quality level)
   */
  async updateQuality(creationId: string, quality: number): Promise<void> {
    if (quality < 1 || quality > 4) {
      throw new Error('Quality must be between 1 and 4');
    }

    await this.db.prepare(`
      UPDATE creations SET quality = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(quality, creationId).run();
  }
}

// ═══════════════════════════════════════════════════════════
// Request Handlers
// ═══════════════════════════════════════════════════════════

export interface BazaarEnv {
  STUDENT_STATE: D1Database;
  PROJECT_STORAGE: R2Bucket;
}

export async function handleBazaarRequest(
  request: Request,
  env: BazaarEnv,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1/bazaar', '');
  const method = request.method;

  const bazaar = new BazaarService(env.STUDENT_STATE, env.PROJECT_STORAGE);

  // CORS
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  try {
    // GET /creations - Browse creations
    if (path === '/creations' && method === 'GET') {
      const typeParam = url.searchParams.get('type');
      const qualityParam = url.searchParams.get('quality');
      const author_idParam = url.searchParams.get('author_id');
      const limitParam = url.searchParams.get('limit');
      const offsetParam = url.searchParams.get('offset');
      const sortParam = url.searchParams.get('sort');

      const browseOptions: {
        type?: string;
        quality?: number;
        author_id?: string;
        limit: number;
        offset: number;
        sort?: 'created' | 'likes' | 'downloads' | 'quality';
      } = {
        limit: limitParam ? parseInt(limitParam) : 20,
        offset: offsetParam ? parseInt(offsetParam) : 0,
      };
      if (typeParam !== null) browseOptions.type = typeParam;
      if (qualityParam !== null) browseOptions.quality = parseInt(qualityParam);
      if (author_idParam !== null) browseOptions.author_id = author_idParam;
      if (sortParam !== null) browseOptions.sort = sortParam as 'created' | 'likes' | 'downloads' | 'quality';

      const result = await bazaar.browseCreations(browseOptions);

      return Response.json(result);
    }

    // GET /creations/:id - Get single creation
    if (path.match(/^\/creations\/[^/]+$/) && method === 'GET') {
      const id = path.split('/').pop();
      if (!id) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const creation = await bazaar.getCreation(id);

      if (!creation) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }

      return Response.json(creation);
    }

    // POST /creations - Create creation
    if (path === '/creations' && method === 'POST') {
      const data = await request.json() as {
        title: string;
        description?: string;
        type: Creation['type'];
        millfile?: string;
        storage_path?: string;
      };
      // In real app, get user_id from auth token
      const author_id = request.headers.get('X-User-Id') || 'demo-user';

      const creation = await bazaar.createCreation({
        ...data,
        author_id
      });

      return Response.json(creation, { status: 201 });
    }

    // POST /creations/:id/fork - Fork creation
    if (path.match(/\/creations\/[^/]+\/fork/) && method === 'POST') {
      const parts = path.split('/');
      const id = parts[2];
      if (!id) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const data = await request.json() as { title?: string };
      const forkerId = request.headers.get('X-User-Id') || 'demo-user';

      const fork = await bazaar.forkCreation(id, forkerId, data.title ?? '');

      return Response.json(fork, { status: 201 });
    }

    // POST /creations/:id/feedback - Add feedback
    if (path.match(/\/creations\/[^/]+\/feedback/) && method === 'POST') {
      const parts = path.split('/');
      const id = parts[2];
      if (!id) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const data = await request.json() as { type?: string; content?: string };
      const userId = request.headers.get('X-User-Id') || 'demo-user';

      const feedbackData: {
        creation_id: string;
        user_id: string;
        type: 'like' | 'comment' | 'verification' | 'fork';
        content?: string;
      } = {
        creation_id: id,
        user_id: userId,
        type: ((data.type as any) ?? 'like') as 'like' | 'comment' | 'verification' | 'fork',
      };
      if (data.content !== undefined) {
        feedbackData.content = data.content;
      }

      const feedback = await bazaar.addFeedback(feedbackData);

      return Response.json(feedback, { status: 201 });
    }

    // GET /profile/:id - Get user profile
    if (path.match(/^\/profile\/[^/]+$/) && method === 'GET') {
      const studentId = path.split('/').pop();
      if (!studentId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const profile = await bazaar.getUserProfile(studentId);

      if (!profile) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }

      return Response.json(profile);
    }

    // POST /merge-requests - Create merge request
    if (path === '/merge-requests' && method === 'POST') {
      const data = await request.json() as {
        fork_id: string;
        title?: string;
        description?: string;
      };
      const mr = await bazaar.createMergeRequest(data);

      return Response.json(mr, { status: 201 });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });

  } catch (error: any) {
    return Response.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
