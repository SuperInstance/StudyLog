/**
 * Spec-Driven Development - Spec Parser
 *
 * Parse natural language specifications into structured requirements.
 * Implements OpenHands/Devin patterns for educational coding.
 *
 * @module spec-driven/spec-parser
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed specification structure
 */
export interface ParsedSpec {
  /** Unique spec ID */
  id: string;
  /** Original natural language spec */
  original: string;
  /** Extracted requirements */
  requirements: Requirement[];
  /** Identified components */
  components: ComponentSpec[];
  /** Identified data structures */
  dataStructures: DataStructureSpec[];
  /** Identified functions/methods */
  functions: FunctionSpec[];
  /** Dependencies/imports */
  dependencies: Dependency[];
  /** Test requirements */
  testRequirements: TestRequirement[];
  /** Quality level requested */
  qualityLevel: QualityLevel;
  /** Language/framework */
  language: Language;
  /** Metadata */
  metadata: SpecMetadata;
}

/**
 * Individual requirement
 */
export interface Requirement {
  /** Requirement ID */
  id: string;
  /** Requirement text */
  text: string;
  /** Requirement type */
  type: RequirementType;
  /** Priority */
  priority: Priority;
  /** Is this a must-have */
  mustHave: boolean;
  /** Related requirements */
  dependencies: string[];
  /** Acceptance criteria */
  acceptanceCriteria?: string[];
}

/**
 * Requirement types
 */
export enum RequirementType {
  FUNCTIONAL = 'functional',
  NON_FUNCTIONAL = 'non_functional',
  UI = 'ui',
  API = 'api',
  DATA = 'data',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  TESTING = 'testing',
}

/**
 * Priority levels
 */
export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Component specification
 */
export interface ComponentSpec {
  /** Component ID */
  id: string;
  /** Component name */
  name: string;
  /** Component type */
  type: ComponentType;
  /** Purpose description */
  purpose: string;
  /** Props/inputs */
  props?: PropertySpec[];
  /** State */
  state?: PropertySpec[];
  /** Methods */
  methods?: string[];
  /** Events it emits */
  events?: string[];
  /** Child components */
  children?: string[];
  /** Styling requirements */
  styling?: StylingSpec;
}

/**
 * Component types
 */
export enum ComponentType {
  WIDGET = 'widget',
  PANEL = 'panel',
  DIALOG = 'dialog',
  FORM = 'form',
  LIST = 'list',
  TABLE = 'table',
  BUTTON = 'button',
  INPUT = 'input',
  CONTAINER = 'container',
  LAYOUT = 'layout',
  SERVICE = 'service',
  WORKER = 'worker',
  MIDDLEWARE = 'middleware',
  HOOK = 'hook',
  UTILITY = 'utility',
}

/**
 * Property specification
 */
export interface PropertySpec {
  /** Property name */
  name: string;
  /** Property type */
  type: string;
  /** Is required */
  required: boolean;
  /** Default value */
  default?: unknown;
  /** Description */
  description?: string;
  /** Validation rules */
  validation?: string[];
}

/**
 * Styling specification
 */
export interface StylingSpec {
  /** CSS framework */
  framework?: 'css' | 'scss' | 'tailwind' | 'styled-components';
  /** Theme requirements */
  theme?: string[];
  /** Responsive requirements */
  responsive?: boolean;
  /** Animation requirements */
  animations?: string[];
}

/**
 * Data structure specification
 */
export interface DataStructureSpec {
  /** Structure ID */
  id: string;
  /** Structure name */
  name: string;
  /** Structure type */
  type: 'interface' | 'type' | 'class' | 'enum';
  /** Properties */
  properties: PropertySpec[];
  /** Generic parameters */
  generics?: string[];
  /** Extends */
  extends?: string;
  /** Description */
  description?: string;
}

/**
 * Function specification
 */
export interface FunctionSpec {
  /** Function ID */
  id: string;
  /** Function name */
  name: string;
  /** Parameters */
  parameters: PropertySpec[];
  /** Return type */
  returnType: string;
  /** Is async */
  isAsync: boolean;
  /** Is generator */
  isGenerator: boolean;
  /** Description */
  description?: string;
  /** Error handling */
  throws?: string[];
}

/**
 * Dependency specification
 */
