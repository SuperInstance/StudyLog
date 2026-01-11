/**
 * Validation Service
 *
 * Performs code validation, quality checks, and regression detection.
 */

import type {
  ValidationResult,
  ValidationIssue,
  QualityCheck,
  QualityCategory,
  QualityCheckResult,
  RegressionDetection,
  PerformanceChange,
  CodeExplanation,
} from '../types/index.js';

// ============================================================================
// Validation Rules
// ============================================================================

interface ValidationRule {
  code: string;
  category: QualityCategory;
  severity: 'error' | 'warning' | 'info';
  check: (content: string, language: string) => ValidationIssue[];
}

const VALIDATION_RULES: ValidationRule[] = [
  // Security checks
  {
    code: 'no-hardcoded-secrets',
    category: 'security',
    severity: 'error',
    check: (content, language) => {
      const issues: ValidationIssue[] = [];
      const secretPatterns = [
        /password\s*[:=]\s*['"][^'"]+['"]/gi,
        /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
        /secret\s*[:=]\s*['"][^'"]+['"]/gi,
        /token\s*[:=]\s*['"][^'"]+['"]/gi,
      ];

      for (const pattern of secretPatterns) {
        let match;
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (pattern.test(line)) {
            issues.push({
              severity: 'error',
              code: 'no-hardcoded-secrets',
              message: 'Possible hardcoded secret detected',
              line: i + 1,
              fix: 'Use environment variables or secure configuration',
            });
          }
        });
      }

      return issues;
    },
  },
  {
    code: 'no-eval',
    category: 'security',
    severity: 'warning',
    check: (content) => {
      const issues: ValidationIssue[] = [];
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        if (/\beval\s*\(/.test(line)) {
          issues.push({
            severity: 'warning',
            code: 'no-eval',
            message: 'Use of eval() can be dangerous',
            line: i + 1,
            fix: 'Avoid eval() or use safer alternatives',
          });
        }
      });

      return issues;
    },
  },

  // Performance checks
  {
    code: 'no-nested-loops',
    category: 'performance',
    severity: 'warning',
    check: (content) => {
      const issues: ValidationIssue[] = [];
      const lines = content.split('\n');

      let loopDepth = 0;
      lines.forEach((line, i) => {
        const openLoops = (line.match(/\b(for|while|do)\b/g) || []).length;
        const closeLoops = (line.match(/\}/g) || []).length;

        loopDepth += openLoops - closeLoops;

        if (loopDepth > 2) {
          issues.push({
            severity: 'warning',
            code: 'no-nested-loops',
            message: `Deep nesting detected (depth: ${loopDepth})`,
            line: i + 1,
            fix: 'Consider extracting nested loops into separate functions',
          });
        }
      });

      return issues;
    },
  },
  {
    code: 'prefer-const',
    category: 'performance',
    severity: 'info',
    check: (content, language) => {
      if (!['typescript', 'javascript'].includes(language)) return [];

      const issues: ValidationIssue[] = [];
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        if (/^\s*let\s+\w+\s*=/.test(line) && !line.includes('++') && !line.includes('--')) {
          issues.push({
            severity: 'info',
            code: 'prefer-const',
            message: 'Variable can be declared as const',
            line: i + 1,
            fix: 'Use const instead of let for variables that are not reassigned',
          });
        }
      });

      return issues;
    },
  },

  // Code quality checks
  {
    code: 'max-line-length',
    category: 'readability',
    severity: 'warning',
    check: (content) => {
      const issues: ValidationIssue[] = [];
      const maxLen = 100;
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        if (line.length > maxLen) {
          issues.push({
            severity: 'warning',
            code: 'max-line-length',
            message: `Line exceeds ${maxLen} characters (${line.length})`,
            line: i + 1,
            fix: 'Break long lines into multiple lines',
          });
        }
      });

      return issues;
    },
  },
  {
    code: 'no-console-log',
    category: 'best_practices',
    severity: 'info',
    check: (content, language) => {
      if (!['typescript', 'javascript'].includes(language)) return [];

      const issues: ValidationIssue[] = [];
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        if (/\bconsole\.(log|debug|info)\b/.test(line)) {
          issues.push({
            severity: 'info',
            code: 'no-console-log',
            message: 'Console.log statement detected',
            line: i + 1,
            fix: 'Use proper logging library or remove',
          });
        }
      });

      return issues;
    },
  },
];

// ============================================================================
// Validation Service
// ============================================================================

export class ValidationService {
  /**
   * Validate code content
   */
  async validate(
    content: string,
    language: string,
    categories?: QualityCategory[]
  ): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    const applicableRules = categories
      ? VALIDATION_RULES.filter(r => categories.includes(r.category))
      : VALIDATION_RULES;

