/**
 * PII Detection and Redaction
 *
 * Detect and redact Personally Identifiable Information (PII)
 * including emails, phone numbers, SSNs, credit cards, etc.
 */

import type {
  PIIDetectionResult,
  PIIInstance,
  PIIType,
  PIIRedactionOptions,
} from './types';

// ============================================================================
// PII Patterns
// ============================================================================

interface PIIPattern {
  type: PIIType;
  name: string;
  patterns: RegExp[];
  redactionChar: string;
  keepFirst?: number;
  keepLast?: number;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    type: 'email',
    name: 'Email Address',
    patterns: [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    ],
    redactionChar: '*',
  },
  {
    type: 'phone',
    name: 'Phone Number',
    patterns: [
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // 123-456-7890
      /\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, // International
    ],
    redactionChar: '*',
    keepFirst: 3,
    keepLast: 4,
  },
  {
    type: 'ssn',
    name: 'Social Security Number',
    patterns: [
      /\b\d{3}[-]\d{2}[-]\d{4}\b/g, // 123-45-6789
      /\b\d{3}\s\d{2}\s\d{4}\b/g, // 123 45 6789
      /\b\d{9}\b/g, // 123456789 (context-dependent)
    ],
    redactionChar: '*',
  },
  {
    type: 'credit_card',
    name: 'Credit Card Number',
    patterns: [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 1234 5678 9012 3456
      /\b\d{13,19}\b/g, // Raw 13-19 digit numbers
    ],
    redactionChar: '*',
    keepLast: 4,
  },
  {
    type: 'ip_address',
    name: 'IP Address',
    patterns: [
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IPv4
      /\b[0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}\b/gi, // IPv6
    ],
    redactionChar: 'x',
  },
  {
    type: 'api_key',
    name: 'API Key',
    patterns: [
      /(?:api[_-]?key|apikey|auth[_-]?token|secret)[:=]\s*[a-zA-Z0-9._-]{20,}/gi,
      /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
      /sk-[a-zA-Z0-9]{32,}/g, // OpenAI-style
      /ghp_[a-zA-Z0-9]{36,}/g, // GitHub-style
      /AKIA[0-9A-Z]{16}/g, // AWS access key
    ],
    redactionChar: '*',
    keepFirst: 7,
  },
  {
    type: 'password',
    name: 'Password',
    patterns: [
      /(?:password|passwd|pwd)[:=]\s*\S+/gi,
    ],
    redactionChar: '*',
    keepFirst: 0,
  },
  {
    type: 'token',
    name: 'Token',
    patterns: [
      /(?:token|jwt)[:=]\s*[a-zA-Z0-9._-]{20,}/gi,
      /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT
    ],
    redactionChar: '*',
    keepFirst: 10,
  },
  {
    type: 'date_of_birth',
    name: 'Date of Birth',
    patterns: [
      /\b(?:dob|date\s+of\s+birth|birth\s+date)[:=]\s*\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/gi,
      /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s*(?:\(?\s*(?:dob|birth|born)\s*\)?)/gi,
    ],
    redactionChar: '*',
  },
  {
    type: 'passport',
    name: 'Passport Number',
    patterns: [
      /\b[A-Za-z]{1,2}\d{6,9}\b/g, // US-style: A1234567
    ],
    redactionChar: '*',
  },
  {
    type: 'license_plate',
    name: 'License Plate',
    patterns: [
      /\b[A-Z]{1,4}[-\s]?\d{1,4}[-\s]?[A-Z]{0,3}\b/g,
    ],
    redactionChar: '*',
  },
];

// ============================================================================
// Name Detection (Simple heuristic)
// ============================================================================

const NAME_PATTERNS = [
  /(?:name|called|known as)[:=]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s+[A-Z][a-z]+/g,
];

// ============================================================================
// PII Detector Class
// ============================================================================

export class PIIDetector {
  private patterns: PIIPattern[];

  constructor(customPatterns?: PIIPattern[]) {
    this.patterns = customPatterns || PII_PATTERNS;
  }

  /**
   * Detect PII in text.
   */
  detect(text: string, options?: PIIRedactionOptions): PIIDetectionResult {
    const startTime = Date.now();
    const instances: PIIInstance[] = [];

    const typesToDetect = options?.types || this.patterns.map(p => p.type);

    for (const pattern of this.patterns) {
      if (!typesToDetect.includes(pattern.type)) continue;

      for (const regex of pattern.patterns) {
        regex.lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
          const value = match[0];
          const existing = instances.find(i => i.location.start === match.index);

          if (!existing) {
            instances.push({
              type: pattern.type,
              value,
              redacted: this.redactValue(value, pattern, options),
              location: { start: match.index, end: match.index + value.length },
              confidence: this.calculateConfidence(value, pattern.type),
            });
          }
        }
      }
    }

    // Sort by location
    instances.sort((a, b) => a.location.start - b.location.start);

    // Generate redacted text
    const redacted = this.applyRedaction(text, instances);

    return {
      instances,
      redacted,
      scanTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Redact PII from text (convenience method).
   */
  redact(text: string, options?: PIIRedactionOptions): string {
    const result = this.detect(text, options);
    return result.redacted;
  }

  /**
   * Redact a single value.
   */
  private redactValue(
    value: string,
    pattern: PIIPattern,
    options?: PIIRedactionOptions
  ): string {
    const redactionChar = options?.redactionChar || pattern.redactionChar;
    const keepFirst = options?.keepFirst ?? pattern.keepFirst ?? 0;
    const keepLast = options?.keepLast ?? pattern.keepLast ?? 0;

    const len = value.length;
    const totalToKeep = keepFirst + keepLast;

    if (totalToKeep >= len) {
      return value;
    }

    const first = value.substring(0, keepFirst);
    const last = value.substring(len - keepLast);
    const middleLen = len - totalToKeep;

    return first + redactionChar.repeat(middleLen) + last;
  }

  /**
   * Apply redaction to text based on detected instances.
   */
  private applyRedaction(text: string, instances: PIIInstance[]): string {
    if (instances.length === 0) return text;

    let result = text;
    let offset = 0;

    for (const instance of instances) {
      const { start, end } = instance.location;
      const before = result.substring(0, start + offset);
      const after = result.substring(end + offset);

      result = before + instance.redacted + after;
      offset += instance.redacted.length - (end - start);
    }

    return result;
  }

  /**
   * Calculate confidence score for detection.
   */
  private calculateConfidence(value: string, type: PIIType): number {
    // Higher confidence for structured formats
    switch (type) {
      case 'email':
        return value.includes('@') ? 0.95 : 0.7;
      case 'ssn':
        return value.includes('-') ? 0.9 : 0.6;
      case 'credit_card':
        return /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/.test(value) ? 0.9 : 0.7;
      case 'api_key':
        return value.startsWith('sk-') || value.startsWith('ghp_') ? 0.95 : 0.6;
      case 'token':
        return value.includes('.') && value.split('.').length === 3 ? 0.95 : 0.6;
      default:
        return 0.7;
    }
  }

  /**
   * Add custom PII pattern.
   */
  addPattern(pattern: PIIPattern): void {
    this.patterns.push(pattern);
  }
}

// ============================================================================
// Default Detector Instance
// ============================================================================

export const defaultPIIDetector = new PIIDetector();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick PII redaction.
 */
export function redactPII(
  text: string,
  options?: PIIRedactionOptions
): string {
  return defaultPIIDetector.redact(text, options);
}

/**
 * Check if text contains PII.
 */
export function containsPII(text: string, types?: PIIType[]): boolean {
  const result = defaultPIIDetector.detect(text, { types });
  return result.instances.length > 0;
}
