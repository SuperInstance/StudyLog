/**
 * Enhanced Security - Main Entry Point
 *
 * Cloudflare Worker for input validation, security scanning,
 * PII redaction, and audit logging.
 */

import { Validator, CommonSchemas } from './validator';
import { PromptInjectionDetector, defaultDetector } from './prompt-injection';
import { PIIDetector, defaultPIIDetector, redactPII } from './pii-redactor';
import { AuditLogger, createAuditLogger } from './audit-logger';
import type {
  ValidationSchema,
  SecurityScanResult,
  PIIDetectionResult,
  AuditLogEntry,
  Env,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Initialize audit logger
    const auditLogger = createAuditLogger(env, 'security');

    // Get client info
    const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || undefined;

    try {
      // Health check
      if (pathname === '/health') {
        return Response.json({
          status: 'healthy',
          service: 'security',
          version: '1.0.0',
        }, { headers: corsHeaders });
      }

      // Validation endpoints
      if (pathname === '/v1/validate' && request.method === 'POST') {
        return await handleValidate(request, env, auditLogger, ipAddress, userAgent);
      }

      // Security scan endpoint
      if (pathname === '/v1/scan' && request.method === 'POST') {
        return await handleScan(request, env, auditLogger, ipAddress, userAgent);
      }

      // PII redaction endpoint
      if (pathname === '/v1/redact-pii' && request.method === 'POST') {
        return await handleRedactPII(request, env, auditLogger);
      }

      // Audit log endpoints
      if (pathname === '/v1/audit/logs' && request.method === 'GET') {
        return await handleQueryAuditLogs(request, env);
      }

      if (pathname === '/v1/audit/stats' && request.method === 'GET') {
        return await handleAuditStats(request, env);
      }

      // Rate limit rules
      if (pathname === '/v1/rate-limits' && request.method === 'GET') {
        return await handleGetRateLimits(env);
      }

      if (pathname === '/v1/rate-limits' && request.method === 'POST') {
        return await handleCreateRateLimit(request, env);
      }

      // Security event submission
      if (pathname === '/v1/security/events' && request.method === 'POST') {
        return await handleSecurityEvent(request, env, auditLogger, ipAddress);
      }

      // 404
      return new Response(JSON.stringify({
        error: 'Not found',
        path: pathname,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Security service error:', error);

      await auditLogger.logSecurityEvent({
        action: 'service_error',
        description: 'Security service error',
        severity: 'error',
        outcome: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) },
        ipAddress,
      });

      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ============================================================================
// Route Handlers
// ============================================================================

async function handleValidate(
  request: Request,
  env: Env,
  auditLogger: AuditLogger,
  ipAddress: string,
  userAgent: string
): Promise<Response> {
  const body = await request.json();
  const { data, schema } = body;

  if (!data || !schema) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: data, schema',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validator = new Validator();
  const result = validator.validate(data, schema);

  // Log validation result
  await auditLogger.logSecurityEvent({
    action: 'input_validation',
    description: `Input validation: ${result.valid ? 'passed' : 'failed'}`,
    severity: result.valid ? 'info' : 'warning',
    outcome: result.valid ? 'success' : 'failure',
    details: { result },
    ipAddress,
    userAgent,
  });

  return Response.json(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleScan(
  request: Request,
  env: Env,
  auditLogger: AuditLogger,
  ipAddress: string,
  userAgent: string
): Promise<Response> {
  const body = await request.json();
  const { input, type } = body;

  if (!input) {
    return new Response(JSON.stringify({
      error: 'Missing required field: input',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Scan for threats
  const detector = new PromptInjectionDetector();
  const scanResult: SecurityScanResult = detector.scan(input);

  // If high severity, log security event
  if (scanResult.threatLevel !== 'safe') {
    await auditLogger.logSecurityEvent({
      action: 'security_scan',
      description: `Security scan found ${scanResult.threatLevel} threat level`,
      severity: scanResult.threatLevel === 'dangerous' ? 'critical' : 'warning',
      outcome: 'success',
      details: { threats: scanResult.threats },
      ipAddress,
      userAgent,
    });
  }

  return Response.json(scanResult, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRedactPII(
  request: Request,
  env: Env,
  auditLogger: AuditLogger
): Promise<Response> {
  const body = await request.json();
  const { text, options } = body;

  if (!text) {
    return new Response(JSON.stringify({
      error: 'Missing required field: text',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const detector = new PIIDetector();
  const result: PIIDetectionResult = detector.detect(text, options);

  // Log if PII found
  if (result.instances.length > 0) {
    await auditLogger.logSecurityEvent({
      action: 'pii_redaction',
      description: `Redacted ${result.instances.length} PII instances`,
      severity: 'info',
      outcome: 'success',
      details: { types: result.instances.map(i => i.type) },
    });
  }

  return Response.json(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleQueryAuditLogs(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const auditLogger = createAuditLogger(env);

  const options = {
    eventType: url.searchParams.get('eventType') as any || undefined,
    severity: url.searchParams.get('severity') as any || undefined,
    userId: url.searchParams.get('userId') || undefined,
    tenantId: url.searchParams.get('tenantId') || undefined,
    outcome: url.searchParams.get('outcome') as any || undefined,
    startTime: url.searchParams.get('startTime') || undefined,
    endTime: url.searchParams.get('endTime') || undefined,
    limit: parseInt(url.searchParams.get('limit') || '100', 10),
    offset: parseInt(url.searchParams.get('offset') || '0', 10),
  };

  const result = await auditLogger.query(options);

  return Response.json(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleAuditStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const auditLogger = createAuditLogger(env);

  const options = {
    tenantId: url.searchParams.get('tenantId') || undefined,
    startTime: url.searchParams.get('startTime') || undefined,
    endTime: url.searchParams.get('endTime') || undefined,
  };

  const stats = await auditLogger.getStats(options);

  return Response.json(stats, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetRateLimits(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT * FROM rate_limit_rules WHERE enabled = 1'
  ).all();

  return Response.json({
    rules: result.results,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCreateRateLimit(request: Request, env: Env): Promise<Response> {
  const body = await request.json();

  await env.DB.prepare(`
    INSERT INTO rate_limit_rules (
      id, name, key, limit, window, block_duration, scope, action_type, enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    body.name,
    body.key,
    body.limit,
    body.window,
    body.blockDuration || null,
    body.scope || 'global',
    JSON.stringify(body.actionType || []),
    body.enabled !== false ? 1 : 0
  ).run();

  return Response.json({
    success: true,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSecurityEvent(
  request: Request,
  env: Env,
  auditLogger: AuditLogger,
  ipAddress: string
): Promise<Response> {
  const body = await request.json();

  await auditLogger.logSecurityEvent({
    action: body.action,
    description: body.description,
    severity: body.severity || 'info',
    userId: body.userId,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    outcome: body.outcome || 'success',
    details: body.details,
    ipAddress,
    tenantId: body.tenantId,
    correlationId: body.correlationId,
  });

  return Response.json({
    success: true,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Exports
// ============================================================================

export { Validator, PromptInjectionDetector, PIIDetector, AuditLogger };
export { CommonSchemas };
export { defaultDetector as defaultInjectionDetector };
export { defaultPIIDetector, redactPII };
export { createAuditLogger };
export type {
  ValidationSchema,
  SecurityScanResult,
  PIIDetectionResult,
  AuditLogEntry,
  Env,
};
