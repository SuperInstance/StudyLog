/**
 * Spec-Driven Development - Task Planner
 *
 * Breaks down specifications into executable tasks.
 * Implements OpenHands/Devin patterns for educational coding.
 *
 * @module spec-driven/task-planner
 */

import type { ParsedSpec, Requirement, ComponentSpec, Priority } from './spec-parser.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Task in the execution plan
 */
export interface Task {
  /** Unique task ID */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Task type */
  type: TaskType;
  /** Task status */
  status: TaskStatus;
  /** Priority */
  priority: Priority;
  /** Estimated complexity (1-10) */
  complexity: number;
  /** Estimated time in minutes */
  estimatedTime: number;
  /** Dependencies (task IDs that must complete first) */
  dependencies: string[];
  /** Related requirement IDs */
  requirementIds: string[];
  /** Related component IDs */
  componentIds: string[];
  /** Files this task will create/modify */
  files: FileOperation[];
  /** Agent assignment */
  agentType: AgentType;
  /** Subtasks for complex tasks */
  subtasks?: Task[];
  /** Educational notes */
  educational?: EducationalNote[];
}

/**
 * Task types
 */
export enum TaskType {
  /** Create a new file */
  CREATE_FILE = 'create_file',
  /** Modify existing file */
  MODIFY_FILE = 'modify_file',
  /** Delete file */
  DELETE_FILE = 'delete_file',
  /** Run tests */
  RUN_TESTS = 'run_tests',
  /** Run linter */
  RUN_LINTER = 'run_linter',
  /** Format code */
  FORMAT_CODE = 'format_code',
  /** Build/compile */
  BUILD = 'build',
  /** Install dependencies */
  INSTALL_DEPS = 'install_deps',
  /** Generate code */
  GENERATE_CODE = 'generate_code',
  /** Review code */
  REVIEW_CODE = 'review_code',
  /** Documentation */
  DOCUMENTATION = 'documentation',
  /** Setup/initialization */
  SETUP = 'setup',
  /** Deployment */
  DEPLOY = 'deploy',
}

/**
 * Task status
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * File operation
 */
export interface FileOperation {
  /** File path */
  path: string;
  /** Operation type */
  operation: FileOperationType;
  /** Content (for create/modify) */
  content?: string;
  /** Language for syntax highlighting */
  language?: string;
}

/**
 * File operation types
 */
export enum FileOperationType {
  CREATE = 'create',
  MODIFY = 'modify',
  DELETE = 'delete',
  RENAME = 'rename',
}

/**
 * Agent types for task assignment
 */
export enum AgentType {
  /** Fast, pattern-based agent (Zooplankton) */
  ZOOPLANKTON = 'zooplankton',
  /** Code generation specialist (Deckhand) */
  DECKHAND = 'deckhand',
  /** Testing specialist (Tester) */
  TESTER = 'tester',
  /** Code review specialist (Builder) */
  BUILDER = 'builder',
  /** Orchestrator for complex tasks (Captain) */
  CAPTAIN = 'captain',
  /** Full AI-powered generation (Whale) */
  WHALE = 'whale',
}

/**
 * Educational note for learning
 */
export interface EducationalNote {
  /** Note type */
  type: 'concept' | 'pattern' | 'best_practice' | 'warning' | 'tip';
  /** Note title */
  title: string;
  /** Note content */
  content: string;
  /** Related resources */
  resources?: string[];
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  /** Plan ID */
  id: string;
  /** Source spec ID */
  specId: string;
  /** Plan name */
  name: string;
  /** Plan description */
  description: string;
  /** All tasks in dependency order */
  tasks: Task[];
  /** Critical path tasks */
  criticalPath: string[];
  /** Total estimated time */
  totalEstimatedTime: number;
  /** Total estimated complexity */
  totalComplexity: number;
  /** Parallelizable task groups */
  parallelGroups: TaskGroup[];
  /** Plan metadata */
  metadata: PlanMetadata;
}

/**
 * Task group for parallel execution
 */
