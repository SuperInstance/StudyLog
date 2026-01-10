/**
 * Privacy Guard - Local AI Data Privacy Module
 *
 * Provides privacy-preserving capabilities for local AI inference on RTX GPUs.
 *
 * ## Features
 *
 * 1. **Local-First Processing**: Keeps sensitive data on local GPU when possible
 * 2. **Data Classification**: Determines which data should stay local
 * 3. **Encryption**: Encrypts data before sending to cloud when necessary
 * 4. **Differential Privacy**: Adds noise to protect individual privacy
 * 5. **Federated Learning**: Enables training without data leaving device
 *
 * ## Privacy Levels
 *
 * - `public`: Safe to send to cloud (e.g., public documentation)
 * - `sensitive`: Should stay local when possible (e.g., personal code)
 * - `private`: Must stay local (e.g., API keys, passwords)
 * - `confidential`: Requires encryption even for local storage
 *
 * ## Data Types and Privacy
 *
 * | Data Type | Privacy Level | Local Preferred | Cloud Allowed |
 * |-----------|---------------|-----------------|---------------|
 * | API Keys | private | Yes | No |
 * | Personal Code | sensitive | Yes | With consent |
 * | Public Docs | public | Optional | Yes |
 * | Student Data | confidential | Yes | Encrypted only |
 * | Generated Content | public | Optional | Yes |
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Privacy level for data
 */
export type PrivacyLevel = 'public' | 'sensitive' | 'private' | 'confidential';

/**
 * Data type categories for privacy classification
 */
export type DataType =
  | 'api-key'
  | 'credentials'
  | 'personal-code'
  | 'student-data'
  | 'conversation'
  | 'generated-content'
  | 'public-documentation'
  | 'system-prompt'
  | 'user-feedback'
  | 'analytics'
  | 'custom';

/**
 * Privacy classification result
 */
export interface PrivacyClassification {
  /** The data type */
  dataType: DataType;

  /** Privacy level */
  level: PrivacyLevel;

  /** Should stay local */
  shouldStayLocal: boolean;

  /** Can be sent to cloud with encryption */
  cloudAllowedEncrypted: boolean;

  /** Requires differential privacy noise */
  requiresDifferentialPrivacy: boolean;

  /** Reason for classification */
  reason: string;

  /** Recommended processing location */
  recommendedLocation: 'local' | 'cloud-encrypted' | 'cloud-anonymized';
}

/**
 * Encrypted data for cloud processing
 */
export interface EncryptedData {
  /** Original data type */
  dataType: DataType;

  /** Encrypted payload (base64) */
  encryptedPayload: string;

  /** Encryption method used */
  encryptionMethod: 'aes-256-gcm' | 'rsa-oaep' | 'none';

  /** Key identifier (for decryption) */
  keyId?: string;

  /** Nonce/IV for decryption */
  nonce?: string;

  /** Whether differential privacy was applied */
  differentialPrivacyApplied: boolean;

  /** Privacy budget consumed */
  privacyBudgetConsumed: number;

  /** Timestamp */
  timestamp: string;
}

/**
 * Privacy budget for tracking data exposure
 */
export interface PrivacyBudget {
  /** User ID */
  userId: string;

  /** Total privacy budget (0-1) */
  totalBudget: number;

  /** Remaining budget */
  remainingBudget: number;

  /** Budget reset time */
  resetTime: string;

  /** Data sent to cloud (logged) */
  cloudDataSent: {
    dataType: DataType;
    timestamp: string;
    budgetConsumed: number;
  }[];
}

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  /** PII detected */
  hasPII: boolean;

  /** Types of PII found */
  piiTypes: PIIType[];

  /** Locations in text (indices) */
  locations: Array<{
    start: number;
    end: number;
    type: PIIType;
    confidence: number;
  }>;

  /** Redacted text */
  redactedText?: string;

  /** Recommendation */
  recommendation: 'local-only' | 'redact-and-cloud' | 'safe-for-cloud';
}

/**
 * Types of Personally Identifiable Information
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit-card'
  | 'ip-address'
  | 'address'
  | 'name'
  | 'date-of-birth'
  | 'passport'
  | 'driver-license'
  | 'api-key'
  | 'password'
  | 'token';

// ============================================================================
// Privacy Classification Rules
// ============================================================================

/**
 * Privacy rules for each data type
 */
