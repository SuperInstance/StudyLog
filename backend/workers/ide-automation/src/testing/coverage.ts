/**
 * Coverage Calculator
 *
 * Calculates test coverage from code and test files.
 */

import type {
  CoverageReport,
  FileCoverage,
  FunctionCoverage,
  BranchCoverage,
} from '../types/index.js';

// ============================================================================
// Coverage Analyzer
// ============================================================================

export interface CoverageAnalysisOptions {
  /** Include branch coverage */
  includeBranches?: boolean;
  /** Minimum coverage threshold */
  threshold?: number;
}

export class CoverageCalculator {
  /**
   * Calculate coverage for a file
   */
  async calculateFileCoverage(
    sourceCode: string,
    testCode: string,
    language: string,
    options: CoverageAnalysisOptions = {}
  ): Promise<FileCoverage> {
    const lines = sourceCode.split('\n');

    // Identify executable lines
    const executableLines = this.identifyExecutableLines(sourceCode, language);

    // Identify covered lines (referenced in tests)
    const coveredLines = this.identifyCoveredLines(sourceCode, testCode, language);

    // Calculate function coverage
    const functions = this.analyzeFunctionCoverage(sourceCode, testCode, language);

    const totalLines = executableLines.length;
    const coveredLineCount = coveredLines.filter(l => executableLines.includes(l)).length;

    return {
      path: '', // Set by caller
      percentage: totalLines > 0 ? Math.round((coveredLineCount / totalLines) * 100) : 0,
      coveredLines: coveredLineCount,
      totalLines,
      functions,
    };
  }

  /**
   * Generate coverage report for multiple files
   */
  async generateReport(
    files: Array<{
      path: string;
      source: string;
      tests: string;
    }>,
    language: string
  ): Promise<CoverageReport> {
    const byFile: Record<string, FileCoverage> = {};
    let totalCovered = 0;
    let totalLines = 0;
    const uncoveredLines: Record<string, number[]> = {};
    const branches: BranchCoverage[] = [];

    for (const file of files) {
      const coverage = await this.calculateFileCoverage(
        file.source,
        file.tests,
        language
      );

      coverage.path = file.path;
      byFile[file.path] = coverage;

      totalCovered += coverage.coveredLines;
      totalLines += coverage.totalLines;

      // Find uncovered lines
      const executable = this.identifyExecutableLines(file.source, language);
      const covered = this.identifyCoveredLines(file.source, file.tests, language);
      uncoveredLines[file.path] = executable.filter(l => !covered.includes(l));
    }

    const total = totalLines > 0 ? Math.round((totalCovered / totalLines) * 100) : 0;

    return {
      total,
      byFile,
      uncoveredLines,
      branches,
    };
  }

  /**
   * Estimate coverage without running tests
   */
  estimateCoverage(
    sourceCode: string,
    testCode: string,
    language: string
  ): number {
    const sourceLines = this.identifyExecutableLines(sourceCode, language);
    const testReferences = this.extractTestReferences(testCode, sourceCode, language);

    let covered = 0;
    for (const line of sourceLines) {
      // Check if line is likely covered by tests
      const lineContent = sourceCode.split('\n')[line] || '';
      for (const ref of testReferences) {
        if (lineContent.includes(ref)) {
          covered++;
          break;
        }
      }
    }

    return sourceLines.length > 0 ? Math.round((covered / sourceLines.length) * 100) : 0;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Identify executable lines in source code
   */
  private identifyExecutableLines(code: string, language: string): number[] {
    const lines = code.split('\n');
    const executable: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (this.isExecutableLine(line, language)) {
        executable.push(i + 1); // 1-indexed
      }
    }

    return executable;
  }

  /**
   * Check if a line is executable
   */
  private isExecutableLine(line: string, language: string): boolean {
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      return false;
    }

