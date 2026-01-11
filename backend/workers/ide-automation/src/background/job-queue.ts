/**
 * Background Job Queue
 *
 * Manages async background jobs with progress tracking,
 * cancellation, and pausing support.
 */

import type {
  BackgroundJob,
  JobStatus,
  QueueEntry,
  CancellationRequest,
  PauseRequest,
  ProgressNotification,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';

// ============================================================================
// Job Queue
// ============================================================================

export class JobQueue {
  private readonly jobs = new Map<string, BackgroundJob>();
  private readonly queue: QueueEntry[] = [];
  private readonly activeExecutions = new Map<string, AbortController>();

  constructor(
    private readonly env: IDEAutomationEnv,
    private readonly maxConcurrent = 3
  ) {}

  /**
   * Enqueue a job
   */
  async enqueue(
    userId: string,
    type: string,
    params: Record<string, unknown>,
    options: {
      priority?: number;
      scheduledAt?: number;
      dependencies?: string[];
    } = {}
  ): Promise<BackgroundJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const job: BackgroundJob = {
      id: jobId,
      userId,
      type,
      params,
      status: 'queued',
      progress: 0,
      createdAt: now,
    };

    // Store job
    this.jobs.set(jobId, job);
    await this.persistJob(job);

    // Add to queue
    const entry: QueueEntry = {
      id: jobId,
      priority: options.priority || 0,
      scheduledAt: options.scheduledAt || now,
      dependencies: options.dependencies || [],
      maxRetries: 3,
      retryCount: 0,
    };

    this.insertSorted(entry);

    // Try to execute
    this.processQueue();

    return job;
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<BackgroundJob | null> {
    // Check memory first
    const memJob = this.jobs.get(jobId);
    if (memJob) {
      return memJob;
    }

    // Check D1
    const result = await this.env.IDE_STATE
      .prepare(`SELECT data FROM background_jobs WHERE id = ?`)
      .bind(jobId)
      .first();

    if (!result) {
      return null;
    }

    const job = JSON.parse(result.data as string) as BackgroundJob;
    this.jobs.set(jobId, job);

    return job;
  }

  /**
   * Cancel a job
   */
  async cancel(request: CancellationRequest): Promise<boolean> {
    const job = await this.getStatus(request.jobId);
    if (!job) {
      return false;
    }

    // Verify ownership
    if (job.userId !== request.userId) {
      throw new Error('Unauthorized');
    }

    // If running, abort the controller
    const controller = this.activeExecutions.get(request.jobId);
    if (controller) {
      if (request.force) {
        controller.abort();
      }
    }

    // Update status
    job.status = 'cancelled';
    job.completedAt = Date.now();

    await this.persistJob(job);

    // Remove from active executions
    this.activeExecutions.delete(request.jobId);

    // Remove from queue
    const queueIndex = this.queue.findIndex(e => e.id === request.jobId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    return true;
  }

  /**
   * Pause a job
   */
  async pause(request: PauseRequest): Promise<boolean> {
    const job = await this.getStatus(request.jobId);
    if (!job) {
      return false;
    }

    // Verify ownership
    if (job.userId !== request.userId) {
      throw new Error('Unauthorized');
    }

    // Only running jobs can be paused
    if (job.status !== 'running') {
      return false;
    }

    // Abort current execution
    const controller = this.activeExecutions.get(request.jobId);
    if (controller) {
      controller.abort();
    }

    // Update status
    job.status = 'paused';
    await this.persistJob(job);

    return true;
  }

  /**
   * Resume a paused job
   */
  async resume(jobId: string, userId: string): Promise<boolean> {
    const job = await this.getStatus(jobId);
    if (!job || job.userId !== userId) {
      return false;
    }

    if (job.status !== 'paused') {
      return false;
    }

    // Re-queue the job
    job.status = 'queued';
    await this.persistJob(job);

    const entry: QueueEntry = {
      id: jobId,
      priority: 0,
      scheduledAt: Date.now(),
      dependencies: [],
      maxRetries: 3,
      retryCount: job.progress > 0 ? 1 : 0,
    };

    this.insertSorted(entry);
    this.processQueue();

    return true;
  }

  /**
   * List user's jobs
   */
  async listJobs(
    userId: string,
    status?: JobStatus,
    limit = 20
  ): Promise<BackgroundJob[]> {
    let query = `SELECT data FROM background_jobs WHERE user_id = ?`;
    const params: unknown[] = [userId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const result = await this.env.IDE_STATE
      .prepare(query)
      .bind(...params)
      .all();

    return (result.results || []).map((row: any) => JSON.parse(row.data) as BackgroundJob);
  }

  /**
   * Update job progress
   */
  async updateProgress(
    jobId: string,
    progress: number,
    statusMessage?: string
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.progress = Math.max(0, Math.min(100, progress));
    if (statusMessage) {
      job.statusMessage = statusMessage;
    }

    await this.persistJob(job);
  }

  /**
   * Complete a job with result
   */
  async complete(jobId: string, result: unknown): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.result = result;
    job.completedAt = Date.now();

    await this.persistJob(job);

    // Remove from active executions
    this.activeExecutions.delete(jobId);

    // Process next jobs
    this.processQueue();
  }

  /**
   * Fail a job with error
   */
  async fail(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.error = error;
    job.completedAt = Date.now();

    await this.persistJob(job);

    // Remove from active executions
    this.activeExecutions.delete(jobId);

    // Process next jobs
    this.processQueue();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    // Count active jobs
    const activeCount = Array.from(this.jobs.values())
      .filter(j => j.status === 'running').length;

    if (activeCount >= this.maxConcurrent) {
      return;
    }

    const now = Date.now();

    // Find next job to execute
    const jobIndex = this.queue.findIndex(entry => {
      if (entry.scheduledAt > now) return false;

      // Check dependencies
      for (const depId of entry.dependencies) {
        const depJob = this.jobs.get(depId);
        if (!depJob || depJob.status !== 'completed') {
          return false;
        }
      }

      return true;
    });

    if (jobIndex === -1) {
      return;
    }

    const entry = this.queue[jobIndex];
    const job = this.jobs.get(entry.id);

    if (!job) {
      this.queue.splice(jobIndex, 1);
      return;
    }

    // Remove from queue
    this.queue.splice(jobIndex, 1);

    // Start execution
    this.executeJob(job, entry);
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: BackgroundJob, entry: QueueEntry): Promise<void> {
    job.status = 'running';
    job.startedAt = Date.now();

    await this.persistJob(job);

    // Create abort controller
    const controller = new AbortController();
    this.activeExecutions.set(job.id, controller);

    try {
      // Execute based on job type
      const result = await this.executeByType(job, controller.signal);

      if (controller.signal.aborted) {
        job.status = 'cancelled';
      } else {
        job.status = 'completed';
        job.result = result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if we should retry
      if (entry.retryCount < entry.maxRetries && !controller.signal.aborted) {
        entry.retryCount++;
        entry.scheduledAt = Date.now() + Math.pow(2, entry.retryCount) * 1000; // Exponential backoff
        this.insertSorted(entry);
        job.status = 'queued';
        job.error = undefined;
      } else {
        job.status = 'failed';
        job.error = errorMessage;
      }
    } finally {
      job.completedAt = Date.now();
      await this.persistJob(job);
      this.activeExecutions.delete(job.id);

      // Process next
      this.processQueue();
    }
  }

  /**
   * Execute job based on type
   */
  private async executeByType(job: BackgroundJob, signal: AbortSignal): Promise<unknown> {
    // This is where job type handlers would be registered
    // For now, we have a simple implementation

    const handlers: Record<string, (params: unknown, signal: AbortSignal) => Promise<unknown>> = {
      'code_generation': async (params, signal) => {
        // Simulate work
        for (let i = 0; i <= 100; i += 10) {
          if (signal.aborted) throw new Error('Cancelled');
          await this.updateProgress(job.id, i, `Generating code... ${i}%`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        return { generated: true };
      },

      'test_run': async (params, signal) => {
        for (let i = 0; i <= 100; i += 10) {
          if (signal.aborted) throw new Error('Cancelled');
          await this.updateProgress(job.id, i, `Running tests... ${i}%`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        return { passed: 47, failed: 3 };
      },

      'refactor': async (params, signal) => {
        for (let i = 0; i <= 100; i += 5) {
          if (signal.aborted) throw new Error('Cancelled');
          await this.updateProgress(job.id, i, `Refactoring... ${i}%`);
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        return { refactored: true };
      },
    };

    const handler = handlers[job.type];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    return await handler(job.params, signal);
  }

  /**
   * Insert job into sorted queue
   */
  private insertSorted(entry: QueueEntry): void {
    // Find insertion point based on priority
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < entry.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, entry);
  }

  /**
   * Persist job to database
   */
  private async persistJob(job: BackgroundJob): Promise<void> {
    await this.env.IDE_STATE
      .prepare(`
        INSERT INTO background_jobs (id, user_id, type, data, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          status = json_extract(excluded.data, '$.status')
      `)
      .bind(
        job.id,
        job.userId,
        job.type,
        JSON.stringify(job),
        job.createdAt
      )
      .run();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create job queue from environment
 */
export function createJobQueue(env: IDEAutomationEnv, maxConcurrent = 3): JobQueue {
  return new JobQueue(env, maxConcurrent);
}
