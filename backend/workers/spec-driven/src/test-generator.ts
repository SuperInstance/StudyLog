/**
 * Spec-Driven Development - Test Generator
 *
 * Generates comprehensive tests from specifications.
 * Implements OpenHands/Devin patterns for educational coding.
 *
 * @module spec-driven/test-generator
 */

import type {
  ParsedSpec,
  Requirement,
  ComponentSpec,
  DataStructureSpec,
  FunctionSpec,
  TestRequirement,
  TestType,
  Language,
} from './spec-parser.js';
import type { Task, ExecutionPlan } from './task-planner.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Generated test suite
 */
export interface TestSuite {
  /** Test suite ID */
  id: string;
  /** Suite name */
  name: string;
  /** Target file/component */
  target: string;
  /** Test type */
  type: TestType;
  /** Test cases */
  tests: TestCase[];
  /** Setup code */
  setup?: string;
  /** Teardown code */
  teardown?: string;
  /** Test file content */
  content: string;
  /** File path */
  filePath: string;
}

/**
 * Test case
 */
export interface TestCase {
  /** Test ID */
  id: string;
  /** Test description/title */
  description: string;
  /** Test code */
  code: string;
  /** Is this test focused (only) */
  focused: boolean;
  /** Is this test skipped */
  skipped: boolean;
  /** Related requirement IDs */
  requirementIds: string[];
  /** Expected behavior */
  expectation: string;
  /** Test category */
  category: TestCategory;
}

/**
 * Test categories
 */
export enum TestCategory {
  HAPPY_PATH = 'happy_path',
  EDGE_CASE = 'edge_case',
  ERROR_HANDLING = 'error_handling',
  INTEGRATION = 'integration',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  SECURITY = 'security',
}

/**
 * Test generation options
 */
export interface TestGenerationOptions {
  /** Include performance tests */
  includePerformance?: boolean;
  /** Include accessibility tests */
  includeAccessibility?: boolean;
  /** Include security tests */
  includeSecurity?: boolean;
  /** Test framework to use */
  framework: TestFramework;
  /** Coverage target (0-100) */
  coverageTarget: number;
  /** Generate mocks */
  generateMocks: boolean;
  /** Include visual regression tests */
  includeVisual: boolean;
}

/**
 * Test frameworks
 */
export enum TestFramework {
  VITEST = 'vitest',
  JEST = 'jest',
  JEST_DOM = 'jest_dom',
  PLAYWRIGHT = 'playwright',
  CYPRESS = 'cypress',
  PYTEST = 'pytest',
  GO_TEST = 'go_test',
}

/**
 * Mock definition
 */
export interface MockDefinition {
  /** Mock name */
  name: string;
  /** Mock type */
  type: 'function' | 'module' | 'class';
  /** Mock implementation */
  implementation: string;
  /** Export name */
  exportName?: string;
}

/**
 * Test coverage report
 */
export interface TestCoverage {
  /** Target file */
  target: string;
  /** Line coverage percentage */
  lineCoverage: number;
  /** Branch coverage percentage */
  branchCoverage: number;
  /** Function coverage percentage */
  functionCoverage: number;
  /** Statement coverage percentage */
  statementCoverage: number;
  /** Uncovered lines */
  uncoveredLines: number[];
  /** Coverage meets target */
  meetsTarget: boolean;
}

// ============================================================================
// Test Generator Class
// ============================================================================

/**
 * Test Generator
 *
 * Generates comprehensive test suites from specifications.
 */
export class TestGenerator {
  private readonly frameworkTemplates: Map<TestFramework, FrameworkTemplate>;

  constructor() {
    this.frameworkTemplates = this.initializeFrameworkTemplates();
  }

