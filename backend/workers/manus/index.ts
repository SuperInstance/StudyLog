/**
 * Manus AI Integration Client
 *
 * Client for Manus.im autonomous AI research and study guide generation.
 *
 * Reference: https://manus.im/
 *
 * Manus provides:
 * - Autonomous research task execution
 * - Study guide generation from topics
 * - Dataset synthesis from multiple sources
 * - Multi-step reasoning with verification
 *
 * Note: This implementation provides a client interface. Actual API
 * endpoints should be verified against the official Manus API documentation.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Research depth level
 */
export type ResearchDepth = 1 | 2 | 3 | 4 | 5;

/**
 * Research task configuration
 */
export interface ResearchTask {
  /** Research query/topic */
  query: string;
  /** Depth of research (1=shallow, 5=comprehensive) */
  depth: ResearchDepth;
  /** Specific sources to focus on */
  sources?: ManusSource[];
  /** Maximum sources to consult */
  maxSources?: number;
  /** Include academic sources */
  includeAcademic?: boolean;
  /** Include recent news/articles */
  includeNews?: boolean;
}

/**
 * Source types for research
 */
export type ManusSource =
  | 'academic'
  | 'news'
  | 'wikipedia'
  | 'documentation'
  | 'forums'
  | 'social'
  | 'custom';

/**
 * Research finding from a source
 */
export interface ResearchFinding {
  /** Source URL or identifier */
  source: string;
  /** Title of the source */
  title: string;
  /** Relevant excerpt or content */
  content: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Timestamp */
  timestamp?: string;
  /** Source type */
  type: ManusSource;
}

/**
 * Synthesized research result
 */
export interface ManusResearchResult {
  /** Research task identifier */
  taskId: string;
  /** Original query */
  query: string;
  /** Compiled findings */
  findings: ResearchFinding[];
  /** Synthesized summary */
  summary: string;
  /** Key insights extracted */
  insights: string[];
  /** Sources consulted */
  sourcesConsulted: number;
  /** Research duration in seconds */
  duration: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggested follow-up questions */
  followUpQuestions: string[];
}

/**
 * Study guide difficulty level
 */
export type StudyDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Study guide generation request
 */
export interface StudyGuideRequest {
  /** Topic to generate guide for */
  topic: string;
  /** Difficulty level */
  difficulty: StudyDifficulty;
  /** Target audience */
  audience?: string;
  /** Specific learning objectives */
  objectives?: string[];
  /** Estimated study time in minutes */
  estimatedTime?: number;
  /** Include practical exercises */
  includeExercises?: boolean;
  /** Include quiz questions */
  includeQuiz?: boolean;
}

/**
 * Learning module in study guide
 */
export interface LearningModule {
  /** Module number */
  number: number;
  /** Module title */
  title: string;
  /** Module content */
  content: string;
  /** Key concepts */
  keyConcepts: string[];
  /** Estimated time in minutes */
  estimatedTime: number;
}

/**
 * Exercise or practice problem
 */
export interface Exercise {
  /** Exercise number */
  number: number;
  /** Exercise title */
  title: string;
  /** Problem statement */
  problem: string;
  /** Hint (optional) */
  hint?: string;
  /** Solution (can be hidden) */
  solution?: string;
}

/**
 * Quiz question
 */
export interface QuizQuestion {
  /** Question number */
  number: number;
  /** Question text */
  question: string;
  /** Options for multiple choice */
  options?: string[];
  /** Correct answer(s) */
  answer: string | string[];
  /** Explanation */
  explanation: string;
  /** Difficulty */
  difficulty: StudyDifficulty;
}

/**
 * Generated study guide
 */
export interface StudyGuide {
  /** Guide identifier */
  guideId: string;
  /** Topic */
  topic: string;
  /** Difficulty level */
  difficulty: StudyDifficulty;
  /** Brief description */
  description: string;
  /** Learning objectives */
  objectives: string[];
  /** Prerequisites */
  prerequisites: string[];
  /** Learning modules */
  modules: LearningModule[];
  /** Practice exercises */
  exercises: Exercise[];
  /** Quiz questions */
  quiz: QuizQuestion[];
  /** Total estimated study time */
  estimatedTime: number;
  /** References and further reading */
  references: string[];
  /** Generated timestamp */
  generatedAt: string;
}

