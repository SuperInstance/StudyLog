/**
 * Batch Regenerator - Process Multiple Assets in Parallel
 *
 * Handles bulk regeneration operations with queue management,
 * parallel processing, and progress tracking.
 */

import { EventEmitter } from 'events';
import {
  AssetForm,
  RegenerationRequest,
  RegenerationResponse,
  RegenerationStatus,
  BatchRegenerationRequest,
  QualityLevel,
  StylePriority
} from './types.js';
import { Regenerator, RegeneratorConfig } from './regenerator.js';

// ============================================================================
// BATCH JOB STATE
// ============================================================================

interface BatchJob {
  id: string;
  request: BatchRegenerationRequest;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  results: Map<string, RegenerationResponse>;
  progress: {
    total: number;
    completed: number;
    failed: number;
    currentAsset?: string;
    currentForm?: AssetForm;
  };
  startTime: Date;
  endTime?: Date;
  error?: string;
}

interface QueuedAsset {
  id: string;
  request: RegenerationRequest;
  priority: number;
  retries: number;
}

// ============================================================================
// BATCH REGENERATOR CLASS
// ============================================================================

export class BatchRegenerator extends EventEmitter {
  private regenerator: Regenerator;
  private queue: QueuedAsset[] = [];
  private activeJobs: Map<string, BatchJob> = new Map();
  private processing = false;
  private maxConcurrent: number;
  private maxRetries: number;
  private config: RegeneratorConfig;

  constructor(
    regenerator: Regenerator,
    config?: Partial<{
      maxConcurrent: number;
      maxRetries: number;
    }>
  ) {
    super();
    this.regenerator = regenerator;
    this.maxConcurrent = config?.maxConcurrent || 4;
    this.maxRetries = config?.maxRetries || 3;
    this.config = {} as RegeneratorConfig;
  }

  /**
   * Submit a batch regeneration request
   */
  async submitBatch(request: BatchRegenerationRequest): Promise<string> {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: BatchJob = {
      id: jobId,
      request,
      status: 'queued',
      results: new Map(),
      progress: {
        total: request.assetIds.length,
        completed: 0,
        failed: 0
      },
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);

    // Queue individual assets
    for (const assetId of request.assetIds) {
      const assetRequest: RegenerationRequest = {
        source: assetId,
        targetForms: request.targetForms,
        quality: request.quality,
        stylePriority: request.stylePriority,
        styleOverrides: request.overrides?.get(assetId),
        forceRegenerate: false
      };

      this.queue.push({
        id: assetId,
        request: assetRequest,
        priority: 0,
        retries: 0
      });
    }

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue().catch(err => {
        this.emit('error', err);
      });
    }

    this.emit('job:queued', { jobId, assetCount: request.assetIds.length });

