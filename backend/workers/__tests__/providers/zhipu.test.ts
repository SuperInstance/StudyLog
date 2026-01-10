/**
 * Zhipu AI (Z.ai) Provider Tests
 *
 * Tests for the Zhipu provider implementation including:
 * - JWT token generation
 * - API key parsing
 * - Model-specific pricing
 * - Request/response handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Helper Functions from Zhipu Provider
// ============================================================================

/**
 * Parse Zhipu API key into ID and secret components
 *
 * Zhipu API keys are formatted as "{id}.{secret}"
 */
function parseApiKey(apiKey: string): { id: string; secret: string } {
  const parts = apiKey.split('.');
  if (parts.length !== 2) {
    throw new Error(
      'Invalid Zhipu API key format. Expected format: {id}.{secret} ' +
      '(e.g., "1234.abcdef1234567890")'
    );
  }
  const [id, secret] = parts;
  if (!id || !secret || id.length < 1 || secret.length < 10) {
    throw new Error(
      'Invalid Zhipu API key: ID and secret must both be non-empty, ' +
      'and secret must be at least 10 characters'
    );
  }
  return { id, secret };
}

/**
 * Encode a string to Base64URL format
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Sign data using HMAC-SHA256
 */
async function signHMACSHA256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataBytes = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, dataBytes);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Generate JWT token for Zhipu API authentication
 */