    for (const rule of applicableRules) {
      const issues = rule.check(content, language);
      for (const issue of issues) {
        switch (issue.severity) {
          case 'error':
            errors.push(issue);
            break;
          case 'warning':
            warnings.push(issue);
            break;
          case 'info':
            info.push(issue);
            break;
        }
      }
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(content, errors, warnings, info);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      qualityScore,
    };
  }

  /**
   * Run quality checks
   */
  async runQualityChecks(
    content: string,
    language: string
  ): Promise<QualityCheckResult> {
    const checks: QualityCheck[] = [];

    // Run all category checks
    const categories: QualityCategory[] = [
      'security',
      'performance',
      'maintainability',
      'readability',
      'best_practices',
    ];

    for (const category of categories) {
      const result = await this.runQualityCheck(content, language, category);
      checks.push(result);
    }

    // Calculate overall score
    const totalScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;

    return {
      valid: checks.every(c => c.passed),
      checks,
      overallScore: Math.round(totalScore),
      timestamp: Date.now(),
    };
  }

  /**
   * Run a single quality check
   */
  async runQualityCheck(
    content: string,
    language: string,
    category: QualityCategory
  ): Promise<QualityCheck> {
    const rules = VALIDATION_RULES.filter(r => r.category === category);
    const allIssues: ValidationIssue[] = [];

    for (const rule of rules) {
      const issues = rule.check(content, language);
      allIssues.push(...issues);
    }

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');

    const passed = errors.length === 0;
    const score = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5));

    const suggestions = allIssues.map(i => i.fix || '').filter(Boolean);

    return {
      category,
      name: this.formatCategoryName(category),
      passed,
      score,
      details: `${errors.length} errors, ${warnings.length} warnings`,
      suggestions,
    };
  }

  /**
   * Detect regressions between two versions
   */
  async detectRegressions(
    original: { content: string; metrics?: Record<string, number> },
    modified: { content: string; metrics?: Record<string, number> }
  ): Promise<RegressionDetection> {
    // Validate both versions
    const originalValidation = await this.validate(original.content, 'typescript');
    const modifiedValidation = await this.validate(modified.content, 'typescript');

    // Find new issues
    const newIssues = modifiedValidation.errors.filter(
      err => !originalValidation.errors.some(orig => orig.code === err.code)
    );

    // Find fixed issues
    const fixedIssues = originalValidation.errors.filter(
      err => !modifiedValidation.errors.some(mod => mod.code === err.code)
    );

    // Compare performance metrics if available
    const performanceRegressions: PerformanceChange[] = [];
    if (original.metrics && modified.metrics) {
      for (const [metric, newValue] of Object.entries(modified.metrics)) {
        const oldValue = original.metrics[metric];
        if (oldValue !== undefined) {
          const change = ((newValue - oldValue) / oldValue) * 100;
          const isRegression = this.isMetricRegression(metric, change);

          if (isRegression && Math.abs(change) > 10) {
            performanceRegressions.push({
              metric,
              previous: oldValue,
              current: newValue,
              changePercent: Math.abs(change),
              direction: change > 0 ? 'regressed' : 'improved',
            });
          }
        }
      }
    }

    // Determine overall status
    let status: 'improved' | 'regressed' | 'stable' = 'stable';
    if (newIssues.length > fixedIssues.length || performanceRegressions.length > 0) {
      status = 'regressed';
    } else if (fixedIssues.length > newIssues.length) {
      status = 'improved';
    }

    return {
      newIssues,
      fixedIssues,
      performanceRegressions,
      status,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Calculate quality score
   */
  private calculateQualityScore(
    content: string,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    info: ValidationIssue[]
  ): number {
    let score = 100;

    // Deduct for errors (20 points each)
    score -= errors.length * 20;

    // Deduct for warnings (5 points each)
    score -= warnings.length * 5;

    // Small bonus for info (indicates thoroughness)
    score += Math.min(info.length * 2, 10);

    // Account for code complexity
    const complexity = this.estimateComplexity(content);
    if (complexity > 100) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate code complexity (simplified)
   */
  private estimateComplexity(content: string): number {
    let complexity = 0;

    // Count control structures
    const patterns = [
      /\bif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcatch\b/g,
      /\?\s*:/g, // ternary
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      complexity += matches?.length || 0;
    }

    return complexity;
  }

  /**
   * Format category name for display
   */
  private formatCategoryName(category: QualityCategory): string {
    return category
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Check if metric change is a regression
   */
  private isMetricRegression(metric: string, change: number): boolean {
    // For most metrics, higher is worse (e.g., latency, memory)
    // For some, higher is better (e.g., throughput, coverage)
    const betterWhenHigher = ['throughput', 'coverage', 'rate', 'score'];
    const isHigherBetter = betterWhenHigher.some(p => metric.toLowerCase().includes(p));

    return isHigherBetter ? change < 0 : change > 0;
  }
}

// ============================================================================
// Quality Check Result (extended)
// ============================================================================

interface QualityCheckResult {
  /** Overall validity */
  valid: boolean;
  /** Individual checks */
  checks: QualityCheck[];
  /** Overall score (0-100) */
  overallScore: number;
  /** Check timestamp */
  timestamp: number;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create validation service
 */
export function createValidationService(): ValidationService {
  return new ValidationService();
}
