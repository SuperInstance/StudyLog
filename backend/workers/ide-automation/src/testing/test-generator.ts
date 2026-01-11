/**
 * Test Generator
 *
 * Generates tests from code using AI analysis.
 * Supports multiple testing frameworks.
 */

import type {
  GeneratedTest,
  TestFramework,
  TestType,
  CodeSymbol,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';

// ============================================================================
// Framework Templates
// ============================================================================

const FRAMEWORK_TEMPLATES: Record<TestFramework, string> = {
  vitest: `import { describe, it, expect, beforeEach, afterEach } from 'vitest';`,
  jest: `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';`,
  pytest: `import pytest`,
  gtest: `#include <gtest/gtest.h>`,
  custom: '',
};

// ============================================================================
// Test Generator
// ============================================================================

export class TestGenerator {
  constructor(
    private readonly env: IDEAutomationEnv,
    private readonly routerUrl = 'https://multi-model-router.studylog.ai'
  ) {}

  /**
   * Generate tests from code
   */
  async generateTests(
    code: string,
    language: string,
    framework: TestFramework = 'vitest',
    type: TestType = 'unit'
  ): Promise<GeneratedTest[]> {
    const symbols = this.extractSymbols(code, language);
    const tests: GeneratedTest[] = [];

    for (const symbol of symbols) {
      if (this.shouldTestSymbol(symbol)) {
        const test = await this.generateTestForSymbol(code, symbol, language, framework, type);
        tests.push(test);
      }
    }

    return tests;
  }

  /**
   * Generate a test for a specific symbol
   */
  async generateTestForSymbol(
    code: string,
    symbol: CodeSymbol,
    language: string,
    framework: TestFramework,
    type: TestType
  ): Promise<GeneratedTest> {
    const prompt = this.buildTestPrompt(code, symbol, language, framework, type);

    const response = await this.callAI(prompt);
    const testContent = this.extractTestContent(response, framework);

    const filePath = this.generateTestPath(symbol, language, framework);

    return {
      path: filePath,
      content: testContent,
      framework,
      type,
      targets: [symbol.name],
      estimatedCoverage: this.estimateCoverage(symbol, type),
    };
  }

  /**
   * Generate tests from file
   */
  async generateTestsFromFile(
    filePath: string,
    code: string,
    framework: TestFramework = 'vitest'
  ): Promise<GeneratedTest> {
    const language = this.detectLanguage(filePath);
    const prompt = this.buildFileTestPrompt(filePath, code, language, framework);

    const response = await this.callAI(prompt);
    const testContent = this.extractTestContent(response, framework);

    const testPath = this.generateTestPathFromFile(filePath, framework);

    const symbols = this.extractSymbols(code, language);

    return {
      path: testPath,
      content: testContent,
      framework,
      type: 'unit',
      targets: symbols.map(s => s.name),
      estimatedCoverage: 70, // Rough estimate
    };
  }

  /**
   * Suggest test cases for a function
   */
  async suggestTestCases(
    functionCode: string,
    functionName: string,
    language: string
  ): Promise<Array<{ description: string; inputs: unknown; expected: unknown }>> {
    const prompt = `Analyze this ${language} function and suggest comprehensive test cases:

Function name: ${functionName}

Code:
\`\`\`${language}
${functionCode}
\`\`\`

Return a JSON array of test cases with:
- description: What the test checks
- inputs: Example input values
- expected: Expected output

Focus on:
1. Normal/expected cases
2. Edge cases
3. Error cases
4. Boundary conditions`;

    const response = await this.callAI(prompt);

    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Extract symbols from code
   */
  private extractSymbols(code: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];

    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
        /(?:export\s+)?class\s+(\w+)/g,
      ],
      javascript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
        /class\s+(\w+)/g,
      ],
      python: [
        /def\s+(\w+)/g,
        /class\s+(\w+)/g,
      ],
      rust: [
        /fn\s+(\w+)/g,
        /struct\s+(\w+)/g,
        /impl\s+(\w+)/g,
      ],
      go: [
        /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g,
        /type\s+(\w+)\s+struct/g,
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;

    for (const pattern of langPatterns) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(code)) !== null) {
        symbols.push({
          name: match[1],
          kind: 'function',
          path: '',
          start: { line: 0, character: match.index },
          end: { line: 0, character: match.index + match[0].length },
        });
      }
    }

    return symbols;
  }

  /**
   * Check if symbol should be tested
   */
  private shouldTestSymbol(symbol: CodeSymbol): boolean {
    // Skip private/internal symbols
    if (symbol.name.startsWith('_')) {
      return false;
    }

    // Test functions and classes
    return ['function', 'method', 'class'].includes(symbol.kind);
  }

  /**
   * Build test generation prompt
   */
  private buildTestPrompt(
    code: string,
    symbol: CodeSymbol,
    language: string,
    framework: TestFramework,
    type: TestType
  ): string {
    const imports = FRAMEWORK_TEMPLATES[framework];

    return `Generate ${type} tests for this ${language} ${symbol.kind} using ${framework}:

${imports}

Code under test:
\`\`\`${language}
${this.extractSymbolCode(code, symbol)}
\`\`\`

Symbol: ${symbol.name}

Generate comprehensive tests that cover:
1. Normal/expected behavior
2. Edge cases
3. Error handling
4. Boundary conditions

Include proper setup/teardown if needed.
Return only the test file content wrapped in code blocks.`;
  }

  /**
   * Build file-level test prompt
   */
  private buildFileTestPrompt(
    filePath: string,
    code: string,
    language: string,
    framework: TestFramework
  ): string {
    const imports = FRAMEWORK_TEMPLATES[framework];

    return `Generate comprehensive tests for this file: ${filePath}

Language: ${language}
Framework: ${framework}

${imports}

Source code:
\`\`\`${language}
${code}
\`\`\`

Generate tests that:
1. Cover all exported functions and classes
2. Include edge cases and error conditions
3. Use appropriate test setup/teardown
4. Are well-organized with descriptive test names

Return only the test file content wrapped in code blocks.`;
  }

  /**
   * Extract code for a specific symbol
   */
  private extractSymbolCode(code: string, symbol: CodeSymbol): string {
    // For now, return a simplified extraction
    // A full implementation would parse the AST
    const lines = code.split('\n');
    const startLine = symbol.start.line;
    const endLine = Math.min(lines.length, symbol.end.line + 20);

    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * Generate test file path for a symbol
   */
  private generateTestPath(symbol: CodeSymbol, language: string): string {
    const extensions: Record<string, string> = {
      typescript: '.test.ts',
      javascript: '.test.js',
      python: '_test.py',
      rust: '_test.rs',
      go: '_test.go',
    };

    const ext = extensions[language] || '.test.ts';
    return `${symbol.name.toLowerCase()}${ext}`;
  }

  /**
   * Generate test file path from source file path
   */
  private generateTestPathFromFile(sourcePath: string, framework: TestFramework): string {
    const parts = sourcePath.split('/');
    const filename = parts.pop() || '';
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

    const testExtensions: Record<TestFramework, string> = {
      vitest: '.test.ts',
      jest: '.test.ts',
      pytest: '_test.py',
      gtest: '_test.cpp',
      custom: '.test.ts',
    };

    const ext = testExtensions[framework];
    parts.push(`${nameWithoutExt}${ext}`);

    return parts.join('/');
  }

  /**
   * Extract test content from AI response
   */
  private extractTestContent(response: string, framework: TestFramework): string {
    // Try to find code block
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)\n```/;
    const match = response.match(codeBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // Return response as-is
    return response.trim();
  }

  /**
   * Estimate coverage for a test
   */
  private estimateCoverage(symbol: CodeSymbol, type: TestType): number {
    let base = 60;

    switch (type) {
      case 'unit':
        base = 70;
        break;
      case 'integration':
        base = 50;
        break;
      case 'e2e':
        base = 40;
        break;
      case 'snapshot':
        base = 30;
        break;
    }

    // Adjust based on symbol complexity
    if (symbol.name.toLowerCase().includes('test')) {
      base = 0;
    }

    return base;
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      cpp: 'cpp',
      c: 'c',
      java: 'java',
    };

    return map[ext] || 'typescript';
  }

  /**
   * Call AI for test generation
   */
  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.routerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-coder',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json() as { content: string };
    return data.content;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create test generator from environment
 */
export function createTestGenerator(env: IDEAutomationEnv): TestGenerator {
  return new TestGenerator(env);
}