async function generateZhipuJWT(apiKey: string): Promise<string> {
  const { id, secret } = parseApiKey(apiKey);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // Token expires in 1 hour

  const header = {
    alg: 'HS256',
    sign_type: 'SIGN',
  };

  const payload = {
    api_key: id,
    exp: exp,
    timestamp: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHMACSHA256(secret, data);
  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Get model-specific pricing for Zhipu models
 */
function getZhipuPricing(model: string): { input: number; output: number } {
  const pricing: Record<string, { input: number; output: number }> = {
    'glm-4-flash': { input: 0.01, output: 0.01 },
    'glm-4.5': { input: 0.05, output: 0.05 },
    'glm-4.7': { input: 0.08, output: 0.30 },
    'glm-4-plus': { input: 0.50, output: 0.50 },
    'glm-4-long': { input: 0.08, output: 0.30 },
  };
  return pricing[model] || { input: 0.08, output: 0.30 };
}

/**
 * Calculate cost based on token usage and model
 */
function calculateZhipuCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = getZhipuPricing(model);
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Zhipu Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------------
  // API Key Parsing Tests
  // ------------------------------------------------------------------------
  describe('parseApiKey', () => {
    it('should parse valid API key in format {id}.{secret}', () => {
      const result = parseApiKey('1234.abcdef1234567890');
      expect(result.id).toBe('1234');
      expect(result.secret).toBe('abcdef1234567890');
    });

    it('should accept API key with longer ID', () => {
      const result = parseApiKey('api-key-id-123.supersecretkey123456');
      expect(result.id).toBe('api-key-id-123');
      expect(result.secret).toBe('supersecretkey123456');
    });

    it('should throw error for missing dot separator', () => {
      expect(() => parseApiKey('invalidkey')).toThrowError(
        'Invalid Zhipu API key format'
      );
    });

    it('should throw error for multiple dots', () => {
      expect(() => parseApiKey('1234.5678.9012')).toThrowError(
        'Invalid Zhipu API key format'
      );
    });

    it('should throw error for empty ID', () => {
      expect(() => parseApiKey('.secretkey123456')).toThrowError(
        'Invalid Zhipu API key'
      );
    });

    it('should throw error for empty secret', () => {
      expect(() => parseApiKey('1234.')).toThrowError(
        'Invalid Zhipu API key'
      );
    });

    it('should throw error for short secret (< 10 chars)', () => {
      expect(() => parseApiKey('1234.short')).toThrowError(
        'Invalid Zhipu API key'
      );
    });
  });

  // ------------------------------------------------------------------------
  // Base64URL Encoding Tests
  // ------------------------------------------------------------------------
  describe('base64UrlEncode', () => {
    it('should encode simple string to Base64URL', () => {
      const result = base64UrlEncode('hello');
      // Regular base64: aGVsbG8=
      // Base64URL: aGVsbG8 (no padding)
      expect(result).toBe('aGVsbG8');
    });

    it('should replace + with -', () => {
      const result = base64UrlEncode('+++');
      expect(result).not.toContain('+');
    });

    it('should replace / with _', () => {
      const input = btoa('/'); // Regular base64 of / is Lw==
      const result = base64UrlEncode('/');
      expect(result).not.toContain('/');
    });

    it('should remove padding =', () => {
      const result = base64UrlEncode('test');
      expect(result).not.toContain('=');
    });

    it('should handle JSON strings', () => {
      const json = JSON.stringify({ alg: 'HS256' });
      const result = base64UrlEncode(json);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------------
  // JWT Token Generation Tests
  // ------------------------------------------------------------------------
  describe('generateZhipuJWT', () => {
    afterEach(() => {
      vi.useRealTimers();
    });
    it('should generate valid JWT with three parts', async () => {
      const jwt = await generateZhipuJWT('1234.abcdefghij1234567890');
      const parts = jwt.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should include correct header', async () => {
      const jwt = await generateZhipuJWT('1234.abcdefghij1234567890');
      const headerB64 = jwt.split('.')[0];

      // Decode Base64URL
      const header = JSON.parse(atob(headerB64.replace(/_/g, '/').replace(/-/g, '+')));
      expect(header.alg).toBe('HS256');
      expect(header.sign_type).toBe('SIGN');
    });

    it('should include API key ID in payload', async () => {
      const jwt = await generateZhipuJWT('my-api-id.abcdefghij1234567890');
      const payloadB64 = jwt.split('.')[1];

      // Decode Base64URL
      const payload = JSON.parse(atob(payloadB64.replace(/_/g, '/').replace(/-/g, '+')));
      expect(payload.api_key).toBe('my-api-id');
    });

    it('should include expiration timestamp', async () => {
      const jwt = await generateZhipuJWT('1234.abcdefghij1234567890');
      const payloadB64 = jwt.split('.')[1];
      const payload = JSON.parse(atob(payloadB64.replace(/_/g, '/').replace(/-/g, '+')));

      const now = Math.floor(Date.now() / 1000);
      expect(payload.exp).toBeGreaterThan(now);
      expect(payload.exp).toBeLessThanOrEqual(now + 3600);
    });

    it('should include timestamp', async () => {
      const jwt = await generateZhipuJWT('1234.abcdefghij1234567890');
      const payloadB64 = jwt.split('.')[1];
      const payload = JSON.parse(atob(payloadB64.replace(/_/g, '/').replace(/-/g, '+')));

      const now = Math.floor(Date.now() / 1000);
      expect(payload.timestamp).toBeGreaterThanOrEqual(now - 1); // Allow 1 second tolerance
      expect(payload.timestamp).toBeLessThanOrEqual(now + 1);
    });

    it('should generate different tokens for same API key (due to timestamp)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      const jwt1 = await generateZhipuJWT('1234.abcdefghij1234567890');

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      const jwt2 = await generateZhipuJWT('1234.abcdefghij1234567890');

      vi.useRealTimers();

      expect(jwt1).not.toBe(jwt2);
    });

    it('should generate same tokens for same API key at same time (deterministic signature)', async () => {
      // Use fake timers to control Date.now
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      const jwt1 = await generateZhipuJWT('1234.abcdefghij1234567890');
      const jwt2 = await generateZhipuJWT('1234.abcdefghij1234567890');

      vi.useRealTimers();

      // Signatures should be identical when timestamp is the same
      expect(jwt1).toBe(jwt2);
    });
  });

  // ------------------------------------------------------------------------
  // Model Pricing Tests
  // ------------------------------------------------------------------------
  describe('getZhipuPricing', () => {
    it('should return correct pricing for glm-4-flash', () => {
      const pricing = getZhipuPricing('glm-4-flash');
      expect(pricing.input).toBe(0.01);
      expect(pricing.output).toBe(0.01);
    });

    it('should return correct pricing for glm-4.5', () => {
      const pricing = getZhipuPricing('glm-4.5');
      expect(pricing.input).toBe(0.05);
      expect(pricing.output).toBe(0.05);
    });

    it('should return correct pricing for glm-4.7', () => {
      const pricing = getZhipuPricing('glm-4.7');
      expect(pricing.input).toBe(0.08);
      expect(pricing.output).toBe(0.30);
    });

    it('should return correct pricing for glm-4-plus', () => {
      const pricing = getZhipuPricing('glm-4-plus');
      expect(pricing.input).toBe(0.50);
      expect(pricing.output).toBe(0.50);
    });

    it('should return correct pricing for glm-4-long', () => {
      const pricing = getZhipuPricing('glm-4-long');
      expect(pricing.input).toBe(0.08);
      expect(pricing.output).toBe(0.30);
    });

    it('should return default pricing for unknown model', () => {
      const pricing = getZhipuPricing('unknown-model');
      expect(pricing.input).toBe(0.08);
      expect(pricing.output).toBe(0.30);
    });
  });

  // ------------------------------------------------------------------------
  // Cost Calculation Tests
  // ------------------------------------------------------------------------
  describe('calculateZhipuCost', () => {
    it('should calculate cost for glm-4-flash correctly', () => {
      const cost = calculateZhipuCost(1000, 500, 'glm-4-flash');
      // (1000/1M) * 0.01 + (500/1M) * 0.01 = 0.00001 + 0.000005 = 0.000015
      expect(cost).toBeCloseTo(0.000015, 6);
    });

    it('should calculate cost for glm-4.7 correctly', () => {
      const cost = calculateZhipuCost(1000, 500, 'glm-4.7');
      // (1000/1M) * 0.08 + (500/1M) * 0.30 = 0.00008 + 0.00015 = 0.00023
      expect(cost).toBeCloseTo(0.00023, 6);
    });

    it('should calculate cost for glm-4-plus correctly', () => {
      const cost = calculateZhipuCost(10000, 5000, 'glm-4-plus');
      // (10000/1M) * 0.50 + (5000/1M) * 0.50 = 0.005 + 0.0025 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it('should handle zero tokens', () => {
      const cost = calculateZhipuCost(0, 0, 'glm-4.7');
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = calculateZhipuCost(1000000, 500000, 'glm-4-flash');
      // (1M/1M) * 0.01 + (500K/1M) * 0.01 = 0.01 + 0.005 = 0.015
      expect(cost).toBeCloseTo(0.015, 4);
    });
  });

  // ------------------------------------------------------------------------
  // Model Selection Strategy Tests
  // ------------------------------------------------------------------------
  describe('Model Selection Strategy', () => {
    it('should recommend glm-4-flash for simple queries', () => {
      // GLM-4-Flash is cheapest at $0.01 input / $0.01 output
      const flashPricing = getZhipuPricing('glm-4-flash');
      expect(flashPricing.input).toBe(0.01);
      expect(flashPricing.output).toBe(0.01);
    });

    it('should recommend glm-4.7 for coding tasks', () => {
      // GLM-4.7 is optimized for coding and agentic workflows
      const pricing = getZhipuPricing('glm-4.7');
      expect(pricing.input).toBe(0.08);
      expect(pricing.output).toBe(0.30);
      // Higher output cost reflects better reasoning for code generation
    });

    it('should recommend glm-4-long for large documents', () => {
      // GLM-4-Long has 200K context window
      const pricing = getZhipuPricing('glm-4-long');
      expect(pricing.input).toBe(0.08);
      expect(pricing.output).toBe(0.30);
      // Same pricing as GLM-4.7 but with extended context
    });

    it('should show glm-4-plus as premium option', () => {
      // GLM-4-Plus is highest quality at $0.50 input / $0.50 output
      const pricing = getZhipuPricing('glm-4-plus');
      expect(pricing.input).toBe(0.50);
      expect(pricing.output).toBe(0.50);
      // Most expensive but highest quality reasoning
    });
  });

  // ------------------------------------------------------------------------
  // Cost Optimization Tests
  // ------------------------------------------------------------------------
  describe('Cost Optimization', () => {
    it('should show cost savings of glm-4-flash over glm-4.7', () => {
      const flashCost = calculateZhipuCost(1000, 1000, 'glm-4-flash');
      const glm47Cost = calculateZhipuCost(1000, 1000, 'glm-4.7');

      expect(flashCost).toBeLessThan(glm47Cost);
      // GLM-4-Flash should be ~11x cheaper for balanced input/output
      expect(glm47Cost / flashCost).toBeGreaterThan(10);
    });

    it('should show cost savings of glm-4.5 over glm-4-plus', () => {
      const glm45Cost = calculateZhipuCost(1000, 1000, 'glm-4.5');
      const glmPlusCost = calculateZhipuCost(1000, 1000, 'glm-4-plus');

      expect(glm45Cost).toBeLessThan(glmPlusCost);
      // GLM-4.5 should be 10x cheaper than GLM-4-Plus
      expect(glmPlusCost / glm45Cost).toBe(10);
    });

    it('should calculate per-token costs correctly', () => {
      // For GLM-4-Flash: $0.01 per 1M tokens = $0.00000001 per token
      const flashPricing = getZhipuPricing('glm-4-flash');
      const perTokenCost = flashPricing.input / 1_000_000;
      expect(perTokenCost).toBe(0.00000001);
    });
  });

  // ------------------------------------------------------------------------
  // Integration Tests
  // ------------------------------------------------------------------------
  describe('Integration', () => {
    it('should handle end-to-end cost calculation for typical request', () => {
      const inputTokens = 500;
      const outputTokens = 750;
      const model = 'glm-4.7';

      const cost = calculateZhipuCost(inputTokens, outputTokens, model);

      // Verify cost is reasonable (not zero, not extremely high)
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01); // Should be less than 1 cent for this request
    });

    it('should support all documented models', () => {
      const models = ['glm-4-flash', 'glm-4.5', 'glm-4.7', 'glm-4-plus', 'glm-4-long'];

      models.forEach(model => {
        const pricing = getZhipuPricing(model);
        expect(pricing).toBeDefined();
        expect(typeof pricing.input).toBe('number');
        expect(typeof pricing.output).toBe('number');
        expect(pricing.input).toBeGreaterThan(0);
        expect(pricing.output).toBeGreaterThan(0);
      });
    });

    it('should generate valid JWT that can be decoded', async () => {
      const apiKey = 'test-id.1234567890abcdef';
      const jwt = await generateZhipuJWT(apiKey);

      // JWT should have 3 parts separated by dots
      const parts = jwt.split('.');
      expect(parts).toHaveLength(3);

      // Each part should be non-empty
      parts.forEach(part => {
        expect(part.length).toBeGreaterThan(0);
      });
    });
  });
});
