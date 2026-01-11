/**
 * Spec-Driven Development - Code Generator
 *
 * Generates code from parsed specifications and tasks.
 * Implements OpenHands/Devin patterns for educational coding.
 *
 * @module spec-driven/code-generator
 */

import type {
  ParsedSpec,
  Requirement,
  ComponentSpec,
  DataStructureSpec,
  FunctionSpec,
  Language,
  QualityLevel,
} from './spec-parser.js';
import type { Task, AgentType } from './task-planner.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Generated file
 */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Language for syntax highlighting */
  language: string;
  /** Is this a test file */
  isTest: boolean;
  /** Related task ID */
  taskId: string;
  /** AI work ratio (0-1) */
  workRatio: number;
  /** Quality score (0-1) */
  qualityScore: number;
}

/**
 * Generation context
 */
export interface GenerationContext {
  /** Original spec */
  spec: ParsedSpec;
  /** Related task */
  task: Task;
  /** Files already generated */
  existingFiles: Map<string, GeneratedFile>;
  /** Import aliases for clean imports */
  imports: Map<string, string>;
  /** User preferences */
  preferences: GenerationPreferences;
}

/**
 * Generation preferences
 */
export interface GenerationPreferences {
  /** Include detailed comments */
  includeComments: boolean;
  /** Include JSDoc/TSDoc */
  includeDocs: boolean;
  /** Strict TypeScript */
  strictTypes: boolean;
  /** Preferred style */
  style: CodeStyle;
  /** Maximum file length */
  maxFileLength: number;
}

/**
 * Code style preferences
 */
export enum CodeStyle {
  DEFAULT = 'default',
  FUNCTIONAL = 'functional',
  OBJECT_ORIENTED = 'object_oriented',
  REACTIVE = 'reactive',
  ASYNC = 'async',
}

/**
 * Generation result
 */
export interface GenerationResult {
  /** Generated files */
  files: GeneratedFile[];
  /** Warnings during generation */
  warnings: string[];
  /** Errors during generation */
  errors: string[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Total tokens used */
  tokensUsed: number;
  /** Total cost estimate */
  costEstimate: number;
}

/**
 * Code generation template
 */
export interface CodeTemplate {
  /** Template name */
  name: string;
  /** Supported language */
  language: Language;
  /** Template type */
  type: TemplateType;
  /** Template content */
  content: string;
  /** Variable placeholders */
  variables: TemplateVariable[];
}

/**
 * Template types
 */
export enum TemplateType {
  COMPONENT = 'component',
  HOOK = 'hook',
  UTILITY = 'utility',
  TYPE = 'type',
  TEST = 'test',
  SERVICE = 'service',
  WORKER = 'worker',
}

/**
 * Template variable
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Default value */
  default: string;
  /** Is required */
  required: boolean;
  /** Description */
  description?: string;
}

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  /** Provider name */
  provider: string;
  /** Model to use */
  model: string;
  /** API key (if needed) */
  apiKey?: string;
  /** Base URL */
  baseUrl?: string;
  /** Max tokens */
  maxTokens: number;
  /** Temperature */
  temperature: number;
}

// ============================================================================
// Code Generator Class
// ============================================================================

/**
 * Code Generator
 *
 * Generates code from specifications using templates and AI assistance.
 */
export class CodeGenerator {
  private readonly templates: Map<string, CodeTemplate>;
  private readonly aiConfig: AIProviderConfig;

