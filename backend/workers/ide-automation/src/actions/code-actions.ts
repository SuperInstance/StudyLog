/**
 * Code Actions Service
 *
 * Handles file editing, multi-file operations, symbol search,
 * refactoring, and code explanation.
 */

import type {
  FileEdit,
  FileDiff,
  CodeSymbol,
  SymbolKind,
  ReferenceLocation,
  CodeExplanation,
  MultiFileOperation,
  Position,
  Range,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';
import { generateDiff, applyEdit, applyEdits, positionToOffset, offsetToPosition } from './diff-generator.js';

// ============================================================================
// Symbol Extraction
// ============================================================================

interface SymbolPattern {
  kind: SymbolKind;
  pattern: RegExp;
  captureGroups: {
    name: number;
    container?: number;
  };
}

const LANGUAGE_PATTERNS: Record<string, SymbolPattern[]> = {
  typescript: [
    {
      kind: 'class',
      pattern: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'interface',
      pattern: /(?:export\s+)?interface\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'function',
      pattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'method',
      pattern: /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'variable',
      pattern: /(?:const|let|var)\s+(\w+)\s*=/g,
      captureGroups: { name: 1 },
    },
  ],
  python: [
    {
      kind: 'class',
      pattern: /class\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'function',
      pattern: /def\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'variable',
      pattern: /(\w+)\s*=/g,
      captureGroups: { name: 1 },
    },
  ],
  rust: [
    {
      kind: 'struct',
      pattern: /struct\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'function',
      pattern: /fn\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'enum',
      pattern: /enum\s+(\w+)/g,
      captureGroups: { name: 1 },
    },
  ],
  go: [
    {
      kind: 'struct',
      pattern: /type\s+(\w+)\s+struct/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'interface',
      pattern: /type\s+(\w+)\s+interface/g,
      captureGroups: { name: 1 },
    },
    {
      kind: 'function',
      pattern: /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g,
      captureGroups: { name: 1 },
    },
  ],
};

// ============================================================================
// Code Actions Service
// ============================================================================

export class CodeActionsService {
  constructor(
    private readonly env: IDEAutomationEnv,
    private readonly routerUrl = 'https://multi-model-router.studylog.ai'
  ) {}

  /**
   * Edit a file with diff
   */
  async editFile(
    workspaceId: string,
    filePath: string,
    edit: FileEdit
  ): Promise<FileDiff> {
    // Get current content from R2
    const key = `${workspaceId}/${filePath}`;
    const object = await this.env.WORKSPACE_STORAGE.get(key);

    let original = '';
    if (object) {
      original = await object.text();
    }

    const modified = applyEdit(original, edit);
    const diff = generateDiff(original, modified, filePath);

    // Store modified content
    await this.env.WORKSPACE_STORAGE.put(key, modified);

    return diff;
  }

  /**
   * Apply multiple file edits (batch operation)
   */
  async batchEdit(
    workspaceId: string,
    edits: FileEdit[]
  ): Promise<FileDiff[]> {
    const diffs: FileDiff[] = [];

    // Group by file
    const byFile = new Map<string, FileEdit[]>();
    for (const edit of edits) {
      const existing = byFile.get(edit.path) || [];
      existing.push(edit);
      byFile.set(edit.path, existing);
    }

    // Apply each file's edits
    for (const [filePath, fileEdits] of byFile.entries()) {
      const key = `${workspaceId}/${filePath}`;
      const object = await this.env.WORKSPACE_STORAGE.get(key);

      let original = '';
      if (object) {
        original = await object.text();
      }

      const modified = applyEdits(original, fileEdits);
      const diff = generateDiff(original, modified, filePath);
      diffs.push(diff);

      await this.env.WORKSPACE_STORAGE.put(key, modified);
    }

    return diffs;
  }

  /**
   * Create a new file
   */
  async createFile(
    workspaceId: string,
    filePath: string,
    content: string
  ): Promise<FileDiff> {
    const key = `${workspaceId}/${filePath}`;

    // Check if file exists
    const existing = await this.env.WORKSPACE_STORAGE.get(key);
    const original = existing ? await existing.text() : '';

    const diff = generateDiff(original, content, filePath);

    await this.env.WORKSPACE_STORAGE.put(key, content);

    return diff;
  }

  /**
   * Delete a file
   */
  async deleteFile(
    workspaceId: string,
    filePath: string
  ): Promise<void> {
    const key = `${workspaceId}/${filePath}`;
    await this.env.WORKSPACE_STORAGE.delete(key);
  }

  /**
   * Rename/move a file
   */
  async renameFile(
    workspaceId: string,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    const oldKey = `${workspaceId}/${oldPath}`;
    const object = await this.env.WORKSPACE_STORAGE.get(oldKey);

    if (!object) {
      throw new Error(`File not found: ${oldPath}`);
    }

    const content = await object.text();
    const newKey = `${workspaceId}/${newPath}`;

    await this.env.WORKSPACE_STORAGE.put(newKey, content);
    await this.env.WORKSPACE_STORAGE.delete(oldKey);
  }

  /**
   * Extract symbols from file content
   */
  extractSymbols(filePath: string, content: string): CodeSymbol[] {
    const ext = filePath.split('.').pop() || '';
    const language = this.detectLanguage(filePath);

    const patterns = LANGUAGE_PATTERNS[language] || [];
    const symbols: CodeSymbol[] = [];

    const lines = content.split('\n');

    for (const patternDef of patterns) {
      const pattern = patternDef.pattern;
      let match: RegExpExecArray | null;

      // Reset regex state
      pattern.lastIndex = 0;

      while ((match = pattern.exec(content)) !== null) {
        const name = match[patternDef.captureGroups.name];
        const offset = match.index;

        const position = offsetToPosition(content, offset);

        // Find end position (approximate)
        const endOffset = offset + match[0].length;
        const endPosition = offsetToPosition(content, endOffset);

        symbols.push({
          name,
          kind: patternDef.kind,
          path: filePath,
          start: position,
          end: endPosition,
        });
      }
    }

    return symbols;
  }

  /**
   * Find symbol references across workspace
   */
  async findReferences(
    workspaceId: string,
    symbolName: string,
    symbolKind?: SymbolKind
  ): Promise<ReferenceLocation[]> {
    // List all files in workspace
    const listed = await this.env.WORKSPACE_STORAGE.list({
      prefix: workspaceId + '/',
    });

    const references: ReferenceLocation[] = [];

    for (const object of listed.objects) {
      if (!object.key) continue;

      const content = await this.getWorkspaceFile(workspaceId, object.key);
      if (!content) continue;

      // Find all references to the symbol
      const filePath = object.key.slice(workspaceId.length + 1);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(`\\b${symbolName}\\b`, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
          references.push({
            path: filePath,
            range: {
              start: { line: i, character: match.index },
              end: { line: i, character: match.index + symbolName.length },
            },
            context: this.extractContext(lines, i, 2),
          });
        }
      }
    }

    return references;
  }

  /**
   * Find definition of symbol
   */
  async findDefinition(
    workspaceId: string,
    symbolName: string,
    filePath?: string
  ): Promise<CodeSymbol | null> {
    // Search in specific file or all files
    if (filePath) {
      const content = await this.getWorkspaceFile(workspaceId, filePath);
      if (content) {
        const symbols = this.extractSymbols(filePath, content);
        return symbols.find(s => s.name === symbolName) || null;
      }
    }

    // Search all files
    const listed = await this.env.WORKSPACE_STORAGE.list({
      prefix: workspaceId + '/',
    });

    for (const object of listed.objects) {
      if (!object.key) continue;

      const content = await this.getWorkspaceFile(workspaceId, object.key);
      if (!content) continue;

      const path = object.key.slice(workspaceId.length + 1);
      const symbols = this.extractSymbols(path, content);
      const found = symbols.find(s => s.name === symbolName);

      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * Explain code snippet
   */
  async explainCode(
    code: string,
    language: string,
    detailLevel: 'brief' | 'detailed' = 'brief'
  ): Promise<CodeExplanation> {
    const prompt = this.buildExplanationPrompt(code, language, detailLevel);

    const response = await this.callAI(prompt);

    // Parse the response
    const explanation = this.parseExplanation(code, language, response);

    return explanation;
  }

  /**
   * Refactor code
   */
  async refactorCode(
    code: string,
    language: string,
    refactoringType: 'optimize' | 'simplify' | 'modernize' | 'type-annotate'
  ): Promise<{ original: string; refactored: string; explanation: string }> {
    const prompt = this.buildRefactorPrompt(code, language, refactoringType);

    const response = await this.callAI(prompt);

    // Extract refactored code from response
    const refactored = this.extractCodeFromResponse(response, language);

    return {
      original: code,
      refactored,
      explanation: response,
    };
  }

  /**
   * Fix errors in code
   */
  async fixErrors(
    code: string,
    language: string,
    errors: Array<{ message: string; line?: number }>
  ): Promise<{ fixed: string; fixes: Array<{ description: string }> }> {
    const prompt = this.buildErrorFixPrompt(code, language, errors);

    const response = await this.callAI(prompt);
    const fixed = this.extractCodeFromResponse(response, language);

    return {
      fixed,
      fixes: [{ description: response }],
    };
  }

  /**
   * Optimize imports
   */
  async optimizeImports(
    code: string,
    language: string
  ): Promise<{ optimized: string; removed: string[]; added: string[] }> {
    // For now, simple implementation
    // Full implementation would parse and resolve imports

    const lines = code.split('\n');
    const imports: string[] = [];
    const otherLines: string[] = [];
    const seenImports = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
        if (!seenImports.has(trimmed)) {
          imports.push(line);
          seenImports.add(trimmed);
        }
      } else {
        otherLines.push(line);
      }
    }

    const optimized = [...imports.sort(), '', ...otherLines].join('\n');

    return {
      optimized,
      removed: [],
      added: [],
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Get file content from workspace storage
   */
  private async getWorkspaceFile(
    workspaceId: string,
    key: string
  ): Promise<string | null> {
    const object = await this.env.WORKSPACE_STORAGE.get(key);
    if (!object) return null;
    return await object.text();
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const extMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'typescript',
      jsx: 'typescript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    };

    return extMap[ext || ''] || 'typescript';
  }

  /**
   * Extract context around a line
   */
  private extractContext(
    lines: string[],
    lineIndex: number,
    contextLines: number
  ): string[] {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end);
  }

  /**
   * Build explanation prompt
   */
  private buildExplanationPrompt(
    code: string,
    language: string,
    detailLevel: string
  ): string {
    return `Explain this ${language} code${detailLevel === 'detailed' ? ' in detail' : ''}:

\`\`\`${language}
${code}
\`\`\`

${detailLevel === 'detailed' ? 'Include: what it does, how it works, key patterns used, and potential edge cases.' : 'Keep it concise - what it does and key patterns.'}`;
  }

  /**
   * Build refactoring prompt
   */
  private buildRefactorPrompt(
    code: string,
    language: string,
    refactoringType: string
  ): string {
    const instructions: Record<typeof refactoringType, string> = {
      optimize: 'Optimize for performance and memory usage',
      simplify: 'Simplify the logic and improve readability',
      modernize: 'Use modern ${language} patterns and features',
      'type-annotate': 'Add comprehensive type annotations',
    };

    return `Refactor this ${language} code to ${instructions[refactoringType]}:

\`\`\`${language}
${code}
\`\`\`

Return only the refactored code wrapped in \`\`\`${language} code blocks, followed by a brief explanation.`;
  }

  /**
   * Build error fix prompt
   */
  private buildErrorFixPrompt(
    code: string,
    language: string,
    errors: Array<{ message: string; line?: number }>
  ): string {
    const errorList = errors.map((e, i) =>
      `${i + 1}. ${e.line ? `Line ${e.line}: ` : ''}${e.message}`
    ).join('\n');

    return `Fix these errors in the following ${language} code:

Errors:
${errorList}

Code:
\`\`\`${language}
${code}
\`\`\`

Return the fixed code wrapped in \`\`\`${language} code blocks, followed by a brief explanation of each fix.`;
  }

  /**
   * Call AI for code-related tasks
   */
  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.routerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-coder',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json() as { content: string };
    return data.content;
  }

  /**
   * Extract code from AI response
   */
  private extractCodeFromResponse(response: string, language: string): string {
    // Try to find code block
    const codeBlockRegex = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'i');
    const match = response.match(codeBlockRegex);

    if (match && match[1]) {
      return match[1].trim();
    }

    // Try generic code block
    const genericRegex = /```(?:\w+)?\n([\s\S]*?)\n```/;
    const genericMatch = response.match(genericRegex);

    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].trim();
    }

    // Return response as-is
    return response.trim();
  }

  /**
   * Parse explanation from AI response
   */
  private parseExplanation(
    code: string,
    language: string,
    response: string
  ): CodeExplanation {
    // Extract explanation text
    const explanation = response
      .replace(/```[\s\S]*?```/g, '')
      .trim();

    // Estimate reading time
    const wordCount = explanation.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / 200); // 200 words per minute

    // Determine difficulty level
    let level: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
    if (code.includes('async') || code.includes('Promise') || code.includes('class')) {
      level = 'advanced';
    } else if (code.length < 200) {
      level = 'beginner';
    }

    return {
      code,
      language,
      explanation,
      concepts: this.extractConcepts(explanation),
      patterns: this.extractPatterns(explanation),
      level,
      readTime,
    };
  }

  /**
   * Extract concepts from explanation
   */
  private extractConcepts(text: string): string[] {
    // Simple extraction - look for capitalized terms, technical terms
    const concepts: string[] = [];
    const words = text.split(/\s+/);

    for (const word of words) {
      if (word.length > 5 && /^[A-Z]/.test(word) && !/[.,!?]$/.test(word)) {
        concepts.push(word);
      }
    }

    return [...new Set(concepts)].slice(0, 5);
  }

  /**
   * Extract patterns from explanation
   */
  private extractPatterns(text: string): string[] {
    const patterns: string[] = [];

    const patternKeywords = [
      'pattern', 'design', 'approach', 'method',
      'strategy', 'technique', 'algorithm',
    ];

    const sentences = text.split(/[.!?]/);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (patternKeywords.some(k => lower.includes(k))) {
        patterns.push(sentence.trim());
      }
    }

    return patterns.slice(0, 3);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create code actions service from environment
 */
export function createCodeActionsService(env: IDEAutomationEnv): CodeActionsService {
  return new CodeActionsService(env);
}