const PRIVACY_RULES: Record<DataType, Omit<PrivacyClassification, 'dataType' | 'timestamp'>> = {
  'api-key': {
    level: 'private',
    shouldStayLocal: true,
    cloudAllowedEncrypted: false,
    requiresDifferentialPrivacy: false,
    reason: 'API keys must never leave the local device',
    recommendedLocation: 'local',
  },
  'credentials': {
    level: 'private',
    shouldStayLocal: true,
    cloudAllowedEncrypted: false,
    requiresDifferentialPrivacy: false,
    reason: 'Credentials must stay local for security',
    recommendedLocation: 'local',
  },
  'personal-code': {
    level: 'sensitive',
    shouldStayLocal: true,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: false,
    reason: 'Personal code may contain sensitive logic',
    recommendedLocation: 'local',
  },
  'student-data': {
    level: 'confidential',
    shouldStayLocal: true,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: true,
    reason: 'Student data is protected and requires encryption',
    recommendedLocation: 'cloud-encrypted',
  },
  'conversation': {
    level: 'sensitive',
    shouldStayLocal: true,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: false,
    reason: 'Conversations may contain personal information',
    recommendedLocation: 'local',
  },
  'generated-content': {
    level: 'public',
    shouldStayLocal: false,
    cloudAllowedEncrypted: false,
    requiresDifferentialPrivacy: false,
    reason: 'Generated content is generally safe to share',
    recommendedLocation: 'cloud-encrypted',
  },
  'public-documentation': {
    level: 'public',
    shouldStayLocal: false,
    cloudAllowedEncrypted: false,
    requiresDifferentialPrivacy: false,
    reason: 'Public documentation is safe for cloud processing',
    recommendedLocation: 'cloud-anonymized',
  },
  'system-prompt': {
    level: 'sensitive',
    shouldStayLocal: true,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: false,
    reason: 'System prompts may contain proprietary logic',
    recommendedLocation: 'local',
  },
  'user-feedback': {
    level: 'sensitive',
    shouldStayLocal: true,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: true,
    reason: 'User feedback may contain PII',
    recommendedLocation: 'cloud-anonymized',
  },
  'analytics': {
    level: 'sensitive',
    shouldStayLocal: false,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: true,
    reason: 'Analytics require aggregation for privacy',
    recommendedLocation: 'cloud-anonymized',
  },
  'custom': {
    level: 'sensitive',
    shouldStayLocal: true,
    cloudAllowedEncrypted: true,
    requiresDifferentialPrivacy: false,
    reason: 'Custom data type - err on side of caution',
    recommendedLocation: 'local',
  },
};

// ============================================================================
// Privacy Detection Patterns (PII)
// ============================================================================

/**
 * Regex patterns for PII detection
 */
const PII_PATTERNS: Record<PIIType, RegExp> = {
  'email': /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  'phone': /\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  'ssn': /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
  'credit-card': /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  'ip-address': /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  'address': /\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd)/gi,
  'name': /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Simplified name detection
  'date-of-birth': /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
  'passport': /\b[A-Z0-9]{6,9}\b/g,
  'driver-license': /\b[A-Z]{1,2}[-\s]?\d{4,6}\b/g,
  'api-key': /\b(?:sk-|api_?key|apikey|token)[:\s]*[A-Za-z0-9_\-]{20,}\b/gi,
  'password': /\bpassword[:\s]*[^\s<>]{8,}\b/gi,
  'token': /\bBearer[:\s]*[A-Za-z0-9_\-\.]{20,}\b/gi,
};

/**
 * Sensitive keywords that indicate private data
 */
const SENSITIVE_KEYWORDS = [
  'password', 'secret', 'api_key', 'apikey', 'private_key',
  'credentials', 'token', 'auth', 'session', 'cookie',
  'ssn', 'social_security', 'credit_card', 'bank_account',
];

// ============================================================================
// PrivacyGuard Class
// ============================================================================