    return jobId;
  }

  /**
   * Get status of a batch job
   */
  getJobStatus(jobId: string): BatchJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): BatchJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a batch job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'queued' || job.status === 'processing') {
      job.status = 'cancelled';
      job.endTime = new Date();

      // Remove queued assets for this job
      this.queue = this.queue.filter(asset => {
        const isInJob = job.request.assetIds.includes(asset.id);
        return !isInJob;
      });

      this.emit('job:cancelled', { jobId });
      return true;
    }

    return false;
  }

  /**
   * Retry failed assets in a batch job
   */
  async retryFailed(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    // Find failed assets and re-queue them
    const failedAssets: string[] = [];
    for (const [assetId, response] of job.results.entries()) {
      if (response.status === RegenerationStatus.FAILED || response.status === RegenerationStatus.PARTIAL) {
        failedAssets.push(assetId);
      }
    }

    if (failedAssets.length === 0) {
      return false;
    }

    // Update job status
    job.status = 'processing';

    // Re-queue failed assets
    for (const assetId of failedAssets) {
      const existingRequest = this.queue.find(q => q.id === assetId);
      if (existingRequest) {
        existingRequest.retries++;
      } else {
        const assetRequest: RegenerationRequest = {
          source: assetId,
          targetForms: job.request.targetForms,
          quality: job.request.quality,
          stylePriority: job.request.stylePriority
        };

        this.queue.push({
          id: assetId,
          request: assetRequest,
          priority: 1, // Higher priority for retries
          retries: 0
        });
      }
    }

    // Reset progress for failed assets
    job.progress.completed -= failedAssets.length;
    job.progress.failed = 0;

    // Start processing if not running
    if (!this.processing) {
      this.processQueue().catch(err => {
        this.emit('error', err);
      });
    }

    this.emit('job:retry', { jobId, retryCount: failedAssets.length });

    return true;
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(olderThanHours: number = 24): number {
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    let cleared = 0;

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.endTime &&
        job.endTime.getTime() < cutoff
      ) {
        this.activeJobs.delete(jobId);
        cleared++;
      }
    }

    return cleared;
  }

  // ========================================================================
  // QUEUE PROCESSING
  // ========================================================================

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0 || this.getActiveProcessingCount() > 0) {
        // Start new jobs up to max concurrent
        while (this.queue.length > 0 && this.getActiveProcessingCount() < this.maxConcurrent) {
          const asset = this.queue.shift();
          if (!asset) break;

          // Check retry limit
          if (asset.retries >= this.maxRetries) {
            this.handleAssetFailure(asset, 'Max retries exceeded');
            continue;
          }

          // Process this asset
          this.processAsset(asset).catch(err => {
            this.handleAssetFailure(asset, err.message);
          });
        }

        // Wait a bit before checking again
        await this.sleep(100);
      }
    } finally {
      this.processing = false;
    }
  }

  private async processAsset(asset: QueuedAsset): Promise<void> {
    // Find which job this asset belongs to
    let targetJob: BatchJob | undefined;

    for (const job of this.activeJobs.values()) {
      if (job.request.assetIds.includes(asset.id) && (job.status === 'queued' || job.status === 'processing')) {
        targetJob = job;
        break;
      }
    }

    if (!targetJob) {
      return;
    }

    // Update job status
    if (targetJob.status === 'queued') {
      targetJob.status = 'processing';
    }

    targetJob.progress.currentAsset = asset.id;

    this.emit('asset:started', {
      jobId: targetJob.id,
      assetId: asset.id,
      request: asset.request
    });

    try {
      // Regenerate the asset with progress tracking
      const response = await this.regenerator.regenerate(asset.request, (progress) => {
        targetJob.progress.currentForm = progress.currentForm;

        this.emit('asset:progress', {
          jobId: targetJob!.id,
          assetId: asset.id,
          progress
        });
      });

      // Store result
      targetJob.results.set(asset.id, response);

      // Update progress
      if (response.status === RegenerationStatus.COMPLETED || response.status === RegenerationStatus.CACHED) {
        targetJob.progress.completed++;
      } else if (response.status === RegenerationStatus.FAILED) {
        targetJob.progress.failed++;
      } else {
        // Partial - count as completed with issues
        targetJob.progress.completed++;
      }

      targetJob.progress.currentAsset = undefined;
      targetJob.progress.currentForm = undefined;

      this.emit('asset:completed', {
        jobId: targetJob.id,
        assetId: asset.id,
        response
      });

      // Check if job is complete
      this.checkJobComplete(targetJob);

    } catch (error) {
      this.handleAssetFailure(asset, error instanceof Error ? error.message : String(error));
    }
  }

  private handleAssetFailure(asset: QueuedAsset, error: string): void {
    // Find job and update
    for (const job of this.activeJobs.values()) {
      if (job.request.assetIds.includes(asset.id)) {
        job.progress.failed++;
        job.results.set(asset.id, {
          assetId: asset.id,
          forms: [],
          status: RegenerationStatus.FAILED,
          timestamp: new Date(),
          processingTime: 0,
          errors: [error]
        });

        this.emit('asset:failed', {
          jobId: job.id,
          assetId: asset.id,
          error
        });

        this.checkJobComplete(job);
        break;
      }
    }
  }

  private checkJobComplete(job: BatchJob): void {
    const totalProcessed = job.progress.completed + job.progress.failed;

    if (totalProcessed >= job.progress.total) {
      job.status = job.progress.failed > 0 ? 'failed' : 'completed';
      job.endTime = new Date();

      if (job.status === 'completed') {
        this.emit('job:completed', {
          jobId: job.id,
          results: Object.fromEntries(job.results)
        });
      } else {
        this.emit('job:failed', {
          jobId: job.id,
          failedCount: job.progress.failed
        });
      }
    }
  }

  private getActiveProcessingCount(): number {
    let count = 0;
    for (const job of this.activeJobs.values()) {
      if (job.status === 'processing') {
        const totalProcessed = job.progress.completed + job.progress.failed;
        count += Math.min(this.maxConcurrent, job.progress.total - totalProcessed);
      }
    }
    return count;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================================================
  // BATCH TEMPLATES
  // ========================================================================

  /**
   * Create a batch request for all forms of multiple assets
   */
  static createFullRegenerationBatch(
    assetIds: string[],
    quality: QualityLevel = QualityLevel.STANDARD
  ): BatchRegenerationRequest {
    return {
      assetIds,
      targetForms: undefined, // All forms
      quality,
      stylePriority: StylePriority.BALANCED,
      parallel: true,
      maxConcurrent: 4
    };
  }

  /**
   * Create a batch request for specific form conversion
   */
  static createFormConversionBatch(
    assetIds: string[],
    targetForm: AssetForm,
    quality: QualityLevel = QualityLevel.STANDARD
  ): BatchRegenerationRequest {
    return {
      assetIds,
      targetForms: [targetForm],
      quality,
      stylePriority: StylePriority.FORM_FOCUSED,
      parallel: true,
      maxConcurrent: 4
    };
  }

  /**
   * Create a batch request for style transfer
   */
  static createStyleTransferBatch(
    sourceAssetId: string,
    targetAssetIds: string[],
    quality: QualityLevel = QualityLevel.STANDARD
  ): BatchRegenerationRequest {
    return {
      assetIds: targetAssetIds,
      targetForms: undefined,
      quality,
      stylePriority: StylePriority.COLOR_EXACT,
      parallel: true,
      maxConcurrent: 2
    };
  }

  /**
   * Create a batch request for quality upgrade
   */
  static createQualityUpgradeBatch(
    assetIds: string[],
    targetQuality: QualityLevel,
    currentQuality: QualityLevel
  ): BatchRegenerationRequest {
    return {
      assetIds,
      targetForms: undefined,
      quality: targetQuality,
      stylePriority: StylePriority.BALANCED,
      parallel: true,
      maxConcurrent: 2
    };
  }
}

