/**
 * Spec-Driven Development - Main Entry Point
 *
 * Implements OpenHands/Devin patterns for educational coding.
 * Orchestrates spec parsing, task planning, code generation, testing, and self-healing.
 *
 * @module spec-driven
 */

import { getSpecParser, parseSpec, type ParsedSpec, type ParseResult, type ParseOptions } from './spec-parser.js';
import { getTaskPlanner, createPlan, type ExecutionPlan, type PlanningOptions } from './task-planner.js';
import { getCodeGenerator, type GeneratedFile, type GenerationContext, type GenerationPreferences, DEFAULT_PREFERENCES } from './code-generator.js';
import { getTestGenerator, generateTests, type TestSuite, type TestGenerationOptions, DEFAULT_TEST_OPTIONS } from './test-generator.js';
import { getSelfHealingSystem, startHealing, waitForSession, type HealingSession, type SelfHealingOptions } from './self-healing.js';

// ============================================================================
// Re-exports
// ============================================================================

export * from './spec-parser.js';
export * from './task-planner.js';
export * from './code-generator.js';
export * from './test-generator.js';
export * from './self-healing.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Full pipeline result
 */
export interface PipelineResult {
  /** Parsed spec */
  spec: ParsedSpec;
  /** Execution plan */
  plan: ExecutionPlan;
  /** Generated files */
  files: GeneratedFile[];
  /** Test suites */
  tests: TestSuite[];
  /** Healing session if enabled */
  healingSession?: string;
  /** Total tokens used */
  tokensUsed: number;
  /** Total cost estimate */
  costEstimate: number;
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
}

/**
 * Pipeline options
 */
export interface PipelineOptions {
  /** Parse options */
  parse?: ParseOptions;
  /** Planning options */
  plan?: PlanningOptions;
  /** Generation preferences */
  generation?: Partial<GenerationPreferences>;
  /** Test generation options */
  tests?: Partial<TestGenerationOptions>;
  /** Enable self-healing */
  selfHealing?: boolean | Partial<SelfHealingOptions>;
  /** Progress callback */
  onProgress?: (progress: PipelineProgress) => void;
}

/**
 * Pipeline progress
 */
export interface PipelineProgress {
  /** Current stage */
  stage: PipelineStage;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current operation description */
  message: string;
  /** Stage-specific data */
  data: Record<string, unknown>;
}

/**
 * Pipeline stages
 */
export enum PipelineStage {
  PARSING = 'parsing',
  PLANNING = 'planning',
  GENERATING = 'generating',
  TESTING = 'testing',
  HEALING = 'healing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ============================================================================
// Pipeline Class
// ============================================================================

/**
 * Spec-Driven Development Pipeline
 *
 * Main orchestrator for the full spec-driven development workflow.
 */
export class SpecDrivenPipeline {
  /**
   * Run the full pipeline from a natural language spec
   */
  async run(specText: string, options: PipelineOptions = {}): Promise<PipelineResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let tokensUsed = 0;
    let costEstimate = 0;

    try {
      // Stage 1: Parse spec
      this.reportProgress(options, PipelineStage.PARSING, 10, 'Parsing specification...');
      const parseResult = await getSpecParser().parse(specText, options.parse);

      warnings.push(...parseResult.warnings);

      this.reportProgress(options, PipelineStage.PARSING, 20, `Parsed ${parseResult.spec.requirements.length} requirements`);

      // Stage 2: Create execution plan
      this.reportProgress(options, PipelineStage.PLANNING, 30, 'Creating execution plan...');
      const plan = await getTaskPlanner().plan(parseResult.spec, options.plan);

      this.reportProgress(options, PipelineStage.PLANNING, 40, `Created plan with ${plan.tasks.length} tasks`);

      // Stage 3: Generate code
      this.reportProgress(options, PipelineStage.GENERATING, 50, 'Generating code...');
      const context: GenerationContext = {
        spec: parseResult.spec,
        task: plan.tasks[0] || { id: 'main', title: 'Main', description: '', type: 'create_file' as any, status: 'pending' as any, priority: 'medium' as any, complexity: 5, estimatedTime: 10, dependencies: [], requirementIds: [], componentIds: [], files: [], agentType: 'builder' as any },
        existingFiles: new Map(),
        imports: new Map(),
        preferences: { ...DEFAULT_PREFERENCES, ...options.generation },
      };

      const generator = getCodeGenerator();
      const codeResults = await generator.generateForPlan(plan.tasks, context);

      const allFiles: GeneratedFile[] = [];
      for (const result of codeResults.values()) {
        allFiles.push(...result.files);
        tokensUsed += result.tokensUsed;
        costEstimate += result.costEstimate;
        warnings.push(...result.warnings);
        errors.push(...result.errors);
      }

      this.reportProgress(options, PipelineStage.GENERATING, 70, `Generated ${allFiles.length} files`);

      // Stage 4: Generate tests
      this.reportProgress(options, PipelineStage.TESTING, 80, 'Generating tests...');
      const testOptions = { ...DEFAULT_TEST_OPTIONS, ...options.tests };
      const testSuites = await getTestGenerator().generateForSpec(parseResult.spec, testOptions);

      this.reportProgress(options, PipelineStage.TESTING, 85, `Generated ${testSuites.length} test suites`);

      // Stage 5: Self-healing (optional)
      let healingSession: string | undefined;
      if (options.selfHealing) {
        this.reportProgress(options, PipelineStage.HEALING, 90, 'Starting self-healing session...');

        const healingOptions = typeof options.selfHealing === 'object'
          ? options.selfHealing
          : undefined;

        healingSession = await startHealing(parseResult.spec, plan, healingOptions);

        // Don't wait for completion in this method - let it run in background
        this.reportProgress(options, PipelineStage.HEALING, 95, `Self-healing session started: ${healingSession}`);
      }

      this.reportProgress(options, PipelineStage.COMPLETED, 100, 'Pipeline completed successfully');

      return {
        spec: parseResult.spec,
        plan,
        files: allFiles,
        tests: testSuites,
        healingSession,
        tokensUsed,
        costEstimate,
        warnings,
        errors,
      };
    } catch (error) {
      this.reportProgress(options, PipelineStage.FAILED, 0, `Pipeline failed: ${error}`);
      errors.push(error instanceof Error ? error.message : String(error));

      return {
        spec: null as any,
        plan: null as any,
        files: [],
        tests: [],
        tokensUsed,
        costEstimate,
        warnings,
        errors,
      };
    }
  }