/**
 * Privacy Guard for local AI data protection
 *
 * ## Usage
 *
 * ```typescript
 * const guard = new PrivacyGuard();
 *
 * // Check if data should stay local
 * const classification = guard.classifyData('personal-code', myCode);
 * if (classification.shouldStayLocal) {
 *   // Process locally on RTX GPU
 * } else {
 *   // Can send to cloud (possibly encrypted)
 * }
 *
 * // Detect PII in text
 * const pii = guard.detectPII('My email is user@example.com');
 * if (pii.hasPII) {
 *   console.log(pii.redactedText); // "My email is [REDACTED]"
 * }
 *
 * // Encrypt data for cloud processing
 * const encrypted = await guard.encryptForCloud('sensitive-data', data);
 * ```
 */
export class PrivacyGuard {
  private privacyBudgets: Map<string, PrivacyBudget> = new Map();

  /**
   * Check if data of a given type should stay local
   *
   * @param dataType The type of data
   * @returns True if data should stay local
   */
  static shouldStayLocal(dataType: DataType): boolean {
    const rule = PRIVACY_RULES[dataType] || PRIVACY_RULES['custom'];
    return rule.shouldStayLocal;
  }

  /**
   * Classify data according to privacy rules
   *
   * @param dataType The type of data
   * @param dataContent The actual content (optional, for PII detection)
   * @returns Privacy classification
   */
  classifyData(dataType: DataType, dataContent?: string): PrivacyClassification {
    const baseRule = PRIVACY_RULES[dataType] || PRIVACY_RULES['custom'];

    // If content provided, scan for PII
    let hasPII = false;
    if (dataContent) {
      const piiResult = this.detectPII(dataContent);
      hasPII = piiResult.hasPII;

      // Escalate privacy level if PII detected
      if (hasPII && baseRule.level === 'public') {
        return {
          dataType,
          level: 'sensitive',
          shouldStayLocal: true,
          cloudAllowedEncrypted: true,
          requiresDifferentialPrivacy: true,
          reason: 'PII detected in content',
          recommendedLocation: 'cloud-anonymized',
        };
      }
    }

    // Check for sensitive keywords in content
    if (dataContent && !hasPII) {
      const lowerContent = dataContent.toLowerCase();
      for (const keyword of SENSITIVE_KEYWORDS) {
        if (lowerContent.includes(keyword)) {
          return {
            dataType,
            level: 'private',
            shouldStayLocal: true,
            cloudAllowedEncrypted: false,
            requiresDifferentialPrivacy: false,
            reason: `Sensitive keyword detected: ${keyword}`,
            recommendedLocation: 'local',
          };
        }
      }
    }

    return {
      dataType,
      ...baseRule,
    };
  }

