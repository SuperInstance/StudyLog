/**
 * Context Builder
 *
 * Gathers relevant code context for AI requests. Handles file reading,
 * symbol extraction, dependency analysis, and semantic search.
 */

import type {
  ContextFile,
  ContextBuildResult,
  CodeSymbol,
  ReadStrategy,
} from './types.js';
import type { VibeCodingEnv } from './types.js';
import { estimateTokens, detectLanguageFromPath } from './utils.js';

// ============================================================================
// Context Builder Configuration
// ============================================================================

interface ContextBuilderConfig {
  /** Maximum context tokens */
  maxTokens: number;
  /** Maximum tokens per file */
  maxFileTokens: number;
  /** Maximum files to include */
  maxFiles: number;
  /** Read strategy */
  readStrategy: ReadStrategy;
  /** Include dependencies */
  includeDependencies: boolean;
  /** Include related symbols */
  includeRelatedSymbols: boolean;
}

const DEFAULT_CONFIG: ContextBuilderConfig = {
  maxTokens: 100000,
  maxFileTokens: 10000,
  maxFiles: 20,
  readStrategy: 'semantic',
  includeDependencies: true,
  includeRelatedSymbols: true,
};

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Context builder for gathering relevant code context
 */
export class ContextBuilder {
  constructor(
    private readonly env: VibeCodingEnv,
    private readonly config: ContextBuilderConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Build context from workspace files
   */
  async buildContext(request: {
    /** User query/message */
    query: string;
    /** Workspace files to consider */
    files: string[];
    /** Current file (for context) */
    currentFile?: string;
    /** Current selection */
    selection?: { startLine: number; endLine: number };
    /** Explicitly included context files */
    includeFiles?: ContextFile[];
  }): Promise<ContextBuildResult> {
    const contextFiles: ContextFile[] = [];
    let totalTokens = 0;

    // Add explicitly included files first
    if (request.includeFiles) {
      for (const file of request.includeFiles) {
        const tokens = estimateTokens(file.content, file.language);
        if (totalTokens + tokens > this.config.maxTokens) {
          break;
        }
        contextFiles.push(file);
        totalTokens += tokens;
      }
    }

    // Analyze query to find relevant files
    const relevantPaths = await this.findRelevantFiles(
      request.query,
      request.files.filter(f =>
        !contextFiles.some(cf => cf.path === f)
      )
    );

    // Read and include relevant files
    for (const path of relevantPaths) {
      if (contextFiles.length >= this.config.maxFiles) {
        break;
      }

      if (totalTokens >= this.config.maxTokens) {
        break;
      }

      const content = await this.readFile(path);
      if (!content) continue;

      const language = detectLanguageFromPath(path);
      const tokens = estimateTokens(content, language);

      // Apply read strategy to potentially reduce content
      const processedContent = this.applyReadStrategy(
        content,
        path,
        request.query,
        tokens
      );

      const file: ContextFile = {
        path,
        content: processedContent,
        language,
        relevance: this.calculateRelevance(request.query, path, content),
        writable: true,
      };

      contextFiles.push(file);
      totalTokens += estimateTokens(processedContent, language);
    }

    // Build context string
    const context = this.buildContextString(contextFiles);

    return {
      context,
      files: contextFiles,
      tokens: totalTokens,
      compressed: totalTokens > this.config.maxTokens * 0.8,
    };
  }

  /**
   * Extract symbols from a file
   */
  async extractSymbols(filePath: string): Promise<CodeSymbol[]> {
    const content = await this.readFile(filePath);
    if (!content) {
      return [];
    }

    return this.parseSymbols(content, filePath);
  }

  /**
   * Get file with line range
   */
  async getFileRange(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<ContextFile | null> {
    const content = await this.readFile(filePath);
    if (!content) {
      return null;
    }

    const lines = content.split('\n');
    const rangeContent = lines
      .slice(Math.max(0, startLine - 1), endLine)
      .join('\n');

    return {
      path: filePath,
      content: rangeContent,
      language: detectLanguageFromPath(filePath),
      startLine,
      endLine,
      writable: true,
    };
  }

  /**
   * Find symbol definition in file
   */
  async findSymbol(
    filePath: string,
    symbolName: string
  ): Promise<CodeSymbol | null> {
    const symbols = await this.extractSymbols(filePath);

    for (const symbol of symbols) {
      if (symbol.name === symbolName) {
        return symbol;
      }
      // Check children
      if (symbol.children) {
        const child = this.findSymbolInChildren(symbol.children, symbolName);
        if (child) {
          return child;
        }
      }
    }

    return null;
  }

  /**
   * Get related files (imports/exports)
   */
  async getRelatedFiles(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath);
    if (!content) {
      return [];
    }

    const imports = this.parseImports(content, filePath);
    return imports.filter(i => i.startsWith('./') || i.startsWith('../'));
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Find files relevant to the query
   */
  private async findRelevantFiles(
    query: string,
    availableFiles: string[]
  ): Promise<string[]> {
    // Extract potential file references from query
    const fileMatches = query.match(/[\w-]+\.[a-z]+/gi) || [];

    // Score files based on relevance
    const scored = availableFiles.map(file => {
      let score = 0;

      // Exact match in query
      if (query.includes(file)) {
        score += 10;
      }

      // File name match
      const fileName = file.split('/').pop() || file;
      if (query.toLowerCase().includes(fileName.toLowerCase())) {
        score += 5;
      }

      // Extension match for language keywords
      const ext = file.split('.').pop();
      const langKeywords: Record<string, string[]> = {
        ts: ['typescript', 'types', 'interface', 'type'],
        js: ['javascript', 'script', 'function'],
        py: ['python', 'class', 'def'],
        rs: ['rust', 'struct', 'impl'],
        go: ['go', 'func', 'package'],
      };

      const keywords = langKeywords[ext || ''] || [];
      for (const keyword of keywords) {
        if (query.toLowerCase().includes(keyword)) {
          score += 2;
        }
      }

      return { file, score };
    });

    // Sort by score and return top results
    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > 0).map(s => s.file);
  }

  /**
   * Read file from workspace storage
   */
  private async readFile(filePath: string): Promise<string | null> {
    try {
      // Try R2 storage first
      if (this.env.WORKSPACE_STORAGE) {
        const object = await this.env.WORKSPACE_STORAGE.get(
          `workspace/${filePath}`
        );
        if (object) {
          return await object.text();
        }
      }

      // Try KV cache
      const cached = await this.env.CONTEXT_CACHE.get(`file:${filePath}`);
      if (cached) {
        return cached;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Apply read strategy to content
   */
  private applyReadStrategy(
    content: string,
    filePath: string,
    query: string,
    estimatedTokens: number
  ): string {
    if (estimatedTokens <= this.config.maxFileTokens) {
      return content;
    }

    switch (this.config.readStrategy) {
      case 'partial':
        return this.extractRelevantSections(content, query);

      case 'semantic':
        // For now, use partial extraction
        // In production, would use embeddings/RAG
        return this.extractRelevantSections(content, query);

      case 'symbol':
        return this.extractSymbolsOnly(content, filePath);

      case 'full':
      default:
        // Truncate if needed
        const lines = content.split('\n');
        const targetLines = Math.floor(
          (this.config.maxFileTokens / estimatedTokens) * lines.length
        );
        return lines.slice(0, targetLines).join('\n') + '\n... (truncated)';
    }
  }

  /**
   * Extract relevant sections based on query
   */
  private extractRelevantSections(content: string, query: string): string {
    const lines = content.split('\n');
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    const relevantLines: { line: string; score: number }[] = lines.map(
      (line, i) => {
        let score = 0;
        const lowerLine = line.toLowerCase();

        for (const keyword of keywords) {
          if (lowerLine.includes(keyword)) {
            score += keyword.length;
          }
        }

        return { line, score };
      }
    );

    // Filter and include context around high-scoring lines
    const result: string[] = [];
    const contextSize = 3;

    for (let i = 0; i < relevantLines.length; i++) {
      if (relevantLines[i].score > 0) {
        const start = Math.max(0, i - contextSize);
        const end = Math.min(lines.length, i + contextSize + 1);

        for (let j = start; j < end; j++) {
          if (result.length === 0 || result[result.length - 1] !== lines[j]) {
            result.push(lines[j]);
          }
        }
      }
    }

    return result.join('\n') || content.slice(0, 1000);
  }

  /**
   * Extract only symbols/definitions
   */
  private extractSymbolsOnly(content: string, filePath: string): string {
    const symbols = this.parseSymbols(content, filePath);

    return symbols
      .map(s => {
        let result = `// ${s.kind}: ${s.name}\n`;
        if (s.documentation) {
          result += `// ${s.documentation}\n`;
        }
        // Get first few lines of symbol
        const lines = content.split('\n');
        const startLine = s.start.line;
        const endLine = Math.min(startLine + 5, s.end.line);
        result += lines.slice(startLine, endLine).join('\n');
        return result;
      })
      .join('\n\n');
  }

  /**
   * Parse symbols from content (simplified)
   */
  private parseSymbols(content: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');
    const language = detectLanguageFromPath(filePath);

    // Simple regex-based parsing (would use proper parser in production)
    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /^(export\s+)?(async\s+)?function\s+(\w+)/,
        /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/,
        /^(export\s+)?class\s+(\w+)/,
        /^(export\s+)?interface\s+(\w+)/,
        /^(export\s+)?type\s+(\w+)\s*=/,
      ],
      javascript: [
        /^(export\s+)?(async\s+)?function\s+(\w+)/,
        /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/,
        /^(export\s+)?class\s+(\w+)/,
      ],
      python: [
        /^def\s+(\w+)\s*\(/,
        /^class\s+(\w+)/,
      ],
      rust: [
        /^pub\s+fn\s+(\w+)/,
        /^fn\s+(\w+)/,
        /^pub\s+struct\s+(\w+)/,
        /^struct\s+(\w+)/,
        /^impl\s+(\w+)/,
      ],
      go: [
        /^func\s+(?:\(\w*\s+\*?\w+\)\s+)?(\w+)/,
        /^type\s+(\w+)\s+struct/,
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of langPatterns) {
        const match = line.match(pattern);
        if (match) {
          const name = match[match.length - 1];
          const kind = this.inferKind(line, language);

          symbols.push({
            name,
            kind,
            path: filePath,
            start: { line: i, character: 0 },
            end: { line: i + 1, character: 0 },
          });
          break;
        }
      }
    }

    return symbols;
  }

  /**
   * Infer symbol kind from line content
   */
  private inferKind(line: string, language: string): CodeSymbol['kind'] {
    const lower = line.toLowerCase();

    if (lower.includes('function') || lower.includes('def ') || lower.includes('fn ')) {
      return 'function';
    }
    if (lower.includes('class') || lower.includes('struct')) {
      return 'class';
    }
    if (lower.includes('interface')) {
      return 'interface';
    }
    if (lower.includes('type ') && lower.includes('=')) {
      return 'typeAlias';
    }
    if (lower.includes('const') || lower.includes('let') || lower.includes('var')) {
      return 'variable';
    }

    return 'function';
  }

  /**
   * Calculate relevance score for a file
   */
  private calculateRelevance(query: string, filePath: string, content: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    // File name match
    const fileName = filePath.split('/').pop() || filePath;
    if (queryLower.includes(fileName.toLowerCase())) {
      score += 0.5;
    }

    // Content keyword matches
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);
    const contentLower = content.toLowerCase();

    for (const keyword of keywords) {
      const occurrences = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(occurrences * 0.01, 0.3);
    }

    return Math.min(score, 1);
  }

  /**
   * Build context string from files
   */
  private buildContextString(files: ContextFile[]): string {
    if (files.length === 0) {
      return '';
    }

    return files
      .map(file => {
        let header = `File: ${file.path}`;
        if (file.startLine || file.endLine) {
          header += ` (lines ${file.startLine || 1}-${file.endLine || ''})`;
        }
        header += `\nLanguage: ${file.language}`;

        return `${header}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
      })
      .join('\n');
  }

  /**
   * Parse imports from content
   */
  private parseImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const language = detectLanguageFromPath(filePath);

    const patterns: Record<string, RegExp> = {
      typescript: /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
      javascript: /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
      python: /^import\s+(\w+)|from\s+(\w+)\s+import/gm,
      rust: /use\s+([^;]+);/g,
      go: /import\s+['"`]([^'"`]+)['"`]/g,
    };

    const pattern = patterns[language];
    if (!pattern) {
      return [];
    }

    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }

    return imports;
  }

  /**
   * Find symbol in children recursively
   */
  private findSymbolInChildren(
    children: CodeSymbol[],
    symbolName: string
  ): CodeSymbol | null {
    for (const child of children) {
      if (child.name === symbolName) {
        return child;
      }
      if (child.children) {
        const found = this.findSymbolInChildren(child.children, symbolName);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a context builder from environment
 */
export function createContextBuilder(
  env: VibeCodingEnv,
  config?: Partial<ContextBuilderConfig>
): ContextBuilder {
  return new ContextBuilder(env, { ...DEFAULT_CONFIG, ...config });
}