/**
 * Dataset synthesis request
 */
export interface DatasetSynthesisRequest {
  /** Topic/domain for dataset */
  topic: string;
  /** Source materials to synthesize from */
  sources: string[];
  /** Type of dataset to generate */
  datasetType: 'qa' | 'classification' | 'instruction' | 'conversation';
  /** Number of samples to generate */
  sampleCount: number;
  /** Output format */
  outputFormat: 'json' | 'csv' | 'jsonl';
}

/**
 * Synthesized dataset entry
 */
export interface DatasetEntry {
  /** Entry identifier */
  id: string;
  /** Source material */
  source: string;
  /** Input/question */
  input: string;
  /** Expected output/answer */
  output: string;
  /** Metadata */
  metadata: {
    topic: string;
    difficulty: StudyDifficulty;
    tags: string[];
    verified: boolean;
  };
}

/**
 * Dataset synthesis result
 */
export interface DatasetResult {
  /** Dataset identifier */
  datasetId: string;
  /** Topic/domain */
  topic: string;
  /** Dataset type */
  datasetType: string;
  /** Generated entries */
  entries: DatasetEntry[];
  /** Total entries */
  totalCount: number;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Export data */
  exportData: {
    format: string;
    data: string;
  };
}

/**
 * Manus client configuration
 */
export interface ManusClientConfig {
  /** Base URL for Manus API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Default research depth */
  defaultResearchDepth?: ResearchDepth;
  /** Default study difficulty */
  defaultDifficulty?: StudyDifficulty;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default system prompts for different tasks
 */
const DEFAULT_PROMPTS = {
  research: `You are an expert researcher. You conduct thorough, systematic investigations on any topic.
Your research is:
- Comprehensive and multi-faceted
- Well-sourced from credible materials
- Objective and balanced
- Clearly organized and synthesized
- Actionable with practical insights`,

  studyGuide: `You are an expert educator and curriculum designer. You create clear, effective study guides.
Your guides are:
- Well-structured with clear progression
- Age and skill-appropriate
- Rich with examples and analogies
- Include practice and assessment
- Aligned with learning objectives`,

  dataset: `You are an expert data curator. You create high-quality training datasets.
Your datasets are:
- Diverse and representative
- Accurate and well-labeled
- Balanced across categories
- Free from harmful bias
- Ready for ML/AI training`,
};

/**
 * Study difficulty descriptions
 */
const DIFFICULTY_DESCRIPTIONS: Record<StudyDifficulty, string> = {
  beginner: 'New to the topic, requires foundational concepts',
  intermediate: 'Some familiarity expected, builds on basics',
  advanced: 'Deep understanding required, complex topics',
  expert: 'Mastery level, specialized and nuanced content',
};

// ============================================================================
// Manus Client Implementation
// ============================================================================

/**
 * Manus AI Client
 *
 * Provides access to autonomous research, study guide generation,
 * and dataset synthesis capabilities.
 *
 * @example
 * ```typescript
 * const client = new ManusClient({
 *   baseUrl: 'https://api.manus.im/v1',
 *   apiKey: process.env.MANUS_API_KEY
 * });
 *
 * // Conduct research
 * const research = await client.researchTask('quantum computing applications', 3);
 *
 * // Generate study guide
 * const guide = await client.generateStudyGuide('machine learning', 'intermediate');
 *
 * // Synthesize dataset
 * const dataset = await client.synthesizeDataset(['article1.txt', 'article2.txt']);
 * ```
 */
export class ManusClient {
  private readonly config: Required<Pick<ManusClientConfig, 'baseUrl' | 'apiKey'>> &
    Omit<ManusClientConfig, 'baseUrl' | 'apiKey'>;

  constructor(config: ManusClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultResearchDepth: config.defaultResearchDepth || 3,
      defaultDifficulty: config.defaultDifficulty || 'intermediate',
      timeout: config.timeout || 60000,
    };
  }

