/**
 * Agent Planner - Task Decomposition Engine
 *
 * Analyzes user requests and creates execution plans
 * with decomposed steps and tool requirements.
 */

import type {
  PlanningStep,
  ExecutionPlan,
  AgentTool,
  TaskPriority,
  ChatMessage,
} from '../types/index.js';

// ============================================================================
// Task Analysis
// ============================================================================

interface TaskAnalysis {
  /** Task category */
  category: TaskCategory;
  /** Estimated complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Tools needed */
  tools: string[];
  /** Estimated steps */
  estimatedSteps: number;
  /** Token estimate */
  estimatedTokens: number;
}

type TaskCategory =
  | 'code_generation'
  | 'code_explanation'
  | 'refactoring'
  | 'debugging'
  | 'file_operations'
  | 'testing'
  | 'research'
  | 'general';

/**
 * Analyze a user request to determine task characteristics
 */
export function analyzeRequest(request: string): TaskAnalysis {
  const lower = request.toLowerCase();

  // Determine category
  let category: TaskCategory = 'general';
  const patterns: Array<{ pattern: RegExp; cat: TaskCategory }> = [
    { pattern: /(?:generate|create|write|build|implement)\s+(?:code|function|class|component)/, cat: 'code_generation' },
    { pattern: /(?:explain|describe|what is|how does)/, cat: 'code_explanation' },
    { pattern: /(?:refactor|optimize|improve|clean up)/, cat: 'refactoring' },
    { pattern: /(?:debug|fix|error|bug|issue)/, cat: 'debugging' },
    { pattern: /(?:file|create|delete|rename|move)\s+(?:file|folder|directory)/, cat: 'file_operations' },
    { pattern: /(?:test|spec|coverage)/, cat: 'testing' },
    { pattern: /(?:find|search|lookup|research)/, cat: 'research' },
  ];

  for (const { pattern, cat } of patterns) {
    if (pattern.test(lower)) {
      category = cat;
      break;
    }
  }

  // Determine complexity
  const complexityIndicators = {
    high: ['multiple', 'several', 'complex', 'architecture', 'system', 'integration', 'api'],
    low: ['simple', 'basic', 'quick', 'small', 'single'],
  };

  let complexity: TaskAnalysis['complexity'] = 'medium';
  for (const word of complexityIndicators.high) {
    if (lower.includes(word)) {
      complexity = 'high';
      break;
    }
  }
  if (complexity === 'medium') {
    for (const word of complexityIndicators.low) {
      if (lower.includes(word)) {
        complexity = 'low';
        break;
      }
    }
  }

  // Determine tools needed
  const tools: string[] = ['read_file'];
  switch (category) {
    case 'code_generation':
      tools.push('write_file', 'code_analyze');
      break;
    case 'refactoring':
      tools.push('write_file', 'find_references', 'code_analyze');
      break;
    case 'debugging':
      tools.push('read_file', 'code_analyze', 'search');
      break;
    case 'file_operations':
      tools.push('write_file', 'delete_file', 'list_files');
      break;
    case 'testing':
      tools.push('run_tests', 'code_analyze');
      break;
  }

  // Estimate steps and tokens
  const complexityMultiplier = { low: 1, medium: 2, high: 3 };
  const estimatedSteps = Math.ceil((5 + request.split(',').length) * complexityMultiplier[complexity] / 2);
  const estimatedTokens = estimatedSteps * 500 * complexityMultiplier[complexity];

  return {
    category,
    complexity,
    tools,
    estimatedSteps,
    estimatedTokens,
  };
}

// ============================================================================
// Plan Generation
// ============================================================================

/**
 * Planning options
 */
interface PlanningOptions {
  /** Available tools */
  availableTools: AgentTool[];
  /** User preferences */
  preferences?: {
    /** Prefer faster execution */
    fast?: boolean;
    /** Prefer thoroughness */
    thorough?: boolean;
  };
}

/**
 * Generate an execution plan for a request
 */
