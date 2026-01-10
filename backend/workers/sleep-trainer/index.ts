/**
 * Sleep Trainer Worker
 *
 * Implements "Sleep = Training Mode" where daily agent logs are batched
 * into embeddings, LoRA adapters are generated from journal entries, and
 * memory consolidation is simulated.
 *
 * Biological analogy: Just as sleep consolidates memories in biological brains,
 * this worker processes daily agent activity to create fine-tuned adapters.
 *
 * Deploy to: wrangler publish
 */

import { Router } from 'itty-router';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // Vectorize for embeddings storage
  VECTORIZE: VectorizeIndex;

  // D1 for journal entries and training data
  DB: D1Database;

  // R2 for LoRA weight storage
  R2: R2Bucket;

  // Hugging Face API for LoRA training
  HF_API_KEY?: string;

  // Embedding model API
  OPENAI_API_KEY?: string;
}

// ============================================================================
// Types
// ============================================================================

interface JournalEntry {
  userId: string;
  agentId: string;
  timestamp: number;
  entry: string;
  mood?: number;
  context?: Record<string, unknown>;
}

interface ConsolidationResult {
  userId: string;
  date: string;
  embeddingsCreated: number;
  loraTrained: boolean;
  loraPath?: string;
  memoriesConsolidated: number;
}

interface Memory {
  id: string;
  userId: string;
  agentId: string;
  content: string;
  embedding: number[];
  importance: number;
  lastAccessed: number;
  accessCount: number;
}

interface LoRAConfig {
  agentId: string;
  rank: number;
  alpha: number;
  dropout: number;
  epochs: number;
  batchSize: number;
}

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

router.options('*', () => new Response(null, { headers: corsHeaders }));

// ============================================================================
// Routes
// ============================================================================

