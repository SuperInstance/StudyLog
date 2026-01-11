/**
 * Diff Generator
 *
 * Generates unified diffs and applies file edits with diff visualization.
 */

import type {
  FileEdit,
  FileDiff,
  DiffChange,
  Range,
  Position,
} from '../types/index.js';

// ============================================================================
// Diff Generation
// ============================================================================

/**
 * Generate a unified diff between two strings
 */
export function generateDiff(
  original: string,
  modified: string,
  filePath: string,
  originalLabel = 'original',
  modifiedLabel = 'modified'
): FileDiff {
  const changes = computeLineChanges(original, modified);
  const diff = formatUnifiedDiff(original, modified, filePath, originalLabel, modifiedLabel);

  return {
    path: filePath,
    original,
    modified,
    diff,
    changes,
    isNew: original.length === 0,
    isDeleted: modified.length === 0,
  };
}

/**
 * Compute line-by-line changes between two texts
 */
export function computeLineChanges(
  original: string,
  modified: string
): DiffChange[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Use simple diff algorithm (Myers diff would be better)
  const changes: DiffChange[] = [];
  const lcs = longestCommonSubsequence(originalLines, modifiedLines);

  let i = 0; // Original line index
  let j = 0; // Modified line index

  for (const [origIdx, modIdx] of lcs) {
    // Add removals for lines in original that aren't in LCS
    while (i < origIdx) {
      changes.push({
        line: i + 1,
        type: 'remove',
        original: originalLines[i],
      });
      i++;
    }

    // Add additions for lines in modified that aren't in LCS
    while (j < modIdx) {
      changes.push({
        line: j + 1,
        type: 'add',
        modified: modifiedLines[j],
      });
      j++;
    }

    // Matching lines - add as context
    changes.push({
      line: i + 1,
      type: 'context',
      original: originalLines[i],
      modified: modifiedLines[j],
    });

    i++;
    j++;
  }

  // Handle remaining lines
  while (i < originalLines.length) {
    changes.push({
      line: i + 1,
      type: 'remove',
      original: originalLines[i],
    });
    i++;
  }

  while (j < modifiedLines.length) {
    changes.push({
      line: j + 1,
      type: 'add',
      modified: modifiedLines[j],
    });
    j++;
  }

  return changes;
}

/**
 * Format as unified diff
 */
function formatUnifiedDiff(
  original: string,
  modified: string,
  filePath: string,
  originalLabel: string,
  modifiedLabel: string
): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  let output = '';
  output += `--- a/${filePath}\t${originalLabel}\n`;
  output += `+++ b/${filePath}\t${modifiedLabel}\n`;

  const hunks = generateHunks(originalLines, modifiedLines);

  for (const hunk of hunks) {
    output += `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.modifiedStart},${hunk.modifiedCount} @@\n`;

    for (const line of hunk.lines) {
      output += `${line.prefix} ${line.content}\n`;
    }
  }

  return output;
}

interface Hunk {
  originalStart: number;
  originalCount: number;
  modifiedStart: number;
  modifiedCount: number;
  lines: Array<{ prefix: string; content: string }>;
}

/**
 * Generate diff hunks
 */
