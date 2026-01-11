/**
 * Utility Functions
 *
 * Shared utilities for ID generation, token estimation, and text processing.
 */

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique nanoid-style ID
 */
export function generateId(prefix = ''): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = prefix;
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return generateId('sess_');
}

/**
 * Generate a message ID
 */
export function generateMessageId(): string {
  return generateId('msg_');
}

/**
 * Generate a branch ID
 */
export function generateBranchId(): string {
  return generateId('branch_');
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 * Different languages have different token-to-character ratios
 */
export function estimateTokens(text: string, language = 'text'): number {
  const ratios: Record<string, number> = {
    typescript: 3.5,
    javascript: 3.5,
    python: 4,
    rust: 3.5,
    go: 3.5,
    java: 3.5,
    c: 3.5,
    cpp: 3.5,
    csharp: 3.5,
    json: 4,
    yaml: 4,
    markdown: 4.5,
    html: 4,
    css: 4,
    text: 4,
  };

  const ratio = ratios[language] || 4;
  return Math.ceil(text.length / ratio);
}

/**
 * Calculate token usage for file context
 */
export function estimateFileTokens(content: string, language: string): number {
  return estimateTokens(content, language);
}

// ============================================================================
// Text Processing
// ============================================================================

/**
 * Split text into chunks at word boundaries
 */
export function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > chunkSize) {
    // Find word boundary near chunk size
    let splitAt = chunkSize;
    const lastSpace = remaining.lastIndexOf(' ', chunkSize);
    const lastNewline = remaining.lastIndexOf('\n', chunkSize);

    if (lastNewline > chunkSize * 0.5) {
      splitAt = lastNewline + 1;
    } else if (lastSpace > chunkSize * 0.5) {
      splitAt = lastSpace + 1;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Generate a title from a message
 */
export function generateTitle(message: string, maxLength = 50): string {
  // Remove markdown code blocks
  let cleaned = message.replace(/```[\s\S]*?```/g, '[code]').trim();

  // Remove common prefixes
  cleaned = cleaned
    .replace(/^(please|can you|could you|i need|i want|help me|create|write|generate|make)\s+/i, '')
    .trim();

  // Truncate at word boundary
  if (cleaned.length > maxLength) {
    const lastSpace = cleaned.lastIndexOf(' ', maxLength);
    cleaned = cleaned.slice(0, lastSpace > 0 ? lastSpace : maxLength);
  }

  return cleaned + (cleaned.length < message.length ? '...' : '');
}

/**
 * Detect language from file path
 */
export function detectLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    sql: 'sql',
    dockerfile: 'dockerfile',
    docker: 'dockerfile',
  };

  return languageMap[ext || ''] || 'text';
}

// ============================================================================
// Diff Generation
// ============================================================================

/**
 * Generate a unified diff between two strings
 */
export function generateUnifiedDiff(
  original: string,
  modified: string,
  filePath: string
): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const chunks = computeDiffChunks(originalLines, modifiedLines);

  let diff = `--- a/${filePath}\n`;
  diff += `+++ b/${filePath}\n`;

  for (const chunk of chunks) {
    diff += `@@ -${chunk.originalStart},${chunk.originalLength} +${chunk.modifiedStart},${chunk.modifiedLength} @@\n`;

    for (const line of chunk.contextBefore) {
      diff += ` ${line}\n`;
    }
    for (const line of chunk.removed) {
      diff += `-${line}\n`;
    }
    for (const line of chunk.added) {
      diff += `+${line}\n`;
    }
    for (const line of chunk.contextAfter) {
      diff += ` ${line}\n`;
    }
  }

  return diff;
}

/**
 * Compute diff chunks using simple line-by-line comparison
 */
interface DiffChunk {
  originalStart: number;
  originalLength: number;
  modifiedStart: number;
  modifiedLength: number;
  contextBefore: string[];
  removed: string[];
  added: string[];
  contextAfter: string[];
}

function computeDiffChunks(
  original: string[],
  modified: string[],
  contextSize = 3
): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let i = 0;
  let j = 0;

  while (i < original.length || j < modified.length) {
    // Find next difference
    while (i < original.length && j < modified.length && original[i] === modified[j]) {
      i++;
      j++;
    }

    if (i >= original.length && j >= modified.length) break;

    const chunk: DiffChunk = {
      originalStart: i + 1,
      originalLength: 0,
      modifiedStart: j + 1,
      modifiedLength: 0,
      contextBefore: [],
      removed: [],
      added: [],
      contextAfter: [],
    };

    // Add context before
    const contextStart = Math.max(0, i - contextSize);
    chunk.contextBefore = original.slice(contextStart, i);
    chunk.originalStart = contextStart + 1;

    // Collect removed lines
    while (i < original.length && (j >= modified.length || original[i] !== modified[j])) {
      chunk.removed.push(original[i]);
      chunk.originalLength++;
      i++;
    }

    // Collect added lines
    while (j < modified.length && (i >= original.length || original[i] !== modified[j])) {
      chunk.added.push(modified[j]);
      chunk.modifiedLength++;
      j++;
    }

    // Add context after
    const contextEnd = Math.min(modified.length, j + contextSize);
    chunk.contextAfter = modified.slice(j, contextEnd);

    // Skip over matching lines we already included in context
    i += Math.max(0, Math.min(contextSize, original.length - i));
    j += Math.max(0, Math.min(contextSize, modified.length - j));

    if (chunk.removed.length > 0 || chunk.added.length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Parse diff changes from unified diff
 */
export function parseDiffChanges(unified: string): Array<{
  line: number;
  type: 'add' | 'remove' | 'modify' | 'context';
  original?: string;
  modified?: string;
}> {
  const changes: Array<{
    line: number;
    type: 'add' | 'remove' | 'modify' | 'context';
    original?: string;
    modified?: string;
  }> = [];

  const lines = unified.split('\n');
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/-(\d+)/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      continue;
    }

    if (line.startsWith('+')) {
      changes.push({
        line: currentLine,
        type: 'add',
        modified: line.slice(1),
      });
      currentLine++;
    } else if (line.startsWith('-')) {
      changes.push({
        line: currentLine,
        type: 'remove',
        original: line.slice(1),
      });
    } else if (line.startsWith(' ')) {
      changes.push({
        line: currentLine,
        type: 'context',
        original: line.slice(1),
        modified: line.slice(1),
      });
      currentLine++;
    }
  }

  return changes;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format cost as USD
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) {
    return `${(cost * 1000000).toFixed(2)}μ`;
  } else if (cost < 0.01) {
    return `${(cost * 1000).toFixed(2)}m`;
  } else if (cost < 1) {
    return `¢${(cost * 100).toFixed(2)}`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

/**
 * Format token count
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
