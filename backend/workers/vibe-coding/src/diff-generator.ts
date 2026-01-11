/**
 * Diff Generator
 *
 * Generates apply-able diffs for code changes. Produces unified diffs
 * with proper line numbers and conflict detection.
 */

import type {
  DiffResult,
  DiffChange,
  FileEdit,
} from './types.js';
import { generateUnifiedDiff, parseDiffChanges } from './utils.js';

// ============================================================================
// Diff Generator
// ============================================================================

/**
 * Diff generation options
 */
export interface DiffOptions {
  /** Number of context lines */
  contextLines?: number;
  /** Whether to detect and mark conflicts */
  detectConflicts?: boolean;
  /** Whether to format the diff */
  format?: boolean;
  /** Custom header */
  header?: string;
}

const DEFAULT_OPTIONS: DiffOptions = {
  contextLines: 3,
  detectConflicts: true,
  format: true,
};

/**
 * Generate a diff result from file edits
 */
export function generateDiff(
  originalContent: string,
  edits: FileEdit[],
  filePath: string,
  options: DiffOptions = DEFAULT_OPTIONS
): DiffResult {
  let modified = originalContent;
  const allChanges: DiffChange[] = [];

  // Sort edits by line number (descending) to apply without offset issues
  const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

  for (const edit of sortedEdits) {
    const result = applyEdit(modified, edit);
    modified = result.content;

    // Map changes to original line numbers
    const offset = originalContent.split('\n').length - modified.split('\n').length;
    const adjustedChanges = result.changes.map(c => ({
      ...c,
      line: c.line + offset,
    }));

    allChanges.unshift(...adjustedChanges);
  }

  const unified = generateUnifiedDiff(originalContent, modified, filePath);

  return {
    path: filePath,
    original: originalContent,
    modified,
    unified,
    changes: parseDiffChanges(unified),
    isNew: originalContent === '',
    isDeleted: modified === '',
  };
}

/**
 * Generate a diff from complete file replacement
 */
export function generateReplacementDiff(
  original: string,
  modified: string,
  filePath: string,
  options: DiffOptions = DEFAULT_OPTIONS
): DiffResult {
  const unified = generateUnifiedDiff(original, modified, filePath);

  return {
    path: filePath,
    original,
    modified,
    unified,
    changes: parseDiffChanges(unified),
    isNew: original === '',
    isDeleted: modified === '',
  };
}

/**
 * Generate multi-file diff
 */
export function generateMultiFileDiff(
  files: Array<{ path: string; original: string; modified: string }>,
  options: DiffOptions = DEFAULT_OPTIONS
): DiffResult[] {
  return files.map(file =>
    generateReplacementDiff(file.original, file.modified, file.path, options)
  );
}

/**
 * Apply a single edit to content
 */
function applyEdit(
  content: string,
  edit: FileEdit
): { content: string; changes: DiffChange[] } {
  const lines = content.split('\n');
  const changes: DiffChange[] = [];

  const startIdx = Math.max(0, edit.startLine - 1);
  const endIdx = Math.min(lines.length, edit.endLine);

  switch (edit.operation) {
    case 'insert':
      // Insert new lines at position
      const newLines = edit.content.split('\n');
      lines.splice(startIdx, 0, ...newLines);

      for (let i = 0; i < newLines.length; i++) {
        changes.push({
          line: startIdx + i + 1,
          type: 'add',
          modified: newLines[i],
        });
      }
      break;

    case 'replace':
      // Replace lines in range
      const replacementLines = edit.content.split('\n');
      const removedLines = lines.slice(startIdx, endIdx);

      for (let i = 0; i < removedLines.length; i++) {
        changes.push({
          line: startIdx + i + 1,
          type: i < replacementLines.length ? 'modify' : 'remove',
          original: removedLines[i],
          modified: replacementLines[i],
        });
      }

      for (let i = removedLines.length; i < replacementLines.length; i++) {
        changes.push({
          line: startIdx + i + 1,
          type: 'add',
          modified: replacementLines[i],
        });
      }

      lines.splice(startIdx, endIdx - startIdx, ...replacementLines);
      break;

    case 'delete':
      // Remove lines in range
      for (let i = startIdx; i < endIdx; i++) {
        changes.push({
          line: i + 1,
          type: 'remove',
          original: lines[i],
        });
      }

      lines.splice(startIdx, endIdx - startIdx);
      break;
  }

  return {
    content: lines.join('\n'),
    changes,
  };
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detect potential merge conflicts in diff
 */
export function detectConflicts(diff: DiffResult): Array<{
  line: number;
  type: 'overlap' | 'inconsistent' | 'orphan';
  message: string;
}> {
  const conflicts: Array<{
    line: number;
    type: 'overlap' | 'inconsistent' | 'orphan';
    message: string;
  }> = [];

  // Look for conflict markers
  const lines = diff.modified.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('<<<<<<<') || line.startsWith('=======')) {
      conflicts.push({
        line: i + 1,
        type: 'overlap',
        message: 'Merge conflict marker detected',
      });
    }
  }

  // Check for inconsistent indentation
  const indentationChanges = diff.changes.filter(c =>
    c.modified !== undefined && c.original !== undefined
  );

  for (const change of indentationChanges) {
    const originalIndent = (change.original?.match(/^\s*/)?.[0] || '').length;
    const modifiedIndent = (change.modified?.match(/^\s*/)?.[0] || '').length;

    if (Math.abs(originalIndent - modifiedIndent) > 4) {
      conflicts.push({
        line: change.line,
        type: 'inconsistent',
        message: 'Significant indentation change detected',
      });
    }
  }

  return conflicts;
}

