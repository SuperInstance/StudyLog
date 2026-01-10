/**
 * Rate Limiter
 *
 * Token bucket rate limiting with support for:
 * - Per-tenant limits
 * - Per-user limits
 * - Burst allowance
 * - Distributed counting via KV
 */

import type { RateLimitConfig, GatewayContext } from './types';

// ============================================================================
// Rate Limit Result
// ============================================================================

export interface RateLimitResult {
  /**
   * Is request allowed
   */
  allowed: boolean;

  /**
   * Remaining requests in window
   */
  remaining: number;

  /**
   * Unix timestamp when limit resets
   */
  reset: number;

  /**
   * Limit value
   */
  limit: number;

  /**
   * Retry after seconds (if not allowed)
   */
  retryAfter?: number;
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Check if request is allowed under rate limit.
   */
  async check(
    context: GatewayContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = this.getRateLimitKey(context, config);

    // Get current state
    const state = await this.getState(key);

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    // Clean expired entries
    const cleanRequests = state.requests.filter(t => t > windowStart);

    // Check if adding this request exceeds limit
    const currentCount = cleanRequests.length;
    const allowed = currentCount < config.limit;
    const remaining = Math.max(0, config.limit - currentCount - 1);

    // Calculate reset time
    let reset: number;
    if (cleanRequests.length > 0) {
      reset = cleanRequests[0] + config.window;
    } else {
      reset = now + config.window;
    }

    if (allowed) {
      // Add this request timestamp
      cleanRequests.push(now);

      // Save updated state
      await this.setState(key, {
        requests: cleanRequests,
        burst: state.burst || 0,
      });

      return {
        allowed: true,
        remaining: remaining - 1,
        reset,
        limit: config.limit,
      };
    }

    // Rate limit exceeded
    const oldestRequest = cleanRequests[0];
    const retryAfter = oldestRequest + config.window - now;

    return {
      allowed: false,
      remaining: 0,
      reset,
      limit: config.limit,
      retryAfter,
    };
  }

  /**
   * Check and consume from burst pool.
   */
  async checkBurst(
    context: GatewayContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = this.getRateLimitKey(context, config);

    const state = await this.getState(key);
    const burstAllowance = config.burst || 0;

    // Check regular limit first
    const regularResult = await this.check(context, config);

    if (regularResult.allowed) {
      return regularResult;
    }

    // Regular limit exceeded, check burst
    if (burstAllowance <= 0 || (state.burst || 0) >= burstAllowance) {
      return regularResult;
    }

    // Use burst allowance
    await this.setState(key, {
      ...state,
      burst: (state.burst || 0) + 1,
    });

    return {
      allowed: true,
      remaining: 0,
      reset: regularResult.reset,
      limit: config.limit + burstAllowance,
    };
  }

  /**
   * Reset rate limit for a key.
   */
  async reset(context: GatewayContext, config: RateLimitConfig): Promise<void> {
    const key = this.getRateLimitKey(context, config);
    await this.kv.delete(key);
  }

  /**
   * Get current rate limit state without consuming.
   */
  async peek(
    context: GatewayContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = this.getRateLimitKey(context, config);
    const state = await this.getState(key);

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.window;

    const cleanRequests = state.requests.filter(t => t > windowStart);
    const currentCount = cleanRequests.length;
    const remaining = Math.max(0, config.limit - currentCount);

    let reset: number;
    if (cleanRequests.length > 0) {
      reset = cleanRequests[0] + config.window;
    } else {
      reset = now + config.window;
    }

    return {
      allowed: currentCount < config.limit,
      remaining,
      reset,
      limit: config.limit,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Get rate limit key for context.
   */
  private getRateLimitKey(context: GatewayContext, config: RateLimitConfig): string {
    const parts = ['ratelimit'];

    // Add scope prefix
    switch (config.scope || 'global') {
      case 'tenant':
        parts.push('tenant', context.tenantId || 'default');
        break;
      case 'user':
        parts.push('user', context.userId || context.clientIp);
        break;
      case 'global':
      default:
        parts.push('global');
        break;
    }

    // Add custom key if specified
    if (config.key) {
      const value = this.getKeyValue(context, config.key);
      parts.push('key', value);
    }

    return parts.join(':');
  }

  /**
   * Get key value from context.
   */
  private getKeyValue(context: GatewayContext, key: string): string {
    switch (key) {
      case 'tenant.id':
        return context.tenantId || 'default';
      case 'user.id':
        return context.userId || 'anonymous';
      case 'ip.address':
        return context.clientIp;
      case 'request.id':
        return context.requestId;
      default:
        return key;
    }
  }

  /**
   * Get rate limit state from KV.
   */
  private async getState(key: string): Promise<RateLimitState> {
    const cached = await this.kv.get(key, 'json');
    return (cached as RateLimitState) || { requests: [], burst: 0 };
  }

  /**
   * Save rate limit state to KV.
   */
  private async setState(key: string, state: RateLimitState): Promise<void> {
    // Set expiration to slightly longer than window
    const ttl = 60; // 1 minute minimum

    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: ttl,
    });
  }
}

/**
 * Rate limit state
 */
interface RateLimitState {
  /**
   * Request timestamps in current window
   */
  requests: number[];

  /**
   * Burst tokens used
   */
  burst: number;
}

// ============================================================================
// Sliding Window Rate Limiter (Alternative Implementation)
// ============================================================================

/**
 * Sliding window rate limiter using atomic counters.
 */
export class SlidingWindowRateLimiter {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Check with sliding window algorithm.
   */
  async check(
    context: GatewayContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const windowSize = config.window;
    const windowStart = now - (now % windowSize);
    const windowKey = `slw:${context.clientIp}:${windowStart}`;

    // Get current count
    const currentStr = await this.kv.get(windowKey);
    const current = currentStr ? parseInt(currentStr, 10) : 0;

    const allowed = current < config.limit;
    const remaining = Math.max(0, config.limit - current - 1);
    const reset = windowStart + windowSize;

    if (allowed) {
      // Increment counter
      await this.kv.put(windowKey, String(current + 1), {
        expirationTtl: windowSize * 2,
      });
    }

    return {
      allowed,
      remaining,
      reset,
      limit: config.limit,
      retryAfter: allowed ? undefined : reset - now,
    };
  }
}