// ============================================================================
// BATCH PROGRESS TRACKER
// ============================================================================

export interface BatchProgress {
  jobId: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentAsset?: string;
  assetsCompleted: string[];
  assetsFailed: string[];
  assetsRemaining: string[];
}

export class BatchProgressTracker {
  private batchRegenerator: BatchRegenerator;
  private updateInterval: number;
  private intervalId?: NodeJS.Timeout;

  constructor(
    batchRegenerator: BatchRegenerator,
    updateInterval: number = 1000
  ) {
    this.batchRegenerator = batchRegenerator;
    this.updateInterval = updateInterval;
  }

  /**
   * Start tracking a batch job
   */
  startTracking(jobId: string, callback: (progress: BatchProgress) => void): () => void {
    const updateProgress = () => {
      const job = this.batchRegenerator.getJobStatus(jobId);
      if (!job) {
        return;
      }

      const assetsCompleted: string[] = [];
      const assetsFailed: string[] = [];
      const assetsRemaining: string[] = [];

      for (const [assetId, response] of job.results.entries()) {
        if (response.status === RegenerationStatus.COMPLETED || response.status === RegenerationStatus.CACHED) {
          assetsCompleted.push(assetId);
        } else if (response.status === RegenerationStatus.FAILED) {
          assetsFailed.push(assetId);
        }
      }

      for (const assetId of job.request.assetIds) {
        if (!job.results.has(assetId)) {
          assetsRemaining.push(assetId);
        }
      }

      const elapsed = Date.now() - job.startTime.getTime();
      const avgTimePerAsset = elapsed / (job.progress.completed + job.progress.failed || 1);
      const remaining = job.progress.total - job.progress.completed - job.progress.failed;
      const estimatedTimeRemaining = remaining > 0 ? avgTimePerAsset * remaining : undefined;

      callback({
        jobId,
        status: job.status,
        total: job.progress.total,
        completed: job.progress.completed,
        failed: job.progress.failed,
        percentage: (job.progress.completed / job.progress.total) * 100,
        estimatedTimeRemaining,
        currentAsset: job.progress.currentAsset,
        assetsCompleted,
        assetsFailed,
        assetsRemaining
      });
    };

    // Immediate update
    updateProgress();

    // Set up interval
    this.intervalId = setInterval(updateProgress, this.updateInterval);

    // Return cleanup function
    return () => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = undefined;
      }
    };
  }
}

