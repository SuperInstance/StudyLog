/**
 * StudyLoG.AI Backend - Main Worker Entry Point
 *
 * Routes:
 * - /api/v1/auth/*     - Authentication
 * - /api/v1/student/*  - Student state and progress
 * - /api/v1/ai/*       - AI inference routing
 * - /api/v1/game/*     - Game state sync
 * - /api/v1/assets/*   - Asset management
 * - /health            - Health check
 */

import { Router } from './router';
import { authRoutes } from './routes/auth';
import { studentRoutes } from './routes/student';
import { aiRoutes } from './routes/ai';
import { gameRoutes } from './routes/game';
import { assetRoutes } from './routes/assets';
import { errorHandler, corsHeaders, rateLimiter } from './middleware';
import type { Env } from './types';

const router = new Router();

// Health check
router.get('/health', async () => {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// API v1 routes
router.route('/api/v1/auth', authRoutes);
router.route('/api/v1/student', studentRoutes);
router.route('/api/v1/ai', aiRoutes);
router.route('/api/v1/game', gameRoutes);
router.route('/api/v1/assets', assetRoutes);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders(request) });
      }

      // Rate limiting
      const rateLimitResult = await rateLimiter(request, env);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      // Route the request
      const response = await router.handle(request, env, ctx);

      // Add CORS headers to response
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders(request)).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      return errorHandler(error, request);
    }
  },
};