  /**
   * Parse a spec only (no generation)
   */
  async parseOnly(specText: string, options?: ParseOptions): Promise<ParseResult> {
    return getSpecParser().parse(specText, options);
  }

  /**
   * Generate from a pre-parsed spec
   */
  async generateFromSpec(spec: ParsedSpec, options?: Omit<PipelineOptions, 'parse'>): Promise<PipelineResult> {
    // Create plan
    const plan = await getTaskPlanner().plan(spec, options?.plan);

    // Generate code
    const context: GenerationContext = {
      spec,
      task: plan.tasks[0] || { id: 'main', title: 'Main', description: '', type: 'create_file' as any, status: 'pending' as any, priority: 'medium' as any, complexity: 5, estimatedTime: 10, dependencies: [], requirementIds: [], componentIds: [], files: [], agentType: 'builder' as any },
      existingFiles: new Map(),
      imports: new Map(),
      preferences: { ...DEFAULT_PREFERENCES, ...options?.generation },
    };

    const generator = getCodeGenerator();
    const codeResults = await generator.generateForPlan(plan.tasks, context);

    const allFiles: GeneratedFile[] = [];
    for (const result of codeResults.values()) {
      allFiles.push(...result.files);
    }

    // Generate tests
    const testOptions = { ...DEFAULT_TEST_OPTIONS, ...options?.tests };
    const testSuites = await getTestGenerator().generateForSpec(spec, testOptions);

    return {
      spec,
      plan,
      files: allFiles,
      tests: testSuites,
      tokensUsed: 0,
      costEstimate: 0,
      warnings: [],
      errors: [],
    };
  }

  /**
   * Resume a healing session
   */
  async resumeHealing(sessionId: string): Promise<HealingSession | null> {
    const system = getSelfHealingSystem();
    return system.getSession(sessionId) || null;
  }

  /**
   * Wait for healing completion
   */
  async waitForHealing(sessionId: string, timeoutMs?: number): Promise<HealingSession> {
    return waitForSession(sessionId, timeoutMs);
  }

  /**
   * Report progress if callback provided
   */
  private reportProgress(options: PipelineOptions, stage: PipelineStage, progress: number, message: string): void {
    if (options.onProgress) {
      options.onProgress({
        stage,
        progress,
        message,
        data: {},
      });
    }
  }
}

// ============================================================================
// Cloudflare Worker Request Handlers
// ============================================================================

/**
 * Spec-driven worker environment
 */
export interface SpecDrivenEnv {
  /** D1 Database for storing sessions */
  DB?: D1Database;
  /** KV for caching */
  CACHE?: KVNamespace;
  /** AI binding for code generation */
  AI?: any;
  /** R2 for storing generated files */
  STORAGE?: R2Bucket;
}

/**
 * Handle API request
 */
