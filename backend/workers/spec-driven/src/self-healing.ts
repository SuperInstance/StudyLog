/**
 * Spec-Driven Development - Self-Healing System
 *
 * Implements test-fix-repeat loop for autonomous code improvement.
 * Implements OpenHands/Devin patterns for educational coding.
 *
 * @module spec-driven/self-healing
 */

import type { ParsedSpec } from './spec-parser.js';
import type { ExecutionPlan, Task, TaskStatus } from './task-planner.js';
import type { GeneratedFile, GenerationResult } from './code-generator.js';
import type { TestSuite, TestCase, TestCoverage } from './test-generator.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Self-healing session state
 */
export interface HealingSession {
  /** Session ID */
  id: string;
  /** Original spec */
  spec: ParsedSpec;
  /** Execution plan */
  plan: ExecutionPlan;
  /** Current iteration */
  iteration: number;
  /** Max iterations */
  maxIterations: number;
  /** Session status */
  status: HealingStatus;
  /** Test results by iteration */
  testResults: Map<number, TestRunResult>;
  /** Fixes applied by iteration */
  fixesApplied: Map<number, Fix[]>;
  /** Coverage history */
  coverageHistory: TestCoverage[];
  /** Session metadata */
  metadata: SessionMetadata;
}

/**
 * Healing status
 */
export enum HealingStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  TESTING = 'testing',
  ANALYZING = 'analyzing',
  FIXING = 'fixing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MAX_ITERATIONS_REACHED = 'max_iterations_reached',
}

/**
 * Test run result
 */
export interface TestRunResult {
  /** Run timestamp */
  timestamp: string;
  /** Total tests run */
  totalTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Failed test details */
  failures: TestFailure[];
  /** Duration in ms */
  duration: number;
  /** Coverage report */
  coverage?: TestCoverage;
}

/**
 * Test failure details
 */
export interface TestFailure {
  /** Test file path */
  testFile: string;
  /** Test name */
  testName: string;
  /** Error message */
  error: string;
  /** Stack trace */
  stack?: string;
  /** Related source file */
  sourceFile?: string;
  /** Severity */
  severity: FailureSeverity;
  /** Can this be auto-fixed */
  fixable: boolean;
}

/**
 * Failure severity
 */
export enum FailureSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Applied fix
 */
export interface Fix {
  /** Fix ID */
  id: string;
  /** Fix type */
  type: FixType;
  /** Target file */
  targetFile: string;
  /** Original code */
  originalCode: string;
  /** Fixed code */
  fixedCode: string;
  /** Related test failure */
  relatedFailure: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Fix description */
  description: string;
  /** Was the fix successful */
  successful: boolean;
}

/**
 * Fix types
 */
export enum FixType {
  SYNTAX = 'syntax',
  IMPORT = 'import',
  TYPE = 'type',
  LOGIC = 'logic',
  DEPENDENCY = 'dependency',
  CONFIG = 'config',
  MOCK = 'mock',
  ASYNC = 'async',
  NULL_CHECK = 'null_check',
  BOUNDS = 'bounds',
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Session started at */
  startedAt: string;
  /** Session completed at */
  completedAt?: string;
  /** Total duration in ms */
  totalDuration?: number;
  /** Total fixes applied */
  totalFixes: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Tokens used */
  tokensUsed: number;
  /** Cost estimate */
  costEstimate: number;
}

/**
 * Self-healing options
 */
export interface SelfHealingOptions {
  /** Maximum iterations */
  maxIterations?: number;
  /** Maximum fixes per iteration */
  maxFixesPerIteration?: number;
  /** Auto-apply fixes or require approval */
  autoApplyFixes?: boolean;
  /** Minimum confidence to auto-apply */
  minAutoApplyConfidence?: number;
  /** Include educational comments */
  educational?: boolean;
  /** Stop on first success */
  stopOnFirstSuccess?: boolean;
  /** Coverage target (0-100) */
  coverageTarget?: number;
}

/**
 * Healing event
 */
export interface HealingEvent {
  /** Event type */
  type: HealingEventType;
  /** Timestamp */
  timestamp: string;
  /** Session ID */
  sessionId: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Message */
  message: string;
}