// ============================================================================
// BATCH REPORT GENERATOR
// ============================================================================

export interface BatchReport {
  jobId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalAssets: number;
  successful: number;
  failed: number;
  cached: number;
  partial: number;
  formsGenerated: {
    microverse: number;
    luanti: number;
    openrts: number;
  };
  totalProcessingTime: number;
  averageProcessingTime: number;
  errors: string[];
  warnings: string[];
}

export class BatchReportGenerator {
  constructor(private batchRegenerator: BatchRegenerator) {}

  /**
   * Generate a report for a batch job
   */
  generateReport(jobId: string): BatchReport | null {
    const job = this.batchRegenerator.getJobStatus(jobId);
    if (!job) {
      return null;
    }

    const formsGenerated = {
      microverse: 0,
      luanti: 0,
      openrts: 0
    };

    let totalProcessingTime = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    let cached = 0;
    let partial = 0;

    for (const [assetId, response] of job.results.entries()) {
      totalProcessingTime += response.processingTime;

      if (response.errors) {
        errors.push(...response.errors);
      }
      if (response.warnings) {
        warnings.push(...response.warnings);
      }

      if (response.status === RegenerationStatus.CACHED) {
        cached++;
      } else if (response.status === RegenerationStatus.PARTIAL) {
        partial++;
      }

      for (const form of response.forms) {
        if (form.success) {
          switch (form.form) {
            case AssetForm.MICROVERSE:
              formsGenerated.microverse++;
              break;
            case AssetForm.LUANTI:
              formsGenerated.luanti++;
              break;
            case AssetForm.OPENRTS:
              formsGenerated.openrts++;
              break;
          }
        }
      }
    }

    const successful = job.progress.completed - cached - partial;
    const failed = job.progress.failed;
    const duration = job.endTime ? job.endTime.getTime() - job.startTime.getTime() : undefined;

    return {
      jobId,
      startTime: job.startTime,
      endTime: job.endTime,
      duration,
      totalAssets: job.progress.total,
      successful,
      failed,
      cached,
      partial,
      formsGenerated,
      totalProcessingTime,
      averageProcessingTime: totalProcessingTime / job.progress.total,
      errors,
      warnings
    };
  }

  /**
   * Generate a summary report for multiple jobs
   */
  generateSummaryReport(jobIds: string[]): {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalAssets: number;
    totalSuccessful: number;
    totalFailed: number;
    totalProcessingTime: number;
  } {
    let totalAssets = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalProcessingTime = 0;
    let completedJobs = 0;
    let failedJobs = 0;

    for (const jobId of jobIds) {
      const report = this.generateReport(jobId);
      if (report) {
        totalAssets += report.totalAssets;
        totalSuccessful += report.successful;
        totalFailed += report.failed;
        totalProcessingTime += report.totalProcessingTime;

        if (report.endTime) {
          if (report.failed > 0) {
            failedJobs++;
          } else {
            completedJobs++;
          }
        }
      }
    }

    return {
      totalJobs: jobIds.length,
      completedJobs,
      failedJobs,
      totalAssets,
      totalSuccessful,
      totalFailed,
      totalProcessingTime
    };
  }
}
