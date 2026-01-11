/**
 * Context Builder
 *
 * Builds code context for AI requests with file reading,
 * semantic search, and RAG integration.
 */

import type {
  ContextFile,
  ReadStrategy,
  SymbolInfo,
  DependencyMap,
  SemanticResult,
  ContextBuildResult,
  RAGConfig,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';

// ============================================================================
// Context Builder
// ============================================================================

export interface ContextBuilderOptions {
  /** Maximum tokens to include */
  maxTokens?: number;
  /** Reading strategy */
  strategy?: ReadStrategy;
  /** RAG configuration */
  rag?: RAGConfig;
}

export class ContextBuilder {
  constructor(
    private readonly env: IDEAutomationEnv,
    private readonly routerUrl = 'https://multi-model-router.studylog.ai'
  ) {}

  /**
   * Build context for a query
   */
  async buildContext(
    query: string,
    workspaceId: string,
    options: ContextBuilderOptions = {}
  ): Promise<ContextBuildResult> {
    const strategy = options.strategy || 'semantic';
    const maxTokens = options.maxTokens || 32000;

    // Find relevant files
    let files: ContextFile[];

    switch (strategy) {
      case 'semantic':
        files = await this.semanticSearch(query, workspaceId, options.rag);
        break;
      case 'full':
        files = await this.readAllFiles(workspaceId);
        break;
      case 'partial':
        files = await this.readPartialFiles(workspaceId, query);
        break;
      case 'diff':
        files = await this.readDiffFiles(workspaceId);
        break;
      default:
        files = [];
    }

    // Trim to token limit
    const trimmedFiles = this.trimToTokens(files, maxTokens);

    // Build context string
    const context = this.buildContextString(trimmedFiles);

    return {
      context,
      files: trimmedFiles,
      tokens: this.estimateTokens(context),
      compressed: trimmedFiles.length < files.length,
      semanticResults: strategy === 'semantic' ? this.toSemanticResults(trimmedFiles) : undefined,
    };
  }

  /**
   * Read a file with strategy
   */
  async readFile(
    workspaceId: string,
    filePath: string,
    strategy: ReadStrategy = 'full',
    options: {
      symbolName?: string;
      startLine?: number;
      endLine?: number;
    } = {}
  ): Promise<ContextFile> {
    const key = `${workspaceId}/${filePath}`;
    const object = await this.env.WORKSPACE_STORAGE.get(key);

    if (!object) {
      throw new Error(`File not found: ${filePath}`);
    }

    let content = await object.text();
    const language = this.detectLanguage(filePath);

    // Apply strategy
    switch (strategy) {
      case 'partial':
        content = this.extractPartial(content, options.startLine, options.endLine);
        break;
      case 'semantic':
        content = this.extractSymbol(content, options.symbolName || '');
        break;
    }

    return {
      path: filePath,
      content,
      language,
      startLine: options.startLine,
      endLine: options.endLine,
      symbol: options.symbolName,
    };
  }

  /**
   * Extract symbols from file
   */
  async extractSymbols(
    workspaceId: string,
    filePath: string
  ): Promise<SymbolInfo[]> {
    const contextFile = await this.readFile(workspaceId, filePath);
    return this.parseSymbols(contextFile.content, contextFile.language, filePath);
  }

  /**
   * Build dependency map
   */
  async buildDependencyMap(
    workspaceId: string,
    filePath: string
  ): Promise<DependencyMap> {
    const contextFile = await this.readFile(workspaceId, filePath);
    const imports = this.parseImports(contextFile.content, contextFile.language);
    const exports = this.parseExports(contextFile.content, contextFile.language);

    return {
      path: filePath,
      imports,
      exports,
      localDeps: imports
        .filter(i => !i.from.startsWith('.') && !i.from.startsWith('/'))
        .map(i => i.from),
      externalDeps: imports
        .filter(i => i.from.startsWith('.') || i.from.startsWith('/'))
        .map(i => i.from),
      circularDeps: [], // Would need full project analysis
    };
  }

  /**
   * Semantic search across workspace
   */
  async semanticSearch(
    query: string,
    workspaceId: string,
    ragConfig?: RAGConfig
  ): Promise<ContextFile[]> {
    // If RAG is configured, use vector search
    if (ragConfig) {
      return await this.ragSearch(query, workspaceId, ragConfig);
    }

    // Fallback to keyword matching
    return await this.keywordSearch(query, workspaceId);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Semantic search using RAG
   */
  private async ragSearch(
    query: string,
    workspaceId: string,
    config: RAGConfig
  ): Promise<ContextFile[]> {
    // Generate embedding for query
    const embedding = await this.generateEmbedding(query);

    // Search vector index (would use Vectorize in production)
    // For now, fallback to keyword search
    return await this.keywordSearch(query, workspaceId);
  }

  /**
   * Generate embedding for text
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Would call embedding service
    // For now, return dummy embedding
    return new Array(1536).fill(0);
  }

  /**
   * Keyword-based search
   */
  private async keywordSearch(
    query: string,
    workspaceId: string
  ): Promise<ContextFile[]> {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);

    const files: ContextFile[] = [];
    const listed = await this.env.WORKSPACE_STORAGE.list({
      prefix: workspaceId + '/',
    });

    for (const object of listed.objects.slice(0, 20)) {
      if (!object.key) continue;

      const content = await this.getWorkspaceFile(workspaceId, object.key);
      if (!content) continue;

      const filePath = object.key.slice(workspaceId.length + 1);
      const relevance = this.calculateRelevance(content, keywords);

      if (relevance > 0.1) {
        files.push({
          path: filePath,
          content: this.truncateContent(content, 2000),
          language: this.detectLanguage(filePath),
          relevance,
        });
      }
    }

    // Sort by relevance
    files.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    return files.slice(0, 10);
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(content: string, keywords: string[]): number {
    const lower = content.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      const count = (lower.match(new RegExp(keyword, 'g')) || []).length;
      matches += count;
    }

    return Math.min(matches / 100, 1);
  }

  /**
   * Read all files in workspace
   */
  private async readAllFiles(workspaceId: string): Promise<ContextFile[]> {
    const files: ContextFile[] = [];
    const listed = await this.env.WORKSPACE_STORAGE.list({
      prefix: workspaceId + '/',
    });

    for (const object of listed.objects) {
      if (!object.key) continue;

      const content = await this.getWorkspaceFile(workspaceId, object.key);
      if (!content) continue;

      const filePath = object.key.slice(workspaceId.length + 1);
      files.push({
        path: filePath,
        content: this.truncateContent(content, 5000),
        language: this.detectLanguage(filePath),
      });
    }

    return files;
  }

  /**
   * Read partial files based on query
   */
  private async readPartialFiles(
    workspaceId: string,
    query: string
  ): Promise<ContextFile[]> {
    const allFiles = await this.readAllFiles(workspaceId);

    // Find relevant sections in each file
    return allFiles.map(file => ({
      ...file,
      content: this.extractRelevantSection(file.content, query),
    }));
  }

  /**
   * Read changed files (diff strategy)
   */
  private async readDiffFiles(workspaceId: string): Promise<ContextFile[]> {
    // In a real implementation, this would compare with git state
    // For now, return empty
    return [];
  }

  /**
   * Extract partial content by line range
   */
  private extractPartial(
    content: string,
    startLine?: number,
    endLine?: number
  ): string {
    const lines = content.split('\n');
    const start = startLine ? Math.max(0, startLine - 1) : 0;
    const end = endLine ? Math.min(lines.length, endLine) : lines.length;

    return lines.slice(start, end).join('\n');
  }

  /**
   * Extract symbol from content
   */
  private extractSymbol(content: string, symbolName: string): string {
    // Simple implementation - find symbol definition
    const lines = content.split('\n');
    const startRegex = new RegExp(`(?:function|class|const|let|var|interface|type)\\s+${symbolName}\\b`);

    let startLine = -1;
    let braceCount = 0;
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (startLine === -1) {
        if (startRegex.test(lines[i])) {
          startLine = i;
          result.push(lines[i]);
          braceCount += (lines[i].match(/{/g) || []).length;
          braceCount -= (lines[i].match(/}/g) || []).length;
        }
      } else {
        result.push(lines[i]);
        braceCount += (lines[i].match(/{/g) || []).length;
        braceCount -= (lines[i].match(/}/g) || []).length;

        if (braceCount === 0) {
          break;
        }
      }
    }

    return result.join('\n');
  }

  /**
   * Extract relevant section based on query
   */
  private extractRelevantSection(content: string, query: string): string {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const lines = content.split('\n');

    const relevantLines: Array<{ line: string; score: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let score = 0;

      for (const keyword of keywords) {
        if (line.toLowerCase().includes(keyword)) {
          score += 10;
        }
      }

      // Boost lines near matches
      if (score > 0) {
        // Include context around matches
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 4); j++) {
          if (j === i) continue;
          const existingIdx = relevantLines.findIndex(l => l.line === lines[j]);
          const boost = 3 - Math.abs(j - i);
          if (existingIdx >= 0) {
            relevantLines[existingIdx].score += boost;
          } else {
            relevantLines.push({ line: lines[j], score: boost });
          }
        }
      }

      if (score > 0) {
        relevantLines.push({ line, score });
      }
    }

    // Sort by score and take top portion
    relevantLines.sort((a, b) => b.score - a.score);

    const topLines = relevantLines
      .slice(0, 50)
      .sort((a, b) => lines.indexOf(a.line) - lines.indexOf(b.line))
      .map(l => l.line);

    return topLines.join('\n');
  }

  /**
   * Parse symbols from content
   */
  private parseSymbols(content: string, language: string, filePath: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    const patterns: Record<string, RegExp[]> = {
      typescript: [
        [/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, 'function'],
        [/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g, 'function'],
        [/(?:export\s+)?class\s+(\w+)/g, 'class'],
        [/(?:export\s+)?interface\s+(\w+)/g, 'interface'],
      ],
      python: [
        [/def\s+(\w+)/g, 'function'],
        [/class\s+(\w+)/g, 'class'],
      ],
      rust: [
        [/fn\s+(\w+)/g, 'function'],
        [/struct\s+(\w+)/g, 'struct'],
        [/enum\s+(\w+)/g, 'enum'],
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;
    const lines = content.split('\n');

    for (const [pattern, kind] of langPatterns) {
      let match: RegExpExecArray | null;
      (pattern as RegExp).lastIndex = 0;

      while ((match = (pattern as RegExp).exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split('\n').length - 1;
        const startPos = this.offsetToPosition(content, match.index);

        symbols.push({
          name: match[1],
          kind: kind as any,
          path: filePath,
          start: startPos,
          end: {
            line: lineNum,
            character: startPos.character + match[1].length,
          },
          text: match[0],
          signature: match[0],
        });
      }
    }

    return symbols;
  }

  /**
   * Parse imports from content
   */
  private parseImports(content: string, language: string): Array<{
    from: string;
    imported: string[];
    isDefault?: boolean;
    isNamespace?: boolean;
    line: number;
  }> {
    const imports: Array<{
      from: string;
      imported: string[];
      isDefault?: boolean;
      isNamespace?: boolean;
      line: number;
    }> = [];

    const lines = content.split('\n');

    const patterns: Record<string, RegExp[]> = {
      typescript: [
        // import foo from 'bar'
        /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
        // import { foo, bar } from 'baz'
        /^import\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/,
        // import * as foo from 'bar'
        /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
        // require('foo')
        /(?:const|let|var)\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/,
      ],
      python: [
        // import foo
        /^import\s+(\w+)/,
        // from foo import bar
        /^from\s+(\w+)\s+import\s+(.+)/,
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;

    lines.forEach((line, i) => {
      for (const pattern of langPatterns) {
        const match = line.match(pattern);
        if (match) {
          if (language === 'typescript') {
            if (match[0].includes('* as')) {
              imports.push({
                from: match[2],
                imported: [match[1]],
                isNamespace: true,
                line: i + 1,
              });
            } else if (match[0].includes('{')) {
              const imported = match[1].split(',').map(s => s.trim());
              imports.push({
                from: match[2],
                imported,
                line: i + 1,
              });
            } else if (match.length === 3) {
              imports.push({
                from: match[2],
                imported: [match[1]],
                isDefault: true,
                line: i + 1,
              });
            }
          }
          break;
        }
      }
    });

    return imports;
  }

  /**
   * Parse exports from content
   */
  private parseExports(content: string, language: string): Array<{
    name: string;
    isDefault: boolean;
    isType: boolean;
    line: number;
  }> {
    const exports: Array<{
      name: string;
      isDefault: boolean;
      isType: boolean;
      line: number;
    }> = [];

    const lines = content.split('\n');

    const patterns = [
      /^export\s+default\s+(?:class|function|const)\s+(\w+)/,
      /^export\s+(?:class|function|const)\s+(\w+)/,
      /^export\s+type\s+(\w+)/,
      /^export\s+interface\s+(\w+)/,
    ];

    lines.forEach((line, i) => {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          exports.push({
            name: match[1],
            isDefault: line.includes('default'),
            isType: line.includes('type') || line.includes('interface'),
            line: i + 1,
          });
          break;
        }
      }
    });

    return exports;
  }

  /**
   * Trim files to token limit
   */
  private trimToTokens(files: ContextFile[], maxTokens: number): ContextFile[] {
    let totalTokens = 0;
    const result: ContextFile[] = [];

    for (const file of files) {
      const fileTokens = this.estimateTokens(file.content);
      if (totalTokens + fileTokens > maxTokens) {
        // Truncate this file
        const remaining = maxTokens - totalTokens;
        const charsPerToken = 4;
        file.content = file.content.slice(0, remaining * charsPerToken);
        result.push(file);
        break;
      }
      result.push(file);
      totalTokens += fileTokens;
    }

    return result;
  }

  /**
   * Build context string from files
   */
  private buildContextString(files: ContextFile[]): string {
    return files.map(file => {
      let text = `File: ${file.path}`;
      if (file.symbol) {
        text += ` (${file.symbol})`;
      }
      text += `\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
      return text;
    }).join('\n');
  }

  /**
   * Convert context files to semantic results
   */
  private toSemanticResults(files: ContextFile[]): SemanticResult[] {
    return files.map(f => ({
      path: f.path,
      score: f.relevance || 0.5,
      snippet: f.content.slice(0, 200),
      range: {
        start: { line: f.startLine || 0, character: 0 },
        end: { line: f.endLine || 10, character: 0 },
      },
      symbols: f.symbol ? [f.symbol] : [],
    }));
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate content to max characters
   */
  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars) + '\n... (truncated)';
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
    };

    return map[ext] || 'text';
  }

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
   * Convert offset to position
   */
  private offsetToPosition(content: string, offset: number): { line: number; character: number } {
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
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create context builder from environment
 */
export function createContextBuilder(env: IDEAutomationEnv): ContextBuilder {
  return new ContextBuilder(env);
}