    // Skip braces and brackets
    if (/^[{}\[\];,\)]+$/.test(line)) {
      return false;
    }

    // Skip import/export statements
    if (/^(import|export|from|require)\s/.test(line)) {
      return false;
    }

    // Skip type declarations
    if (/^(interface|type|class)\s/.test(line)) {
      return false;
    }

    // Check for executable patterns
    const executablePatterns = [
      /return\s/,
      /=>/,
      /\bif\b/,
      /\belse\b/,
      /\bfor\b/,
      /\bwhile\b/,
      /\bswitch\b/,
      /\bcase\b/,
      /\bthrow\b/,
      /\btry\b/,
      /\bcatch\b/,
      /\bfinally\b/,
      /=>\s*{/,
      /function\s*\(/,
      /=\s*[^=]/,
      /\.\w+\s*\(/,
    ];

    return executablePatterns.some(p => p.test(line));
  }

  /**
   * Identify lines covered by tests
   */
  private identifyCoveredLines(
    sourceCode: string,
    testCode: string,
    language: string
  ): number[] {
    const references = this.extractTestReferences(testCode, sourceCode, language);
    const sourceLines = sourceCode.split('\n');
    const covered: number[] = [];

    for (let i = 0; i < sourceLines.length; i++) {
      const line = sourceLines[i];
      for (const ref of references) {
        if (line.includes(ref) && this.isExecutableLine(line.trim(), language)) {
          covered.push(i + 1);
          break;
        }
      }
    }

    return [...new Set(covered)];
  }

  /**
   * Extract references from tests
   */
  private extractTestReferences(
    testCode: string,
    sourceCode: string,
    language: string
  ): string[] {
    const references: string[] = [];

    // Extract function names from source
    const sourceFunctions = this.extractFunctionNames(sourceCode, language);
    references.push(...sourceFunctions);

    // Extract references from test code
    const testCalls = testCode.match(/\b[a-zA-Z_]\w*\s*\(/g) || [];
    for (const call of testCalls) {
      const name = call.replace(/\s*\(/, '');
      if (sourceFunctions.includes(name)) {
        references.push(name);
      }
    }

    return [...new Set(references)];
  }

  /**
   * Extract function names from code
   */
  private extractFunctionNames(code: string, language: string): string[] {
    const names: string[] = [];
    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /function\s+(\w+)/g,
        /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
        /(\w+)\s*\([^)]*\)\s*{/g,
      ],
      python: [
        /def\s+(\w+)/g,
      ],
      rust: [
        /fn\s+(\w+)/g,
      ],
      go: [
        /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g,
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;

    for (const pattern of langPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(code)) !== null) {
        names.push(match[1]);
      }
    }

    return [...new Set(names)];
  }

  /**
   * Analyze function-level coverage
   */
  private analyzeFunctionCoverage(
    sourceCode: string,
    testCode: string,
    language: string
  ): FunctionCoverage[] {
    const functions = this.extractFunctions(sourceCode, language);
    const references = this.extractTestReferences(testCode, sourceCode, language);

    return functions.map((fn) => {
      const isCalled = references.includes(fn.name);
      return {
        name: fn.name,
        percentage: isCalled ? 100 : 0,
        count: isCalled ? 1 : 0,
      };
    });
  }

  /**
   * Extract functions with positions
   */
  private extractFunctions(code: string, language: string): Array<{ name: string; line: number }> {
    const functions: Array<{ name: string; line: number }> = [];
    const lines = code.split('\n');

    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      ],
      python: [
        /def\s+(\w+)/,
      ],
      rust: [
        /fn\s+(\w+)/,
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;

    lines.forEach((line, i) => {
      for (const pattern of langPatterns) {
        const match = line.match(pattern);
        if (match) {
          functions.push({ name: match[1], line: i + 1 });
        }
      }
    });

    return functions;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create coverage calculator
 */
export function createCoverageCalculator(): CoverageCalculator {
  return new CoverageCalculator();
}
