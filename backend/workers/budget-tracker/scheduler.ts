/**
 * End-of-Day Fill Knowledge Scheduler
 *
 * Cron-triggered worker that processes fill-knowledge tasks at the end
 * of each day to maximize free-tier value before budget resets.
 *
 * ## The Fill Knowledge Strategy
 *
 * When free-tier API credits are nearly exhausted but not empty:
 * 1. Switch to next provider for immediate user requests
 * 2. Queue "fill knowledge" tasks to use remaining budget
 * 3. Run tasks at end-of-day when they won't block users
 * 4. Benefits carry forward: better caching/embeddings = cheaper next day
 *
 * ## Task Types
 *
 * - **embedding**: Generate embeddings for knowledge base content
 * - **cache-warm**: Pre-generate responses for common queries
 * - **training-data**: Generate synthetic training data
 * - **summarization**: Summarize documents for faster retrieval
 * - **classification**: Classify content for better routing
 *
 * ## Scheduling
 *
 * - Cron trigger: 50 23 * * * (11:50 PM daily)
 * - Processes all pending tasks with scheduled_for <= now
 * - Tasks are ordered by priority (1 = highest)
 * - Failed tasks are retried up to max_retries
 *
 * @see types.ts for FillKnowledgeTask type definition
 */

import type { FillKnowledgeTask, FillKnowledgeTaskType } from './types';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // D1 Database
  DB: D1Database;

  // Budget tracker worker URL (for task processing callbacks)
  BUDGET_TRACKER_URL?: string;

  // Multi-model router URL (for generating embeddings, etc.)
  MULTI_MODEL_ROUTER_URL?: string;
}

// ============================================================================
// Task Processor Registry
// ============================================================================

/**
 * Task processor function type.
 *
 * Each task type has a processor that:
 * 1. Receives the task parameters
 * 2. Executes the work (e.g., generates embeddings)
 * 3. Returns the result and actual cost
 */
type TaskProcessor = (
  env: Env,
  task: FillKnowledgeTask
) => Promise<{ result: Record<string, unknown>; actualCost: number }>;

/**
 * Registry of task processors by type.
 *
 * Each processor uses the remaining free-tier budget to perform
 * knowledge expansion work that will reduce costs in the future.
 */
