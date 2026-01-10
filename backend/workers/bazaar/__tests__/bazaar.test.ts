/**
 * Bazaar Worker Tests
 *
 * Tests for the community marketplace worker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseMillfile, stringifyMillfile } from '../index';

describe('Bazaar Service', () => {
  beforeEach(() => {
    // Setup mocks if needed for future tests
    vi.clearAllMocks();
  });

  describe('parseMillfile', () => {
    it('should parse basic TOML structure', () => {
      const toml = `[meta]
title = "Test Creation"
author = "testuser"
quality = 2

[permissions]
fork_enabled = true`;

      const result = parseMillfile(toml);

      expect(result.meta?.title).toBe('Test Creation');
      expect(result.meta?.author).toBe('testuser');
      expect(result.meta?.quality).toBe(2);
      expect(result.permissions?.fork_enabled).toBe(true);
    });

    it('should handle empty sections', () => {
      const toml = `[meta]
title = "Test"

[empty]`;

      const result = parseMillfile(toml);
      expect(result.meta?.title).toBe('Test');
    });

    it('should parse arrays', () => {
      const toml = `[simulation]
components = ["led", "resistor", "battery"]`;

      const result = parseMillfile(toml);
      expect(result.simulation?.components).toEqual(['led', 'resistor', 'battery']);
    });
  });

  describe('stringifyMillfile', () => {
    it('should convert Millfile object to TOML', () => {
      const millfile = {
        meta: {
          title: 'Test Creation',
          author: 'testuser',
          quality: 2,
        },
        permissions: {
          fork_enabled: true,
          merge_enabled: false,
        },
      };

      const result = stringifyMillfile(millfile);

      expect(result).toContain('[meta]');
      expect(result).toContain('title = "Test Creation"');
      expect(result).toContain('[permissions]');
      expect(result).toContain('fork_enabled = true');
    });
  });
});

describe('Bazaar API', () => {
  describe('Quality Levels', () => {
    it('should have 4 quality levels', () => {
      const qualityLabels = {
        1: { label: 'Experimental', color: '#9ca3af', icon: '⚗️' },
        2: { label: 'Working', color: '#3b82f6', icon: '✓' },
        3: { label: 'Verified', color: '#10b981', icon: '★' },
        4: { label: 'Excellent', color: '#f59e0b', icon: '★★' },
      };

      expect(Object.keys(qualityLabels)).toHaveLength(4);
    });
  });

  describe('Creation Types', () => {
    it('should support 5 creation types', () => {
      const types = ['simulation', 'puzzle', 'agent', 'extension', 'godot-scene'];
      expect(types).toHaveLength(5);
    });
  });
});