/**
 * Healing event types
 */
export enum HealingEventType {
  SESSION_STARTED = 'session_started',
  ITERATION_STARTED = 'iteration_started',
  CODE_GENERATED = 'code_generated',
  TESTS_RUN = 'tests_run',
  FAILURES_DETECTED = 'failures_detected',
  FIXES_APPLIED = 'fixes_applied',
  ITERATION_COMPLETED = 'iteration_completed',
  SESSION_COMPLETED = 'session_completed',
  SESSION_FAILED = 'session_failed',
}

/**
 * Event listener type
 */
export type HealingEventListener = (event: HealingEvent) => void;

// ============================================================================
// Self-Healing System Class
// ============================================================================

/**
 * Self-Healing System
 *
 * Implements autonomous test-fix-repeat loop for code generation.
 */
export class SelfHealingSystem {
  private readonly activeSessions: Map<string, HealingSession>;
  private readonly eventListeners: Set<HealingEventListener>;
  private readonly defaultOptions: SelfHealingOptions;

  constructor() {
    this.activeSessions = new Map();
    this.eventListeners = new Set();
    this.defaultOptions = {
      maxIterations: 5,
      maxFixesPerIteration: 10,
      autoApplyFixes: true,
      minAutoApplyConfidence: 0.7,
      educational: true,
      stopOnFirstSuccess: false,
      coverageTarget: 80,
    };
  }

  /**
   * Start a self-healing session
   */
  async startSession(
    spec: ParsedSpec,
    plan: ExecutionPlan,
    options?: Partial<SelfHealingOptions>
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const sessionId = this.generateId();

    const session: HealingSession = {
      id: sessionId,
      spec,
      plan,
      iteration: 0,
      maxIterations: opts.maxIterations!,
      status: HealingStatus.IDLE,
      testResults: new Map(),
      fixesApplied: new Map(),
      coverageHistory: [],
      metadata: {
        startedAt: new Date().toISOString(),
        totalFixes: 0,
        successRate: 0,
        tokensUsed: 0,
        costEstimate: 0,
      },
    };

    this.activeSessions.set(sessionId, session);
    this.emitEvent({
      type: HealingEventType.SESSION_STARTED,
      timestamp: new Date().toISOString(),
      sessionId,
      data: { specId: spec.id, planId: plan.id },
      message: 'Self-healing session started',
    });

    // Start the healing loop (non-blocking)
    this.runHealingLoop(sessionId, opts).catch(error => {
      console.error(`Healing session ${sessionId} failed:`, error);
      session.status = HealingStatus.FAILED;
    });

    return sessionId;
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): HealingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get session events
   */
  getSessionEvents(sessionId: string): HealingEvent[] {
    // In a real implementation, would store events per session
    return [];
  }

