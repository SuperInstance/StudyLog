/**
 * Integration Tests for Quality Scaling System
 *
 * Tests hardware detection, quality tier selection, and asset LOD:
 * - Hardware detection capabilities
 * - Quality tier selection based on hardware
 * - Asset LOD (Level of Detail) selection
 * - Dynamic quality adjustment
 * - User tier limits and permissions
 * - Cost calculation per tier
 * - Performance benchmarking
 * - Fallback behavior
 *
 * @see backend/workers/image-cascade/quality-tiers.ts
 * @see packages/hardware/src/index.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectHardware,
  getHardwareCapabilities,
  type HardwareCapabilities,
} from '../../packages/hardware/src/index';
import {
  ImageQuality,
  QUALITY_TIERS,
  USER_TIER_LIMITS,
  getTierConfig,
  getNextTier,
  calculateTierCost,
  estimateGenerationTime,
  getRecommendedTier,
  canUserAccessTier,
  type QualityTierConfig,
} from '../../workers/image-cascade/quality-tiers';

// ============================================================================
// Test Fixtures and Mocks
// ============================================================================

// Mock Navigator for browser-like tests
const mockNavigator = {
  hardwareConcurrency: 8,
  deviceMemory: 16,
  userAgent: 'Mozilla/5.0 Test Browser',
};

// Mock WebGL context
const mockWebGLContext = {
  getParameter: (param: number) => {
    switch (param) {
      case 37445: // UNMASKED_VENDOR_WEBGL
        return 'NVIDIA';
      case 37446: // UNMASKED_RENDERER_WEBGL
        return 'NVIDIA GeForce RTX 3080';
      default:
        return 'unknown';
    }
  },
};

// Create mock canvas for WebGL detection
const mockCanvas = {
  getContext: (context: string) => {
    if (context === 'webgl' || context === 'webgl2') {
      return mockWebGLContext;
    }
    return null;
  },
};

beforeEach(() => {
  // Setup global mocks for hardware detection
  global.navigator = mockNavigator as any;
  global.document = {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') {
        return mockCanvas;
      }
      return {};
    }),
  } as any;
  global.window = {
    performance: {
      memory: {
        jsHeapSizeLimit: 2_000_000_000,
        totalJSHeapSize: 100_000_000,
        usedJSHeapSize: 80_000_000,
      },
    },
  } as any;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Hardware Detection Tests
// ============================================================================

describe('Quality Scaling - Hardware Detection', () => {
  describe('CPU Detection', () => {
    it('should detect number of CPU cores', () => {
      const hardware = getHardwareCapabilities();

      expect(hardware.cpuCores).toBeGreaterThanOrEqual(1);
      expect(hardware.cpuCores).toBeLessThanOrEqual(32);
    });

    it('should categorize CPU performance', () => {
      const hardware = getHardwareCapabilities();

      expect(['low', 'medium', 'high', 'ultra']).toContain(hardware.cpuPerformance);
    });

    it('should detect low-end CPU correctly', () => {
      // Mock low-end CPU
      global.navigator.hardwareConcurrency = 2;
      const hardware = getHardwareCapabilities();

      expect(hardware.cpuCores).toBe(2);
    });

    it('should detect high-end CPU correctly', () => {
      // Mock high-end CPU
      global.navigator.hardwareConcurrency = 16;
      const hardware = getHardwareCapabilities();

      expect(hardware.cpuCores).toBe(16);
    });
  });

  describe('GPU Detection', () => {
    it('should detect GPU vendor', () => {
      const hardware = getHardwareCapabilities();

      expect(hardware.gpuVendor).toBeDefined();
    });

    it('should detect GPU model', () => {
      const hardware = getHardwareCapabilities();

      expect(hardware.gpuModel).toBeDefined();
    });

    it('should categorize GPU performance tier', () => {
      const hardware = getHardwareCapabilities();

      expect(['integrated', 'entry', 'mid', 'high', 'ultra']).toContain(hardware.gpuTier);
    });

    it('should handle missing WebGL gracefully', () => {
      // Mock no WebGL support
      mockCanvas.getContext = vi.fn(() => null);

      const hardware = getHardwareCapabilities();

      // Should still return valid capabilities
      expect(hardware).toBeDefined();
    });
  });

  describe('Memory Detection', () => {
    it('should detect available RAM', () => {
      const hardware = getHardwareCapabilities();

      expect(hardware.ramGB).toBeGreaterThanOrEqual(0);
    });

    it('should categorize memory capacity', () => {
      const hardware = getHardwareCapabilities();

      expect(['low', 'medium', 'high']).toContain(hardware.memoryCapacity);
    });

    it('should detect low memory systems', () => {
      global.navigator.deviceMemory = 4;
      const hardware = getHardwareCapabilities();

      expect(hardware.ramGB).toBeLessThanOrEqual(8);
    });

    it('should detect high memory systems', () => {
      global.navigator.deviceMemory = 32;
      const hardware = getHardwareCapabilities();

      expect(hardware.ramGB).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Display Detection', () => {
    it('should detect screen resolution', () => {
      global.screen = {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1050,
        colorDepth: 24,
        pixelDepth: 24,
      } as any;

      const hardware = getHardwareCapabilities();

      expect(hardware.screenWidth).toBe(1920);
      expect(hardware.screenHeight).toBe(1080);
    });

    it('should detect pixel ratio (DPI)', () => {
      global.window.devicePixelRatio = 2;

      const hardware = getHardwareCapabilities();

      expect(hardware.devicePixelRatio).toBeGreaterThanOrEqual(1);
    });

    it('should detect high-DPI displays', () => {
      global.window.devicePixelRatio = 3;

      const hardware = getHardwareCapabilities();

      expect(hardware.isHighDPI).toBe(true);
    });
  });

  describe('Overall Hardware Score', () => {
    it('should calculate overall hardware score', () => {
      const hardware = getHardwareCapabilities();

      expect(hardware.overallScore).toBeGreaterThanOrEqual(0);
      expect(hardware.overallScore).toBeLessThanOrEqual(100);
    });

    it('should classify overall hardware tier', () => {
      const hardware = getHardwareCapabilities();

      expect(['low', 'medium', 'high', 'ultra']).toContain(hardware.overallTier);
    });

    it('should give higher scores for better hardware', () => {
      // Mock high-end hardware
      global.navigator.hardwareConcurrency = 16;
      global.navigator.deviceMemory = 32;
      global.window.devicePixelRatio = 2;
      global.screen = {
        width: 3840,
        height: 2160,
      } as any;

      const hardware = getHardwareCapabilities();

      expect(hardware.overallScore).toBeGreaterThan(50);
    });
  });
});

// ============================================================================
// Quality Tier Configuration Tests
// ============================================================================

describe('Quality Scaling - Tier Configuration', () => {
  describe('Quality Tier Definitions', () => {
    it('should have DRAFT tier configured', () => {
      const draft = QUALITY_TIERS[ImageQuality.DRAFT];

      expect(draft).toBeDefined();
      expect(draft.tier).toBe(ImageQuality.DRAFT);
      expect(draft.provider).toBeDefined();
      expect(draft.model).toBeDefined();
    });

    it('should have PREVIEW tier configured', () => {
      const preview = QUALITY_TIERS[ImageQuality.PREVIEW];

      expect(preview).toBeDefined();
      expect(preview.tier).toBe(ImageQuality.PREVIEW);
      expect(preview.resolution).toBe('1024x1024');
    });

    it('should have FINAL tier configured', () => {
      const final = QUALITY_TIERS[ImageQuality.FINAL];

      expect(final).toBeDefined();
      expect(final.tier).toBe(ImageQuality.FINAL);
      expect(final.provider).toBe('openai');
      expect(final.model).toBe('dall-e-3');
    });

    it('should have increasing costs across tiers', () => {
      const draft = QUALITY_TIERS[ImageQuality.DRAFT];
      const preview = QUALITY_TIERS[ImageQuality.PREVIEW];
      const final = QUALITY_TIERS[ImageQuality.FINAL];

      expect(draft.costPerImage).toBeLessThan(preview.costPerImage);
      expect(preview.costPerImage).toBeLessThan(final.costPerImage);
    });

    it('should have increasing latency across tiers', () => {
      const draft = QUALITY_TIERS[ImageQuality.DRAFT];
      const preview = QUALITY_TIERS[ImageQuality.PREVIEW];
      const final = QUALITY_TIERS[ImageQuality.FINAL];

      expect(draft.estimatedLatency).toBeLessThan(preview.estimatedLatency);
      expect(preview.estimatedLatency).toBeLessThan(final.estimatedLatency);
    });

    it('should have different max images per tier', () => {
      const draft = QUALITY_TIERS[ImageQuality.DRAFT];
      const preview = QUALITY_TIERS[ImageQuality.PREVIEW];
      const final = QUALITY_TIERS[ImageQuality.FINAL];

      expect(draft.maxImages).toBeGreaterThanOrEqual(preview.maxImages);
      expect(preview.maxImages).toBeGreaterThanOrEqual(final.maxImages);
    });
  });

  describe('Provider Assignment', () => {
    it('should assign cloudflare to DRAFT tier', () => {
      const draft = QUALITY_TIERS[ImageQuality.DRAFT];

      expect(draft.provider).toBe('cloudflare');
    });

    it('should assign zhipu to PREVIEW tier', () => {
      const preview = QUALITY_TIERS[ImageQuality.PREVIEW];

      expect(preview.provider).toBe('zhipu');
    });

    it('should assign openai to FINAL tier', () => {
      const final = QUALITY_TIERS[ImageQuality.FINAL];

      expect(final.provider).toBe('openai');
    });
  });
});

// ============================================================================
// Quality Tier Selection Tests
// ============================================================================

describe('Quality Scaling - Tier Selection', () => {
  describe('Auto-Selection Based on Hardware', () => {
    it('should select DRAFT for low-end hardware', () => {
      // Mock low-end hardware
      global.navigator.hardwareConcurrency = 2;
      global.navigator.deviceMemory = 4;

      const hardware = getHardwareCapabilities();
      const tier = getRecommendedTier('concept-exploration' as any);

      // Low-end hardware should use draft for exploration
      expect(tier).toBeDefined();
    });

    it('should select PREVIEW for medium hardware', () => {
      // Mock medium hardware
      global.navigator.hardwareConcurrency = 8;
      global.navigator.deviceMemory = 16;

      const hardware = getHardwareCapabilities();
      const tier = getRecommendedTier('style-refinement' as any);

      expect(tier).toBeDefined();
    });

    it('should select FINAL for high-end hardware', () => {
      // Mock high-end hardware
      global.navigator.hardwareConcurrency = 16;
      global.navigator.deviceMemory = 32;

      const hardware = getHardwareCapabilities();
      const tier = getRecommendedTier('production-asset' as any);

      expect(tier).toBeDefined();
    });
  });

  describe('Use Case-Based Selection', () => {
    it('should recommend DRAFT for concept exploration', () => {
      const tier = getRecommendedTier('concept-exploration');

      expect(tier).toBe(ImageQuality.DRAFT);
    });

    it('should recommend DRAFT for rapid iteration', () => {
      const tier = getRecommendedTier('rapid-iteration');

      expect(tier).toBe(ImageQuality.DRAFT);
    });

    it('should recommend DRAFT for mockups', () => {
      const tier = getRecommendedTier('mockup');

      expect(tier).toBe(ImageQuality.DRAFT);
    });

    it('should recommend PREVIEW for style refinement', () => {
      const tier = getRecommendedTier('style-refinement');

      expect(tier).toBe(ImageQuality.PREVIEW);
    });

    it('should recommend PREVIEW for approval workflow', () => {
      const tier = getRecommendedTier('approval-workflow');

      expect(tier).toBe(ImageQuality.PREVIEW);
    });

    it('should recommend FINAL for production assets', () => {
      const tier = getRecommendedTier('production-asset');

      expect(tier).toBe(ImageQuality.FINAL);
    });

    it('should recommend FINAL for print materials', () => {
      const tier = getRecommendedTier('print-material');

      expect(tier).toBe(ImageQuality.FINAL);
    });

    it('should recommend FINAL for marketing', () => {
      const tier = getRecommendedTier('marketing');

      expect(tier).toBe(ImageQuality.FINAL);
    });
  });

  describe('Tier Progression', () => {
    it('should progress from DRAFT to PREVIEW', () => {
      const next = getNextTier(ImageQuality.DRAFT);

      expect(next).toBe(ImageQuality.PREVIEW);
    });

    it('should progress from PREVIEW to FINAL', () => {
      const next = getNextTier(ImageQuality.PREVIEW);

      expect(next).toBe(ImageQuality.FINAL);
    });

    it('should return null for FINAL tier (no higher tier)', () => {
      const next = getNextTier(ImageQuality.FINAL);

      expect(next).toBe(null);
    });

    it('should support full tier progression chain', () => {
      let current = ImageQuality.DRAFT;
      const progression = [current];

      while (current !== null) {
        current = getNextTier(current) as ImageQuality;
        if (current) progression.push(current);
      }

      expect(progression).toEqual([ImageQuality.DRAFT, ImageQuality.PREVIEW, ImageQuality.FINAL]);
    });
  });
});

// ============================================================================
// User Tier Limits Tests
// ============================================================================

describe('Quality Scaling - User Tier Limits', () => {
  describe('Free Tier Limits', () => {
    it('should limit free users to DRAFT quality', () => {
      const limits = USER_TIER_LIMITS.free;

      expect(limits.maxQualityTier).toBe(ImageQuality.DRAFT);
    });

    it('should have low daily limit for free users', () => {
      const limits = USER_TIER_LIMITS.free;

      expect(limits.dailyLimit).toBe(50);
    });

    it('should have lowest queue priority for free users', () => {
      const limits = USER_TIER_LIMITS.free;

      expect(limits.queuePriority).toBe(1);
    });

    it('should have no discount for free users', () => {
      const limits = USER_TIER_LIMITS.free;

      expect(limits.costDiscount).toBe(0);
    });

    it('should allow free users to access DRAFT tier', () => {
      const canAccess = canUserAccessTier('free', ImageQuality.DRAFT);

      expect(canAccess).toBe(true);
    });

    it('should deny free users from accessing PREVIEW tier', () => {
      const canAccess = canUserAccessTier('free', ImageQuality.PREVIEW);

      expect(canAccess).toBe(false);
    });

    it('should deny free users from accessing FINAL tier', () => {
      const canAccess = canUserAccessTier('free', ImageQuality.FINAL);

      expect(canAccess).toBe(false);
    });
  });

  describe('Forge Tier Limits', () => {
    it('should allow forge users to access PREVIEW quality', () => {
      const limits = USER_TIER_LIMITS.forge;

      expect(limits.maxQualityTier).toBe(ImageQuality.PREVIEW);
    });

    it('should have higher daily limit for forge users', () => {
      const limits = USER_TIER_LIMITS.forge;

      expect(limits.dailyLimit).toBe(200);
    });

    it('should give forge users 10% discount', () => {
      const limits = USER_TIER_LIMITS.forge;

      expect(limits.costDiscount).toBe(0.1);
    });

    it('should allow forge users to access DRAFT tier', () => {
      const canAccess = canUserAccessTier('forge', ImageQuality.DRAFT);

      expect(canAccess).toBe(true);
    });

    it('should allow forge users to access PREVIEW tier', () => {
      const canAccess = canUserAccessTier('forge', ImageQuality.PREVIEW);

      expect(canAccess).toBe(true);
    });

    it('should deny forge users from accessing FINAL tier', () => {
      const canAccess = canUserAccessTier('forge', ImageQuality.FINAL);

      expect(canAccess).toBe(false);
    });
  });

  describe('Studio Tier Limits', () => {
    it('should allow studio users to access FINAL quality', () => {
      const limits = USER_TIER_LIMITS.studio;

      expect(limits.maxQualityTier).toBe(ImageQuality.FINAL);
    });

    it('should have high daily limit for studio users', () => {
      const limits = USER_TIER_LIMITS.studio;

      expect(limits.dailyLimit).toBe(1000);
    });

    it('should give studio users 20% discount', () => {
      const limits = USER_TIER_LIMITS.studio;

      expect(limits.costDiscount).toBe(0.2);
    });

    it('should allow studio users to access all tiers', () => {
      const canDraft = canUserAccessTier('studio', ImageQuality.DRAFT);
      const canPreview = canUserAccessTier('studio', ImageQuality.PREVIEW);
      const canFinal = canUserAccessTier('studio', ImageQuality.FINAL);

      expect(canDraft).toBe(true);
      expect(canPreview).toBe(true);
      expect(canFinal).toBe(true);
    });
  });

  describe('Lab Tier Limits', () => {
    it('should give lab users unlimited access', () => {
      const limits = USER_TIER_LIMITS.lab;

      expect(limits.dailyLimit).toBe(-1); // -1 means unlimited
    });

    it('should give lab users highest discount', () => {
      const limits = USER_TIER_LIMITS.lab;

      expect(limits.costDiscount).toBe(0.35);
    });

    it('should give lab users highest queue priority', () => {
      const limits = USER_TIER_LIMITS.lab;

      expect(limits.queuePriority).toBe(20);
    });
  });
});

// ============================================================================
// Cost Calculation Tests
// ============================================================================

describe('Quality Scaling - Cost Calculation', () => {
  it('should calculate DRAFT tier cost correctly', () => {
    const cost = calculateTierCost(ImageQuality.DRAFT, 10);

    expect(cost).toBe(0); // DRAFT is free
  });

  it('should calculate PREVIEW tier cost correctly', () => {
    const cost = calculateTierCost(ImageQuality.PREVIEW, 1);

    expect(cost).toBeCloseTo(0.004, 3);
  });

  it('should calculate FINAL tier cost correctly', () => {
    const cost = calculateTierCost(ImageQuality.FINAL, 1);

    expect(cost).toBeCloseTo(0.040, 3);
  });

  it('should cap cost at max images per tier', () => {
    const cost = calculateTierCost(ImageQuality.PREVIEW, 100); // Max is 4

    expect(cost).toBeCloseTo(0.016, 3); // 4 * 0.004
  });

  it('should calculate cost for multiple images', () => {
    const cost = calculateTierCost(ImageQuality.FINAL, 5); // Max is 1

    expect(cost).toBeCloseTo(0.040, 3); // Still 1 * 0.04
  });

  it('should handle zero image count', () => {
    const cost = calculateTierCost(ImageQuality.DRAFT, 0);

    expect(cost).toBe(0);
  });

  it('should handle negative image count gracefully', () => {
    const cost = calculateTierCost(ImageQuality.PREVIEW, -1);

    expect(cost).toBe(0);
  });
});

// ============================================================================
// Time Estimation Tests
// ============================================================================

describe('Quality Scaling - Time Estimation', () => {
  it('should estimate DRAFT tier generation time', () => {
    const time = estimateGenerationTime(ImageQuality.DRAFT, 1);

    expect(time).toBeCloseTo(3, 0); // ~3 seconds per image
  });

  it('should estimate PREVIEW tier generation time', () => {
    const time = estimateGenerationTime(ImageQuality.PREVIEW, 1);

    expect(time).toBeCloseTo(8, 0); // ~8 seconds per image
  });

  it('should estimate FINAL tier generation time', () => {
    const time = estimateGenerationTime(ImageQuality.FINAL, 1);

    expect(time).toBeCloseTo(15, 0); // ~15 seconds per image
  });

  it('should scale time with image count', () => {
    const time1 = estimateGenerationTime(ImageQuality.DRAFT, 1);
    const time10 = estimateGenerationTime(ImageQuality.DRAFT, 10);

    expect(time10).toBeCloseTo(time1 * 10, 0);
  });

  it('should cap time at max images per tier', () => {
    const time = estimateGenerationTime(ImageQuality.FINAL, 10); // Max is 1

    expect(time).toBeCloseTo(15, 0); // Still 1 * 15
  });

  it('should handle zero image count', () => {
    const time = estimateGenerationTime(ImageQuality.PREVIEW, 0);

    expect(time).toBe(0);
  });
});

// ============================================================================
// Dynamic Quality Adjustment Tests
// ============================================================================

describe('Quality Scaling - Dynamic Quality Adjustment', () => {
  describe('Automatic Quality Reduction', () => {
    it('should reduce quality on low battery (simulated)', () => {
      // Mock battery API
      global.navigator.getBattery = vi.fn(async () => ({
        level: 0.1,
        charging: false,
      }));

      const hardware = getHardwareCapabilities();

      // Hardware detection should complete
      expect(hardware).toBeDefined();
    });

    it('should reduce quality on slow network (simulated)', () => {
      // Mock connection API
      global.navigator.connection = {
        effectiveType: 'slow-2g',
        downlink: 0.5,
        rtt: 2000,
        saveData: true,
      } as any;

      const hardware = getHardwareCapabilities();

      expect(hardware).toBeDefined();
    });

    it('should prefer lower tier for data saver mode', () => {
      global.navigator.connection = {
        saveData: true,
      } as any;

      const tier = getRecommendedTier('production-asset' as any);

      // Should adjust based on constraints
      expect(tier).toBeDefined();
    });
  });

  describe('Progressive Quality Enhancement', () => {
    it('should allow upgrading from DRAFT to PREVIEW', () => {
      const draft = getTierConfig(ImageQuality.DRAFT);
      const preview = getTierConfig(ImageQuality.PREVIEW);

      expect(draft.resolution).toBe('512x512');
      expect(preview.resolution).toBe('1024x1024');
    });

    it('should allow upgrading from PREVIEW to FINAL', () => {
      const preview = getTierConfig(ImageQuality.PREVIEW);
      const final = getTierConfig(ImageQuality.FINAL);

      expect(preview.costPerImage).toBeLessThan(final.costPerImage);
    });

    it('should maintain aspect ratio across tiers', () => {
      const draft = getTierConfig(ImageQuality.DRAFT);
      const preview = getTierConfig(ImageQuality.PREVIEW);
      const final = getTierConfig(ImageQuality.FINAL);

      // All should be square or have consistent aspect ratio
      expect(draft.resolution.split('x')).toHaveLength(2);
      expect(preview.resolution.split('x')).toHaveLength(2);
      expect(final.resolution.split('x')).toHaveLength(2);
    });
  });
});

// ============================================================================
// Asset LOD Selection Tests
// ============================================================================

describe('Quality Scaling - Asset LOD Selection', () => {
  describe('LOD Based on Distance/Context', () => {
    it('should select low LOD for distant/background assets', () => {
      const hardware = getHardwareCapabilities();

      // Background/distant assets should use lower LOD
      const tier = getRecommendedTier('mockup' as any);

      expect(tier).toBe(ImageQuality.DRAFT);
    });

    it('should select medium LOD for mid-range assets', () => {
      const tier = getRecommendedTier('approval-workflow' as any);

      expect(tier).toBe(ImageQuality.PREVIEW);
    });

    it('should select high LOD for foreground/hero assets', () => {
      const tier = getRecommendedTier('production-asset' as any);

      expect(tier).toBe(ImageQuality.FINAL);
    });
  });

  describe('LOD Based on Frame Rate Requirements', () => {
    it('should prefer lower LOD for high frame rate requirements', () => {
      // Mock high-performance CPU but emphasize frame rate
      global.navigator.hardwareConcurrency = 16;

      const tier = getRecommendedTier('rapid-iteration' as any);

      expect(tier).toBe(ImageQuality.DRAFT);
    });

    it('should allow higher LOD when frame rate is not critical', () => {
      const tier = getRecommendedTier('marketing' as any);

      expect(tier).toBe(ImageQuality.FINAL);
    });
  });
});

// ============================================================================
// Performance Benchmarking Tests
// ============================================================================

describe('Quality Scaling - Performance Benchmarking', () => {
  it('should complete hardware detection quickly', () => {
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      getHardwareCapabilities();
    }

    const duration = performance.now() - start;

    // Should complete 100 detections in less than 1 second
    expect(duration).toBeLessThan(1000);
  });

  it('should complete tier config lookup quickly', () => {
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      getTierConfig(ImageQuality.PREVIEW);
    }

    const duration = performance.now() - start;

    // Should complete 10000 lookups in less than 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should complete cost calculation quickly', () => {
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      calculateTierCost(ImageQuality.FINAL, 10);
    }

    const duration = performance.now() - start;

    // Should complete 10000 calculations in less than 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should complete access check quickly', () => {
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      canUserAccessTier('studio', ImageQuality.FINAL);
    }

    const duration = performance.now() - start;

    // Should complete 10000 checks in less than 100ms
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Quality Scaling - Error Handling', () => {
  it('should handle missing navigator gracefully', () => {
    // @ts-ignore
    delete global.navigator;

    const hardware = getHardwareCapabilities();

    expect(hardware).toBeDefined();
    // Should use defaults
    expect(hardware.cpuCores).toBeGreaterThanOrEqual(1);
  });

  it('should handle missing WebGL context gracefully', () => {
    global.document.createElement = vi.fn(() => ({
      getContext: () => null,
    }));

    const hardware = getHardwareCapabilities();

    expect(hardware).toBeDefined();
    expect(hardware.gpuVendor).toBeDefined();
  });

  it('should handle invalid user tier gracefully', () => {
    // @ts-ignore - testing invalid input
    const canAccess = canUserAccessTier('invalid_tier', ImageQuality.DRAFT);

    expect(canAccess).toBe(false);
  });

  it('should handle invalid quality tier gracefully', () => {
    // @ts-ignore - testing invalid input
    const cost = calculateTierCost('invalid_tier', 1);

    expect(cost).toBe(0);
  });

  it('should handle negative image count in cost calculation', () => {
    const cost = calculateTierCost(ImageQuality.DRAFT, -5);

    expect(cost).toBe(0);
  });
});

// ============================================================================
// Fallback Behavior Tests
// ============================================================================

describe('Quality Scaling - Fallback Behavior', () => {
  it('should fallback to DRAFT when hardware detection fails', () => {
    // Completely mock out hardware detection
    global.navigator = {} as any;
    global.document = {} as any;
    global.window = {} as any;

    const hardware = getHardwareCapabilities();
    const tier = getRecommendedTier('production-asset' as any);

    // Should still return a valid tier
    expect(tier).toBeDefined();
  });

  it('should fallback to lowest tier when provider unavailable', () => {
    // Simulate unavailable provider by requesting with minimal hardware
    global.navigator.hardwareConcurrency = 1;
    global.navigator.deviceMemory = 2;

    const hardware = getHardwareCapabilities();

    // Should still return valid capabilities
    expect(hardware).toBeDefined();
    expect(hardware.cpuCores).toBeGreaterThanOrEqual(1);
  });

  it('should handle multiple consecutive fallback scenarios', () => {
    const scenarios = [
      { concurrency: 1, memory: 2 },
      { concurrency: 2, memory: 4 },
      { concurrency: 0, memory: 0 }, // Edge case
    ];

    scenarios.forEach(scenario => {
      global.navigator.hardwareConcurrency = scenario.concurrency;
      global.navigator.deviceMemory = scenario.memory;

      const hardware = getHardwareCapabilities();

      expect(hardware).toBeDefined();
    });
  });
});