export interface TaskGroup {
  /** Group ID */
  id: string;
  /** Group name */
  name: string;
  /** Task IDs in this group */
  taskIds: string[];
  /** Can execute in parallel */
  parallel: boolean;
}

/**
 * Plan metadata
 */
export interface PlanMetadata {
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Plan version */
  version: number;
  /** Total tasks */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
}

/**
 * Planning options
 */
export interface PlanningOptions {
  /** Base directory for file operations */
  baseDir?: string;
  /** Include educational notes */
  educational?: boolean;
  /** Maximum task complexity (split larger tasks) */
  maxComplexity?: number;
  /** Prefer parallelization */
  preferParallel?: boolean;
  /** Agent strategy */
  agentStrategy?: AgentStrategy;
}

/**
 * Agent selection strategy
 */
export enum AgentStrategy {
  /** Always use fastest agent */
  FASTEST = 'fastest',
  /** Balance speed and quality */
  BALANCED = 'balanced',
  /** Always use best quality agent */
  QUALITY = 'quality',
  /** Let AI decide per task */
  ADAPTIVE = 'adaptive',
}

// ============================================================================
// Task Planner Class
// ============================================================================

/**
 * Task Planner
 *
 * Breaks down specifications into executable tasks with dependencies.
 */
export class TaskPlanner {
  private readonly taskComplexityWeights: Record<TaskType, number>;
  private readonly educationalNotes: Map<string, EducationalNote[]>;

  constructor() {
    // Base complexity weights for task types
    this.taskComplexityWeights = {
      [TaskType.CREATE_FILE]: 3,
      [TaskType.MODIFY_FILE]: 2,
      [TaskType.DELETE_FILE]: 1,
      [TaskType.RUN_TESTS]: 1,
      [TaskType.RUN_LINTER]: 1,
      [TaskType.FORMAT_CODE]: 1,
      [TaskType.BUILD]: 2,
      [TaskType.INSTALL_DEPS]: 1,
      [TaskType.GENERATE_CODE]: 5,
      [TaskType.REVIEW_CODE]: 2,
      [TaskType.DOCUMENTATION]: 3,
      [TaskType.SETUP]: 2,
      [TaskType.DEPLOY]: 4,
    };

    this.educationalNotes = this.initializeEducationalNotes();
  }