// ============================================================================
// Diff Parsing
// ============================================================================

/**
 * Parse a unified diff string into structured changes
 */
export function parseUnifiedDiff(
  diffText: string
): Array<{ filePath: string; changes: DiffChange[] }> {
  const results: Array<{ filePath: string; changes: DiffChange[] }> = [];
  const lines = diffText.split('\n');

  let currentFile: string | null = null;
  let currentChanges: DiffChange[] = [];
  let currentLine = 0;

  for (const line of lines) {
    // File header
    const fileMatch = line.match(/^\+\+\+ b\/(.+)/);
    if (fileMatch) {
      if (currentFile) {
        results.push({ filePath: currentFile, changes: currentChanges });
      }
      currentFile = fileMatch[1];
      currentChanges = [];
      continue;
    }

    // Hunk header
    const hunkMatch = line.match(/^@@\s+-(\d+),?\d*\s+\+(\d+),?\d*\s+@@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[2], 10);
      continue;
    }

    // Diff content
    if (currentFile) {
      if (line.startsWith('+')) {
        currentChanges.push({
          line: currentLine,
          type: 'add',
          modified: line.slice(1),
        });
        currentLine++;
      } else if (line.startsWith('-')) {
        currentChanges.push({
          line: currentLine,
          type: 'remove',
          original: line.slice(1),
        });
      } else if (line.startsWith(' ')) {
        currentChanges.push({
          line: currentLine,
          type: 'context',
          original: line.slice(1),
          modified: line.slice(1),
        });
        currentLine++;
      }
    }
  }

  if (currentFile) {
    results.push({ filePath: currentFile, changes: currentChanges });
  }

  return results;
}

/**
 * Apply a unified diff to original content
 */
export function applyUnifiedDiff(
  original: string,
  unifiedDiff: string
): { success: boolean; result?: string; error?: string } {
  try {
    const parsed = parseUnifiedDiff(unifiedDiff);

    if (parsed.length === 0) {
      return { success: false, error: 'No changes found in diff' };
    }

    if (parsed.length > 1) {
      return { success: false, error: 'Multi-file diffs not supported' };
    }

    const { changes } = parsed[0];
    const lines = original.split('\n');
    const resultLines: string[] = [];

    let changeIdx = 0;
    let lineIdx = 0;

    while (lineIdx < lines.length && changeIdx < changes.length) {
      const change = changes[changeIdx];

      if (change.line === lineIdx + 1) {
        switch (change.type) {
          case 'context':
            resultLines.push(change.modified || change.original || '');
            lineIdx++;
            break;
          case 'remove':
            lineIdx++; // Skip original line
            break;
          case 'add':
            resultLines.push(change.modified || '');
            // Don't increment lineIdx for additions
            break;
        }
        changeIdx++;
      } else {
        // No change for this line
        resultLines.push(lines[lineIdx]);
        lineIdx++;
      }
    }

    // Add remaining lines
    while (lineIdx < lines.length) {
      resultLines.push(lines[lineIdx]);
      lineIdx++;
    }

    return { success: true, result: resultLines.join('\n') };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a diff for display
 */
export function formatDiffForDisplay(diff: DiffResult): string {
  let output = '';

  output += `Path: ${diff.path}\n`;
  output += `Lines: +${countAddedLines(diff)}/-${countRemovedLines(diff)}\n`;
  output += '\n';

  if (diff.isNew) {
    output += '[NEW FILE]\n\n';
  } else if (diff.isDeleted) {
    output += '[DELETED]\n\n';
  }

  output += diff.unified;

  return output;
}

/**
 * Count added lines in diff
 */
function countAddedLines(diff: DiffResult): number {
  return diff.changes.filter(c => c.type === 'add').length;
}

/**
 * Count removed lines in diff
 */
function countRemovedLines(diff: DiffResult): number {
  return diff.changes.filter(c => c.type === 'remove').length;
}

/**
 * Create a summary of the diff
 */
export function createDiffSummary(diff: DiffResult): {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
} {
  return {
    filesChanged: 1,
    linesAdded: diff.changes.filter(c => c.type === 'add').length,
    linesRemoved: diff.changes.filter(c => c.type === 'remove').length,
    linesModified: diff.changes.filter(c => c.type === 'modify').length,
  };
}

/**
 * Create summary for multiple diffs
 */
export function createMultiDiffSummary(diffs: DiffResult[]): {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  byFile: Record<string, ReturnType<typeof createDiffSummary>>;
} {
  const byFile: Record<string, ReturnType<typeof createDiffSummary>> = {};

  for (const diff of diffs) {
    byFile[diff.path] = createDiffSummary(diff);
  }

  return {
    filesChanged: diffs.length,
    linesAdded: Object.values(byFile).reduce((sum, s) => sum + s.linesAdded, 0),
    linesRemoved: Object.values(byFile).reduce((sum, s) => sum + s.linesRemoved, 0),
    linesModified: Object.values(byFile).reduce((sum, s) => sum + s.linesModified, 0),
    byFile,
  };
}