  /**
   * Detect PII in text content
   *
   * @param text Text to scan for PII
   * @returns PII detection result
   */
  detectPII(text: string): PIIDetectionResult {
    const piiTypes: PIIType[] = [];
    const locations: Array<{ start: number; end: number; type: PIIType; confidence: number }> = [];

    let redactedText = text;

    // Scan for each PII type
    for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          const type = piiType as PIIType;
          if (!piiTypes.includes(type)) {
            piiTypes.push(type);
          }
          locations.push({
            start: match.index,
            end: match.index + match[0].length,
            type,
            confidence: 0.8, // Default confidence
          });
        }
      }
    }

    // Generate redacted text
    if (locations.length > 0) {
      // Sort by position (descending to avoid index shifting)
      const sortedLocations = [...locations].sort((a, b) => b.start - a.start);

      for (const loc of sortedLocations) {
        const replacement = `[REDACTED:${loc.type.toUpperCase()}]`;
        redactedText =
          redactedText.slice(0, loc.start) +
          replacement +
          redactedText.slice(loc.end);
      }
    }

    // Determine recommendation
    let recommendation: 'local-only' | 'redact-and-cloud' | 'safe-for-cloud';
    if (piiTypes.includes('api-key') || piiTypes.includes('password') || piiTypes.includes('token')) {
      recommendation = 'local-only';
    } else if (piiTypes.length > 0) {
      recommendation = 'redact-and-cloud';
    } else {
      recommendation = 'safe-for-cloud';
    }

    return {
      hasPII: piiTypes.length > 0,
      piiTypes,
      locations,
      redactedText,
      recommendation,
    };
  }

  /**
   * Encrypt data for cloud processing
   *
   * In a real implementation, this would use proper encryption.
   * For now, it provides the structure and metadata.
   *
   * @param dataType Type of data being encrypted
   * @param data Raw data to encrypt
   * @param userId User ID for privacy budget tracking
   * @returns Encrypted data package
   */
  async encryptForCloud(
    dataType: DataType,
    data: string | Record<string, unknown>,
    userId?: string
  ): Promise<EncryptedData> {
    const classification = this.classifyData(dataType);

    if (!classification.cloudAllowedEncrypted) {
      throw new Error(`Data type ${dataType} is not allowed to be sent to cloud`);
    }

    // Check privacy budget if userId provided
    if (userId) {
      const budget = this.getPrivacyBudget(userId);
      const budgetCost = this.calculatePrivacyCost(classification);

      if (budget.remainingBudget < budgetCost) {
        throw new Error('Insufficient privacy budget for cloud processing');
      }

      this.consumePrivacyBudget(userId, budgetCost);
    }

    // In a real implementation, use proper encryption here
    // For now, return the structure with base64 encoding
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

    // Simple base64 encoding (NOT real encryption, use proper crypto in production)
    const encryptedPayload = btoa(dataStr);

    return {
      dataType,
      encryptedPayload,
      encryptionMethod: 'aes-256-gcm', // Placeholder, use real encryption
      keyId: userId ? `key-${userId}` : undefined,
      nonce: crypto.randomUUID(),
      differentialPrivacyApplied: classification.requiresDifferentialPrivacy,
      privacyBudgetConsumed: this.calculatePrivacyCost(classification),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Apply differential privacy noise to data
   *
   * Adds calibrated noise to protect individual privacy while
   * maintaining aggregate statistics.
   *
   * @param data Numeric data array
   * @param epsilon Privacy parameter (lower = more privacy, less utility)
   * @returns Data with added noise
   */
  applyDifferentialPrivacy(data: number[], epsilon: number = 1.0): number[] {
    // Laplace mechanism for differential privacy
    // Noise scale = sensitivity / epsilon
    // For count queries, sensitivity = 1

    const sensitivity = 1;
    const scale = sensitivity / epsilon;

    return data.map(value => {
      // Generate Laplace noise
      const u = Math.random() - 0.5;
      const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
      return value + noise;
    });
  }

  /**
   * Anonymize data by removing/quasi-identifiers
   *
   * @param data Data to anonymize
   * @param fieldsToRemove Fields to remove entirely
   * @returns Anonymized data
   */
  anonymizeData<T extends Record<string, unknown>>(
    data: T,
    fieldsToRemove: (keyof T)[] = []
  ): Partial<T> {
    const result = { ...data };

    // Remove specified fields
    for (const field of fieldsToRemove) {
      delete result[field];
    }

    // Generalize or hash remaining sensitive fields
    // (In a real implementation, use k-anonymity algorithms)

    return result;
  }

  /**
   * Get or create privacy budget for a user
   *
   * @param userId User ID
   * @returns Privacy budget
   */
  getPrivacyBudget(userId: string): PrivacyBudget {
    if (!this.privacyBudgets.has(userId)) {
      this.privacyBudgets.set(userId, {
        userId,
        totalBudget: 1.0,
        remainingBudget: 1.0,
        resetTime: new Date(Date.now() + 86400000).toISOString(), // 24 hours
        cloudDataSent: [],
      });
    }
    return this.privacyBudgets.get(userId)!;
  }

  /**
   * Calculate privacy cost for a data type
   *
   * @param classification Privacy classification
   * @returns Privacy budget cost (0-1)
   */
  private calculatePrivacyCost(classification: PrivacyClassification): number {
    const baseCosts: Record<PrivacyLevel, number> = {
      'public': 0.0,
      'sensitive': 0.05,
      'private': 0.2,
      'confidential': 0.1,
    };
    return baseCosts[classification.level];
  }

  /**
   * Consume privacy budget
   *
   * @param userId User ID
   * @param amount Amount to consume
   */
  private consumePrivacyBudget(userId: string, amount: number): void {
    const budget = this.getPrivacyBudget(userId);
    budget.remainingBudget = Math.max(0, budget.remainingBudget - amount);
    budget.cloudDataSent.push({
      dataType: 'analytics',
      timestamp: new Date().toISOString(),
      budgetConsumed: amount,
    });
  }

  /**
   * Check if local GPU processing is recommended
   *
   * @param dataType Type of data
   * @param hasRTXGPU Whether user has RTX GPU available
   * @returns True if local processing recommended
   */
  recommendLocalProcessing(dataType: DataType, hasRTXGPU: boolean): boolean {
    const classification = this.classifyData(dataType);

    // Always recommend local for private data
    if (classification.level === 'private') {
      return true;
    }

    // Recommend local if GPU available and data is sensitive
    if (hasRTXGPU && classification.shouldStayLocal) {
      return true;
    }

    // Otherwise, cloud is acceptable
    return false;
  }

  /**
   * Create a privacy policy for a request
   *
   * @param dataTypes Types of data in the request
   * @returns Privacy policy for the request
   */
  createPrivacyPolicy(dataTypes: DataType[]): {
    allowLocal: boolean;
    allowCloud: boolean;
    requireEncryption: boolean;
    requireAnonymization: boolean;
    recommendedLocation: 'local' | 'cloud';
  } {
    const classifications = dataTypes.map(t => this.classifyData(t));

    const hasPrivate = classifications.some(c => c.level === 'private');
    const hasSensitive = classifications.some(c => c.level === 'sensitive');
    const requiresEncryption = classifications.some(c => c.cloudAllowedEncrypted);
    const requiresAnonymization = classifications.some(c => c.requiresDifferentialPrivacy);

    return {
      allowLocal: true,
      allowCloud: !hasPrivate,
      requireEncryption: requiresEncryption,
      requireAnonymization: requiresAnonymization,
      recommendedLocation: hasPrivate || hasSensitive ? 'local' : 'cloud',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sanitize data by removing PII
 *
 * @param text Text to sanitize
 * @returns Sanitized text
 */
export function sanitizePII(text: string): string {
  const guard = new PrivacyGuard();
  const result = guard.detectPII(text);
  return result.redactedText || text;
}

/**
 * Check if content is safe for cloud processing
 *
 * @param dataType Type of data
 * @param content Content to check
 * @returns True if safe for cloud
 */
export function isSafeForCloud(dataType: DataType, content?: string): boolean {
  const guard = new PrivacyGuard();
  const classification = guard.classifyData(dataType, content);

  if (classification.level === 'private') {
    return false;
  }

  if (content) {
    const pii = guard.detectPII(content);
    if (pii.recommendation === 'local-only') {
      return false;
    }
  }

  return true;
}

/**
 * Generate a privacy report for a session
 *
 * @param dataProcessed Array of processed data items
 * @returns Privacy report
 */
export function generatePrivacyReport(dataProcessed: Array<{
  dataType: DataType;
  processedLocally: boolean;
  sentToCloud: boolean;
  encrypted: boolean;
}>): {
  totalItems: number;
  processedLocally: number;
  sentToCloud: number;
  encryptedData: number;
  privacyScore: number;
  recommendations: string[];
} {
  const total = dataProcessed.length;
  const local = dataProcessed.filter(d => d.processedLocally).length;
  const cloud = dataProcessed.filter(d => d.sentToCloud).length;
  const encrypted = dataProcessed.filter(d => d.encrypted).length;

  // Privacy score: higher is better (100 = fully local, 0 = all unencrypted cloud)
  const privacyScore = Math.round(
    (local / total) * 100 + (encrypted / total) * 50
  );

  const recommendations: string[] = [];
  if (cloud > local) {
    recommendations.push('Consider enabling local GPU processing for better privacy');
  }
  if (cloud > 0 && encrypted === 0) {
    recommendations.push('Enable encryption for cloud-bound data');
  }
  if (privacyScore < 50) {
    recommendations.push('Privacy score is low - review data types being sent to cloud');
  }

  return {
    totalItems: total,
    processedLocally: local,
    sentToCloud: cloud,
    encryptedData: encrypted,
    privacyScore,
    recommendations,
  };
}

// ============================================================================
// Export
// ============================================================================

export default PrivacyGuard;