export interface Dependency {
  /** Package name */
  name: string;
  /** Version constraint */
  version?: string;
  /** Is dev dependency */
  dev: boolean;
  /** Import path (for internal modules) */
  importPath?: string;
  /** Why it's needed */
  reason: string;
}

/**
 * Test requirement
 */
export interface TestRequirement {
  /** Test ID */
  id: string;
  /** What to test */
  scenario: string;
  /** Expected behavior */
  expectation: string;
  /** Test type */
  type: TestType;
  /** Priority */
  priority: Priority;
}

/**
 * Test types
 */
export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  VISUAL = 'visual',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  SECURITY = 'security',
}

/**
 * Quality levels
 */
export enum QualityLevel {
  PROTOTYPE = 'prototype',
  MVP = 'mvp',
  PRODUCTION = 'production',
  ENTERPRISE = 'enterprise',
}

/**
 * Supported languages/frameworks
 */
export enum Language {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  GODOT_GDSCRIPT = 'godot_gdscript',
  RUST = 'rust',
  GO = 'go',
}

/**
 * Spec metadata
 */
export interface SpecMetadata {
  /** Timestamp parsed */
  parsedAt: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Complexity score (1-10) */
  complexity: number;
  /** Estimated tasks */
  estimatedTasks: number;
  /** Keywords extracted */
  keywords: string[];
  /** Ambiguous parts that need clarification */
  ambiguous: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Parse options
 */
export interface ParseOptions {
  /** Quality level hint */
  qualityLevel?: QualityLevel;
  /** Language hint */
  language?: Language;
  /** Component type hint */
  componentType?: ComponentType;
  /** Strict parsing (fail on ambiguity) */
  strict?: boolean;
  /** Include educational comments */
  educational?: boolean;
}

/**
 * Parse result
 */
export interface ParseResult {
  /** Parsed spec */
  spec: ParsedSpec;
  /** Warnings during parsing */
  warnings: string[];
  /** Suggestions for the user */
  suggestions: string[];
  /** Questions to clarify ambiguities */
  questions: string[];
}

// ============================================================================
// Spec Parser Class
// ============================================================================

/**
 * Spec Parser
 *
 * Parses natural language specifications into structured requirements.
 * Uses LLM-based extraction with rule-based fallbacks.
 */
export class SpecParser {
  private readonly patterns: Map<RegExp, RequirementType>;
  private readonly componentPatterns: Map<RegExp, ComponentType>;
  private readonly languagePatterns: Map<RegExp, Language>;

  constructor() {
    // Initialize patterns for requirement type detection
    this.patterns = new Map([
      [/should (be able to|support|handle|allow)/i, RequirementType.FUNCTIONAL],
      [/must (include|have|provide|expose)/i, RequirementType.FUNCTIONAL],
      [/needs? to (validate|verify|check)/i, RequirementType.FUNCTIONAL],
      [/user can (click|tap|select|input|enter)/i, RequirementType.UI],
      [/display|show|render|present/i, RequirementType.UI],
      [/responsive|mobile|desktop|tablet/i, RequirementType.UI],
      [/api|endpoint|route|handler/i, RequirementType.API],
      [/get|post|put|delete|patch/i, RequirementType.API],
      [/fast|performant|optimize|efficient/i, RequirementType.PERFORMANCE],
      [/secure|encrypt|auth|permission/i, RequirementType.SECURITY],
      [/accessible|a11y|screen.?reader|wcag/i, RequirementType.ACCESSIBILITY],
      [/test|spec|coverage|mock/i, RequirementType.TESTING],
    ]);

    // Initialize patterns for component type detection
    this.componentPatterns = new Map([
      [/widget|panel|sidebar/i, ComponentType.WIDGET],
      [/dialog|modal|popup/i, ComponentType.DIALOG],
      [/form|input|field/i, ComponentType.FORM],
      [/list|grid|table/i, ComponentType.LIST],
      [/button|clickable/i, ComponentType.BUTTON],
      [/service|provider/i, ComponentType.SERVICE],
      [/worker|background/i, ComponentType.WORKER],
      [/middleware|interceptor/i, ComponentType.MIDDLEWARE],
      [/hook|use\w+/i, ComponentType.HOOK],
    ]);

    // Initialize patterns for language detection
    this.languagePatterns = new Map([
      [/typescript|ts\.|\.tsx/i, Language.TYPESCRIPT],
      [/javascript|js\.|\.jsx/i, Language.JAVASCRIPT],
      [/python|py\.|\.py/i, Language.PYTHON],
      [/godot|gdscript|\.gd/i, Language.GODOT_GDSCRIPT],
      [/rust|rs\.|\.rs/i, Language.RUST],
      [/go|golang|\.go/i, Language.GO],
    ]);
  }