function generateHunks(
  originalLines: string[],
  modifiedLines: string[]
): Hunk[] {
  const hunks: Hunk[] = [];
  const changes = computeLineChanges(originalLines.join('\n'), modifiedLines.join('\n'));

  let currentHunk: Hunk | null = null;
  let contextLineCount = 0;
  const CONTEXT_LINES = 3;

  for (const change of changes) {
    if (change.type === 'context') {
      if (currentHunk) {
        currentHunk.lines.push({ prefix: ' ', content: change.original || '' });
        contextLineCount++;

        // Close hunk if we have enough context
        if (contextLineCount >= CONTEXT_LINES * 2) {
          hunks.push(currentHunk);
          currentHunk = null;
          contextLineCount = 0;
        }
      }
    } else {
      // Start new hunk if needed
      if (!currentHunk) {
        const contextStart = Math.max(0, change.line - CONTEXT_LINES - 1);
        currentHunk = {
          originalStart: contextStart + 1,
          originalCount: 0,
          modifiedStart: contextStart + 1,
          modifiedCount: 0,
          lines: [],
        };

        // Add leading context
        for (let i = contextStart; i < change.line - 1; i++) {
          if (originalLines[i] !== undefined) {
            currentHunk.lines.push({ prefix: ' ', content: originalLines[i] });
            currentHunk.originalCount++;
            currentHunk.modifiedCount++;
          }
        }
      }

      if (change.type === 'remove') {
        currentHunk.lines.push({ prefix: '-', content: change.original || '' });
        currentHunk.originalCount++;
      } else if (change.type === 'add') {
        currentHunk.lines.push({ prefix: '+', content: change.modified || '' });
        currentHunk.modifiedCount++;
      }

      contextLineCount = 0;
    }
  }

  // Close any open hunk
  if (currentHunk) {
    // Add trailing context
    const lastChange = changes[changes.length - 1];
    if (lastChange) {
      const contextEnd = Math.min(
        originalLines.length,
        lastChange.line + CONTEXT_LINES
      );

      for (let i = lastChange.line; i < contextEnd; i++) {
        if (originalLines[i] !== undefined) {
          currentHunk.lines.push({ prefix: ' ', content: originalLines[i] });
          currentHunk.originalCount++;
          currentHunk.modifiedCount++;
        }
      }
    }

    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Compute longest common subsequence (for diff)
 */
function longestCommonSubsequence(
  a: string[],
  b: string[]
): Array<[number, number]> {
  const m = a.length;
  const n = b.length;

  // Dynamic programming table
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const result: Array<[number, number]> = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

// ============================================================================
// Diff Application
// ============================================================================

/**
 * Apply a file edit to content
 */
export function applyEdit(content: string, edit: FileEdit): string {
  const lines = content.split('\n');

  if (edit.startLine !== undefined && edit.endLine !== undefined) {
    // Line-based edit
    const startIdx = Math.max(0, edit.startLine - 1);
    const endIdx = Math.min(lines.length, edit.endLine);

    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);

    const newLines = edit.newContent.split('\n');
    return [...before, ...newLines, ...after].join('\n');
  }

  // String replacement
  if (edit.oldContent) {
    return content.replace(edit.oldContent, edit.newContent);
  }

  // Append if no specific location
  return content + (content.endsWith('\n') ? '' : '\n') + edit.newContent;
}

/**
 * Apply multiple file edits
 */
export function applyEdits(content: string, edits: FileEdit[]): string {
  let result = content;

  // Sort edits by position (last first to avoid offset issues)
  const sortedEdits = [...edits].sort((a, b) => {
    const aLine = a.endLine ?? a.startLine ?? 0;
    const bLine = b.endLine ?? b.startLine ?? 0;
    return bLine - aLine;
  });

  for (const edit of sortedEdits) {
    result = applyEdit(result, edit);
  }

  return result;
}

// ============================================================================
// Inline Diff Rendering
// ============================================================================

/**
 * Render inline diff for web display
 */
export function renderInlineDiff(
  changes: DiffChange[],
  options: {
    showLineNumbers?: boolean;
    wordDiff?: boolean;
  } = {}
): Array<{
  type: string;
  line: number;
  content: string;
  lineNumber?: number;
  wordChanges?: Array<{ type: 'add' | 'remove'; content: string }>;
}> {
  const result: Array<{
    type: string;
    line: number;
    content: string;
    lineNumber?: number;
    wordChanges?: Array<{ type: 'add' | 'remove'; content: string }>;
  }> = [];

  for (const change of changes) {
    const item: typeof result[0] = {
      type: change.type,
      line: change.line,
      content: change.original || change.modified || '',
    };

    if (options.showLineNumbers) {
      item.lineNumber = change.line;
    }

    if (options.wordDiff && change.type === 'modify') {
      item.wordChanges = computeWordDiff(
        change.original || '',
        change.modified || ''
      );
    }

    result.push(item);
  }

  return result;
}

/**
 * Compute word-level diff
 */
function computeWordDiff(
  original: string,
  modified: string
): Array<{ type: 'add' | 'remove'; content: string }> {
  const originalWords = original.split(/(\s+)/);
  const modifiedWords = modified.split(/(\s+)/);

  const changes: Array<{ type: 'add' | 'remove'; content: string }> = [];

  const lcs = longestCommonSubsequence(originalWords, modifiedWords);

  let i = 0;
  let j = 0;

  for (const [origIdx, modIdx] of lcs) {
    while (i < origIdx) {
      changes.push({ type: 'remove', content: originalWords[i] });
      i++;
    }

    while (j < modIdx) {
      changes.push({ type: 'add', content: modifiedWords[j] });
      j++;
    }

    // Same word - no change marker
    i++;
    j++;
  }

  while (i < originalWords.length) {
    changes.push({ type: 'remove', content: originalWords[i] });
    i++;
  }

  while (j < modifiedWords.length) {
    changes.push({ type: 'add', content: modifiedWords[j] });
    j++;
  }

  return changes;
}

// ============================================================================
// Range and Position Utilities
// ============================================================================

/**
 * Create a position
 */
export function pos(line: number, character: number): Position {
  return { line, character };
}

/**
 * Create a range
 */
export function range(start: Position, end: Position): Range {
  return { start, end };
}

/**
 * Check if a position is within a range
 */
export function positionInRange(position: Position, range: Range): boolean {
  if (position.line < range.start.line) return false;
  if (position.line > range.end.line) return false;

  if (position.line === range.start.line) {
    if (position.character < range.start.character) return false;
  }

  if (position.line === range.end.line) {
    if (position.character > range.end.character) return false;
  }

  return true;
}

/**
 * Get line and character from offset
 */
export function offsetToPosition(
  content: string,
  offset: number
): Position {
  let line = 0;
  let character = 0;

  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
  }

  return { line, character };
}

/**
 * Get offset from line and character
 */
export function positionToOffset(
  content: string,
  position: Position
): number {
  let offset = 0;
  let currentLine = 0;

  for (let i = 0; i < content.length; i++) {
    if (currentLine === position.line) {
      return offset + Math.min(position.character, content.length - i);
    }

    if (content[i] === '\n') {
      currentLine++;
    }

    offset++;
  }

  return offset;
}