  /**
   * Create an execution plan from a parsed spec
   */
  async plan(spec: ParsedSpec, options: PlanningOptions = {}): Promise<ExecutionPlan> {
    const tasks: Task[] = [];
    const baseDir = options.baseDir || '/src';

    // Phase 1: Setup tasks
    tasks.push(...this.createSetupTasks(spec, baseDir, options));

    // Phase 2: Create data structures
    tasks.push(...this.createDataStructureTasks(spec, baseDir, options));

    // Phase 3: Create utility functions
    tasks.push(...this.createFunctionTasks(spec, baseDir, options));

    // Phase 4: Create component files
    tasks.push(...this.createComponentTasks(spec, baseDir, options));

    // Phase 5: Create test files
    tasks.push(...this.createTestTasks(spec, baseDir, options));

    // Phase 6: Documentation tasks
    tasks.push(...this.createDocumentationTasks(spec, baseDir, options));

    // Phase 7: Verification tasks
    tasks.push(...this.createVerificationTasks(spec, options));

    // Build dependency graph
    this.buildDependencies(tasks);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(tasks);

    // Group parallelizable tasks
    const parallelGroups = this.groupParallelTasks(tasks, options);

    // Calculate totals
    const totalEstimatedTime = tasks.reduce((sum, t) => sum + t.estimatedTime, 0);
    const totalComplexity = tasks.reduce((sum, t) => sum + t.complexity, 0);

    // Assign agents based on strategy
    this.assignAgents(tasks, options.agentStrategy || AgentStrategy.BALANCED);

    // Add educational notes if enabled
    if (options.educational) {
      this.attachEducationalNotes(tasks);
    }

    return {
      id: this.generateId(),
      specId: spec.id,
      name: `Execution Plan for ${spec.id}`,
      description: `Generated from spec with ${spec.requirements.length} requirements`,
      tasks,
      criticalPath,
      totalEstimatedTime,
      totalComplexity,
      parallelGroups,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        totalTasks: tasks.length,
        completedTasks: 0,
        failedTasks: 0,
      },
    };
  }

  /**
   * Update plan based on execution progress
   */
  updatePlan(plan: ExecutionPlan, updates: { taskId: string; status: TaskStatus }[]): ExecutionPlan {
    const taskMap = new Map(plan.tasks.map(t => [t.id, t]));

    for (const update of updates) {
      const task = taskMap.get(update.taskId);
      if (task) {
        task.status = update.status;
      }
    }

    // Update metadata
    plan.metadata.completedTasks = plan.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    plan.metadata.failedTasks = plan.tasks.filter(t => t.status === TaskStatus.FAILED).length;
    plan.metadata.updatedAt = new Date().toISOString();

    return plan;
  }

  /**
   * Get next executable tasks (dependencies satisfied)
   */
  getNextTasks(plan: ExecutionPlan): Task[] {
    const completedIds = new Set(plan.tasks.filter(t => t.status === TaskStatus.COMPLETED).map(t => t.id));

    return plan.tasks.filter(task => {
      if (task.status !== TaskStatus.PENDING) return false;
      // Check if all dependencies are completed
      return task.dependencies.every(depId => completedIds.has(depId));
    });
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(plan: ExecutionPlan, status: TaskStatus): Task[] {
    return plan.tasks.filter(t => t.status === status);
  }

  /**
   * Get tasks by type
   */
  getTasksByType(plan: ExecutionPlan, type: TaskType): Task[] {
    return plan.tasks.filter(t => t.type === type);
  }

  // ========================================================================
  // Private Methods - Task Creation
  // ========================================================================

  /**
   * Create setup/initialization tasks
   */
  private createSetupTasks(spec: ParsedSpec, baseDir: string, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];

    // Install dependencies task
    if (spec.dependencies.length > 0) {
      tasks.push({
        id: this.generateId(),
        title: 'Install Dependencies',
        description: `Install ${spec.dependencies.length} required dependencies`,
        type: TaskType.INSTALL_DEPS,
        status: TaskStatus.PENDING,
        priority: 'high' as Priority,
        complexity: 1,
        estimatedTime: 5,
        dependencies: [],
        requirementIds: [],
        componentIds: [],
        files: [],
        agentType: AgentType.ZOOPLANKTON,
        educational: options.educational ? [
          {
            type: 'tip',
            title: 'Dependency Management',
            content: 'Always install dependencies before starting development to ensure required packages are available.',
          },
        ] : [],
      });
    }

    // Create directory structure task
    tasks.push({
      id: this.generateId(),
      title: 'Create Directory Structure',
      description: 'Create required directories for the project',
      type: TaskType.SETUP,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 2,
      estimatedTime: 2,
      dependencies: [],
      requirementIds: [],
      componentIds: [],
      files: [],
      agentType: AgentType.ZOOPLANKTON,
    });

    return tasks;
  }

  /**
   * Create data structure tasks
   */
  private createDataStructureTasks(spec: ParsedSpec, baseDir: string, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];
    const setupTaskId = tasks[0]?.id || '';

    for (const ds of spec.dataStructures) {
      const filePath = this.getFilePath(baseDir, ds.name, 'types');
      tasks.push({
        id: this.generateId(),
        title: `Create ${ds.name} ${ds.type}`,
        description: `Define ${ds.type} for ${ds.name} with ${ds.properties.length} properties`,
        type: TaskType.CREATE_FILE,
        status: TaskStatus.PENDING,
        priority: 'high' as Priority,
        complexity: Math.min(5, 2 + ds.properties.length),
        estimatedTime: 3 + ds.properties.length,
        dependencies: [setupTaskId],
        requirementIds: spec.requirements.filter(r => r.text.includes(ds.name)).map(r => r.id),
        componentIds: [],
        files: [{
          path: filePath,
          operation: FileOperationType.CREATE,
          language: this.getLanguageExtension(spec.language),
        }],
        agentType: AgentType.DECKHAND,
        educational: options.educational ? this.getEducationalNotes('data-structures') : [],
      });
    }

    return tasks;
  }

  /**
   * Create function tasks
   */
  private createFunctionTasks(spec: ParsedSpec, baseDir: string, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];
    const setupTaskId = tasks[0]?.id || '';

    // Group functions by utility type
    const utilGroups = this.groupFunctionsByUtility(spec.functions);

    for (const [groupName, functions] of utilGroups) {
      const filePath = this.getFilePath(baseDir, groupName, 'utils');
      tasks.push({
        id: this.generateId(),
        title: `Create ${groupName} Utilities`,
        description: `Implement ${functions.length} utility functions`,
        type: TaskType.CREATE_FILE,
        status: TaskStatus.PENDING,
        priority: 'medium' as Priority,
        complexity: Math.min(7, 3 + functions.length),
        estimatedTime: 5 * functions.length,
        dependencies: [setupTaskId],
        requirementIds: [],
        componentIds: [],
        files: [{
          path: filePath,
          operation: FileOperationType.CREATE,
          language: this.getLanguageExtension(spec.language),
        }],
        agentType: AgentType.DECKHAND,
        educational: options.educational ? this.getEducationalNotes('functions') : [],
      });
    }

    return tasks;
  }

  /**
   * Create component tasks
   */
  private createComponentTasks(spec: ParsedSpec, baseDir: string, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];
    const setupTaskId = tasks[0]?.id || '';

    for (const component of spec.components) {
      const filePath = this.getFilePath(baseDir, component.name, 'components');
      const complexity = this.calculateComponentComplexity(component);
      const maxComplexity = options.maxComplexity || 7;

      if (complexity > maxComplexity) {
        // Split complex component into subtasks
        tasks.push(...this.createComplexComponentTasks(component, spec, baseDir, setupTaskId, options));
      } else {
        tasks.push({
          id: this.generateId(),
          title: `Create ${component.name} Component`,
          description: component.purpose || `Create ${component.type} component`,
          type: TaskType.CREATE_FILE,
          status: TaskStatus.PENDING,
          priority: component.props?.some(p => p.required) ? 'high' as Priority : 'medium' as Priority,
          complexity,
          estimatedTime: complexity * 3,
          dependencies: [setupTaskId],
          requirementIds: spec.requirements.filter(r => r.text.includes(component.name)).map(r => r.id),
          componentIds: [component.id],
          files: [{
            path: filePath,
            operation: FileOperationType.CREATE,
            language: this.getLanguageExtension(spec.language),
          }],
          agentType: AgentType.BUILDER,
          educational: options.educational ? this.getEducationalNotes('components') : [],
        });
      }
    }

    return tasks;
  }

  /**
   * Create tasks for complex components (with subtasks)
   */
  private createComplexComponentTasks(
    component: ComponentSpec,
    spec: ParsedSpec,
    baseDir: string,
    dependencyId: string,
    options: PlanningOptions
  ): Task[] {
    const tasks: Task[] = [];
    const filePath = this.getFilePath(baseDir, component.name, 'components');

    // Parent task
    const parentTask: Task = {
      id: this.generateId(),
      title: `Create ${component.name} Component (Complex)`,
      description: component.purpose || `Create complex ${component.type} component`,
      type: TaskType.CREATE_FILE,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 8,
      estimatedTime: 30,
      dependencies: [dependencyId],
      requirementIds: spec.requirements.filter(r => r.text.includes(component.name)).map(r => r.id),
      componentIds: [component.id],
      files: [{
        path: filePath,
        operation: FileOperationType.CREATE,
        language: this.getLanguageExtension(spec.language),
      }],
      agentType: AgentType.WHALE,
      subtasks: [],
      educational: options.educational ? this.getEducationalNotes('complex-components') : [],
    };

    // Subtask: Create types/interfaces
    const typesTask: Task = {
      id: this.generateId(),
      title: `Define ${component.name} Types`,
      description: 'Define TypeScript interfaces for props and state',
      type: TaskType.CREATE_FILE,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 3,
      estimatedTime: 5,
      dependencies: [dependencyId],
      requirementIds: [],
      componentIds: [],
      files: [{
        path: filePath.replace(/\.tsx?$/, '.types.ts'),
        operation: FileOperationType.CREATE,
        language: 'typescript',
      }],
      agentType: AgentType.DECKHAND,
    };
    parentTask.subtasks?.push(typesTask);
    tasks.push(typesTask);

    // Subtask: Create component skeleton
    const skeletonTask: Task = {
      id: this.generateId(),
      title: `Create ${component.name} Skeleton`,
      description: 'Create basic component structure with props',
      type: TaskType.CREATE_FILE,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 4,
      estimatedTime: 8,
      dependencies: [typesTask.id],
      requirementIds: [],
      componentIds: [],
      files: [{
        path: filePath,
        operation: FileOperationType.CREATE,
        language: this.getLanguageExtension(spec.language),
      }],
      agentType: AgentType.BUILDER,
    };
    parentTask.subtasks?.push(skeletonTask);
    tasks.push(skeletonTask);

    // Subtask: Implement component logic
    const logicTask: Task = {
      id: this.generateId(),
      title: `Implement ${component.name} Logic`,
      description: 'Implement component state management and handlers',
      type: TaskType.MODIFY_FILE,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 6,
      estimatedTime: 12,
      dependencies: [skeletonTask.id],
      requirementIds: [],
      componentIds: [],
      files: [{
        path: filePath,
        operation: FileOperationType.MODIFY,
        language: this.getLanguageExtension(spec.language),
      }],
      agentType: AgentType.BUILDER,
    };
    parentTask.subtasks?.push(logicTask);
    tasks.push(logicTask);

    tasks.push(parentTask);
    return tasks;
  }

  /**
   * Create test tasks
   */
  private createTestTasks(spec: ParsedSpec, baseDir: string, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];

    // Test file for each component
    for (const component of spec.components) {
      const componentTasks = tasks.filter(t =>
        t.componentIds.includes(component.id) && t.type === TaskType.CREATE_FILE
      );
      const testFilePath = this.getFilePath(baseDir, component.name, '__tests__');

      tasks.push({
        id: this.generateId(),
        title: `Create Tests for ${component.name}`,
        description: `Generate unit tests for ${component.name}`,
        type: TaskType.CREATE_FILE,
        status: TaskStatus.PENDING,
        priority: 'medium' as Priority,
        complexity: 4,
        estimatedTime: 10,
        dependencies: componentTasks.map(t => t.id),
        requirementIds: spec.testRequirements.filter(t => t.scenario.includes(component.name)).map(t => t.id),
        componentIds: [component.id],
        files: [{
          path: testFilePath,
          operation: FileOperationType.CREATE,
          language: 'typescript',
        }],
        agentType: AgentType.TESTER,
        educational: options.educational ? this.getEducationalNotes('testing') : [],
      });
    }

    return tasks;
  }

  /**
   * Create documentation tasks
   */
  private createDocumentationTasks(spec: ParsedSpec, baseDir: string, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];
    const allCreateTasks = tasks.filter(t => t.type === TaskType.CREATE_FILE);

    // Create README task
    tasks.push({
      id: this.generateId(),
      title: 'Create Documentation',
      description: 'Generate README documentation',
      type: TaskType.DOCUMENTATION,
      status: TaskStatus.PENDING,
      priority: 'low' as Priority,
      complexity: 3,
      estimatedTime: 10,
      dependencies: allCreateTasks.map(t => t.id),
      requirementIds: [],
      componentIds: [],
      files: [{
        path: `${baseDir}/README.md`,
        operation: FileOperationType.CREATE,
        language: 'markdown',
      }],
      agentType: AgentType.CAPTAIN,
      educational: options.educational ? this.getEducationalNotes('documentation') : [],
    });

    return tasks;
  }

  /**
   * Create verification tasks
   */
  private createVerificationTasks(spec: ParsedSpec, options: PlanningOptions): Task[] {
    const tasks: Task[] = [];
    const allPreviousTasks = tasks.map(t => t.id);

    // Run linter
    tasks.push({
      id: this.generateId(),
      title: 'Run Linter',
      description: 'Check code style and linting rules',
      type: TaskType.RUN_LINTER,
      status: TaskStatus.PENDING,
      priority: 'medium' as Priority,
      complexity: 1,
      estimatedTime: 2,
      dependencies: allPreviousTasks,
      requirementIds: [],
      componentIds: [],
      files: [],
      agentType: AgentType.ZOOPLANKTON,
    });

    // Run tests
    tasks.push({
      id: this.generateId(),
      title: 'Run Tests',
      description: 'Execute all tests',
      type: TaskType.RUN_TESTS,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 2,
      estimatedTime: 5,
      dependencies: allPreviousTasks,
      requirementIds: spec.testRequirements.map(t => t.id),
      componentIds: [],
      files: [],
      agentType: AgentType.TESTER,
    });

    // Build task
    tasks.push({
      id: this.generateId(),
      title: 'Build Project',
      description: 'Compile and build the project',
      type: TaskType.BUILD,
      status: TaskStatus.PENDING,
      priority: 'high' as Priority,
      complexity: 3,
      estimatedTime: 3,
      dependencies: allPreviousTasks,
      requirementIds: [],
      componentIds: [],
      files: [],
      agentType: AgentType.ZOOPLANKTON,
    });

    return tasks;
  }

  // ========================================================================
  // Private Methods - Analysis
  // ========================================================================

  /**
   * Build dependency relationships between tasks
   */
  private buildDependencies(tasks: Task[]): void {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const fileMap = new Map<string, Task[]>();

    // Group tasks by file path
    for (const task of tasks) {
      for (const file of task.files) {
        if (!fileMap.has(file.path)) {
          fileMap.set(file.path, []);
        }
        fileMap.get(file.path)!.push(task);
      }
    }

    // Add dependencies for files that depend on other files
    for (const task of tasks) {
      for (const file of task.files) {
        // Check if this file imports from another file being created
        const relatedTasks = this.findRelatedFileTasks(file.path, fileMap);
        for (const related of relatedTasks) {
          if (related.id !== task.id && !task.dependencies.includes(related.id)) {
            task.dependencies.push(related.id);
          }
        }
      }
    }
  }

  /**
   * Find tasks that create files this task depends on
   */
  private findRelatedFileTasks(filePath: string, fileMap: Map<string, Task[]>): Task[] {
    const related: Task[] = [];

    // Simple heuristic: types files are dependencies, utils are dependencies
    if (filePath.includes('/components/')) {
      // Component depends on types
      for (const [path, tasks] of fileMap) {
        if (path.includes('/types/') || path.includes('.types.')) {
          related.push(...tasks);
        }
      }
    }

    return related;
  }

  /**
   * Calculate critical path through tasks
   */
  private calculateCriticalPath(tasks: Task[]): string[] {
    // Build dependency graph
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const incomingEdges = new Map<string, Set<string>>();
    const processed = new Set<string>();
    const path: string[] = [];

    // Initialize incoming edges
    for (const task of tasks) {
      incomingEdges.set(task.id, new Set(task.dependencies));
    }

    // Topological sort starting from tasks with no dependencies
    while (processed.size < tasks.length) {
      // Find tasks with all dependencies processed
      const ready = tasks.filter(t =>
        !processed.has(t.id) &&
        [...(incomingEdges.get(t.id) || [])].every(depId => processed.has(depId))
      );

      if (ready.length === 0) {
        // Circular dependency or issue - break
        break;
      }

      // Sort by complexity (higher complexity first for critical path)
      ready.sort((a, b) => b.complexity - a.complexity);

      // Add highest complexity task to critical path
      const critical = ready[0];
      path.push(critical.id);
      processed.add(critical.id);

      // Also process other ready tasks in parallel
      for (const task of ready.slice(1)) {
        processed.add(task.id);
      }
    }

    return path;
  }

  /**
   * Group tasks that can run in parallel
   */
  private groupParallelTasks(tasks: Task[], options: PlanningOptions): TaskGroup[] {
    const groups: TaskGroup[] = [];
    const processed = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    let iteration = 0;
    while (processed.size < tasks.length && iteration < tasks.length) {
      // Find tasks whose dependencies are all processed
      const readyTasks = tasks.filter(t =>
        !processed.has(t.id) &&
        t.dependencies.every(depId => processed.has(depId))
      );

      if (readyTasks.length === 0) {
        break;
      }

      // Create a group for these tasks
      groups.push({
        id: this.generateId(),
        name: `Group ${groups.length + 1}`,
        taskIds: readyTasks.map(t => t.id),
        parallel: readyTasks.length > 1 && options.preferParallel !== false,
      });

      // Mark as processed
      for (const task of readyTasks) {
        processed.add(task.id);
      }

      iteration++;
    }

    return groups;
  }

  /**
   * Assign agents to tasks based on strategy
   */
  private assignAgents(tasks: Task[], strategy: AgentStrategy): void {
    for (const task of tasks) {
      switch (strategy) {
        case AgentStrategy.FASTEST:
          // Use fastest agent possible
          if (task.complexity <= 3) {
            task.agentType = AgentType.ZOOPLANKTON;
          } else if (task.complexity <= 5) {
            task.agentType = AgentType.DECKHAND;
          } else {
            task.agentType = AgentType.BUILDER;
          }
          break;

        case AgentStrategy.QUALITY:
          // Always use highest quality agent
          if (task.complexity >= 7) {
            task.agentType = AgentType.WHALE;
          } else {
            task.agentType = AgentType.CAPTAIN;
          }
          break;

        case AgentStrategy.ADAPTIVE:
          // Already set during task creation, keep as is
          break;

        case AgentStrategy.BALANCED:
        default:
          // Keep the agent assigned during creation
          break;
      }
    }
  }

  /**
   * Attach educational notes to tasks
   */
  private attachEducationalNotes(tasks: Task[]): void {
    for (const task of tasks) {
      const notes = this.educationalNotes.get(task.type);
      if (notes && !task.educational) {
        task.educational = notes;
      }
    }
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  /**
   * Calculate component complexity
   */
  private calculateComponentComplexity(component: ComponentSpec): number {
    let complexity = 2;

    if (component.props) complexity += component.props.length * 0.5;
    if (component.state) complexity += component.state?.length * 0.5;
    if (component.methods) complexity += component.methods.length * 0.3;
    if (component.events) complexity += component.events.length * 0.3;
    if (component.children) complexity += component.children.length * 0.5;

    return Math.min(10, Math.ceil(complexity));
  }

  /**
   * Group functions by utility category
   */
  private groupFunctionsByUtility(functions: ReturnType<typeof import('./spec-parser')['FunctionSpec']>[]): Map<string, typeof functions> {
    const groups = new Map<string, typeof functions>();

    for (const func of functions) {
      // Try to determine category from name
      let category = 'common';

      const name = func.name.toLowerCase();
      if (/format|parse|convert|transform/i.test(name)) category = 'format';
      else if (/validate|check|verify/i.test(name)) category = 'validation';
      else if (/fetch|request|get|load/i.test(name)) category = 'api';
      else if (/calculate|compute|derive/i.test(name)) category = 'math';

      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(func);
    }

    return groups;
  }

  /**
   * Get file path for a component
   */
  private getFilePath(baseDir: string, name: string, subfolder: string): string {
    const fileName = this.toKebabCase(name);
    const ext = this.getFileExtension(subfolder);
    return `${baseDir}/${subfolder}/${fileName}${ext}`;
  }

  /**
   * Get file extension based on language
   */
  private getFileExtension(subfolder: string): string {
    if (subfolder === '__tests__') return '.test.ts';
    if (subfolder === 'components') return '.tsx';
    if (subfolder === 'types') return '.ts';
    return '.ts';
  }

  /**
   * Get language extension string
   */
  private getLanguageExtension(language: ReturnType<typeof import('./spec-parser')['Language']>): string {
    switch (language) {
      case 'typescript': return 'typescript';
      case 'javascript': return 'javascript';
      case 'python': return 'python';
      case 'godot_gdscript': return 'gdscript';
      case 'rust': return 'rust';
      case 'go': return 'go';
      default: return 'typescript';
    }
  }

  /**
   * Convert to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Get educational notes for a topic
   */
  private getEducationalNotes(topic: string): EducationalNote[] {
    const all: EducationalNote[] = [];
    for (const notes of this.educationalNotes.values()) {
      all.push(...notes);
    }
    return all.filter(n =>
      n.resources?.some(r => r.toLowerCase().includes(topic))
    );
  }

  /**
   * Initialize educational notes database
   */
  private initializeEducationalNotes(): Map<string, EducationalNote[]> {
    const notes = new Map<string, EducationalNote[]>();

    // Component development notes
    notes.set(TaskType.CREATE_FILE, [
      {
        type: 'best_practice',
        title: 'Component Composition',
        content: 'Break down complex UIs into smaller, reusable components. Each component should have a single responsibility.',
        resources: ['component-composition', 'solid-principles'],
      },
    ]);

    // Testing notes
    notes.set(TaskType.RUN_TESTS, [
      {
        type: 'best_practice',
        title: 'Test-Driven Development',
        content: 'Write tests before implementing features. This helps clarify requirements and catches regressions early.',
        resources: ['tdd', 'testing-best-practices'],
      },
    ]);

    // Additional topic-based notes
    const topicNotes: EducationalNote[] = [
      {
        type: 'concept',
        title: 'Type Safety',
        content: 'Using TypeScript interfaces provides compile-time type checking and better IDE support.',
        resources: ['typescript-basics', 'type-system'],
      },
      {
        type: 'pattern',
        title: 'Props Drilling',
        content: 'Avoid passing props through multiple layers. Consider context or state management for deeply shared state.',
        resources: ['react-context', 'state-management'],
      },
      {
        type: 'warning',
        title: 'Circular Dependencies',
        content: 'Be careful not to create circular imports between files. This can cause runtime errors.',
        resources: ['module-system', 'dependency-management'],
      },
    ];

    notes.set('data-structures', topicNotes);
    notes.set('functions', topicNotes);
    notes.set('components', topicNotes);
    notes.set('complex-components', [
      {
        type: 'best_practice',
        title: 'Incremental Development',
        content: 'Build complex features incrementally. Start with types, then skeleton, then implement logic.',
        resources: ['incremental-development', 'agile-methodology'],
      },
    ]);
    notes.set('testing', [
      {
        type: 'concept',
        title: 'Test Coverage',
        content: 'Aim for high test coverage, but focus on testing critical paths and edge cases rather than chasing 100%.',
        resources: ['test-coverage', 'testing-strategies'],
      },
    ]);
    notes.set('documentation', [
      {
        type: 'best_practice',
        title: 'Self-Documenting Code',
        content: 'Write code that is clear enough to not need extensive comments. Use comments to explain "why", not "what".',
        resources: ['clean-code', 'documentation-best-practices'],
      },
    ]);

    return notes;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// Factory
// ============================================================================

let plannerInstance: TaskPlanner | null = null;

/**
 * Get or create task planner instance
 */
export function getTaskPlanner(): TaskPlanner {
  if (!plannerInstance) {
    plannerInstance = new TaskPlanner();
  }
  return plannerInstance;
}

/**
 * Create a plan (convenience function)
 */
export async function createPlan(spec: ParsedSpec, options?: PlanningOptions): Promise<ExecutionPlan> {
  const planner = getTaskPlanner();
  return planner.plan(spec, options);
}