  /**
   * Cancel a session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = HealingStatus.FAILED;
      session.metadata.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: HealingEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: HealingEventListener): void {
    this.eventListeners.delete(listener);
  }

  // ========================================================================
  // Private Methods - Healing Loop
  // ========================================================================

  /**
   * Run the self-healing loop
   */
  private async runHealingLoop(sessionId: string, options: SelfHealingOptions): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    while (session.iteration < session.maxIterations) {
      session.iteration++;
      session.status = HealingStatus.GENERATING;

      this.emitEvent({
        type: HealingEventType.ITERATION_STARTED,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { iteration: session.iteration },
        message: `Starting iteration ${session.iteration}`,
      });

      // Step 1: Generate code for current tasks
      const generatedFiles = await this.generateCodeForIteration(session, options);

      this.emitEvent({
        type: HealingEventType.CODE_GENERATED,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { fileCount: generatedFiles.length },
        message: `Generated ${generatedFiles.length} files`,
      });

      // Step 2: Run tests
      session.status = HealingStatus.TESTING;
      const testResult = await this.runTests(session, generatedFiles);

      this.emitEvent({
        type: HealingEventType.TESTS_RUN,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { passed: testResult.passedTests, failed: testResult.failedTests },
        message: `Tests: ${testResult.passedTests} passed, ${testResult.failedTests} failed`,
      });

      session.testResults.set(session.iteration, testResult);

      // Step 3: Check if all tests pass
      if (testResult.failedTests === 0) {
        session.status = HealingStatus.COMPLETED;
        session.metadata.completedAt = new Date().toISOString();
        session.metadata.successRate = 1;
        session.metadata.totalDuration = Date.now() - new Date(session.metadata.startedAt).getTime();

        this.emitEvent({
          type: HealingEventType.SESSION_COMPLETED,
          timestamp: new Date().toISOString(),
          sessionId,
          data: { iterations: session.iteration },
          message: 'All tests passed, session completed',
        });

        if (options.stopOnFirstSuccess) {
          break;
        }
      }

      // Step 4: Analyze failures
      session.status = HealingStatus.ANALYZING;
      const failures = testResult.failures;

      if (failures.length === 0) {
        // Tests pass but maybe coverage is low
        if (testResult.coverage && options.coverageTarget) {
          if (testResult.coverage.lineCoverage < options.coverageTarget) {
            // Could add more tests here
          }
        }
        continue;
      }

      this.emitEvent({
        type: HealingEventType.FAILURES_DETECTED,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { failureCount: failures.length },
        message: `Detected ${failures.length} test failures`,
      });

      // Step 5: Generate fixes
      session.status = HealingStatus.FIXING;
      const fixes = await this.generateFixes(session, failures, options);

      // Step 6: Apply fixes
      const appliedFixes = await this.applyFixes(session, fixes, options);
      session.fixesApplied.set(session.iteration, appliedFixes);
      session.metadata.totalFixes += appliedFixes.filter(f => f.successful).length;

      this.emitEvent({
        type: HealingEventType.FIXES_APPLIED,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { fixCount: appliedFixes.length, successful: appliedFixes.filter(f => f.successful).length },
        message: `Applied ${appliedFixes.length} fixes`,
      });

      this.emitEvent({
        type: HealingEventType.ITERATION_COMPLETED,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { iteration: session.iteration },
        message: `Iteration ${session.iteration} completed`,
      });
    }