  /**
   * Parse a natural language specification
   */
  async parse(spec: string, options: ParseOptions = {}): Promise<ParseResult> {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const questions: string[] = [];

    // Detect language
    const language = options.language ?? this.detectLanguage(spec);

    // Detect quality level
    const qualityLevel = options.qualityLevel ?? this.detectQualityLevel(spec);

    // Split into sentences/clauses
    const sentences = this.splitIntoSentences(spec);

    // Extract requirements
    const requirements = this.extractRequirements(sentences, warnings);

    // Extract components
    const components = this.extractComponents(sentences, language, warnings);

    // Extract data structures
    const dataStructures = this.extractDataStructures(sentences);

    // Extract functions
    const functions = this.extractFunctions(sentences);

    // Extract dependencies
    const dependencies = this.extractDependencies(sentences, language);

    // Extract test requirements
    const testRequirements = this.extractTestRequirements(sentences);

    // Generate metadata
    const metadata = this.generateMetadata(spec, requirements, components);

    // Check for ambiguities
    if (options.strict !== false) {
      const ambiguities = this.detectAmbiguities(spec, requirements);
      questions.push(...ambiguities);
    }

    // Generate suggestions
    suggestions.push(...this.generateSuggestions(spec, requirements, components));

    // Build parsed spec
    const parsedSpec: ParsedSpec = {
      id: this.generateId(),
      original: spec,
      requirements,
      components,
      dataStructures,
      functions,
      dependencies,
      testRequirements,
      qualityLevel,
      language,
      metadata,
    };

    return {
      spec: parsedSpec,
      warnings,
      suggestions,
      questions,
    };
  }

  /**
   * Parse multiple related specs
   */
  async parseMultiple(specs: string[], options: ParseOptions = {}): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    for (const spec of specs) {
      const result = await this.parse(spec, options);
      results.push(result);
    }

    // Cross-reference specs for shared components and dependencies
    this.crossReferenceSpecs(results);

    return results;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Detect programming language from spec
   */
  private detectLanguage(spec: string): Language {
    for (const [pattern, language] of this.languagePatterns) {
      if (pattern.test(spec)) {
        return language;
      }
    }
    return Language.TYPESCRIPT; // Default
  }

  /**
   * Detect quality level from spec
   */
  private detectQualityLevel(spec: string): QualityLevel {
    const lower = spec.toLowerCase();

    if (/prototype|poc|proof of concept|mockup/i.test(lower)) {
      return QualityLevel.PROTOTYPE;
    }
    if (/mvp|minimal viable|basic/i.test(lower)) {
      return QualityLevel.MVP;
    }
    if (/enterprise|scalable|highly available/i.test(lower)) {
      return QualityLevel.ENTERPRISE;
    }
    return QualityLevel.PRODUCTION; // Default
  }

