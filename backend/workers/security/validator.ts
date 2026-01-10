/**
 * Input Validation Schema
 *
 * Comprehensive input validation with sanitization.
 * Supports nested objects, arrays, and custom validators.
 */

import type {
  ValidationSchema,
  ValidationResult,
  ValidationRuleType,
} from './types';

// ============================================================================
// Validator Class
// ============================================================================

export class Validator {
  /**
   * Validate value against schema.
   */
  validate(
    value: unknown,
    schema: ValidationSchema,
    path: string = ''
  ): ValidationResult {
    // Check required
    if (value === undefined || value === null) {
      if (schema.required) {
        return {
          valid: false,
          error: `Required field '${path}' is missing`,
        };
      }
      // Use default if available
      if (schema.default !== undefined) {
        return {
          valid: true,
          sanitized: schema.default,
        };
      }
      return { valid: true };
    }

    // Validate based on type
    let sanitized = value;
    const typeResult = this.validateType(value, schema, path);

    if (!typeResult.valid) {
      return typeResult;
    }

    if (typeResult.sanitized !== undefined) {
      sanitized = typeResult.sanitized;
    }

    // Validate min/max/range
    const rangeResult = this.validateRange(sanitized, schema, path);
    if (!rangeResult.valid) {
      return rangeResult;
    }

    // Validate length
    const lengthResult = this.validateLength(sanitized, schema, path);
    if (!lengthResult.valid) {
      return lengthResult;
    }

    // Validate pattern
    const patternResult = this.validatePattern(sanitized, schema, path);
    if (!patternResult.valid) {
      return patternResult;
    }

    // Validate enum
    const enumResult = this.validateEnum(sanitized, schema, path);
    if (!enumResult.valid) {
      return enumResult;
    }

    // Validate nested properties (for objects)
    if (schema.type === 'object' && schema.properties) {
      const objectResult = this.validateObject(
        sanitized as Record<string, unknown>,
        schema.properties,
        path
      );
      if (!objectResult.valid) {
        return objectResult;
      }
      sanitized = objectResult.sanitized;
    }

    // Validate array items
    if (schema.type === 'array' && schema.items) {
      const arrayResult = this.validateArray(
        sanitized as unknown[],
        schema.items,
        path
      );
      if (!arrayResult.valid) {
        return arrayResult;
      }
      sanitized = arrayResult.sanitized;
    }

    // Custom validator
    if (schema.validate) {
      const customResult = schema.validate(sanitized);
      if (customResult !== true) {
        return {
          valid: false,
          error: typeof customResult === 'string'
            ? customResult
            : `Validation failed for '${path}'`,
        };
      }
    }

    // Apply sanitizer
    if (schema.sanitize) {
      sanitized = schema.sanitize(sanitized);
    }

    return {
      valid: true,
      sanitized,
    };
  }

  /**
   * Validate object against properties schema.
   */
  validateObject(
    obj: Record<string, unknown>,
    properties: Record<string, ValidationSchema>,
    basePath: string = ''
  ): ValidationResult {
    const sanitized: Record<string, unknown> = {};

    for (const [key, schema] of Object.entries(properties)) {
      const path = basePath ? `${basePath}.${key}` : key;
      const result = this.validate(obj[key], schema, path);

      if (!result.valid) {
        return result;
      }

      if (result.sanitized !== undefined) {
        sanitized[key] = result.sanitized;
      }
    }

    return {
      valid: true,
      sanitized,
    };
  }

  /**
   * Validate array items.
   */
  validateArray(
    arr: unknown[],
    itemSchema: ValidationSchema,
    basePath: string = ''
  ): ValidationResult {
    const sanitized: unknown[] = [];

    for (let i = 0; i < arr.length; i++) {
      const path = `${basePath}[${i}]`;
      const result = this.validate(arr[i], itemSchema, path);

      if (!result.valid) {
        return result;
      }

      sanitized.push(result.sanitized !== undefined ? result.sanitized : arr[i]);
    }

    return {
      valid: true,
      sanitized,
    };
  }

  // ========================================================================
  // Type Validation
  // ========================================================================