    // Check final status
    if (session.iteration >= session.maxIterations) {
      session.status = HealingStatus.MAX_ITERATIONS_REACHED;
      session.metadata.completedAt = new Date().toISOString();
      session.metadata.totalDuration = Date.now() - new Date(session.metadata.startedAt).getTime();

      const lastResult = session.testResults.get(session.iteration);
      if (lastResult) {
        session.metadata.successRate = lastResult.totalTests > 0
          ? lastResult.passedTests / lastResult.totalTests
          : 0;
      }

      this.emitEvent({
        type: HealingEventType.SESSION_COMPLETED,
        timestamp: new Date().toISOString(),
        sessionId,
        data: { maxIterationsReached: true },
        message: 'Max iterations reached',
      });
    }
  }

  /**
   * Generate code for an iteration
   */
  private async generateCodeForIteration(
    session: HealingSession,
    options: SelfHealingOptions
  ): Promise<Map<string, GeneratedFile>> {
    const files = new Map<string, GeneratedFile>();

    // In a real implementation, this would call the code generator
    // For now, return empty map
    return files;
  }

  /**
   * Run tests
   */
  private async runTests(
    session: HealingSession,
    generatedFiles: Map<string, GeneratedFile>
  ): Promise<TestRunResult> {
    const startTime = Date.now();

    // In a real implementation, this would:
    // 1. Write files to disk/scratchpad
    // 2. Install dependencies
    // 3. Run the test framework
    // 4. Parse results

    // Mock result for now
    const result: TestRunResult = {
      timestamp: new Date().toISOString(),
      totalTests: 10,
      passedTests: 7,
      failedTests: 3,
      skippedTests: 0,
      failures: [
        {
          testFile: '__tests__/Component.test.ts',
          testName: 'renders without crashing',
          error: 'Cannot find module',
          stack: 'Error: Cannot find module',
          sourceFile: 'src/components/Component.tsx',
          severity: FailureSeverity.HIGH,
          fixable: true,
        },
        {
          testFile: '__tests__/Component.test.ts',
          testName: 'handles click event',
          error: 'onClick is not a function',
          stack: 'TypeError: onClick is not a function',
          sourceFile: 'src/components/Component.tsx',
          severity: FailureSeverity.MEDIUM,
          fixable: true,
        },
        {
          testFile: '__tests__/utils.test.ts',
          testName: 'formatDate returns correct format',
          error: 'Expected "2024-01-10" but got "01/10/2024"',
          sourceFile: 'src/utils/date.ts',
          severity: FailureSeverity.LOW,
          fixable: true,
        },
      ],
      duration: Date.now() - startTime,
    };

    return result;
  }

  /**
   * Generate fixes for failures
   */
  private async generateFixes(
    session: HealingSession,
    failures: TestFailure[],
    options: SelfHealingOptions
  ): Promise<Fix[]> {
    const fixes: Fix[] = [];

    for (const failure of failures) {
      if (!failure.fixable) continue;

      const fix = await this.analyzeAndGenerateFix(session, failure);
      if (fix) {
        fixes.push(fix);
      }
    }

    // Sort by confidence and limit
    fixes.sort((a, b) => b.confidence - a.confidence);
    return fixes.slice(0, options.maxFixesPerIteration);
  }

  /**
   * Analyze a failure and generate a fix
   */
  private async analyzeAndGenerateFix(
    session: HealingSession,
    failure: TestFailure
  ): Promise<Fix | null> {
    // Analyze the error to determine fix type
    const fixType = this.determineFixType(failure);
    const confidence = this.estimateFixConfidence(failure, fixType);

    if (confidence < (this.defaultOptions.minAutoApplyConfidence || 0.7)) {
      return null;
    }

    // Generate the actual fix
    const fix = await this.generateFixForFailure(failure, fixType);

    return {
      id: this.generateId(),
      type: fixType,
      targetFile: failure.sourceFile || '',
      originalCode: fix.originalCode,
      fixedCode: fix.fixedCode,
      relatedFailure: failure.testName,
      confidence,
      description: fix.description,
      successful: false, // Will be set after application
    };
  }

  /**
   * Determine the type of fix needed
   */
  private determineFixType(failure: TestFailure): FixType {
    const error = failure.error.toLowerCase();

    if (error.includes('cannot find module') || error.includes('not found')) {
      return FixType.IMPORT;
    }
    if (error.includes('syntax') || error.includes('parse')) {
      return FixType.SYNTAX;
    }
    if (error.includes('type') || error.includes('assignable')) {
      return FixType.TYPE;
    }
    if (error.includes('null') || error.includes('undefined')) {
      return FixType.NULL_CHECK;
    }
    if (error.includes('async') || error.includes('promise')) {
      return FixType.ASYNC;
    }
    if (error.includes('mock') || error.includes('stub')) {
      return FixType.MOCK;
    }
    if (error.includes('out of range') || error.includes('bounds')) {
      return FixType.BOUNDS;
    }

    return FixType.LOGIC;
  }

  /**
   * Estimate confidence in the fix
   */
  private estimateFixConfidence(failure: TestFailure, fixType: FixType): number {
    let confidence = 0.5;

    // Higher confidence for simple fix types
    switch (fixType) {
      case FixType.IMPORT:
      case FixType.SYNTAX:
        confidence = 0.95;
        break;
      case FixType.TYPE:
        confidence = 0.85;
        break;
      case FixType.ASYNC:
        confidence = 0.8;
        break;
      case FixType.NULL_CHECK:
        confidence = 0.75;
        break;
      case FixType.MOCK:
        confidence = 0.7;
        break;
      case FixType.LOGIC:
        confidence = 0.6;
        break;
      default:
        confidence = 0.5;
    }

    // Adjust based on severity
    switch (failure.severity) {
      case FailureSeverity.CRITICAL:
        confidence -= 0.1;
        break;
      case FailureSeverity.LOW:
        confidence += 0.1;
        break;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Generate fix for a specific failure
   */
  private async generateFixForFailure(
    failure: TestFailure,
    fixType: FixType
  ): Promise<{ originalCode: string; fixedCode: string; description: string }> {
    // In a real implementation, this would:
    // 1. Read the source file
    // 2. Use AI to analyze and generate the fix
    // 3. Return the diff

    // For now, return placeholder
    return {
      originalCode: '// Original code',
      fixedCode: '// Fixed code',
      description: `Fix for ${fixType}: ${failure.error}`,
    };
  }

  /**
   * Apply fixes to the codebase
   */
  private async applyFixes(
    session: HealingSession,
    fixes: Fix[],
    options: SelfHealingOptions
  ): Promise<Fix[]> {
    const applied: Fix[] = [];

    for (const fix of fixes) {
      // Skip if confidence is below threshold for auto-apply
      if (options.autoApplyFixes && fix.confidence < (options.minAutoApplyConfidence || 0.7)) {
        continue;
      }

      try {
        // In a real implementation, this would:
        // 1. Read the target file
        // 2. Apply the fix (string replacement or AST-based)
        // 3. Write back
        // 4. Update session state

        fix.successful = true;
        applied.push(fix);

        if (options.educational) {
          // Add educational comment
          fix.description += `\n\n// Educational: This fix addresses ${fix.type} by ensuring proper handling.`;
        }
      } catch (error) {
        fix.successful = false;
      }
    }

    return applied;
  }

  /**
   * Emit an event to listeners
   */
  private emitEvent(event: HealingEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `heal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// Pattern Recognition for Common Fixes
// ============================================================================

/**
 * Common error patterns and their fixes
 */
export const ERROR_PATTERNS: Record<string, { pattern: RegExp; fixTemplate: string; type: FixType }> = {
  cannotFindModule: {
    pattern: /Cannot find module ['"](.+)['"]/,
    fixTemplate: "import { $1 } from '$1';",
    type: FixType.IMPORT,
  },
  isNotAFunction: {
    pattern: /(.+) is not a function/,
    fixTemplate: 'const $1 = typeof props.$1 === "function" ? props.$1 : () => {};',
    type: FixType.NULL_CHECK,
  },
  cannotReadProperty: {
    pattern: /Cannot read properties? of (undefined|null) \(reading '(.+)'\)/,
    fixTemplate: 'const $1 = obj?.$1;',
    type: FixType.NULL_CHECK,
  },
  typeNotAssignable: {
    pattern: /Type '(.+)' is not assignable to type '(.+)'/,
    fixTemplate: 'const value: $2 = $1 as $2;',
    type: FixType.TYPE,
  },
  expectedButReceived: {
    pattern: /Expected ['"](.+)['"] but received ['"](.+)['"]/,
    fixTemplate: 'const formatted = formatAs("$1");',
    type: FixType.LOGIC,
  },
};

/**
 * Try to match an error to a known pattern
 */
export function matchErrorPattern(error: string): { fixTemplate: string; type: FixType } | null {
  for (const [key, { pattern, fixTemplate, type }] of Object.entries(ERROR_PATTERNS)) {
    if (pattern.test(error)) {
      return { fixTemplate, type };
    }
  }
  return null;
}

// ============================================================================
// Factory
// ============================================================================

let systemInstance: SelfHealingSystem | null = null;

/**
 * Get or create self-healing system instance
 */
export function getSelfHealingSystem(): SelfHealingSystem {
  if (!systemInstance) {
    systemInstance = new SelfHealingSystem();
  }
  return systemInstance;
}

/**
 * Start a healing session (convenience function)
 */
export async function startHealing(
  spec: ParsedSpec,
  plan: ExecutionPlan,
  options?: Partial<SelfHealingOptions>
): Promise<string> {
  const system = getSelfHealingSystem();
  return system.startSession(spec, plan, options);
}

/**
 * Wait for a session to complete
 */
export async function waitForSession(sessionId: string, timeoutMs = 300000): Promise<HealingSession> {
  const startTime = Date.now();
  const system = getSelfHealingSystem();

  while (Date.now() - startTime < timeoutMs) {
    const session = system.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (
      session.status === HealingStatus.COMPLETED ||
      session.status === HealingStatus.FAILED ||
      session.status === HealingStatus.MAX_ITERATIONS_REACHED
    ) {
      return session;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Session ${sessionId} timed out`);
}