  /**
   * Split spec into sentences
   */
  private splitIntoSentences(spec: string): string[] {
    // Split on sentence boundaries, filter empty
    return spec
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Extract requirements from sentences
   */
  private extractRequirements(sentences: string[], warnings: string[]): Requirement[] {
    const requirements: Requirement[] = [];

    for (const sentence of sentences) {
      // Determine requirement type
      let type = RequirementType.FUNCTIONAL;
      for (const [pattern, reqType] of this.patterns) {
        if (pattern.test(sentence)) {
          type = reqType;
          break;
        }
      }

      // Determine priority
      const priority = this.determinePriority(sentence);

      // Check if must-have
      const mustHave = /^(must|required|essential|critical)/i.test(sentence);

      // Extract acceptance criteria from "should/when/then" patterns
      const acceptanceCriteria = this.extractAcceptanceCriteria(sentence);

      requirements.push({
        id: this.generateId(),
        text: sentence,
        type,
        priority,
        mustHave,
        dependencies: [],
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      });
    }

    return requirements;
  }

  /**
   * Determine priority from sentence
   */
  private determinePriority(sentence: string): Priority {
    const lower = sentence.toLowerCase();

    if (/critical|essential|must|urgent/i.test(lower)) {
      return Priority.CRITICAL;
    }
    if (/important|should|high/i.test(lower)) {
      return Priority.HIGH;
    }
    if (/nice to have|could|optional|low/i.test(lower)) {
      return Priority.LOW;
    }
    return Priority.MEDIUM;
  }

  /**
   * Extract acceptance criteria
   */
  private extractAcceptanceCriteria(sentence: string): string[] {
    const criteria: string[] = [];

    // Look for "when/then" patterns
    const whenThen = sentence.match(/when\s+(.+?)\s+then\s+(.+?)(?:\.|$)/i);
    if (whenThen) {
      criteria.push(`When ${whenThen[1]}, then ${whenThen[2]}`);
    }

    // Look for "given/when/then" patterns
    const givenWhenThen = sentence.match(
      /given\s+(.+?)\s+when\s+(.+?)\s+then\s+(.+?)(?:\.|$)/i
    );
    if (givenWhenThen) {
      criteria.push(`Given ${givenWhenThen[1]}`);
      criteria.push(`When ${givenWhenThen[2]}`);
      criteria.push(`Then ${givenWhenThen[3]}`);
    }

    return criteria;
  }

  /**
   * Extract components from sentences
   */
  private extractComponents(sentences: string[], language: Language, warnings: string[]): ComponentSpec[] {
    const components: ComponentSpec[] = [];

    for (const sentence of sentences) {
      // Try to extract component name from patterns like "create a [X] component"
      const componentMatch = sentence.match(
        /(?:create|build|make|add|implement)\s+(?:a|an)?\s*(\w+)(?:\s+(?:component|widget|panel|service))?/i
      );

      if (componentMatch) {
        const name = this.toPascalCase(componentMatch[1]);
        const type = this.detectComponentType(sentence);

        // Extract props from patterns like "with [X] prop"
        const props = this.extractProps(sentence);

        // Extract methods from patterns like "should have [X] method"
        const methods = this.extractMethods(sentence);

        components.push({
          id: this.generateId(),
          name,
          type,
          purpose: sentence,
          props: props.length > 0 ? props : undefined,
          methods: methods.length > 0 ? methods : undefined,
        });
      }
    }

    return components;
  }

  /**
   * Detect component type from sentence
   */
  private detectComponentType(sentence: string): ComponentType {
    for (const [pattern, compType] of this.componentPatterns) {
      if (pattern.test(sentence)) {
        return compType;
      }
    }
    return ComponentType.WIDGET; // Default
  }

  /**
   * Extract props from sentence
   */
  private extractProps(sentence: string): PropertySpec[] {
    const props: PropertySpec[] = [];

    // Match patterns like "with name prop", "accepts title: string"
    const propPatterns = [
      /with\s+(\w+)\s+(?:prop|property|parameter)/gi,
      /accepts?\s+(\w+):\s*(\w+)/gi,
      /(\w+)\s+(?:prop|property):\s*(\w+)/gi,
    ];

    for (const pattern of propPatterns) {
      let match;
      // eslint-disable-next-line no-cond-assign
      while ((match = pattern.exec(sentence)) !== null) {
        props.push({
          name: match[1],
          type: match[2] || 'any',
          required: false,
        });
      }
    }

    return props;
  }

  /**
   * Extract methods from sentence
   */
  private extractMethods(sentence: string): string[] {
    const methods: string[] = [];

    // Match patterns like "with save method", "handleClick function"
    const methodPattern = /(?:with|and)\s+(\w+)\s+(?:method|function|handler)/gi;
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = methodPattern.exec(sentence)) !== null) {
      methods.push(match[1]);
    }

    return methods;
  }

  /**
   * Extract data structures from sentences
   */
  private extractDataStructures(sentences: string[]): DataStructureSpec[] {
    const structures: DataStructureSpec[] = [];

    for (const sentence of sentences) {
      // Match patterns like "User interface with name, email"
      const interfaceMatch = sentence.match(
        /(\w+)\s+(?:interface|type|class)\s+(?:with|having)?\s*:?\s*(.+?)(?:\.|$)/i
      );

      if (interfaceMatch) {
        const name = this.toPascalCase(interfaceMatch[1]);
        const properties = this.parseProperties(interfaceMatch[2]);

        structures.push({
          id: this.generateId(),
          name,
          type: 'interface',
          properties,
          description: sentence,
        });
      }
    }

    return structures;
  }