export async function generatePlan(
  request: string,
  context: {
    workspaceId: string;
    files?: string[];
    previousPlans?: ExecutionPlan[];
  },
  options: PlanningOptions
): Promise<ExecutionPlan> {
  const analysis = analyzeRequest(request);
  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Generate planning steps based on category
  const steps = generateStepsForCategory(
    analysis.category,
    request,
    analysis.tools,
    options.availableTools
  );

  // Estimate cost (rough approximation)
  const costPerMillion = 0.28; // DeepSeek output cost
  const estimatedCost = (analysis.estimatedTokens / 1_000_000) * costPerMillion;

  return {
    id: planId,
    request,
    summary: generateSummary(request, analysis),
    steps,
    estimatedTokens: analysis.estimatedTokens,
    estimatedCost,
    createdAt: Date.now(),
  };
}

/**
 * Generate planning steps based on task category
 */
function generateStepsForCategory(
  category: TaskCategory,
  request: string,
  tools: string[],
  availableTools: AgentTool[]
): PlanningStep[] {
  const steps: PlanningStep[] = [];
  const availableToolNames = new Set(availableTools.map(t => t.name));

  // Filter tools to only available ones
  const availableToolsFiltered = tools.filter(t => availableToolNames.has(t));

  switch (category) {
    case 'code_generation':
      steps.push(
        {
          step: 1,
          description: 'Analyze requirements and identify needed files',
          tools: ['read_file'],
          estimatedTokens: 500,
          dependencies: [],
          status: 'pending',
        },
        {
          step: 2,
          description: 'Read existing code context and patterns',
          tools: ['read_file', 'code_analyze'],
          estimatedTokens: 1000,
          dependencies: [0],
          status: 'pending',
        },
        {
          step: 3,
          description: 'Generate code following project patterns',
          tools: ['code_analyze'],
          estimatedTokens: 2000,
          dependencies: [1],
          status: 'pending',
        },
        {
          step: 4,
          description: 'Write generated code to files',
          tools: ['write_file'],
          estimatedTokens: 500,
          dependencies: [2],
          status: 'pending',
        },
        {
          step: 5,
          description: 'Verify generated code and check for issues',
          tools: ['code_analyze'],
          estimatedTokens: 1000,
          dependencies: [3],
          status: 'pending',
        }
      );
      break;

    case 'refactoring':
      steps.push(
        {
          step: 1,
          description: 'Analyze current code structure',
          tools: ['read_file', 'code_analyze'],
          estimatedTokens: 1000,
          dependencies: [],
          status: 'pending',
        },
        {
          step: 2,
          description: 'Identify refactoring opportunities',
          tools: ['code_analyze', 'find_references'],
          estimatedTokens: 1500,
          dependencies: [0],
          status: 'pending',
        },
        {
          step: 3,
          description: 'Plan refactoring changes',
          tools: ['code_analyze'],
          estimatedTokens: 1000,
          dependencies: [1],
          status: 'pending',
        },
        {
          step: 4,
          description: 'Apply refactoring changes',
          tools: ['write_file'],
          estimatedTokens: 1500,
          dependencies: [2],
          status: 'pending',
        },
        {
          step: 5,
          description: 'Verify changes and run tests',
          tools: ['run_tests', 'code_analyze'],
          estimatedTokens: 1000,
          dependencies: [3],
          status: 'pending',
        }
      );
      break;

    case 'debugging':
      steps.push(
        {
          step: 1,
          description: 'Gather error information and context',
          tools: ['read_file'],
          estimatedTokens: 500,
          dependencies: [],
          status: 'pending',
        },
        {
          step: 2,
          description: 'Analyze error patterns and identify root cause',
          tools: ['code_analyze', 'search'],
          estimatedTokens: 1500,
          dependencies: [0],
          status: 'pending',
        },
        {
          step: 3,
          description: 'Propose and validate fixes',
          tools: ['code_analyze'],
          estimatedTokens: 1000,
          dependencies: [1],
          status: 'pending',
        },
        {
          step: 4,
          description: 'Apply fix to code',
          tools: ['write_file'],
          estimatedTokens: 500,
          dependencies: [2],
          status: 'pending',
        },
        {
          step: 5,
          description: 'Verify fix resolves the issue',
          tools: ['run_tests'],
          estimatedTokens: 500,
          dependencies: [3],
          status: 'pending',
        }
      );
      break;

    case 'code_explanation':
      steps.push(
        {
          step: 1,
          description: 'Read and parse the code to explain',
          tools: ['read_file'],
          estimatedTokens: 500,
          dependencies: [],
          status: 'pending',
        },
        {
          step: 2,
          description: 'Analyze code structure and patterns',
          tools: ['code_analyze'],
          estimatedTokens: 1000,
          dependencies: [0],
          status: 'pending',
        },
        {
          step: 3,
          description: 'Generate explanation',
          tools: [],
          estimatedTokens: 1500,
          dependencies: [1],
          status: 'pending',
        }
      );
      break;

    default:
      // General task - create flexible steps
      steps.push(
        {
          step: 1,
          description: 'Understand the request',
          tools: [],
          estimatedTokens: 500,
          dependencies: [],
          status: 'pending',
        },
        {
          step: 2,
          description: 'Gather necessary context',
          tools: availableToolsFiltered.slice(0, 3),
          estimatedTokens: 1000,
          dependencies: [0],
          status: 'pending',
        },
        {
          step: 3,
          description: 'Execute the task',
          tools: availableToolsFiltered,
          estimatedTokens: 2000,
          dependencies: [1],
          status: 'pending',
        },
        {
          step: 4,
          description: 'Verify results',
          tools: [],
          estimatedTokens: 500,
          dependencies: [2],
          status: 'pending',
        }
      );
  }

  return steps;
}

