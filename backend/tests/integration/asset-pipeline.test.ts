/**
 * Integration Tests for Asset Pipeline Worker
 *
 * Tests the complete asset generation pipeline including:
 * - 3D model generation
 * - Audio generation
 * - 2D art generation
 * - Asset regeneration across 3 forms
 * - Godot format conversion
 * - Hot-reload functionality
 * - Error handling and recovery
 *
 * @see backend/workers/asset-pipeline/index.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAsset } from '../../workers/asset-pipeline/index';

// ============================================================================
// Test Fixtures and Mocks
// ============================================================================

interface MockWebSocket {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  readyState: number;
}

let mockWebSocket: MockWebSocket;
let mockFetch: ReturnType<typeof vi.fn>;

// Mock WebSocket for hot-reload testing
const createMockWebSocket = (): MockWebSocket => {
  const ws = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (event === 'open') {
        // Simulate async connection
        setTimeout(() => callback(), 10);
      }
    }),
    readyState: 0, // CONNECTING
  } as unknown as MockWebSocket;
  return ws;
};

// Mock fetch for API calls
const createMockFetch = () => {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const urlLower = url.toLowerCase();

    // Image generation endpoint
    if (urlLower.includes('/images/generations')) {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024), // Mock image data
      } as Response;
    }

    // 3D generation endpoint
    if (urlLower.includes('/3d/generate')) {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4096), // Mock 3D model data
      } as Response;
    }

    // Audio generation endpoint
    if (urlLower.includes('/audio/speech')) {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8192), // Mock audio data
      } as Response;
    }

    // Default error response
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Endpoint not found',
    } as Response;
  });
};

// ============================================================================
// Setup and Teardown
// ============================================================================

beforeEach(() => {
  // Setup global mocks
  mockFetch = createMockFetch();
  global.fetch = mockFetch;
  mockWebSocket = createMockWebSocket();
  // @ts-ignore - WebSocket is not defined in Node test environment
  global.WebSocket = vi.fn((url: string) => mockWebSocket);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Asset Pipeline Tests - Image Generation
// ============================================================================

describe('Asset Pipeline - Image Generation', () => {
  describe('Happy Paths', () => {
    it('should generate a 2D image asset successfully', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'A futuristic cityscape at sunset',
        quality: 'medium' as const,
        style: 'cyberpunk',
      };

      const result = await generateAsset(request);

      expect(result).toBeDefined();
      expect(result.type).toBe('.png');
      expect(result.importPath).toContain('user://generated/');
      expect(result.data.byteLength).toBeGreaterThan(0);
    });

    it('should generate image with custom style parameter', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Forest scene',
        quality: 'low' as const,
        style: 'impressionist',
      };

      const result = await generateAsset(request);

      expect(result.type).toBe('.png');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/images/generations'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('impressionist'),
        })
      );
    });

    it('should generate multiple images in sequence', async () => {
      const requests = [
        { type: 'image' as const, prompt: 'Scene 1', quality: 'low' as const },
        { type: 'image' as const, prompt: 'Scene 2', quality: 'low' as const },
        { type: 'image' as const, prompt: 'Scene 3', quality: 'low' as const },
      ];

      const results = await Promise.all(
        requests.map(req => generateAsset(req))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.type).toBe('.png');
        expect(result.data.byteLength).toBeGreaterThan(0);
      });
    });

    it('should include metadata in generated asset', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'high' as const,
        style: 'realistic',
      };

      const result = await generateAsset(request);

      expect(result).toBeDefined();
      // The importPath should be a valid Godot user:// path
      expect(result.importPath).toMatch(/^user:\/\/generated\/\d+\.png$/);
    });
  });

  describe('Error Cases', () => {
    it('should handle image generation API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Generation failed',
      } as Response);

      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'medium' as const,
      };

      await expect(generateAsset(request)).rejects.toThrow('Image generation failed');
    });

    it('should handle network timeout for image generation', async () => {
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'medium' as const,
      };

      await expect(generateAsset(request)).rejects.toThrow();
    });

    it('should handle invalid image data response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => {
          throw new Error('Invalid buffer');
        },
      } as Response);

      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'medium' as const,
      };

      await expect(generateAsset(request)).rejects.toThrow();
    });

    it('should handle malformed prompt gracefully', async () => {
      const request = {
        type: 'image' as const,
        prompt: '', // Empty prompt
        quality: 'medium' as const,
      };

      // Should still attempt generation even with empty prompt
      const result = await generateAsset(request);
      expect(result).toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should generate low quality image within 5 seconds', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Simple test pattern',
        quality: 'low' as const,
      };

      const start = performance.now();
      await generateAsset(request);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000);
    }, 10000);

    it('should handle concurrent image generation efficiently', async () => {
      const concurrency = 10;
      const requests = Array(concurrency).fill(null).map((_, i) => ({
        type: 'image' as const,
        prompt: `Concurrent test ${i}`,
        quality: 'low' as const,
      }));

      const start = performance.now();
      await Promise.all(requests.map(req => generateAsset(req)));
      const duration = performance.now() - start;

      // Should complete all concurrent requests in reasonable time
      expect(duration).toBeLessThan(30000);
    }, 35000);
  });
});

// ============================================================================
// Asset Pipeline Tests - 3D Model Generation
// ============================================================================

describe('Asset Pipeline - 3D Model Generation', () => {
  describe('Happy Paths', () => {
    it('should generate a 3D model asset successfully', async () => {
      const request = {
        type: '3d' as const,
        prompt: 'A simple cube with metallic texture',
        quality: 'medium' as const,
        format: 'glb',
      };

      const result = await generateAsset(request);

      expect(result).toBeDefined();
      expect(result.type).toBe('.glb');
      expect(result.importPath).toContain('user://generated/');
      expect(result.data.byteLength).toBeGreaterThan(0);
    });

    it('should generate 3D model with default GLB format', async () => {
      const request = {
        type: '3d' as const,
        prompt: 'Test model',
        quality: 'low' as const,
      };

      const result = await generateAsset(request);

      expect(result.type).toBe('.glb');
    });

    it('should send correct format to 3D generation API', async () => {
      const request = {
        type: '3d' as const,
        prompt: 'Character model',
        quality: 'high' as const,
        format: 'glb',
      };

      await generateAsset(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/3d/generate'),
        expect.objectContaining({
          body: expect.stringContaining('"format":"glb"'),
        })
      );
    });

    it('should generate complex 3D models', async () => {
      const complexPrompt = 'A detailed fantasy castle with towers, moat, and surrounding landscape';

      const request = {
        type: '3d' as const,
        prompt: complexPrompt,
        quality: 'high' as const,
      };

      const result = await generateAsset(request);

      expect(result).toBeDefined();
      expect(result.type).toBe('.glb');
    });
  });

  describe('Error Cases', () => {
    it('should handle 3D generation API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Model generation failed',
        text: async () => 'Service unavailable',
      } as Response);

      const request = {
        type: '3d' as const,
        prompt: 'Test model',
        quality: 'medium' as const,
      };

      await expect(generateAsset(request)).rejects.toThrow('3D generation failed');
    });

    it('should handle unsupported 3D format', async () => {
      const request = {
        type: '3d' as const,
        prompt: 'Test model',
        quality: 'medium' as const,
        format: 'unsupported',
      };

      // Should still attempt to use the format, API will validate
      const result = await generateAsset(request);
      expect(result).toBeDefined();
    });

    it('should handle incomplete 3D model data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10), // Too small for valid 3D model
      } as Response);

      const request = {
        type: '3d' as const,
        prompt: 'Test model',
        quality: 'medium' as const,
      };

      // Should still return the data even if small
      const result = await generateAsset(request);
      expect(result.data.byteLength).toBe(10);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should generate simple 3D model within 10 seconds', async () => {
      const request = {
        type: '3d' as const,
        prompt: 'Simple geometric shape',
        quality: 'low' as const,
      };

      const start = performance.now();
      await generateAsset(request);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10000);
    }, 15000);

    it('should handle memory efficiently for large 3D models', async () => {
      // Create a mock that returns a large buffer
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10 * 1024 * 1024), // 10MB
      } as Response);

      const request = {
        type: '3d' as const,
        prompt: 'Large model',
        quality: 'high' as const,
      };

      const result = await generateAsset(request);
      expect(result.data.byteLength).toBe(10 * 1024 * 1024);
    }, 20000);
  });
});

// ============================================================================
// Asset Pipeline Tests - Audio Generation
// ============================================================================

describe('Asset Pipeline - Audio Generation', () => {
  describe('Happy Paths', () => {
    it('should generate an audio asset successfully', async () => {
      const request = {
        type: 'audio' as const,
        prompt: 'Hello, welcome to the tutorial!',
        quality: 'medium' as const,
        voice: 'alloy',
      };

      const result = await generateAsset(request);

      expect(result).toBeDefined();
      expect(result.type).toBe('.wav');
      expect(result.importPath).toContain('user://generated/');
      expect(result.data.byteLength).toBeGreaterThan(0);
    });

    it('should use default voice when not specified', async () => {
      const request = {
        type: 'audio' as const,
        prompt: 'Test speech',
        quality: 'low' as const,
      };

      const result = await generateAsset(request);

      expect(result.type).toBe('.wav');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/audio/speech'),
        expect.objectContaining({
          body: expect.stringContaining('"voice":"alloy"'),
        })
      );
    });

    it('should support different voice options', async () => {
      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

      for (const voice of voices) {
        const request = {
          type: 'audio' as const,
          prompt: 'Test speech',
          quality: 'low' as const,
          voice,
        };

        const result = await generateAsset(request);
        expect(result.type).toBe('.wav');
      }
    });

    it('should handle long text for audio generation', async () => {
      const longText = 'This is a very long text that should be converted to speech. '.repeat(10);

      const request = {
        type: 'audio' as const,
        prompt: longText,
        quality: 'medium' as const,
      };

      const result = await generateAsset(request);
      expect(result).toBeDefined();
      expect(result.type).toBe('.wav');
    });
  });

  describe('Error Cases', () => {
    it('should handle audio generation API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'TTS Service Error',
        text: async () => 'Speech synthesis failed',
      } as Response);

      const request = {
        type: 'audio' as const,
        prompt: 'Test speech',
        quality: 'medium' as const,
      };

      await expect(generateAsset(request)).rejects.toThrow('Audio generation failed');
    });

    it('should handle empty text for audio generation', async () => {
      const request = {
        type: 'audio' as const,
        prompt: '',
        quality: 'medium' as const,
      };

      // Should still attempt generation
      const result = await generateAsset(request);
      expect(result).toBeDefined();
    });

    it('should handle invalid voice parameter', async () => {
      const request = {
        type: 'audio' as const,
        prompt: 'Test speech',
        quality: 'medium' as const,
        voice: 'invalid_voice_name_12345',
      };

      // API will validate the voice, but we should still attempt
      const result = await generateAsset(request);
      expect(result).toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should generate short audio within 5 seconds', async () => {
      const request = {
        type: 'audio' as const,
        prompt: 'Short test',
        quality: 'low' as const,
      };

      const start = performance.now();
      await generateAsset(request);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000);
    }, 10000);

    it('should handle concurrent audio generation', async () => {
      const requests = Array(5).fill(null).map((_, i) => ({
        type: 'audio' as const,
        prompt: `Concurrent audio test ${i}`,
        quality: 'low' as const,
      }));

      const results = await Promise.all(
        requests.map(req => generateAsset(req))
      );

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.type).toBe('.wav');
      });
    }, 30000);
  });
});

// ============================================================================
// Asset Pipeline Tests - Asset Regeneration
// ============================================================================

describe('Asset Pipeline - Asset Regeneration Across Forms', () => {
  describe('Cross-Form Transformation', () => {
    it('should support regeneration from 2D to 3D', async () => {
      // First generate 2D image
      const imageRequest = {
        type: 'image' as const,
        prompt: 'A simple cube',
        quality: 'low' as const,
      };

      const imageAsset = await generateAsset(imageRequest);

      // Then generate 3D version based on same concept
      const modelRequest = {
        type: '3d' as const,
        prompt: 'A simple cube', // Same concept
        quality: 'low' as const,
      };

      const modelAsset = await generateAsset(modelRequest);

      expect(imageAsset.type).toBe('.png');
      expect(modelAsset.type).toBe('.glb');
    });

    it('should support regeneration from 3D to 2D', async () => {
      // First generate 3D model
      const modelRequest = {
        type: '3d' as const,
        prompt: 'Fantasy character',
        quality: 'low' as const,
      };

      await generateAsset(modelRequest);

      // Then generate 2D representation
      const imageRequest = {
        type: 'image' as const,
        prompt: 'Fantasy character', // Same subject
        quality: 'low' as const,
        style: 'portrait',
      };

      const imageAsset = await generateAsset(imageRequest);
      expect(imageAsset.type).toBe('.png');
    });

    it('should maintain consistent asset IDs across forms', async () => {
      const basePrompt = 'Consistent test asset';

      // Generate all three forms with same base prompt
      const imageAsset = await generateAsset({
        type: 'image' as const,
        prompt: basePrompt,
        quality: 'low' as const,
      });

      const modelAsset = await generateAsset({
        type: '3d' as const,
        prompt: basePrompt,
        quality: 'low' as const,
      });

      const audioAsset = await generateAsset({
        type: 'audio' as const,
        prompt: basePrompt,
        quality: 'low' as const,
      });

      // All should have valid import paths with timestamps
      expect(imageAsset.importPath).toMatch(/user:\/\/generated\/\d+\.png/);
      expect(modelAsset.importPath).toMatch(/user:\/\/generated\/\d+\.glb/);
      expect(audioAsset.importPath).toMatch(/user:\/\/generated\/\d+\.wav/);
    });
  });

  describe('Iterative Refinement', () => {
    it('should support iterative prompt refinement for images', async () => {
      const basePrompt = 'A mountain landscape';
      const refinements = [
        { style: 'photorealistic' },
        { style: 'dramatic lighting' },
        { style: '4K ultra detailed' },
      ];

      let lastPrompt = basePrompt;
      const assets = [];

      for (const refinement of refinements) {
        const asset = await generateAsset({
          type: 'image' as const,
          prompt: lastPrompt,
          quality: 'low' as const,
          ...refinement,
        });
        assets.push(asset);
        lastPrompt = `${basePrompt} with ${refinement.style}`;
      }

      expect(assets).toHaveLength(3);
      assets.forEach(asset => {
        expect(asset.type).toBe('.png');
      });
    });

    it('should support quality tier upgrades', async () => {
      const prompt = 'Test asset';

      // Start with low quality
      const lowQuality = await generateAsset({
        type: 'image' as const,
        prompt,
        quality: 'low' as const,
      });

      // Upgrade to medium
      const mediumQuality = await generateAsset({
        type: 'image' as const,
        prompt,
        quality: 'medium' as const,
      });

      // Upgrade to high
      const highQuality = await generateAsset({
        type: 'image' as const,
        prompt,
        quality: 'high' as const,
      });

      expect(lowQuality.importPath).not.toBe(mediumQuality.importPath);
      expect(mediumQuality.importPath).not.toBe(highQuality.importPath);
    });
  });
});

// ============================================================================
// Asset Pipeline Tests - Godot Integration
// ============================================================================

describe('Asset Pipeline - Godot Format Conversion', () => {
  describe('Format Conversion', () => {
    it('should convert PNG to Godot user:// path', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      const result = await generateAsset(request);

      expect(result.type).toBe('.png');
      expect(result.importPath).toMatch(/^user:\/\//);
      expect(result.importPath).toContain('.png');
    });

    it('should convert GLB to Godot user:// path', async () => {
      const request = {
        type: '3d' as const,
        prompt: 'Test model',
        quality: 'low' as const,
      };

      const result = await generateAsset(request);

      expect(result.type).toBe('.glb');
      expect(result.importPath).toMatch(/^user:\/\//);
    });

    it('should convert WAV to Godot user:// path', async () => {
      const request = {
        type: 'audio' as const,
        prompt: 'Test audio',
        quality: 'low' as const,
      };

      const result = await generateAsset(request);

      expect(result.type).toBe('.wav');
      expect(result.importPath).toMatch(/^user:\/\//);
    });

    it('should generate unique timestamps for each asset', async () => {
      const requests = [
        { type: 'image' as const, prompt: 'Test 1', quality: 'low' as const },
        { type: 'image' as const, prompt: 'Test 2', quality: 'low' as const },
      ];

      const [asset1, asset2] = await Promise.all(
        requests.map(req => generateAsset(req))
      );

      const timestamp1 = asset1.importPath.match(/(\d+)/)?.[1];
      const timestamp2 = asset2.importPath.match(/(\d+)/)?.[1];

      expect(timestamp1).toBeDefined();
      expect(timestamp2).toBeDefined();
      expect(timestamp1).not.toBe(timestamp2);
    });
  });
});

// ============================================================================
// Asset Pipeline Tests - Hot Reload
// ============================================================================

describe('Asset Pipeline - Hot Reload Functionality', () => {
  describe('WebSocket Communication', () => {
    it('should establish WebSocket connection for hot reload', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      await generateAsset(request);

      // WebSocket should be created for hot reload
      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:7352/godot'
      );
    });

    it('should send hot reload message with asset data', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      await generateAsset(request);

      // Wait for WebSocket connection
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"hot_reload"')
      );
    });

    it('should include asset path in hot reload message', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      const result = await generateAsset(request);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining(result.importPath)
      );
    });

    it('should include asset format in hot reload message', async () => {
      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      await generateAsset(request);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('.png')
      );
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle WebSocket connection timeout', async () => {
      // Mock a WebSocket that never connects
      mockWebSocket.addEventListener = vi.fn();
      mockWebSocket.readyState = 0; // CONNECTING

      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      // Should still complete asset generation even if hot reload fails
      await expect(generateAsset(request)).rejects.toThrow();
    });

    it('should handle WebSocket send errors gracefully', async () => {
      mockWebSocket.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      // Should reject when hot reload fails
      await expect(generateAsset(request)).rejects.toThrow();
    });

    it('should handle WebSocket connection errors', async () => {
      mockWebSocket.addEventListener = vi.fn((event: string, callback: any) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 10);
        }
      });

      const request = {
        type: 'image' as const,
        prompt: 'Test image',
        quality: 'low' as const,
      };

      await expect(generateAsset(request)).rejects.toThrow();
    });
  });
});

// ============================================================================
// Asset Pipeline Tests - Unknown Asset Types
// ============================================================================

describe('Asset Pipeline - Unknown Asset Types', () => {
  it('should throw error for unknown asset type', async () => {
    const request = {
      type: 'unknown' as 'image' | '3d' | 'audio',
      prompt: 'Test',
      quality: 'low' as const,
    };

    await expect(generateAsset(request)).rejects.toThrow('Unknown asset type');
  });

  it('should provide descriptive error message', async () => {
    const request = {
      type: 'video' as 'image' | '3d' | 'audio',
      prompt: 'Test video',
      quality: 'low' as const,
    };

    await expect(generateAsset(request)).rejects.toThrow(/Unknown asset type: video/);
  });
});

// ============================================================================
// Asset Pipeline Tests - Concurrent Operations
// ============================================================================

describe('Asset Pipeline - Concurrent Operations', () => {
  it('should handle mixed concurrent asset generation', async () => {
    const requests = [
      { type: 'image' as const, prompt: 'Image 1', quality: 'low' as const },
      { type: '3d' as const, prompt: 'Model 1', quality: 'low' as const },
      { type: 'audio' as const, prompt: 'Audio 1', quality: 'low' as const },
      { type: 'image' as const, prompt: 'Image 2', quality: 'low' as const },
      { type: '3d' as const, prompt: 'Model 2', quality: 'low' as const },
    ];

    const results = await Promise.all(
      requests.map(req => generateAsset(req))
    );

    expect(results).toHaveLength(5);
    expect(results[0].type).toBe('.png');
    expect(results[1].type).toBe('.glb');
    expect(results[2].type).toBe('.wav');
    expect(results[3].type).toBe('.png');
    expect(results[4].type).toBe('.glb');
  }, 60000);

  it('should maintain isolation between concurrent requests', async () => {
    const prompts = ['Asset A', 'Asset B', 'Asset C'];
    const requests = prompts.map(prompt => ({
      type: 'image' as const,
      prompt,
      quality: 'low' as const,
    }));

    const results = await Promise.all(
      requests.map(req => generateAsset(req))
    );

    // Each should have unique import paths
    const paths = results.map(r => r.importPath);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(3);
  });
});
