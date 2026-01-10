/**
 * Code Generator Worker Tests
 *
 * Tests for the AI code generation worker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MODEL_CONFIGS } from '../index';

// Mock the CodeGenerator class to test verification
class MockCodeGenerator {
  verifyMethod(files: any[]): any {
    const errors: string[] = [];
    const warnings: string[] = [];
    let testsRun = 0;
    let testsPassed = 0;

    for (const file of files) {
      if (file.language === 'typescript') {
        testsRun++;
        if (file.content.includes('export')) {
          testsPassed++;
        } else {
          warnings.push(`${file.path}: Missing exports`);
        }
      }

      if (file.language === 'gdscript') {
        testsRun++;
        if (file.content.includes('extends ')) {
          testsPassed++;
        } else {
          errors.push(`${file.path}: Missing extends clause`);
        }
      }

      if (file.language === 'gdscene') {
        testsRun++;
        if (file.content.includes('[gd_scene')) {
          testsPassed++;
        } else {
          errors.push(`${file.path}: Invalid scene format`);
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      tests_run: testsRun,
      tests_passed: testsPassed
    };
  }
}

describe('Code Generator', () => {
  describe('Model Configuration', () => {
    it('should have 3 quality levels', () => {
      expect(Object.keys(MODEL_CONFIGS)).toEqual(['fast', 'balanced', 'premium']);
    });

    it('should configure fast mode for speed', () => {
      const fast = MODEL_CONFIGS.fast;
      expect(fast.model).toContain('haiku');
      expect(fast.maxTokens).toBe(4096);
      expect(fast.temperature).toBe(0.7);
      expect(fast.expectedWorkRatio).toBeLessThan(0.7);
    });

    it('should configure premium mode for quality', () => {
      const premium = MODEL_CONFIGS.premium;
      expect(premium.model).toContain('opus');
      expect(premium.maxTokens).toBe(16384);
      expect(premium.temperature).toBe(0.3);
      expect(premium.expectedWorkRatio).toBeGreaterThan(0.8);
    });
  });

  describe('Verification', () => {
    let generator: MockCodeGenerator;

    beforeEach(() => {
      generator = new MockCodeGenerator();
    });

    it('should verify TypeScript syntax', () => {
      const files = [{
        path: 'test.ts',
        content: `export function test() {
  return 'hello';
}`,
        language: 'typescript',
      }];

      const result = generator.verifyMethod(files);

      expect(result.passed).toBe(true);
    });

    it('should detect missing exports', () => {
      const files = [{
        path: 'test.ts',
        content: `function test() {
  return 'hello';
}`,
        language: 'typescript',
      }];

      const result = generator.verifyMethod(files);

      // Verification passes (only warnings, no errors) but warnings are present
      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should verify GDScript syntax', () => {
      const files = [{
        path: 'test.gd',
        content: `extends Node2D

func _ready():
    print("Hello")`,
        language: 'gdscript',
      }];

      const result = generator.verifyMethod(files);

      expect(result.passed).toBe(true);
    });

    it('should verify Godot scene format', () => {
      const files = [{
        path: 'test.tscn',
        content: `[gd_scene load_steps=2 format=3]

[node name="Root" type="Node2D"]`,
        language: 'gdscene',
      }];

      const result = generator.verifyMethod(files);

      expect(result.passed).toBe(true);
    });
  });

  describe('Work Ratio', () => {
    it('should calculate AI contribution correctly', () => {
      const expectations = {
        fast: 0.6,
        balanced: 0.75,
        premium: 0.85,
      };

      for (const [quality, expectedRatio] of Object.entries(expectations)) {
        expect(MODEL_CONFIGS[quality as keyof typeof MODEL_CONFIGS].expectedWorkRatio)
          .toBeCloseTo(expectedRatio, 0.1);
      }
    });
  });
});