/**
 * Generate a plan summary
 */
function generateSummary(request: string, analysis: TaskAnalysis): string {
  const categoryDescriptions: Record<TaskCategory, string> = {
    code_generation: 'Generate new code',
    code_explanation: 'Explain code',
    refactoring: 'Refactor existing code',
    debugging: 'Debug and fix issues',
    file_operations: 'Perform file operations',
    testing: 'Work with tests',
    research: 'Research and gather information',
    general: 'Complete task',
  };

  return `${categoryDescriptions[analysis.category]} (${analysis.complexity} complexity)`;
}

// ============================================================================
// Priority Determination
// ============================================================================

/**
 * Determine task priority from request
 */
export function determinePriority(request: string): TaskPriority {
  const lower = request.toLowerCase();

  // Urgent indicators
  if (/^(urgent|critical|asap|immediately|blocking)/i.test(lower)) {
    return 'urgent';
  }

  // High priority indicators
  if (/^(high|important|priority|soon)/i.test(lower) ||
      /(?=.*\b(bug|error|broken|failing)\b)(?=.*\b(now|fix|please)\b)/i.test(lower)) {
    return 'high';
  }

  // Low priority indicators
  if (/^(when|eventually|later|someday|low priority)/i.test(lower) ||
      /(?=.*\b(can you|could you|would you)\b)(?=.*\b(someday|when|eventually)\b)/i.test(lower)) {
    return 'low';
  }

  return 'normal';
}

// ============================================================================
// Plan Validation
// ============================================================================

/**
 * Validate that a plan is executable
 */
export function validatePlan(
  plan: ExecutionPlan,
  availableTools: AgentTool[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const availableToolNames = new Set(availableTools.map(t => t.name));

  // Check that all required tools are available
  for (const step of plan.steps) {
    for (const tool of step.tools) {
      if (!availableToolNames.has(tool)) {
        errors.push(`Step ${step.step} requires unavailable tool: ${tool}`);
      }
    }
  }

  // Check that dependencies are valid
  for (const step of plan.steps) {
    for (const dep of step.dependencies) {
      if (dep >= step.step) {
        errors.push(`Step ${step.step} has invalid dependency on step ${dep}`);
      }
    }
  }

  // Check for circular dependencies (simplified check)
  const visited = new Set<number>();
  const recursionStack = new Set<number>();

  function hasCycle(step: number): boolean {
    if (recursionStack.has(step)) return true;
    if (visited.has(step)) return false;

    visited.add(step);
    recursionStack.add(step);

    const stepData = plan.steps[step];
    if (stepData) {
      for (const dep of stepData.dependencies) {
        if (hasCycle(dep)) return true;
      }
    }

    recursionStack.delete(step);
    return false;
  }

  for (let i = 0; i < plan.steps.length; i++) {
    if (hasCycle(i)) {
      errors.push('Circular dependencies detected in plan');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