  /**
   * Parse properties from comma-separated list
   */
  private parseProperties(propString: string): PropertySpec[] {
    const properties: PropertySpec[] = [];
    const parts = propString.split(/,|\s+and\s+/i);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Try to parse "name: type" pattern
      const typeMatch = trimmed.match(/(\w+):\s*(\w+)/);
      if (typeMatch) {
        properties.push({
          name: typeMatch[1],
          type: typeMatch[2],
          required: false,
        });
      } else {
        // Just a name, default to any type
        properties.push({
          name: trimmed,
          type: 'any',
          required: false,
        });
      }
    }

    return properties;
  }

  /**
   * Extract functions from sentences
   */
  private extractFunctions(sentences: string[]): FunctionSpec[] {
    const functions: FunctionSpec[] = [];

    for (const sentence of sentences) {
      // Match patterns like "createUser function that takes name and email"
      const funcMatch = sentence.match(
        /(\w+)\s+(?:function|method)\s+(?:that\s+)?(?:takes?|accepts?|receives?)\s+(.+?)(?:\.|$)/i
      );

      if (funcMatch) {
        const name = funcMatch[1];
        const params = this.parseProperties(funcMatch[2]);
        const isAsync = /async/i.test(sentence);

        functions.push({
          id: this.generateId(),
          name,
          parameters: params,
          returnType: 'void',
          isAsync,
          isGenerator: false,
          description: sentence,
        });
      }
    }

    return functions;
  }

  /**
   * Extract dependencies from sentences
   */
  private extractDependencies(sentences: string[], language: Language): Dependency[] {
    const dependencies: Dependency[] = [];

    // Common package patterns by language
    const packagePatterns: Record<Language, RegExp[]> = {
      [Language.TYPESCRIPT]: [/use\s+(@?[\w-]+)/gi, /import\s+.*from\s+['"](@?[\w-]+)/gi],
      [Language.JAVASCRIPT]: [/use\s+([\w-]+)/gi, /require\(['"]([\w-]+)/gi],
      [Language.PYTHON]: [/import\s+(\w+)/gi, /from\s+(\w+)\s+import/gi],
      [Language.GODOT_GDSCRIPT]: [/extends\s+(\w+)/gi],
      [Language.RUST]: [/use\s+(\w+::)/gi, /extern\s+crate\s+(\w+)/gi],
      [Language.GO]: [/import\s+["']([^"']+)/gi],
    };

    const patterns = packagePatterns[language] || packagePatterns[Language.TYPESCRIPT];

    for (const sentence of sentences) {
      for (const pattern of patterns) {
        let match;
        // eslint-disable-next-line no-cond-assign
        while ((match = pattern.exec(sentence)) !== null) {
          const name = match[1];
          if (name && !dependencies.some(d => d.name === name)) {
            dependencies.push({
              name,
              dev: false,
              reason: `Extracted from: ${sentence.substring(0, 50)}`,
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract test requirements from sentences
   */
  private extractTestRequirements(sentences: string[]): TestRequirement[] {
    const tests: TestRequirement[] = [];

    for (const sentence of sentences) {
      // Match patterns like "test that", "verify that", "ensure that"
      const testMatch = sentence.match(
        /(?:test|verify|ensure|check)(?:\s+that)?\s+(.+?)(?:\.|$)/i
      );

      if (testMatch) {
        tests.push({
          id: this.generateId(),
          scenario: testMatch[1],
          expectation: 'Should pass validation',
          type: TestType.UNIT,
          priority: this.determinePriority(sentence),
        });
      }
    }

    return tests;
  }

  /**
   * Generate metadata about the spec
   */
  private generateMetadata(spec: string, requirements: Requirement[], components: ComponentSpec[]): SpecMetadata {
    // Calculate complexity based on requirements and components
    const complexity = Math.min(10, Math.ceil((requirements.length + components.length * 2) / 3));

    // Estimate tasks (rough estimate: 1 task per 2 requirements + 1 per component)
    const estimatedTasks = Math.ceil(requirements.length / 2) + components.length;

    // Extract keywords
    const keywords = this.extractKeywords(spec);

    return {
      parsedAt: new Date().toISOString(),
      confidence: this.calculateConfidence(spec, requirements, components),
      complexity,
      estimatedTasks,
      keywords,
      ambiguous: [],
      suggestions: [],
    };
  }

  /**
   * Extract keywords from spec
   */
  private extractKeywords(spec: string): string[] {
    const words = spec
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Count frequency
    const frequency = new Map<string, number>();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }

    // Return top 10 most frequent
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(spec: string, requirements: Requirement[], components: ComponentSpec[]): number {
    let score = 0.5; // Base confidence

    // More requirements = higher confidence
    score += Math.min(requirements.length * 0.05, 0.2);

    // Components detected = higher confidence
    score += Math.min(components.length * 0.1, 0.2);

    // Spec length matters
    if (spec.length > 100) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Detect ambiguities in spec
   */
  private detectAmbiguities(spec: string, requirements: Requirement[]): string[] {
    const questions: string[] = [];

    // Check for vague terms
    const vagueTerms = [
      { pattern: /\b(appropriate|suitable|reasonable|good|better|best)\b/i, question: 'What specifically does "TERM" mean in this context?' },
      { pattern: /\b(some|various|multiple|several)\b/i, question: 'Can you specify exactly how many "TERM" refers to?' },
      { pattern: /\b(etc|and so on|etcetera)\b/i, question: 'Can you list all items instead of using "TERM"?' },
      { pattern: /\b(maybe|possibly|might|could)\b/i, question: 'Is "TERM" required or optional?' },
    ];

    for (const { pattern, question } of vagueTerms) {
      const matches = spec.match(pattern);
      if (matches) {
        for (const match of matches) {
          questions.push(question.replace('TERM', match));
        }
      }
    }

    return questions;
  }

  /**
   * Generate suggestions for improving the spec
   */
  private generateSuggestions(spec: string, requirements: Requirement[], components: ComponentSpec[]): string[] {
    const suggestions: string[] = [];

    // Check for acceptance criteria
    const hasAcceptanceCriteria = requirements.some(r => r.acceptanceCriteria && r.acceptanceCriteria.length > 0);
    if (!hasAcceptanceCriteria) {
      suggestions.push('Consider adding acceptance criteria using "When/Then" format for clearer requirements.');
    }

    // Check for priority levels
    const hasCritical = requirements.some(r => r.priority === Priority.CRITICAL);
    if (!hasCritical && requirements.length > 3) {
      suggestions.push('Consider marking critical requirements with "must" or "required".');
    }

    // Check for UI/UX considerations
    const hasUI = components.some(c => [ComponentType.WIDGET, ComponentType.FORM, ComponentType.BUTTON].includes(c.type));
    if (hasUI && !/responsive|mobile/i.test(spec)) {
      suggestions.push('Consider specifying responsive/mobile requirements for UI components.');
    }

    return suggestions;
  }

  /**
   * Cross-reference multiple specs for shared components
   */
  private crossReferenceSpecs(results: ParseResult[]): void {
    // Collect all component names
    const componentNames = new Map<string, string[]>();
    for (const result of results) {
      for (const component of result.spec.components) {
        if (!componentNames.has(component.name)) {
          componentNames.set(component.name, []);
        }
        componentNames.get(component.name)!.push(result.spec.id);
      }
    }

    // Find shared components and add cross-references
    for (const result of results) {
      for (const component of result.spec.components) {
        const sharedIn = componentNames.get(component.name);
        if (sharedIn && sharedIn.length > 1) {
          component.children = sharedIn.filter(id => id !== result.spec.id);
        }
      }
    }
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// Factory
// ============================================================================

let parserInstance: SpecParser | null = null;

/**
 * Get or create spec parser instance
 */
export function getSpecParser(): SpecParser {
  if (!parserInstance) {
    parserInstance = new SpecParser();
  }
  return parserInstance;
}

/**
 * Parse a spec (convenience function)
 */
export async function parseSpec(spec: string, options?: ParseOptions): Promise<ParseResult> {
  const parser = getSpecParser();
  return parser.parse(spec, options);
}
