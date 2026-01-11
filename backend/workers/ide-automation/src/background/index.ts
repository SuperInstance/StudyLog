/**
 * Background Module - Background Execution
 *
 * Exports all background execution functionality:
 * - JobQueue: Async job management with cancellation/pausing
 * - Progress tracking and notifications
 */

export * from './job-queue.js';

// Re-export commonly used types
export type {
  BackgroundJob,
  JobStatus,
  QueueEntry,
  CancellationRequest,
  PauseRequest,
  ProgressNotification,
} from '../types/index.js';