  constructor(aiConfig?: Partial<AIProviderConfig>) {
    this.templates = this.initializeTemplates();
    this.aiConfig = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 8192,
      temperature: 0.3,
      ...aiConfig,
    };
  }

  /**
   * Generate code for a task
   */
  async generateForTask(task: Task, context: GenerationContext): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    let tokensUsed = 0;

    try {
      // Determine generation strategy based on agent type
      const strategy = this.getGenerationStrategy(task.agentType);

      // Generate each file in the task
      for (const fileOp of task.files) {
        const result = await this.generateFile(fileOp.path, context, strategy);

        if (result.error) {
          errors.push(result.error);
        } else if (result.content) {
          files.push({
            path: fileOp.path,
            content: result.content,
            language: fileOp.language || 'typescript',
            isTest: fileOp.path.includes('.test.') || fileOp.path.includes('__tests__'),
            taskId: task.id,
            workRatio: result.workRatio || 0.75,
            qualityScore: result.qualityScore || 0.8,
          });
          tokensUsed += result.tokensUsed || 0;
        }

        if (result.warning) {
          warnings.push(result.warning);
        }
      }

      return {
        files,
        warnings,
        errors,
        suggestions: this.generateSuggestions(files, context),
        tokensUsed,
        costEstimate: this.calculateCost(tokensUsed, this.aiConfig),
      };
    } catch (error) {
      return {
        files,
        warnings,
        errors: [error instanceof Error ? error.message : String(error)],
        suggestions: [],
        tokensUsed,
        costEstimate: 0,
      };
    }
  }

  /**
   * Generate code for an entire plan
   */
  async generateForPlan(
    tasks: Task[],
    context: GenerationContext
  ): Promise<Map<string, GenerationResult>> {
    const results = new Map<string, GenerationResult>();
    const generatedFiles = new Map<string, GeneratedFile>();

    // Generate tasks in order (respecting dependencies)
    const sortedTasks = this.topologicalSort(tasks);

    for (const task of sortedTasks) {
      if (task.type === 'run_tests' || task.type === 'run_linter' || task.type === 'build') {
        continue; // Skip non-code-generation tasks
      }

      // Update context with already generated files
      context.existingFiles = new Map(generatedFiles);

      const result = await this.generateForTask(task, context);
      results.set(task.id, result);

      // Add generated files to map
      for (const file of result.files) {
        generatedFiles.set(file.path, file);
      }
    }

    return results;
  }

  /**
   * Generate a single file
   */
  private async generateFile(
    filePath: string,
    context: GenerationContext,
    strategy: GenerationStrategy
  ): Promise<{
    content?: string;
    error?: string;
    warning?: string;
    workRatio?: number;
    qualityScore?: number;
    tokensUsed?: number;
  }> {
    // Determine file type from path
    const fileType = this.getFileType(filePath);
    const template = this.findTemplate(fileType, context.spec.language);

    if (!template && strategy === GenerationStrategy.TEMPLATE) {
      return {
        error: `No template found for file type: ${fileType}`,
        workRatio: 0,
        qualityScore: 0,
      };
    }

    // Generate based on strategy
    switch (strategy) {
      case GenerationStrategy.TEMPLATE:
        return this.generateFromTemplate(template!, filePath, context);

      case GenerationStrategy.HYBRID:
        return this.generateHybrid(template, filePath, context);

      case GenerationStrategy.AI:
        return await this.generateWithAI(filePath, context);

      default:
        return await this.generateWithAI(filePath, context);
    }
  }

  /**
   * Generate from template
   */
  private generateFromTemplate(
    template: CodeTemplate,
    filePath: string,
    context: GenerationContext
  ): {
    content: string;
    workRatio: number;
    qualityScore: number;
    tokensUsed: number;
  } {
    let content = template.content;

    // Fill in variables
    for (const variable of template.variables) {
      const value = this.getVariableValue(variable, context, filePath);
      content = content.replaceAll(`{{${variable.name}}}`, value);
    }

    return {
      content,
      workRatio: 0.4, // Templates are low AI contribution
      qualityScore: 0.7,
      tokensUsed: 0,
    };
  }

  /**
   * Generate hybrid (template + AI refinement)
   */
  private async generateHybrid(
    template: CodeTemplate | undefined,
    filePath: string,
    context: GenerationContext
  ): Promise<{
    content?: string;
    workRatio?: number;
    qualityScore?: number;
    tokensUsed?: number;
  }> {
    // Start with template if available
    let baseContent = '';
    if (template) {
      const result = this.generateFromTemplate(template, filePath, context);
      baseContent = result.content;
    }

    // Use AI to refine/customize
    // This is a placeholder - in production would call actual AI
    const refined = this.refineWithAI(baseContent, filePath, context);

    return {
      content: refined.content,
      workRatio: 0.6,
      qualityScore: 0.85,
      tokensUsed: refined.tokensUsed,
    };
  }

  /**
   * Generate with AI only
   */
  private async generateWithAI(
    filePath: string,
    context: GenerationContext
  ): Promise<{
    content?: string;
    workRatio?: number;
    qualityScore?: number;
    tokensUsed?: number;
  }> {
    // Build prompt for AI
    const prompt = this.buildPrompt(filePath, context);

    // In production, this would call actual AI
    // For now, return a placeholder response
    const content = this.generatePlaceholderContent(filePath, context);

    return {
      content,
      workRatio: 0.85,
      qualityScore: 0.9,
      tokensUsed: this.estimateTokens(prompt.length + content.length),
    };
  }

  /**
   * Refine content with AI
   */
  private refineWithAI(baseContent: string, filePath: string, context: GenerationContext): {
    content: string;
    tokensUsed: number;
  } {
    // Build refinement prompt
    const refinementPrompt = this.buildRefinementPrompt(baseContent, filePath, context);

    // In production, this would call actual AI
    // For now, return base content with some improvements
    const improved = this.applyRefinements(baseContent, context);

    return {
      content: improved,
      tokensUsed: this.estimateTokens(refinementPrompt.length),
    };
  }

  /**
   * Build prompt for AI generation
   */
  private buildPrompt(filePath: string, context: GenerationContext): string {
    const fileType = this.getFileType(filePath);
    const componentName = this.getComponentNameFromPath(filePath);

    let prompt = `Generate ${fileType} code for ${componentName}.\n\n`;

    // Add spec requirements
    if (context.spec.requirements.length > 0) {
      prompt += 'Requirements:\n';
      for (const req of context.spec.requirements.slice(0, 5)) {
        prompt += `  - ${req.text}\n`;
      }
      prompt += '\n';
    }

    // Add component-specific details
    const component = context.spec.components.find(c => c.name === componentName);
    if (component) {
      prompt += `Component: ${component.name}\n`;
      prompt += `Type: ${component.type}\n`;
      if (component.props && component.props.length > 0) {
        prompt += `Props:\n`;
        for (const prop of component.props) {
          prompt += `  - ${prop.name}: ${prop.type}${prop.required ? ' (required)' : ''}\n`;
        }
      }
      if (component.methods && component.methods.length > 0) {
        prompt += `Methods: ${component.methods.join(', ')}\n`;
      }
    }

    // Add data structures
    const relevantTypes = context.spec.dataStructures.filter(ds =>
      componentName.toLowerCase().includes(ds.name.toLowerCase()) ||
      ds.name.toLowerCase().includes(componentName.toLowerCase())
    );
    if (relevantTypes.length > 0) {
      prompt += '\nRelated Types:\n';
      for (const type of relevantTypes) {
        prompt += `  - ${type.name}: ${type.type}\n`;
      }
    }

    // Add quality guidance
    prompt += `\nQuality Level: ${context.spec.qualityLevel}\n`;
    prompt += `Language: ${context.spec.language}\n`;

    if (context.preferences.includeComments) {
      prompt += 'Include detailed explanatory comments.\n';
    }

    if (context.preferences.includeDocs) {
      prompt += 'Include JSDoc/TSDoc documentation.\n';
    }

    return prompt;
  }

  /**
   * Build refinement prompt
   */
  private buildRefinementPrompt(baseContent: string, filePath: string, context: GenerationContext): string {
    return `Review and improve the following code for ${filePath}.

Requirements from spec:
${context.spec.requirements.map(r => `- ${r.text}`).join('\n')}

Code to refine:
${baseContent}

Please improve:
1. Code quality and best practices
2. Error handling
3. Type safety
4. Performance considerations
5. Documentation comments
`;
  }

  /**
   * Apply template-based refinements
   */
  private applyRefinements(content: string, context: GenerationContext): string {
    let refined = content;

    // Add header if not present
    if (!refined.startsWith('/**') && !refined.startsWith('//')) {
      const header = this.generateFileHeader(context);
      refined = header + '\n\n' + refined;
    }

    // Ensure imports are at the top
    if (!refined.includes('import ')) {
      const imports = this.generateImports(context);
      if (imports) {
        refined = imports + '\n\n' + refined;
      }
    }

    return refined;
  }

  /**
   * Generate file header
   */
  private generateFileHeader(context: GenerationContext): string {
    const lines = [
      '/**',
      ` * ${context.spec.id} - Generated File`,
      ' *',
      ' * Generated by StudyLoG.AI Spec-Driven Development',
      ` * Quality Level: ${context.spec.qualityLevel}`,
      ` * Generated: ${new Date().toISOString()}`,
      ' *',
      ' * This file was generated from a natural language specification.',
      ' * Review and modify as needed for your use case.',
      ' */',
    ];
    return lines.join('\n');
  }

  /**
   * Generate imports
   */
  private generateImports(context: GenerationContext): string {
    const imports: string[] = [];

    // Add React import for components
    if (context.spec.components.length > 0) {
      imports.push("import React from 'react';");
    }

    // Add type imports
    for (const ds of context.spec.dataStructures) {
      imports.push(`import type { ${ds.name} } from './types/${this.toKebabCase(ds.name)}';`);
    }

    return imports.join('\n');
  }

  /**
   * Generate placeholder content
   */
  private generatePlaceholderContent(filePath: string, context: GenerationContext): string {
    const componentName = this.getComponentNameFromPath(filePath);
    const fileType = this.getFileType(filePath);

    switch (fileType) {
      case 'component':
        return this.generateComponentPlaceholder(componentName, context);

      case 'type':
        return this.generateTypePlaceholder(componentName, context);

      case 'test':
        return this.generateTestPlaceholder(componentName, context);

      case 'utility':
        return this.generateUtilityPlaceholder(componentName, context);

      default:
        return this.generateGenericPlaceholder(componentName, context);
    }
  }

  /**
   * Generate component placeholder
   */
  private generateComponentPlaceholder(name: string, context: GenerationContext): string {
    const component = context.spec.components.find(c => c.name === name);
    const hasProps = component?.props && component.props.length > 0;

    let content = `import React from 'react';\n\n`;

    // Generate props interface
    if (hasProps && context.preferences.strictTypes) {
      content += `interface ${name}Props {\n`;
      for (const prop of component!.props!) {
        const optional = prop.required ? '' : '?';
        content += `  ${prop.name}${optional}: ${prop.type};\n`;
      }
      content += `}\n\n`;
    }

    // Generate component
    const propsParam = hasProps ? `{ ${component!.props!.map(p => p.name).join(', ')} }: ${name}Props` : '';
    content += `export function ${name}(${propsParam}) {\n`;
    content += `  return (\n`;
    content += `    <div className="${this.toKebabCase(name)}">\n`;
    content += `      {/* ${name} component */}\n`;
    content += `      <h1>${name}</h1>\n`;
    content += `    </div>\n`;
    content += `  );\n`;
    content += `}\n`;

    if (context.preferences.includeDocs) {
      content = `
/**
 * ${name} Component
 *
 * ${component?.purpose || 'No description provided.'}
 *
${component?.props ? component.props.map(p => ` * @param ${p.name} - ${p.description || p.type}`).join('\n') : ''}
 */
${content}`;
    }

    return content;
  }

  /**
   * Generate type placeholder
   */
  private generateTypePlaceholder(name: string, context: GenerationContext): string {
    const type = context.spec.dataStructures.find(ds => ds.name === name);

    if (!type) {
      return `// Type definition for ${name}\n// TODO: Add properties\n`;
    }

    let content = `export ${type.type} ${name} {\n`;

    for (const prop of type.properties) {
      const optional = prop.required ? '' : '?';
      const comment = prop.description ? ` // ${prop.description}` : '';
      content += `  ${prop.name}${optional}: ${prop.type};${comment}\n`;
    }

    content += `}\n`;

    return content;
  }

  /**
   * Generate test placeholder
   */
  private generateTestPlaceholder(name: string, context: GenerationContext): string {
    const component = context.spec.components.find(c => c.name === name);
    const requirements = context.spec.testRequirements.filter(t =>
      t.scenario.toLowerCase().includes(name.toLowerCase())
    );

    let content = `import { render, screen } from '@testing-library/react';\n`;
    content += `import { ${name} } from '../${this.toKebabCase(name)}';\n\n`;
    content += `describe('${name}', () => {\n`;

    // Add test from requirements
    if (requirements.length > 0) {
      for (const req of requirements.slice(0, 3)) {
        content += `  it('${req.scenario}', () => {\n`;
        content += `    // ${req.expectation}\n`;
        content += `    render(<${name} />);\n`;
        content += `    expect(screen.getByText('${name}')).toBeInTheDocument();\n`;
        content += `  });\n\n`;
      }
    } else {
      content += `  it('renders without crashing', () => {\n`;
      content += `    render(<${name} />);\n`;
      content += `    expect(screen.getByText('${name}')).toBeInTheDocument();\n`;
      content += `  });\n\n`;
    }

    // Add props test if component has props
    if (component?.props && component.props.length > 0) {
      content += `  it('renders with props', () => {\n`;
      const props = component.props.map(p => `${p.name}="${p.type}"`).join(' ');
      content += `    render(<${name} ${props} />);\n`;
      content += `    expect(screen.getByText('${name}')).toBeInTheDocument();\n`;
      content += `  });\n`;
    }

    content += `});\n`;

    return content;
  }

  /**
   * Generate utility placeholder
   */
  private generateUtilityPlaceholder(name: string, context: GenerationContext): string {
    const functions = context.spec.functions.filter(f =>
      f.name.toLowerCase().includes(name.toLowerCase())
    );

    let content = `/**\n`;
    content += ` * Utility functions for ${name}\n`;
    content += ` */\n\n`;

    for (const func of functions) {
      const asyncKeyword = func.isAsync ? 'async ' : '';
      content += `export ${asyncKeyword}function ${func.name}(`;
      content += func.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      content += `): ${func.returnType} {\n`;
      content += `  // TODO: Implement ${func.name}\n`;
      if (func.description) {
        content += `  // ${func.description}\n`;
      }
      content += `  throw new Error('Not implemented');\n`;
      content += `}\n\n`;
    }

    return content;
  }

  /**
   * Generate generic placeholder
   */
  private generateGenericPlaceholder(name: string, context: GenerationContext): string {
    return `// ${name}\n// Generated from spec: ${context.spec.id}\n// TODO: Implement\n`;
  }

  // ========================================================================
  // Template System
  // ========================================================================

  /**
   * Initialize code templates
   */
  private initializeTemplates(): Map<string, CodeTemplate> {
    const templates = new Map<string, CodeTemplate>();

    // React component template
    templates.set('react-component', {
      name: 'react-component',
      language: 'typescript',
      type: TemplateType.COMPONENT,
      content: `import React, { useState, useEffect } from 'react';

interface {{COMPONENT_NAME}}Props {
  {{PROPS_DEFINITION}}
}

export function {{COMPONENT_NAME}}({{PROPS_DESTRUCTURING}}: {{COMPONENT_NAME}}Props) {
  // State
  const [state, setState] = useState<{{STATE_TYPE}}>({{INITIAL_STATE}});

  // Effects
  useEffect(() => {
    // TODO: Add side effects
  }, []);

  // Handlers
  const handleEvent = (event: Event) => {
    // TODO: Handle event
  };

  return (
    <div className="{{CSS_CLASS}}">
      {{CHILDREN}}
    </div>
  );
}
`,
      variables: [
        { name: 'COMPONENT_NAME', default: 'MyComponent', required: true },
        { name: 'PROPS_DEFINITION', default: '', required: false },
        { name: 'PROPS_DESTRUCTURING', default: '', required: false },
        { name: 'STATE_TYPE', default: 'any', required: false },
        { name: 'INITIAL_STATE', default: 'null', required: false },
        { name: 'CSS_CLASS', default: 'my-component', required: false },
        { name: 'CHILDREN', default: '', required: false },
      ],
    });

    // TypeScript interface template
    templates.set('typescript-interface', {
      name: 'typescript-interface',
      language: 'typescript',
      type: TemplateType.TYPE,
      content: `/**
 * {{INTERFACE_NAME}} interface
{{DESCRIPTION}}
 */
export interface {{INTERFACE_NAME}} {
  {{PROPERTIES}}
}

export type {{INTERFACE_NAME}}Create = Omit<{{INTERFACE_NAME}}, 'id' | 'createdAt' | 'updatedAt'>;
export type {{INTERFACE_NAME}}Update = Partial<{{INTERFACE_NAME}}Create>;
`,
      variables: [
        { name: 'INTERFACE_NAME', default: 'MyInterface', required: true },
        { name: 'DESCRIPTION', default: '', required: false },
        { name: 'PROPERTIES', default: '', required: true },
      ],
    });

    // Test template
    templates.set('react-test', {
      name: 'react-test',
      language: 'typescript',
      type: TemplateType.TEST,
      content: `import { render, screen, waitFor } from '@testing-library/react';
import { {{COMPONENT_NAME}} } from '../{{COMPONENT_FILE}}';

describe('{{COMPONENT_NAME}}', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<{{COMPONENT_NAME}} />);
      expect(screen.getByTestId('{{TEST_ID}}')).toBeInTheDocument();
    });

    {{RENDERING_TESTS}}
  });

  describe('Interaction', () => {
    {{INTERACTION_TESTS}}
  });

  describe('Edge Cases', () => {
    {{EDGE_CASE_TESTS}}
  });
});
`,
      variables: [
        { name: 'COMPONENT_NAME', default: 'MyComponent', required: true },
        { name: 'COMPONENT_FILE', default: 'MyComponent', required: true },
        { name: 'TEST_ID', default: 'my-component', required: true },
        { name: 'RENDERING_TESTS', default: '', required: false },
        { name: 'INTERACTION_TESTS', default: '', required: false },
        { name: 'EDGE_CASE_TESTS', default: '', required: false },
      ],
    });

    return templates;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get generation strategy for agent type
   */
  private getGenerationStrategy(agentType: AgentType): GenerationStrategy {
    switch (agentType) {
      case 'zooplankton':
        return GenerationStrategy.TEMPLATE;
      case 'deckhand':
        return GenerationStrategy.HYBRID;
      case 'tester':
      case 'builder':
        return GenerationStrategy.HYBRID;
      case 'captain':
      case 'whale':
        return GenerationStrategy.AI;
      default:
        return GenerationStrategy.HYBRID;
    }
  }

  /**
   * Find template for file type and language
   */
  private findTemplate(fileType: string, language: Language): CodeTemplate | undefined {
    const key = `${language}-${fileType}`;
    return this.templates.get(key);
  }

  /**
   * Get file type from path
   */
  private getFileType(filePath: string): string {
    if (filePath.includes('/components/')) return 'component';
    if (filePath.includes('/types/')) return 'type';
    if (filePath.includes('/utils/') || filePath.includes('/helpers/')) return 'utility';
    if (filePath.includes('.test.') || filePath.includes('/__tests__/')) return 'test';
    if (filePath.includes('/services/')) return 'service';
    if (filePath.includes('/workers/')) return 'worker';
    return 'generic';
  }

  /**
   * Get component name from file path
   */
  private getComponentNameFromPath(filePath: string): string {
    const match = filePath.match(/\/(\w+)(?:\.\w+)?$/);
    if (match) {
      return this.toPascalCase(match[1]);
    }
    return 'GeneratedComponent';
  }

  /**
   * Get template variable value
   */
  private getVariableValue(variable: { name: string; default: string }, context: GenerationContext, filePath: string): string {
    const componentName = this.getComponentNameFromPath(filePath);

    switch (variable.name) {
      case 'COMPONENT_NAME':
        return componentName;

      case 'INTERFACE_NAME':
        return componentName;

      case 'CSS_CLASS':
        return this.toKebabCase(componentName);

      case 'COMPONENT_FILE':
        return this.toKebabCase(componentName);

      case 'TEST_ID':
        return this.toKebabCase(componentName);

      default:
        return variable.default;
    }
  }

  /**
   * Generate suggestions for improvement
   */
  private generateSuggestions(files: GeneratedFile[], context: GenerationContext): string[] {
    const suggestions: string[] = [];

    // Check for TODO comments
    const todoCount = files.reduce((sum, f) => sum + (f.content.match(/TODO/g) || []).length, 0);
    if (todoCount > 0) {
      suggestions.push(`${todoCount} TODO items found - review and implement`);
    }

    // Check for 'any' types
    const anyCount = files.reduce((sum, f) => sum + (f.content.match(/:\s*any/g) || []).length, 0);
    if (anyCount > 0 && context.preferences.strictTypes) {
      suggestions.push(`${anyCount} 'any' types found - consider using specific types`);
    }

    // Check for missing exports
    const missingExports = files.filter(f => !f.content.includes('export'));
    if (missingExports.length > 0) {
      suggestions.push(`${missingExports.length} files without exports - add if needed`);
    }

    return suggestions;
  }

  /**
   * Topological sort for tasks respecting dependencies
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
        sorted.push(task);
      }
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return sorted;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(textLength: number): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(textLength / 4);
  }

  /**
   * Calculate cost estimate
   */
  private calculateCost(tokensUsed: number, config: AIProviderConfig): number {
    // Simple cost model (adjust based on actual provider pricing)
    const costPerMillion = 3; // $3 per million tokens (example)
    return (tokensUsed / 1_000_000) * costPerMillion;
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (_, c) => c.toUpperCase());
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
}

// ============================================================================
// Enums
// ============================================================================

/**
 * Generation strategy
 */
enum GenerationStrategy {
  TEMPLATE = 'template',
  HYBRID = 'hybrid',
  AI = 'ai',
}

// ============================================================================
// Factory
// ============================================================================

let generatorInstance: CodeGenerator | null = null;

/**
 * Get or create code generator instance
 */
export function getCodeGenerator(config?: Partial<AIProviderConfig>): CodeGenerator {
  if (!generatorInstance) {
    generatorInstance = new CodeGenerator(config);
  }
  return generatorInstance;
}

/**
 * Default generation preferences
 */
export const DEFAULT_PREFERENCES: GenerationPreferences = {
  includeComments: true,
  includeDocs: true,
  strictTypes: true,
  style: CodeStyle.DEFAULT,
  maxFileLength: 500,
};
