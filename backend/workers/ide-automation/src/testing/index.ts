/**
 * Testing Module - Testing Integration
 *
 * Exports all testing functionality:
 * - TestGenerator: Generate tests from code
 * - ValidationService: Code validation and quality checks
 * - CoverageCalculator: Calculate test coverage
 */

export * from './test-generator.js';
export * from './validation.js';
export * from './coverage.js';

// Re-export commonly used types
export type {
  GeneratedTest,
  TestFramework,
  TestType,
  ValidationResult,
  ValidationIssue,
  QualityCheck,
  QualityCategory,
  CoverageReport,
  FileCoverage,
  RegressionDetection,
} from '../types/index.js';