// Health check
router.get('/', () => {
  return new Response(
    JSON.stringify({ status: 'sleeping', service: 'sleep-trainer', message: 'Processing agent dreams...' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

// Trigger sleep mode for a user
router.post('/sleep/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400 });
  }

  try {
    const result = await performSleepCycle(env, userId);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});

// Add journal entry
router.post('/journal', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as Omit<JournalEntry, 'timestamp'>;

  const entry: JournalEntry = {
    ...body,
    timestamp: Date.now(),
  };

  await env.DB
    .prepare('INSERT INTO journal_entries (user_id, agent_id, timestamp, entry, mood, context) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(entry.userId, entry.agentId, entry.timestamp, entry.entry, entry.mood ?? 0, JSON.stringify(entry.context ?? {}))
    .run();

  return new Response(JSON.stringify({ success: true, entry }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get agent memories
router.get('/memories/:userId/:agentId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;
  const agentId = req.param?.agentId;

  // Query Vectorize for similar memories
  const memories = await env.VECTORIZE.query([], {
    namespace: `${userId}-${agentId}`,
    topK: 50,
  });

  return new Response(JSON.stringify({ memories }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Search memories by semantic similarity
router.post('/search', async (req) => {
  const env = req.env as Env;
  const body = await req.json();

  const { userId, agentId, query, topK = 10 } = body as { userId: string; agentId: string; query: string; topK?: number };

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(env, query);

  // Search Vectorize
  const results = await env.VECTORIZE.query(queryEmbedding, {
    namespace: `${userId}-${agentId}`,
    topK,
  });

  // Update access stats for returned memories
  for (const match of results.matches || []) {
    await env.DB.prepare('UPDATE memories SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?')
      .bind(Date.now(), match.id)
      .run();
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get LoRA adapter info
router.get('/lora/:userId/:agentId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;
  const agentId = req.param?.agentId;

  const result = await env.DB
    .prepare('SELECT * FROM lora_adapters WHERE user_id = ? AND agent_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(userId, agentId)
    .first();

  return new Response(JSON.stringify({ adapter: result }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// ============================================================================
// Sleep Cycle Implementation
// ============================================================================

async function performSleepCycle(env: Env, userId: string): Promise<ConsolidationResult> {
  const date = new Date().toISOString().split('T')[0];
  let embeddingsCreated = 0;
  let memoriesConsolidated = 0;
  let loraPath: string | undefined;

  // 1. Fetch today's journal entries
  const entries = await fetchJournalEntries(env, userId, date);

  // 2. Process entries into embeddings
  for (const entry of entries) {
    const embedding = await generateEmbedding(env, entry.entry);

    // Store in Vectorize
    await env.VECTORIZE.upsert([
      {
        id: `memory-${entry.agentId}-${entry.timestamp}`,
        values: embedding,
        metadata: {
          userId,
          agentId: entry.agentId,
          content: entry.entry,
          timestamp: entry.timestamp,
          mood: entry.mood ?? 0,
        },
      },
    ]);

    // Also store in D1 for metadata
    await env.DB
      .prepare('INSERT INTO memories (id, user_id, agent_id, content, importance, last_accessed, access_count) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(`memory-${entry.agentId}-${entry.timestamp}`, userId, entry.agentId, entry.entry, calculateImportance(entry), Date.now(), 0)
      .run();

    embeddingsCreated++;
  }

  // 3. Consolidate memories (forget unimportant ones)
  const forgotten = await consolidateMemories(env, userId);
  memoriesConsolidated = forgotten;

  // 4. Train LoRA if enough data
  const entriesByAgent = groupByAgent(entries);
  for (const [agentId, agentEntries] of Object.entries(entriesByAgent)) {
    if (agentEntries.length >= 10) {
      // Minimum entries for training
      loraPath = await trainLoRA(env, userId, agentId, agentEntries);
    }
  }

  return {
    userId,
    date,
    embeddingsCreated,
    loraTrained: !!loraPath,
    loraPath,
    memoriesConsolidated,
  };
}

async function fetchJournalEntries(env: Env, userId: string, date: string): Promise<JournalEntry[]> {
  const startOfDay = new Date(date).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  const result = await env.DB
    .prepare('SELECT * FROM journal_entries WHERE user_id = ? AND timestamp >= ? AND timestamp < ?')
    .bind(userId, startOfDay, endOfDay)
    .all();

  return (result.results || []).map((row: any) => ({
    userId: row.user_id,
    agentId: row.agent_id,
    timestamp: row.timestamp,
    entry: row.entry,
    mood: row.mood,
    context: JSON.parse(row.context || '{}'),
  }));
}

async function generateEmbedding(env: Env, text: string): Promise<number[]> {
  // Use OpenAI or similar for embeddings
  if (env.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data[0].embedding;
    }
  }

  // Fallback: simple hash-based embedding (not production quality)
  return simpleHashEmbedding(text);
}

function simpleHashEmbedding(text: string): number[] {
  // Very simple fallback embedding - replace with real embedding service
  const embedding = new Array(384).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    embedding[i % 384] = (hash & 0xffff) / 0xffff;
  }
  return embedding;
}

function calculateImportance(entry: JournalEntry): number {
  // Calculate importance based on multiple factors
  let importance = 0.5;

  // Mood extremity increases importance
  if (entry.mood !== undefined) {
    importance += Math.abs(entry.mood) * 0.3;
  }

  // Length matters (longer entries = more detail)
  importance += Math.min(entry.entry.length / 1000, 0.2);

  return Math.min(importance, 1.0);
}

async function consolidateMemories(env: Env, userId: string): Promise<number> {
  // Forget memories that are:
  // 1. Old (>30 days)
  // 2. Low importance (<0.3)
  // 3. Rarely accessed (<3 times)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const result = await env.DB
    .prepare(
      'DELETE FROM memories WHERE user_id = ? AND created_at < ? AND importance < 0.3 AND access_count < 3 RETURNING id'
    )
    .bind(userId, thirtyDaysAgo)
    .all();

  const forgottenIds = (result.results || []).map((r: any) => r.id);

  // Also remove from Vectorize
  for (const id of forgottenIds) {
    await env.VECTORIZE.deleteByIds([id]);
  }

  return forgottenIds.length;
}

function groupByAgent(entries: JournalEntry[]): Record<string, JournalEntry[]> {
  const grouped: Record<string, JournalEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.agentId]) {
      grouped[entry.agentId] = [];
    }
    grouped[entry.agentId].push(entry);
  }
  return grouped;
}

async function trainLoRA(
  env: Env,
  userId: string,
  agentId: string,
  entries: JournalEntry[]
): Promise<string> {
  // Prepare training data
  const trainingData = entries
    .map((e) => {
      // Format as instruction/response pairs
      return {
        instruction: getContextForEntry(e),
        input: '',
        output: e.entry,
      };
    })
    .filter((d) => d.instruction); // Only include entries with clear context

  if (trainingData.length < 5) {
    return ''; // Not enough training data
  }

  // Create JSONL for training
  const jsonl = trainingData.map((d) => JSON.stringify(d)).join('\n');

  // Upload to R2
  const datasetKey = `training/${userId}/${agentId}/${Date.now()}.jsonl`;
  await env.R2.put(datasetKey, jsonl, {
    customMetadata: {
      contentType: 'application/jsonl',
      agentId,
      userId,
    },
  });

  // In production, this would trigger Hugging Face training or similar
  // For now, we'll create a record of the "trained" adapter
  const loraId = `lora-${userId}-${agentId}-${Date.now()}`;

  await env.DB
    .prepare('INSERT INTO lora_adapters (id, user_id, agent_id, dataset_path, rank, alpha, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(loraId, userId, agentId, datasetKey, 8, 16, Date.now())
    .run();

  return `r2://${datasetKey}`;
}

function getContextForEntry(entry: JournalEntry): string {
  // Infer instruction context from entry content
  const context = entry.context || {};
  if (typeof context === 'object' && 'task' in context) {
    return String(context.task);
  }
  if (entry.entry.includes('I think')) {
    return 'What are your thoughts on this situation?';
  }
  if (entry.entry.includes('I did') || entry.entry.includes('I completed')) {
    return 'What did you accomplish?';
  }
  return 'Respond naturally to the following:';
}

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router.handle(request, env, ctx).catch((err) => {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    });
  },
};