  /**
   * Execute autonomous research task
   *
   * @param query - Research query or topic
   * @param depth - Research depth (1-5)
   * @returns Promise resolving to ManusResearchResult
   */
  async researchTask(query: string, depth: ResearchDepth = this.config.defaultResearchDepth): Promise<ManusResearchResult> {
    const startTime = Date.now();

    try {
      const taskId = crypto.randomUUID();

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/research`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            taskId,
            query,
            depth,
            systemPrompt: DEFAULT_PROMPTS.research,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Manus research error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      return {
        taskId: data.taskId || taskId,
        query,
        findings: data.findings || [],
        summary: data.summary || '',
        insights: data.insights || [],
        sourcesConsulted: data.sourcesConsulted || 0,
        duration: (Date.now() - startTime) / 1000,
        confidence: data.confidence || 0,
        followUpQuestions: data.followUpQuestions || [],
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Manus research timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Generate a study guide for a topic
   *
   * @param topic - Topic to generate guide for
   * @param difficulty - Difficulty level
   * @returns Promise resolving to StudyGuide
   */
  async generateStudyGuide(
    topic: string,
    difficulty: StudyDifficulty = this.config.defaultDifficulty
  ): Promise<StudyGuide> {
    try {
      const guideId = crypto.randomUUID();

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/study-guide`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            guideId,
            topic,
            difficulty,
            difficultyDescription: DIFFICULTY_DESCRIPTIONS[difficulty],
            systemPrompt: DEFAULT_PROMPTS.studyGuide,
            includeExercises: true,
            includeQuiz: true,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Manus study guide error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      return {
        guideId: data.guideId || guideId,
        topic,
        difficulty,
        description: data.description || '',
        objectives: data.objectives || [],
        prerequisites: data.prerequisites || [],
        modules: data.modules || [],
        exercises: data.exercises || [],
        quiz: data.quiz || [],
        estimatedTime: data.estimatedTime || 0,
        references: data.references || [],
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Manus study guide timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Synthesize a dataset from source materials
   *
   * @param sources - Array of source URLs or text content
   * @returns Promise resolving to DatasetResult
   */
  async synthesizeDataset(sources: string[]): Promise<DatasetResult> {
    try {
      const datasetId = crypto.randomUUID();

      // Infer topic from first source
      const topic = sources[0]?.split('/').pop()?.split('.')[0] || 'general';

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/dataset/synthesize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            datasetId,
            topic,
            sources,
            datasetType: 'qa',
            sampleCount: sources.length * 10,
            outputFormat: 'jsonl',
            systemPrompt: DEFAULT_PROMPTS.dataset,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Manus dataset error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      return {
        datasetId: data.datasetId || datasetId,
        topic,
        datasetType: 'qa',
        entries: data.entries || [],
        totalCount: data.totalCount || 0,
        qualityScore: data.qualityScore || 0,
        exportData: {
          format: 'jsonl',
          data: data.exportData || '',
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Manus dataset timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Stream research results as they come in
   *
   * @param query - Research query
   * @param depth - Research depth
   * @returns Async iterable of partial results
   */
  async *researchTaskStream(
    query: string,
    depth: ResearchDepth = this.config.defaultResearchDepth
  ): AsyncIterable<Partial<ManusResearchResult>> {
    const taskId = crypto.randomUUID();

    try {
      // In a real implementation, this would use Server-Sent Events or WebSocket
      // For now, we'll simulate streaming by polling
      let isComplete = false;

      while (!isComplete) {
        const response = await fetch(
          `${this.config.baseUrl}/research/${taskId}/stream`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json() as any;
          yield data;

          if (data.complete) {
            isComplete = true;
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      throw new Error(`Streaming research failed: ${error}`);
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if the client is configured and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/health`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available source types
   */
  getAvailableSources(): ManusSource[] {
    return ['academic', 'news', 'wikipedia', 'documentation', 'forums', 'social', 'custom'];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Manus client from environment configuration
 *
 * @param env - Environment object containing MANUS_API_KEY
 * @param config - Optional additional configuration
 * @returns Configured ManusClient instance
 */
export function createManusClient(
  env: { MANUS_API_KEY?: string; MANUS_BASE_URL?: string },
  config?: Partial<ManusClientConfig>
): ManusClient {
  const apiKey = env.MANUS_API_KEY || config?.apiKey;
  if (!apiKey) {
    throw new Error('MANUS_API_KEY is required for Manus client');
  }

  return new ManusClient({
    baseUrl: env.MANUS_BASE_URL || config?.baseUrl || 'https://api.manus.im/v1',
    apiKey,
    ...config,
  });
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './types';