  /**
   * Generate tests for an entire spec
   */
  async generateForSpec(
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite[]> {
    const suites: TestSuite[] = [];

    // Generate tests for each component
    for (const component of spec.components) {
      const suite = await this.generateComponentTests(component, spec, options);
      if (suite) {
        suites.push(suite);
      }
    }

    // Generate tests for each function
    for (const func of spec.functions) {
      const suite = await this.generateFunctionTests(func, spec, options);
      if (suite) {
        suites.push(suite);
      }
    }

    // Generate tests for each data structure
    for (const dataStruct of spec.dataStructures) {
      const suite = await this.generateDataStructureTests(dataStruct, spec, options);
      if (suite) {
        suites.push(suite);
      }
    }

    // Generate tests from explicit test requirements
    for (const testReq of spec.testRequirements) {
      const suite = await this.generateRequirementTests(testReq, spec, options);
      if (suite) {
        suites.push(suite);
      }
    }

    return suites;
  }

  /**
   * Generate tests for a specific component
   */
  async generateComponentTests(
    component: ComponentSpec,
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite | null> {
    const tests: TestCase[] = [];
    const framework = this.frameworkTemplates.get(options.framework);

    if (!framework) {
      return null;
    }

    // Happy path tests
    tests.push(...this.generateHappyPathTests(component, spec));

    // Edge case tests
    tests.push(...this.generateEdgeCaseTests(component, spec));

    // Error handling tests
    tests.push(...this.generateErrorHandlingTests(component, spec));

    // Accessibility tests if enabled
    if (options.includeAccessibility) {
      tests.push(...this.generateAccessibilityTests(component, spec));
    }

    // Generate test content
    const content = this.generateTestFileContent(component.name, tests, framework, component);

    const filePath = this.getTestFilePath(component.name, options.framework, 'component');

    return {
      id: this.generateId(),
      name: `${component.name} Tests`,
      target: component.name,
      type: TestType.UNIT,
      tests,
      setup: this.generateSetup(component, framework),
      teardown: this.generateTeardown(component, framework),
      content,
      filePath,
    };
  }

  /**
   * Generate tests for a specific function
   */
  async generateFunctionTests(
    func: FunctionSpec,
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite | null> {
    const tests: TestCase[] = [];
    const framework = this.frameworkTemplates.get(options.framework);

    if (!framework) {
      return null;
    }

    // Test with valid inputs
    tests.push({
      id: this.generateId(),
      description: `should return expected result for valid input`,
      code: this.generateFunctionTestCode(func, 'valid'),
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'function returns correct result',
      category: TestCategory.HAPPY_PATH,
    });

    // Test with invalid inputs
    tests.push({
      id: this.generateId(),
      description: `should handle invalid input gracefully`,
      code: this.generateFunctionTestCode(func, 'invalid'),
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'function handles errors',
      category: TestCategory.ERROR_HANDLING,
    });

    // Test edge cases
    for (const param of func.parameters) {
      if (param.type === 'string') {
        tests.push({
          id: this.generateId(),
          description: `should handle empty string for ${param.name}`,
          code: this.generateFunctionTestCode(func, 'empty_string', param),
          focused: false,
          skipped: false,
          requirementIds: [],
          expectation: 'function handles empty strings',
          category: TestCategory.EDGE_CASE,
        });
      }
      if (param.type === 'number' || param.type === 'int') {
        tests.push({
          id: this.generateId(),
          description: `should handle zero for ${param.name}`,
          code: this.generateFunctionTestCode(func, 'zero', param),
          focused: false,
          skipped: false,
          requirementIds: [],
          expectation: 'function handles zero',
          category: TestCategory.EDGE_CASE,
        });
      }
    }

    const content = this.generateTestFileContent(func.name, tests, framework, { type: 'function' });

    const filePath = this.getTestFilePath(func.name, options.framework, 'utility');

    return {
      id: this.generateId(),
      name: `${func.name} Tests`,
      target: func.name,
      type: TestType.UNIT,
      tests,
      setup: framework.setupFunction ? framework.setupFunction(func.name) : undefined,
      teardown: framework.teardownFunction ? framework.teardownFunction(func.name) : undefined,
      content,
      filePath,
    };
  }

  /**
   * Generate tests for data structures
   */
  async generateDataStructureTests(
    dataStruct: DataStructureSpec,
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite | null> {
    const tests: TestCase[] = [];
    const framework = this.frameworkTemplates.get(options.framework);

    if (!framework) {
      return null;
    }

    // Test type validation
    tests.push({
      id: this.generateId(),
      description: `should create valid ${dataStruct.name} instance`,
      code: this.generateDataStructureTestCode(dataStruct, 'valid'),
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'type validates correctly',
      category: TestCategory.HAPPY_PATH,
    });

    // Test required properties
    for (const prop of dataStruct.properties.filter(p => p.required)) {
      tests.push({
        id: this.generateId(),
        description: `should require ${prop.name} property`,
        code: this.generateDataStructureTestCode(dataStruct, 'missing_required', prop),
        focused: false,
        skipped: false,
        requirementIds: [],
        expectation: 'required property validation',
        category: TestCategory.ERROR_HANDLING,
      });
    }

    const content = this.generateTestFileContent(dataStruct.name, tests, framework, dataStruct);

    const filePath = this.getTestFilePath(dataStruct.name, options.framework, 'type');

    return {
      id: this.generateId(),
      name: `${dataStruct.name} Type Tests`,
      target: dataStruct.name,
      type: TestType.UNIT,
      tests,
      content,
      filePath,
    };
  }

  /**
   * Generate tests from test requirements
   */
  async generateRequirementTests(
    testReq: TestRequirement,
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite | null> {
    const framework = this.frameworkTemplates.get(options.framework);

    if (!framework) {
      return null;
    }

    // Determine target from scenario
    const targetMatch = testReq.scenario.match(/(\w+)\s+(?:should|must|when)/i);
    const target = targetMatch ? targetMatch[1] : 'unknown';

    const test: TestCase = {
      id: this.generateId(),
      description: testReq.scenario,
      code: this.generateRequirementTestCode(testReq, framework),
      focused: testReq.priority === 'critical',
      skipped: false,
      requirementIds: [],
      expectation: testReq.expectation,
      category: this.getTestCategory(testReq.type),
    };

    const content = this.generateTestFileContent(
      target,
      [test],
      framework,
      { type: 'requirement', description: testReq.scenario }
    );

    const filePath = this.getTestFilePath(target, options.framework, 'requirement');

    return {
      id: this.generateId(),
      name: `${testReq.scenario.substring(0, 30)}...`,
      target,
      type: testReq.type,
      tests: [test],
      content,
      filePath,
    };
  }

  /**
   * Generate integration tests for multiple components
   */
  async generateIntegrationTests(
    plan: ExecutionPlan,
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite> {
    const tests: TestCase[] = [];
    const framework = this.frameworkTemplates.get(options.framework);

    if (!framework) {
      throw new Error(`Unsupported framework: ${options.framework}`);
    }

    // Test component interactions
    for (let i = 0; i < spec.components.length - 1; i++) {
      const componentA = spec.components[i];
      const componentB = spec.components[i + 1];

      tests.push({
        id: this.generateId(),
        description: `${componentA.name} integrates with ${componentB.name}`,
        code: this.generateIntegrationTestCode([componentA, componentB], framework),
        focused: false,
        skipped: false,
        requirementIds: [],
        expectation: 'components work together',
        category: TestCategory.INTEGRATION,
      });
    }

    const content = this.generateTestFileContent('Integration', tests, framework, { type: 'integration' });

    return {
      id: this.generateId(),
      name: 'Integration Tests',
      target: 'integration',
      type: TestType.INTEGRATION,
      tests,
      content,
      filePath: `${this.getBasePath(options.framework)}/integration.test.ts`,
    };
  }

  /**
   * Generate E2E tests
   */
  async generateE2ETests(
    spec: ParsedSpec,
    options: TestGenerationOptions
  ): Promise<TestSuite> {
    const tests: TestCase[] = [];

    // Generate user flow tests from requirements
    for (const req of spec.requirements) {
      if (req.type === 'functional' || req.type === 'ui') {
        tests.push({
          id: this.generateId(),
          description: `user flow: ${req.text.substring(0, 50)}`,
          code: this.generateE2ETestCode(req, spec),
          focused: false,
          skipped: false,
          requirementIds: [req.id],
          expectation: req.acceptanceCriteria?.[0] || req.text,
          category: TestCategory.HAPPY_PATH,
        });
      }
    }

    const framework = this.frameworkTemplates.get(TestFramework.PLAYWRIGHT);
    const content = framework ? this.generateTestFileContent('E2E', tests, framework, { type: 'e2e' }) : '';

    return {
      id: this.generateId(),
      name: 'E2E Tests',
      target: 'e2e',
      type: TestType.E2E,
      tests,
      content,
      filePath: `${this.getBasePath(TestFramework.PLAYWRIGHT)}/e2e.spec.ts`,
    };
  }

  // ========================================================================
  // Test Code Generation Methods
  // ========================================================================

  /**
   * Generate happy path tests
   */
  private generateHappyPathTests(component: ComponentSpec, spec: ParsedSpec): TestCase[] {
    const tests: TestCase[] = [];

    // Basic rendering test
    tests.push({
      id: this.generateId(),
      description: 'renders without crashing',
      code: `render(<${component.name} />);
expect(screen.getByTestId('${this.toKebabCase(component.name)}')).toBeInTheDocument();`,
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'component renders successfully',
      category: TestCategory.HAPPY_PATH,
    });

    // Props rendering tests
    if (component.props && component.props.length > 0) {
      const requiredProps = component.props.filter(p => p.required);
      if (requiredProps.length > 0) {
        const propsStr = requiredProps.map(p => {
          const value = this.getMockValueForType(p.type);
          return `${p.name}={${value}}`;
        }).join(' ');

        tests.push({
          id: this.generateId(),
          description: 'renders with required props',
          code: `render(<${component.name} ${propsStr} />);
expect(screen.getByTestId('${this.toKebabCase(component.name)}')).toBeInTheDocument();`,
          focused: false,
          skipped: false,
          requirementIds: [],
          expectation: 'component renders with props',
          category: TestCategory.HAPPY_PATH,
        });
      }
    }

    // Display content test
    tests.push({
      id: this.generateId(),
      description: 'displays content correctly',
      code: `const { container } = render(<${component.name} />);
expect(container).toHaveTextContent(/${component.name}/i);`,
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'content is displayed',
      category: TestCategory.HAPPY_PATH,
    });

    return tests;
  }

  /**
   * Generate edge case tests
   */
  private generateEdgeCaseTests(component: ComponentSpec, spec: ParsedSpec): TestCase[] {
    const tests: TestCase[] = [];

    // Empty props test
    if (component.props && component.props.length > 0) {
      const optionalProps = component.props.filter(p => !p.required);
      if (optionalProps.length > 0) {
        tests.push({
          id: this.generateId(),
          description: 'handles missing optional props',
          code: `render(<${component.name} />);
// Should not throw when optional props are omitted`,
          focused: false,
          skipped: false,
          requirementIds: [],
          expectation: 'gracefully handles missing optional props',
          category: TestCategory.EDGE_CASE,
        });
      }
    }

    // Empty arrays/lists
    tests.push({
      id: this.generateId(),
      description: 'handles empty data',
      code: `render(<${component.name} data={[]} />);
expect(screen.getByText(/no items/i|/empty/i)).toBeInTheDocument();`,
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'shows empty state',
      category: TestCategory.EDGE_CASE,
    });

    // Large data
    tests.push({
      id: this.generateId(),
      description: 'handles large datasets',
      code: `const largeData = Array(1000).fill(null).map((_, i) => ({ id: i }));
render(<${component.name} data={largeData} />);
// Should render without performance issues`,
      focused: false,
      skipped: true, // Expensive test
      requirementIds: [],
      expectation: 'handles large data',
      category: TestCategory.PERFORMANCE,
    });

    return tests;
  }

  /**
   * Generate error handling tests
   */
  private generateErrorHandlingTests(component: ComponentSpec, spec: ParsedSpec): TestCase[] {
    const tests: TestCase[] = [];

    // Invalid prop type
    if (component.props && component.props.length > 0) {
      const prop = component.props.find(p => p.required);
      if (prop) {
        tests.push({
          id: this.generateId(),
          description: `validates ${prop.name} prop type`,
          code: `// @ts-expect-error - Testing invalid prop type
render(<${component.name} ${prop.name}={null as any} />);
// Should show validation error or handle gracefully`,
          focused: false,
          skipped: false,
          requirementIds: [],
          expectation: 'prop validation works',
          category: TestCategory.ERROR_HANDLING,
        });
      }
    }

    // Error boundary test
    tests.push({
      id: this.generateId(),
      description: 'handles errors gracefully',
      code: `const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
render(<ErrorBoundary><${component.name} {...propsThatCauseError} /></ErrorBoundary>);
expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
consoleSpy.mockRestore();`,
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'error boundary catches errors',
      category: TestCategory.ERROR_HANDLING,
    });

    return tests;
  }

  /**
   * Generate accessibility tests
   */
  private generateAccessibilityTests(component: ComponentSpec, spec: ParsedSpec): TestCase[] {
    const tests: TestCase[] = [];

    // ARIA attributes
    tests.push({
      id: this.generateId(),
      description: 'has proper ARIA attributes',
      code: `render(<${component.name} />);
const element = screen.getByTestId('${this.toKebabCase(component.name)}');
expect(element).toHaveAccessibleDescription();`,
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'accessible to screen readers',
      category: TestCategory.ACCESSIBILITY,
    });

    // Keyboard navigation
    tests.push({
      id: this.generateId(),
      description: 'supports keyboard navigation',
      code: `render(<${component.name} />);
const focusableElement = screen.getByRole('button') || screen.getByRole('link');
focusableElement?.focus();
expect(focusableElement).toHaveFocus();`,
      focused: false,
      skipped: false,
      requirementIds: [],
      expectation: 'keyboard navigable',
      category: TestCategory.ACCESSIBILITY,
    });

    // Color contrast (visual test placeholder)
    tests.push({
      id: this.generateId(),
      description: 'has sufficient color contrast',
      code: `// Visual regression test for color contrast
// Run with axe-core for automated checks`,
      focused: false,
      skipped: true, // Requires visual regression setup
      requirementIds: [],
      expectation: 'WCAG AA compliant contrast',
      category: TestCategory.ACCESSIBILITY,
    });

    return tests;
  }

  /**
   * Generate function test code
   */
  private generateFunctionTestCode(
    func: FunctionSpec,
    scenario: string,
    param?: { name: string; type: string }
  ): string {
    const asyncKeyword = func.isAsync ? 'await ' : '';
    const returns = func.isAsync ? 'Promise' : '';

    switch (scenario) {
      case 'valid':
        const validArgs = func.parameters.map(p => this.getMockValueForType(p.type)).join(', ');
        return `const result = ${asyncKeyword}${func.name}(${validArgs});
expect(result).toBeDefined();`;

      case 'invalid':
        const invalidArgs = func.parameters.map(p => 'null as any').join(', ');
        return `await expect(${asyncKeyword}${func.name}(${invalidArgs})).rejects.toThrow();`;

      case 'empty_string':
        if (param) {
          const args = func.parameters.map(p => p.name === param.name ? "''" : this.getMockValueForType(p.type)).join(', ');
          return `const result = ${asyncKeyword}${func.name}(${args});
expect(result).toBeDefined();`;
        }
        return '';

      case 'zero':
        if (param) {
          const args = func.parameters.map(p => p.name === param.name ? '0' : this.getMockValueForType(p.type)).join(', ');
          return `const result = ${asyncKeyword}${func.name}(${args});
expect(result).toBeDefined();`;
        }
        return '';

      default:
        return `// Test implementation needed`;
    }
  }

  /**
   * Generate data structure test code
   */
  private generateDataStructureTestCode(
    dataStruct: DataStructureSpec,
    scenario: string,
    prop?: { name: string; type: string; required: boolean }
  ): string {
    switch (scenario) {
      case 'valid':
        const validProps = dataStruct.properties.map(p =>
          `${p.name}: ${this.getMockValueForType(p.type)}`
        ).join(',\n    ');
        return `const validInstance: ${dataStruct.name} = {
    ${validProps}
  };
  expect(validInstance).toBeDefined();`;

      case 'missing_required':
        if (prop) {
          const propsWithoutRequired = dataStruct.properties
            .filter(p => p.name !== prop.name)
            .map(p => `${p.name}: ${this.getMockValueForType(p.type)}`)
            .join(',\n    ');

          return `// @ts-expect-error - Testing missing required property
  const invalidInstance: ${dataStruct.name} = {
    ${propsWithoutRequired}
  };
  // Should fail type check or throw during validation`;
        }
        return '';

      default:
        return `// Test implementation needed`;
    }
  }

  /**
   * Generate integration test code
   */
  private generateIntegrationTestCode(components: ComponentSpec[], framework: FrameworkTemplate): string {
    const renders = components.map(c =>
      `render(<${c.name} {...getMockPropsFor('${c.name}')} />);`
    ).join('\n    ');

    return `// Testing integration between ${components.map(c => c.name).join(' and ')}
    ${renders}
    // Verify interaction works correctly
    expect(/* interaction result */).toBeDefined();`;
  }

  /**
   * Generate E2E test code
   */
  private generateE2ETestCode(req: Requirement, spec: ParsedSpec): string {
    return `// E2E test for: ${req.text}
    await page.goto('/${this.toKebabCase(req.text.substring(0, 20))}');
    await expect(page.locator('body')).toBeVisible();
    // TODO: Add specific E2E assertions for this requirement`;
  }

  /**
   * Generate requirement test code
   */
  private generateRequirementTestCode(testReq: TestRequirement, framework: FrameworkTemplate): string {
    return `// Test: ${testReq.scenario}
    // Expected: ${testReq.expectation}
    expect(true).toBe(true); // TODO: Implement actual test`;
  }

  /**
   * Generate test file content
   */
  private generateTestFileContent(
    targetName: string,
    tests: TestCase[],
    framework: FrameworkTemplate,
    targetInfo: ComponentSpec | DataStructureSpec | { type: string; description?: string }
  ): string {
    let content = framework.header;

    // Add imports
    content += framework.getImports(targetName, targetInfo);

    // Add describe block
    content += `\ndescribe('${targetName}', () => {\n`;

    // Add setup if exists
    const setup = this.generateSetup(targetInfo, framework);
    if (setup) {
      content += `\n  ${setup}\n`;
    }

    // Group tests by category
    const categorized = new Map<TestCategory, TestCase[]>();
    for (const test of tests) {
      if (!categorized.has(test.category)) {
        categorized.set(test.category, []);
      }
      categorized.get(test.category)!.push(test);
    }

    // Output tests by category
    for (const [category, categoryTests] of categorized) {
      if (categoryTests.length > 0 && categorized.size > 1) {
        content += `\n  describe('${category}', () => {\n`;
      }

      for (const test of categoryTests) {
        const testFn = test.focused ? 'it.only' : test.skipped ? 'it.skip' : 'it';
        content += `\n  ${testFn}('${test.description}', async () => {\n`;
        content += `    ${test.code}\n`;
        content += `  });\n`;
      }

      if (categoryTests.length > 0 && categorized.size > 1) {
        content += `\n  });\n`;
      }
    }

    // Add teardown if exists
    const teardown = this.generateTeardown(targetInfo, framework);
    if (teardown) {
      content += `\n  ${teardown}\n`;
    }

    content += `\n});\n`;

    return content;
  }

  /**
   * Generate setup code
   */
  private generateSetup(
    target: ComponentSpec | DataStructureSpec | { type: string; description?: string },
    framework: FrameworkTemplate
  ): string {
    if (framework.setupFunction) {
      return framework.setupFunction(target);
    }

    // Default setup
    if ('props' in target && target.props && target.props.length > 0) {
      const mockProps = target.props
        .filter(p => p.required)
        .map(p => `const ${p.name} = ${this.getMockValueForType(p.type)};`)
        .join('\n    ');

      return `beforeEach(() => {
    ${mockProps}
  });`;
    }

    return '';
  }

  /**
   * Generate teardown code
   */
  private generateTeardown(
    target: ComponentSpec | DataStructureSpec | { type: string; description?: string },
    framework: FrameworkTemplate
  ): string {
    if (framework.teardownFunction) {
      return framework.teardownFunction(target);
    }

    return `afterEach(() => {
    cleanup();
  });`;
  }

  // ========================================================================
  // Template System
  // ========================================================================

  /**
   * Initialize framework templates
   */
  private initializeFrameworkTemplates(): Map<TestFramework, FrameworkTemplate> {
    const templates = new Map<TestFramework, FrameworkTemplate>();

    // Vitest template
    templates.set(TestFramework.VITEST, {
      name: 'vitest',
      header: `/**
 * Auto-generated tests
 * Generated by StudyLoG.AI Spec-Driven Development
 */
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
`,
      getImports: (targetName: string, targetInfo: ComponentSpec | DataStructureSpec | { type: string }) => {
        if ('type' in targetInfo && targetInfo.type === 'component') {
          return `import { ${targetName} } from '../${this.toKebabCase(targetName)}';\n`;
        }
        if ('type' in targetInfo && targetInfo.type === 'function') {
          return `import { ${targetName} } from '../utils/${this.toKebabCase(targetName)}';\n`;
        }
        if ('type' in targetInfo && targetInfo.type === 'integration') {
          return `// Integration test imports\n`;
        }
        return `import { ${targetName} } from '../${this.toKebabCase(targetName)}';\n`;
      },
      setupFunction: undefined,
      teardownFunction: undefined,
    });

    // Jest template
    templates.set(TestFramework.JEST, {
      name: 'jest',
      header: `/**
 * Auto-generated tests
 * Generated by StudyLoG.AI Spec-Driven Development
 */
import { render, screen, cleanup } from '@testing-library/react';
`,
      getImports: (targetName: string) => {
        return `import { ${targetName} } from '../${this.toKebabCase(targetName)}';\n`;
      },
      setupFunction: undefined,
      teardownFunction: undefined,
    });

    // Playwright template (E2E)
    templates.set(TestFramework.PLAYWRIGHT, {
      name: 'playwright',
      header: `/**
 * Auto-generated E2E tests
 * Generated by StudyLoG.AI Spec-Driven Development
 */
import { test, expect } from '@playwright/test';
`,
      getImports: () => '',
      setupFunction: () => 'test.beforeEach(async ({ page }) => {\n    await page.goto("/");\n  });',
      teardownFunction: () => '',
    });

    return templates;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get mock value for a type
   */
  private getMockValueForType(type: string): string {
    const lowerType = type.toLowerCase();

    if (lowerType === 'string') return "'test'";
    if (lowerType === 'number' || lowerType === 'int') return '42';
    if (lowerType === 'boolean') return 'true';
    if (lowerType === 'array') return '[]';
    if (lowerType === 'object') return '{}';
    if (lowerType.includes('[]')) return '[]';
    if (lowerType.includes('[') && lowerType.includes(']')) {
      // Array type like string[], number[]
      return '[]';
    }

    return 'null';
  }

  /**
   * Get test file path
   */
  private getTestFilePath(targetName: string, framework: TestFramework, fileType: string): string {
    const base = this.getBasePath(framework);
    const kebabName = this.toKebabCase(targetName);

    switch (framework) {
      case TestFramework.VITEST:
      case TestFramework.JEST:
        return `${base}/${kebabName}.test.ts`;

      case TestFramework.PLAYWRIGHT:
        return `${base}/${kebabName}.spec.ts`;

      case TestFramework.CYPRESS:
        return `${base}/${kebabName}.cy.ts`;

      case TestFramework.PYTEST:
        return `${base}/test_${kebabName.replace(/-/g, '_')}.py`;

      default:
        return `${base}/${kebabName}.test.ts`;
    }
  }

  /**
   * Get base path for test files
   */
  private getBasePath(framework: TestFramework): string {
    switch (framework) {
      case TestFramework.VITEST:
      case TestFramework.JEST:
        return '__tests__';
      case TestFramework.PLAYWRIGHT:
        return 'e2e';
      case TestFramework.CYPRESS:
        return 'cypress/e2e';
      default:
        return '__tests__';
    }
  }

  /**
   * Get test category from test type
   */
  private getTestCategory(testType: TestType): TestCategory {
    switch (testType) {
      case TestType.UNIT:
        return TestCategory.HAPPY_PATH;
      case TestType.INTEGRATION:
        return TestCategory.INTEGRATION;
      case TestType.E2E:
        return TestCategory.HAPPY_PATH;
      case TestType.PERFORMANCE:
        return TestCategory.PERFORMANCE;
      case TestType.ACCESSIBILITY:
        return TestCategory.ACCESSIBILITY;
      case TestType.SECURITY:
        return TestCategory.SECURITY;
      default:
        return TestCategory.HAPPY_PATH;
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
   * Generate unique ID
   */
  private generateId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Framework template
 */
interface FrameworkTemplate {
  /** Template name */
  name: string;
  /** File header */
  header: string;
  /** Get imports for target */
  getImports: (targetName: string, targetInfo: ComponentSpec | DataStructureSpec | { type: string }) => string;
  /** Setup function generator */
  setupFunction?: (target: ComponentSpec | DataStructureSpec | { type: string }) => string;
  /** Teardown function generator */
  teardownFunction?: (target: ComponentSpec | DataStructureSpec | { type: string }) => string;
}

// ============================================================================
// Factory
// ============================================================================

let generatorInstance: TestGenerator | null = null;

/**
 * Get or create test generator instance
 */
export function getTestGenerator(): TestGenerator {
  if (!generatorInstance) {
    generatorInstance = new TestGenerator();
  }
  return generatorInstance;
}

/**
 * Default test generation options
 */
export const DEFAULT_TEST_OPTIONS: TestGenerationOptions = {
  includePerformance: false,
  includeAccessibility: true,
  includeSecurity: false,
  framework: TestFramework.VITEST,
  coverageTarget: 80,
  generateMocks: true,
  includeVisual: false,
};

/**
 * Generate tests from spec (convenience function)
 */
export async function generateTests(
  spec: ParsedSpec,
  options?: Partial<TestGenerationOptions>
): Promise<TestSuite[]> {
  const generator = getTestGenerator();
  return generator.generateForSpec(spec, { ...DEFAULT_TEST_OPTIONS, ...options });
}