const TASK_PROCESSORS: Record<FillKnowledgeTaskType, TaskProcessor> = {
  /**
   * Generate embeddings for knowledge base content.
   *
   * This task processes un-indexed content and generates embeddings
   * using the provider's embedding model. The embeddings enable
   * semantic search, which:
   * - Reduces LLM calls (direct vector search instead)
   * - Improves response relevance
   * - Lowers future costs
   *
   * Parameters:
   * - contentIds: Array of content IDs to embed
   * - batchSize: Number of embeddings per batch
   */
  embedding: async (env, task) => {
    const params = task.parameters as {
      contentIds?: string[];
      batchSize?: number;
      limit?: number;
    };

    // Simulate embedding generation (actual implementation would call embedding API)
    const contentCount = params.limit || params.contentIds?.length || 100;
    const costPerEmbedding = 0.00001; // ~$0.01 per 1K embeddings
    const actualCost = contentCount * costPerEmbedding;

    // In production, this would:
    // 1. Fetch content from database
    // 2. Call embedding API via multi-model-router
    // 3. Store embeddings in vector store (Vectorize)
    // 4. Update content records with embedding IDs

    return {
      result: {
        taskType: 'embedding',
        contentProcessed: contentCount,
        embeddingDimension: 1536,
        vectorStoreUpdated: true,
      },
      actualCost,
    };
  },

  /**
   * Warm up response cache for common queries.
   *
   * This task identifies frequently-asked queries and pre-generates
   * responses using the current provider. The cached responses:
   * - Eliminate LLM calls for common questions
   * - Provide instant responses to users
   * - Reduce load on higher-tier providers
   *
   * Parameters:
   * - queryPatterns: Array of query patterns to cache
   * - timeWindow: Hours to look back for frequency analysis
   */
  'cache-warm': async (env, task) => {
    const params = {
      queryPatterns: [
        'explain how tokens work',
        'what is a neural network',
        'how does training work',
        'debug my code',
        'explain this error',
      ],
      ...task.parameters,
    };

    const queryCount = params.queryPatterns.length;
    const avgCostPerQuery = 0.001; // ~$0.001 per cached response
    const actualCost = queryCount * avgCostPerQuery;

    // In production, this would:
    // 1. Analyze query logs for frequent patterns
    // 2. Generate responses via multi-model-router
    // 3. Store in KV cache with appropriate TTL
    // 4. Track cache hit rates

    return {
      result: {
        taskType: 'cache-warm',
        queriesProcessed: queryCount,
        cacheEntriesCreated: queryCount,
        estimatedHitsPerDay: queryCount * 10,
      },
      actualCost,
    };
  },

  /**
   * Generate synthetic training data for fine-tuning.
   *
   * This task uses the remaining budget to generate training examples
   * that can be used for fine-tuning smaller models. Fine-tuned models:
   * - Can replace larger models for specific tasks
   * - Have lower inference costs
   * - Maintain quality for domain-specific tasks
   *
   * Parameters:
   * - taskType: Type of training data to generate
   * - examples: Number of examples to generate
   * - format: Output format (jsonl, json, etc.)
   */
  'training-data': async (env, task) => {
    const params = {
      taskType: 'code-completion',
      examples: 50,
      format: 'jsonl',
      ...task.parameters,
    };

    const costPerExample = 0.005; // ~$0.005 per synthetic example
    const actualCost = params.examples * costPerExample;

    // In production, this would:
    // 1. Use the provider to generate diverse examples
    // 2. Validate example quality
    // 3. Format for training pipeline
    // 4. Store in R2 for fine-tuning job

    return {
      result: {
        taskType: 'training-data',
        examplesGenerated: params.examples,
        format: params.format,
        outputLocation: `r2://training-data/${task.id}.jsonl`,
      },
      actualCost,
    };
  },

  /**
   * Summarize documents for faster retrieval.
   *
   * This task generates summaries of long documents that can be:
   * - Shown to users before they decide to use full context
   * - Used for semantic search instead of full documents
   * - Included as context to reduce token usage
   *
   * Parameters:
   * - documentIds: Array of document IDs to summarize
   * - summaryLength: Target word count
   */
  summarization: async (env, task) => {
    const params = {
      documentIds: [] as string[],
      summaryLength: 200,
      ...task.parameters,
    };

    const docCount = params.documentIds.length || 20;
    const costPerDoc = 0.002; // ~$0.002 per summary
    const actualCost = docCount * costPerDoc;

    // In production, this would:
    // 1. Fetch documents from database
    // 2. Generate summaries via multi-model-router
    // 3. Store summaries alongside documents
    // 4. Update search index

    return {
      result: {
        taskType: 'summarization',
        documentsProcessed: docCount,
        avgSummaryLength: params.summaryLength,
        compressionRatio: 0.1, // Summaries are ~10% of original
      },
      actualCost,
    };
  },

  /**
   * Classify content for better routing.
   *
   * This task classifies unclassified content using intent taxonomy.
 * Classified content enables:
   * - More accurate cascade routing
   * - Better provider selection
   * - Improved analytics
   *
   * Parameters:
   * - contentIds: Array of unclassified content IDs
   * - taxonomy: Classification taxonomy to use
   */
  classification: async (env, task) => {
    const params = {
      contentIds: [] as string[],
      taxonomy: 'intent',
      ...task.parameters,
    };

    const contentCount = params.contentIds.length || 100;
    const costPerClassification = 0.0005;
    const actualCost = contentCount * costPerClassification;

    // In production, this would:
    // 1. Fetch unclassified content
    // 2. Use first-mile-router for classification
    // 3. Store classifications in database
    // 4. Trigger cache invalidation for affected queries

    return {
      result: {
        taskType: 'classification',
        contentClassified: contentCount,
        taxonomy: params.taxonomy,
        confidenceDistribution: {
          high: 0.7,
          medium: 0.2,
          low: 0.1,
        },
      },
      actualCost,
    };
  },

  /**
   * Custom knowledge task.
   *
   * User-defined tasks for specific knowledge expansion needs.
   * Parameters and processing are fully customizable.
   */
  custom: async (env, task) => {
    // Custom tasks define their own processing logic
    // via the parameters object
    const cost = (task.parameters as { estimatedCost?: number }).estimatedCost || 0;

    return {
      result: {
        taskType: 'custom',
        customParameters: task.parameters,
      },
      actualCost: cost,
    };
  },
};

// ============================================================================
// Task Processing
// ============================================================================

/**
 * Process a single fill-knowledge task.
 *
 * Handles the complete lifecycle of a task:
 * 1. Marks task as 'running'
 * 2. Executes the appropriate processor
 * 3. Updates task with result and actual cost
 * 4. Marks as 'completed' or 'failed'
 * 5. Updates provider budget with actual cost
 *
 * @param env - Worker environment
 * @param task - Task to process
 * @returns Updated task
 */