  private validateType(
    value: unknown,
    schema: ValidationSchema,
    path: string
  ): ValidationResult {
    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return {
            valid: false,
            error: `Field '${path}' must be a string`,
          };
        }
        return { valid: true };

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return {
            valid: false,
            error: `Field '${path}' must be a number`,
          };
        }
        return { valid: true };

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            valid: false,
            error: `Field '${path}' must be a boolean`,
          };
        }
        return { valid: true };

      case 'email':
        return this.validateEmail(value, path);

      case 'url':
        return this.validateURL(value, path);

      case 'uuid':
        return this.validateUUID(value, path);

      case 'array':
        if (!Array.isArray(value)) {
          return {
            valid: false,
            error: `Field '${path}' must be an array`,
          };
        }
        return { valid: true };

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return {
            valid: false,
            error: `Field '${path}' must be an object`,
          };
        }
        return { valid: true };

      case 'date':
        return this.validateDate(value, path);

      default:
        return { valid: true };
    }
  }

  private validateEmail(value: unknown, path: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Field '${path}' must be a string`,
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return {
        valid: false,
        error: `Field '${path}' must be a valid email address`,
      };
    }

    // Sanitize by trimming and lowercasing
    return {
      valid: true,
      sanitized: value.trim().toLowerCase(),
    };
  }

  private validateURL(value: unknown, path: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Field '${path}' must be a string`,
      };
    }

    try {
      const url = new URL(value);

      // Only allow http/https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          valid: false,
          error: `Field '${path}' must be an HTTP/HTTPS URL`,
        };
      }

      return {
        valid: true,
        sanitized: url.toString(),
      };
    } catch {
      return {
        valid: false,
        error: `Field '${path}' must be a valid URL`,
      };
    }
  }

  private validateUUID(value: unknown, path: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Field '${path}' must be a string`,
      };
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      return {
        valid: false,
        error: `Field '${path}' must be a valid UUID`,
      };
    }

    return { valid: true };
  }

  private validateDate(value: unknown, path: string): ValidationResult {
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return {
          valid: false,
          error: `Field '${path}' must be a valid date`,
        };
      }
      return {
        valid: true,
        sanitized: date.toISOString(),
      };
    }

    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return {
          valid: false,
          error: `Field '${path}' must be a valid date`,
        };
      }
      return {
        valid: true,
        sanitized: value.toISOString(),
      };
    }

    return {
      valid: false,
      error: `Field '${path}' must be a date string or Date object`,
    };
  }

  // ========================================================================
  // Range Validation
  // ========================================================================

  private validateRange(
    value: unknown,
    schema: ValidationSchema,
    path: string
  ): ValidationResult {
    if (typeof value !== 'number') {
      return { valid: true };
    }

    if (schema.min !== undefined && value < schema.min) {
      return {
        valid: false,
        error: `Field '${path}' must be at least ${schema.min}`,
      };
    }

    if (schema.max !== undefined && value > schema.max) {
      return {
        valid: false,
        error: `Field '${path}' must be at most ${schema.max}`,
      };
    }

    return { valid: true };
  }

  // ========================================================================
  // Length Validation
  // ========================================================================

  private validateLength(
    value: unknown,
    schema: ValidationSchema,
    path: string
  ): ValidationResult {
    const length = typeof value === 'string' ? value.length :
                   Array.isArray(value) ? value.length :
                   value instanceof Date ? value.toISOString().length :
                   0;

    if (schema.minLength !== undefined && length < schema.minLength) {
      return {
        valid: false,
        error: `Field '${path}' must be at least ${schema.minLength} characters`,
      };
    }

    if (schema.maxLength !== undefined && length > schema.maxLength) {
      return {
        valid: false,
        error: `Field '${path}' must be at most ${schema.maxLength} characters`,
      };
    }

    return { valid: true };
  }

  // ========================================================================
  // Pattern Validation
  // ========================================================================

  private validatePattern(
    value: unknown,
    schema: ValidationSchema,
    path: string
  ): ValidationResult {
    if (schema.pattern && typeof value === 'string') {
      if (!schema.pattern.test(value)) {
        return {
          valid: false,
          error: `Field '${path}' does not match required pattern`,
        };
      }
    }
    return { valid: true };
  }

  // ========================================================================
  // Enum Validation
  // ========================================================================

  private validateEnum(
    value: unknown,
    schema: ValidationSchema,
    path: string
  ): ValidationResult {
    if (schema.enum && !schema.enum.includes(value)) {
      return {
        valid: false,
        error: `Field '${path}' must be one of: ${schema.enum.join(', ')}`,
      };
    }
    return { valid: true };
  }
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

export const CommonSchemas = {
  /**
   * User ID (UUID)
   */
  userId: {
    type: 'uuid' as ValidationRuleType,
    required: true,
  },

  /**
   * Email address
   */
  email: {
    type: 'email' as ValidationRuleType,
    required: true,
  },

  /**
   * Display name
   */
  displayName: {
    type: 'string' as ValidationRuleType,
    required: false,
    minLength: 1,
    maxLength: 100,
    sanitize: (val: unknown) =>
      typeof val === 'string' ? val.trim().substring(0, 100) : val,
  },

  /**
   * Pagination limit
   */
  limit: {
    type: 'number' as ValidationRuleType,
    required: false,
    default: 50,
    min: 1,
    max: 100,
  },

  /**
   * Pagination offset
   */
  offset: {
    type: 'number' as ValidationRuleType,
    required: false,
    default: 0,
    min: 0,
  },

  /**
   * Search query
   */
  searchQuery: {
    type: 'string' as ValidationRuleType,
    required: false,
    maxLength: 500,
    minLength: 1,
    sanitize: (val: unknown) =>
      typeof val === 'string' ? val.trim().substring(0, 500) : val,
  },

  /**
   * Sort direction
   */
  sortDirection: {
    type: 'enum' as ValidationRuleType,
    required: false,
    default: 'desc',
    enum: ['asc', 'desc', 'ASC', 'DESC'],
  },

  /**
   * AI prompt input
   */
  aiPrompt: {
    type: 'string' as ValidationRuleType,
    required: true,
    minLength: 1,
    maxLength: 10000,
  },

  /**
   * Code input
   */
  codeInput: {
    type: 'string' as ValidationRuleType,
    required: true,
    maxLength: 50000,
  },

  /**
   * File name
   */
  fileName: {
    type: 'string' as ValidationRuleType,
    required: true,
    pattern: /^[a-zA-Z0-9._-]+$/,
    maxLength: 255,
    sanitize: (val: unknown) =>
      typeof val === 'string'
        ? val.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255)
        : val,
  },
};

// ============================================================================
// Default Validator Instance
// ============================================================================

export const defaultValidator = new Validator();