export async function handleSpecDrivenRequest(
  request: Request,
  env: SpecDrivenEnv,
  ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1/spec-driven', '');

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // POST /parse - Parse a spec
    if (path === '/parse' && request.method === 'POST') {
      const body = await request.json() as { spec: string; options?: ParseOptions };

      if (!body.spec) {
        return Response.json({ error: 'Missing spec in request body' }, { status: 400 });
      }

      const result = await getSpecParser().parse(body.spec, body.options);

      return Response.json({
        success: true,
        data: result,
      });
    }

    // POST /plan - Create execution plan from spec
    if (path === '/plan' && request.method === 'POST') {
      const body = await request.json() as { spec: string; parseOptions?: ParseOptions; planOptions?: PlanningOptions };

      if (!body.spec) {
        return Response.json({ error: 'Missing spec in request body' }, { status: 400 });
      }

      const parseResult = await getSpecParser().parse(body.spec, body.parseOptions);
      const plan = await getTaskPlanner().plan(parseResult.spec, body.planOptions);

      return Response.json({
        success: true,
        data: { spec: parseResult.spec, plan },
      });
    }

    // POST /generate - Run full pipeline
    if (path === '/generate' && request.method === 'POST') {
      const body = await request.json() as {
        spec: string;
        parseOptions?: ParseOptions;
        planOptions?: PlanningOptions;
        generationOptions?: Partial<GenerationPreferences>;
        testOptions?: Partial<TestGenerationOptions>;
        selfHealing?: boolean | Partial<SelfHealingOptions>;
      };

      if (!body.spec) {
        return Response.json({ error: 'Missing spec in request body' }, { status: 400 });
      }

      const pipeline = new SpecDrivenPipeline();
      const result = await pipeline.run(body.spec, {
        parse: body.parseOptions,
        plan: body.planOptions,
        generation: body.generationOptions,
        tests: body.testOptions,
        selfHealing: body.selfHealing,
      });

      return Response.json({
        success: true,
        data: result,
      });
    }

    // POST /generate/code - Generate code only (no tests)
    if (path === '/generate/code' && request.method === 'POST') {
      const body = await request.json() as {
        spec: string;
        parseOptions?: ParseOptions;
        planOptions?: PlanningOptions;
      };

      if (!body.spec) {
        return Response.json({ error: 'Missing spec in request body' }, { status: 400 });
      }

      const parseResult = await getSpecParser().parse(body.spec, body.parseOptions);
      const plan = await getTaskPlanner().plan(parseResult.spec, body.planOptions);

      const context: GenerationContext = {
        spec: parseResult.spec,
        task: plan.tasks[0] || { id: 'main', title: 'Main', description: '', type: 'create_file' as any, status: 'pending' as any, priority: 'medium' as any, complexity: 5, estimatedTime: 10, dependencies: [], requirementIds: [], componentIds: [], files: [], agentType: 'builder' as any },
        existingFiles: new Map(),
        imports: new Map(),
        preferences: DEFAULT_PREFERENCES,
      };

      const generator = getCodeGenerator({ AI: env?.AI });
      const results = await generator.generateForPlan(plan.tasks, context);

      const files: GeneratedFile[] = [];
      for (const result of results.values()) {
        files.push(...result.files);
      }

      return Response.json({
        success: true,
        data: { files, spec: parseResult.spec, plan },
      });
    }

    // POST /generate/tests - Generate tests only
    if (path === '/generate/tests' && request.method === 'POST') {
      const body = await request.json() as {
        spec: string;
        parseOptions?: ParseOptions;
        testOptions?: Partial<TestGenerationOptions>;
      };

      if (!body.spec) {
        return Response.json({ error: 'Missing spec in request body' }, { status: 400 });
      }

      const parseResult = await getSpecParser().parse(body.spec, body.parseOptions);
      const testOptions = { ...DEFAULT_TEST_OPTIONS, ...body.testOptions };
      const testSuites = await getTestGenerator().generateForSpec(parseResult.spec, testOptions);

      return Response.json({
        success: true,
        data: { tests: testSuites, spec: parseResult.spec },
      });
    }

    // GET /session/:id - Get healing session status
    if (path.match(/^\/session\/[^/]+$/) && request.method === 'GET') {
      const sessionId = path.split('/').pop()!;
      const system = getSelfHealingSystem();
      const session = system.getSession(sessionId);

      if (!session) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      return Response.json({
        success: true,
        data: session,
      });
    }

    // DELETE /session/:id - Cancel healing session
    if (path.match(/^\/session\/[^/]+$/) && request.method === 'DELETE') {
      const sessionId = path.split('/').pop()!;
      const system = getSelfHealingSystem();
      const cancelled = system.cancelSession(sessionId);

      if (!cancelled) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      return Response.json({
        success: true,
        data: { message: 'Session cancelled' },
      });
    }

    // POST /heal - Start self-healing session
    if (path === '/heal' && request.method === 'POST') {
      const body = await request.json() as {
        spec: string;
        parseOptions?: ParseOptions;
        planOptions?: PlanningOptions;
        healingOptions?: Partial<SelfHealingOptions>;
      };

      if (!body.spec) {
        return Response.json({ error: 'Missing spec in request body' }, { status: 400 });
      }

      const parseResult = await getSpecParser().parse(body.spec, body.parseOptions);
      const plan = await getTaskPlanner().plan(parseResult.spec, body.planOptions);
      const sessionId = await startHealing(parseResult.spec, plan, body.healingOptions);

      return Response.json({
        success: true,
        data: { sessionId },
      });
    }

    // GET /health - Health check
    if (path === '/health' && request.method === 'GET') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });

  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Parse and generate from a spec string (simple API)
 */
export async function specDriven(spec: string, options?: PipelineOptions): Promise<PipelineResult> {
  const pipeline = new SpecDrivenPipeline();
  return pipeline.run(spec, options);
}

/**
 * Default pipeline instance
 */
export const pipeline = new SpecDrivenPipeline();