async function processTask(env: Env, task: FillKnowledgeTask): Promise<FillKnowledgeTask> {
  const now = new Date().toISOString();

  // Mark as running
  await env.DB
    .prepare('UPDATE fill_knowledge_tasks SET status = ?, started_at = ?, updated_at = ? WHERE id = ?')
    .bind('running', now, now, task.id)
    .run();

  try {
    // Get the processor for this task type
    const processor = TASK_PROCESSORS[task.taskType];
    if (!processor) {
      throw new Error(`No processor found for task type: ${task.taskType}`);
    }

    // Execute the task
    const { result, actualCost } = await processor(env, task);

    // Update task with success result
    const completedAt = new Date().toISOString();
    await env.DB
      .prepare(`UPDATE fill_knowledge_tasks
        SET status = ?, actual_cost = ?, result = ?, completed_at = ?, updated_at = ?
        WHERE id = ?`)
      .bind('completed', actualCost, JSON.stringify(result), completedAt, completedAt, task.id)
      .run();

    // Update provider budget with actual cost
    await updateProviderBudget(env, task.userId, task.providerId, actualCost);

    return {
      ...task,
      status: 'completed',
      actualCost,
      result,
      startedAt: now,
      completedAt,
      updatedAt: completedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const completedAt = new Date().toISOString();

    // Check if we should retry
    const retryCount = task.retryCount + 1;
    const shouldRetry = retryCount <= task.maxRetries;

    await env.DB
      .prepare(`UPDATE fill_knowledge_tasks
        SET status = ?, error_message = ?, retry_count = ?, updated_at = ?
        WHERE id = ?`)
      .bind(shouldRetry ? 'pending' : 'failed', errorMessage, retryCount, completedAt, task.id)
      .run();

    return {
      ...task,
      status: shouldRetry ? 'pending' : 'failed',
      retryCount,
      errorMessage,
      updatedAt: completedAt,
    };
  }
}

/**
 * Update provider budget after task completion.
 *
 * Records the actual cost of a fill-knowledge task against
 * the provider's daily budget.
 *
 * @param env - Worker environment
 * @param userId - User ID
 * @param providerId - Provider ID
 * @param cost - Actual cost in USD
 */
async function updateProviderBudget(
  env: Env,
  userId: string,
  providerId: string,
  cost: number
): Promise<void> {
  // Update daily_used in provider_budgets
  await env.DB
    .prepare(`UPDATE provider_budgets
      SET daily_used = daily_used + ?, updated_at = ?
      WHERE user_id = ? AND provider_id = ?`)
    .bind(cost, new Date().toISOString(), userId, providerId)
    .run();

  // Record in usage_records for tracking
  await env.DB
    .prepare(`INSERT INTO usage_records (
      id, user_id, provider_id, model, input_tokens, output_tokens,
      cost, success, context, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      userId,
      providerId,
      `fill-knowledge-${crypto.randomUUID()}`,
      0,
      0,
      cost,
      1,
      'fill-knowledge-task',
      new Date().toISOString()
    )
    .run();
}

/**
 * Fetch pending tasks that are ready to process.
 *
 * Gets tasks where:
 * - status = 'pending'
 * - scheduled_for <= now
 * - Ordered by priority ASC, then scheduled_for ASC
 *
 * @param env - Worker environment
 * @returns Array of pending tasks
 */
async function fetchPendingTasks(env: Env): Promise<FillKnowledgeTask[]> {
  const now = new Date().toISOString();

  const result = await env.DB
    .prepare(`SELECT * FROM fill_knowledge_tasks
      WHERE status = ? AND scheduled_for <= ?
      ORDER BY priority ASC, scheduled_for ASC
      LIMIT 50`)
    .bind('pending', now)
    .all();

  return result.results.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    providerId: row.provider_id,
    taskType: row.task_type,
    priority: row.priority,
    estimatedCost: row.estimated_cost,
    parameters: JSON.parse(row.parameters || '{}'),
    status: row.status,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    actualCost: row.actual_cost,
    result: row.result ? JSON.parse(row.result) : undefined,
    errorMessage: row.error_message,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Main scheduler handler.
 *
 * Called by cron trigger to process pending fill-knowledge tasks.
 *
 * ## Cron Schedule
 *
 * Recommended: 50 23 * * * (11:50 PM daily)
 *
 * This runs 10 minutes before midnight to use remaining budget
 * before daily reset.
 */
export async function handleSchedule(env: Env): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
}> {
  const pendingTasks = await fetchPendingTasks(env);

  let succeeded = 0;
  let failed = 0;

  for (const task of pendingTasks) {
    const processed = await processTask(env, task);

    if (processed.status === 'completed') {
      succeeded++;
    } else if (processed.status === 'failed') {
      failed++;
    }
  }

  // Check for remaining pending tasks
  const remainingResult = await env.DB
    .prepare('SELECT COUNT(*) as count FROM fill_knowledge_tasks WHERE status = ?')
    .bind('pending')
    .first();

  const remaining = (remainingResult?.count as number) || 0;

  return {
    processed: pendingTasks.length,
    succeeded,
    failed,
    remaining,
  };
}

/**
 * Cloudflare Worker export for scheduled execution.
 *
 * Configure in wrangler.toml:
 * ```
 * [triggers]
 * crons = ["50 23 * * *"]
 * ```
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Fill Knowledge Scheduler] Running at:', new Date().toISOString());

    const result = await handleSchedule(env);

    console.log('[Fill Knowledge Scheduler] Results:', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      remaining: result.remaining,
    });

    // Log any failures for investigation
    if (result.failed > 0) {
      console.warn(`[Fill Knowledge Scheduler] ${result.failed} tasks failed`);
    }
  },
};
