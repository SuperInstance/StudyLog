/**
 * StudyLoG.AI - RAG Puzzle Generator
 *
 * Uses Retrieval-Augmented Generation to create contextually relevant
 * puzzles based on student skill gaps and learning progression.
 */

import type { SkillGap, SkillProfile } from './skill-gap';

export interface PuzzleTemplate {
  id: string;
  title: string;
  description: string;
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  stage: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  skills: string[];
  templateType: 'fill-in' | 'multiple-choice' | 'code' | 'simulation';
  template: string; // Template with {{placeholders}}
  variables: TemplateVariable[];
  validationFn: string; // JavaScript validation function as string
}

export interface TemplateVariable {
  name: string;
  type: 'number' | 'string' | 'array' | 'object';
  constraints?: {
    min?: number;
    max?: number;
    options?: string[];
    length?: number;
  };
}

export interface GeneratedPuzzle {
  id: string;
  templateId: string;
  title: string;
  description: string;
  difficulty: number;
  skills: string[];
  prompt: string;
  expectedAnswer: unknown;
  hints: string[];
  xpReward: number;
  generatedAt: string;
}

export interface RAGContext {
  profile: SkillProfile;
  gaps: SkillGap[];
  recentPuzzles: string[]; // IDs of recently solved puzzles
  preferredDifficulty: number;
}

// Embed text using Cloudflare AI
export async function embedText(ai: Ai, text: string): Promise<number[]> {
  const result = await ai.run('@cf/baai/bge-base-en-v1.5' as any, { text: [text] }) as { data?: number[][] };
  return result.data?.[0] ?? [];
}

// Search for relevant puzzle templates using Vectorize
export async function searchTemplates(
  vectorize: VectorizeIndex,
  query: number[],
  filters: {
    skills?: string[];
    difficulty?: number;
    module?: string;
  },
  limit = 10
): Promise<string[]> {
  const vectorFilter: Record<string, string> = {};
  if (filters.module) {
    vectorFilter.module = filters.module;
  }

  const queryOptions: VectorizeQueryOptions = {
    topK: limit,
    returnMetadata: 'all',
  };
  if (Object.keys(vectorFilter).length > 0) {
    queryOptions.filter = vectorFilter as VectorizeVectorMetadataFilter;
  }

  const results = await vectorize.query(query, queryOptions);

  return results.matches
    .filter((m) => {
      if (!m.metadata) return true;
      if (filters.difficulty && Math.abs((m.metadata.difficulty as number) - filters.difficulty) > 1) {
        return false;
      }
      if (filters.skills && filters.skills.length > 0) {
        const templateSkills = (m.metadata.skills as string[]) || [];
        return filters.skills.some((s) => templateSkills.includes(s));
      }
      return true;
    })
    .map((m) => m.id);
}

// Generate a puzzle from template
export function generateFromTemplate(
  template: PuzzleTemplate,
  context: RAGContext
): GeneratedPuzzle {
  // Generate variable values based on constraints and difficulty
  const variables: Record<string, unknown> = {};

  for (const v of template.variables) {
    variables[v.name] = generateVariable(v, context.preferredDifficulty);
  }

  // Fill in template
  let prompt = template.template;
  for (const [name, value] of Object.entries(variables)) {
    const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
    prompt = prompt.replace(new RegExp(`{{${name}}}`, 'g'), replacement);
  }

  // Calculate expected answer using validation function
  const validationFn = new Function('variables', template.validationFn);
  const expectedAnswer = validationFn(variables);

  // Generate contextual hints based on skill gaps
  const hints = generateHints(template, context.gaps);

  // Calculate XP based on difficulty and skill gap relevance
  const baseXp = template.difficulty * 10;
  const gapBonus = context.gaps.some((g) => template.skills.includes(g.skill)) ? 5 : 0;
  const xpReward = baseXp + gapBonus;

  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    title: template.title,
    description: template.description,
    difficulty: template.difficulty,
    skills: template.skills,
    prompt,
    expectedAnswer,
    hints,
    xpReward,
    generatedAt: new Date().toISOString(),
  };
}

// Generate a variable value based on constraints
function generateVariable(
  variable: TemplateVariable,
  difficulty: number
): unknown {
  const { constraints } = variable;

  switch (variable.type) {
    case 'number': {
      const min = constraints?.min ?? 1;
      const max = constraints?.max ?? 100;
      // Higher difficulty = larger numbers
      const range = max - min;
      const difficultyFactor = 0.5 + difficulty * 0.1;
      const adjustedMax = min + Math.round(range * difficultyFactor);
      return Math.floor(Math.random() * (adjustedMax - min + 1)) + min;
    }

    case 'string': {
      if (constraints?.options) {
        return constraints.options[Math.floor(Math.random() * constraints.options.length)];
      }
      return `value_${Math.random().toString(36).slice(2, 8)}`;
    }

    case 'array': {
      const length = constraints?.length ?? 3 + difficulty;
      const arr: number[] = [];
      for (let i = 0; i < length; i++) {
        arr.push(Math.floor(Math.random() * 100));
      }
      return arr;
    }

    case 'object': {
      return { key: `value_${difficulty}` };
    }

    default:
      return null;
  }
}

// Generate hints based on skill gaps
function generateHints(template: PuzzleTemplate, gaps: SkillGap[]): string[] {
  const hints: string[] = [];

  // Generic hints
  hints.push('Take your time and think about what the question is asking.');

  // Skill-specific hints
  for (const skill of template.skills) {
    const gap = gaps.find((g) => g.skill === skill);
    if (gap && gap.currentLevel < 40) {
      hints.push(getSkillHint(skill));
    }
  }

  // Difficulty-based final hint
  if (template.difficulty >= 4) {
    hints.push('This is a challenging puzzle. Break it down into smaller steps.');
  }

  return hints.slice(0, 3); // Max 3 hints
}

// Get hint for specific skill
function getSkillHint(skill: string): string {
  const hints: Record<string, string> = {
    'gear-ratios': 'Remember: smaller driving gear = faster output, larger driven gear = more torque.',
    'energy-transfer': 'Energy is conserved - trace where it flows from input to output.',
    'feedback-loops': 'Look for signals that feed back into their own cause.',
    'binary-encoding': 'Each bit doubles the number of possible values.',
    'logic-gates': 'AND needs all inputs true, OR needs any input true.',
    'algorithms': 'What happens step by step? Walk through it manually first.',
    'resource-gathering': 'Efficiency = output / input. Maximize the ratio.',
    'coordination': 'Think about timing and communication between agents.',
    'market-dynamics': 'Supply up = price down. Demand up = price up.',
    'delegation': 'Good delegation = clear instructions + appropriate capability.',
    'optimization': 'Try different approaches and measure the results.',
    'emergent-behavior': 'Simple local rules can create complex global patterns.',
  };

  return hints[skill] || 'Think carefully about the underlying principles.';
}

// RAG pipeline: given a context, generate the best puzzle
export async function generatePuzzleForStudent(
  ai: Ai,
  vectorize: VectorizeIndex,
  db: D1Database,
  context: RAGContext
): Promise<GeneratedPuzzle | null> {
  // Build query from skill gaps
  const gapDescription = context.gaps
    .slice(0, 3)
    .map((g) => `${g.skill} (level: ${g.currentLevel})`)
    .join(', ');

  const queryText = `puzzle for skills: ${gapDescription}. difficulty: ${context.preferredDifficulty}`;

  // Embed query
  const queryVector = await embedText(ai, queryText);

  // Search templates
  const templateIds = await searchTemplates(vectorize, queryVector, {
    skills: context.gaps.map((g) => g.skill),
    difficulty: context.preferredDifficulty,
  });

  // Filter out recently solved
  const availableIds = templateIds.filter((id) => !context.recentPuzzles.includes(id));

  if (availableIds.length === 0) {
    return null; // No suitable puzzles found
  }

  // Fetch template from database
  const template = await db
    .prepare('SELECT * FROM puzzle_templates WHERE id = ?')
    .bind(availableIds[0])
    .first<PuzzleTemplate>();

  if (!template) {
    return null;
  }

  // Generate puzzle
  return generateFromTemplate(template, context);
}

// Batch generate puzzles for a module
export async function generateModulePuzzles(
  _ai: Ai,
  module: string,
  stage: number,
  count: number
): Promise<GeneratedPuzzle[]> {
  // This would typically use LLM to generate novel puzzles
  // For now, return placeholder
  const puzzles: GeneratedPuzzle[] = [];

  for (let i = 0; i < count; i++) {
    puzzles.push({
      id: crypto.randomUUID(),
      templateId: 'generated',
      title: `${module} Stage ${stage} Puzzle ${i + 1}`,
      description: 'AI-generated puzzle based on curriculum',
      difficulty: Math.min(5, Math.ceil(stage / 2)),
      skills: [],
      prompt: 'Puzzle prompt would be generated by LLM',
      expectedAnswer: null,
      hints: ['Think step by step.'],
      xpReward: 10 * stage,
      generatedAt: new Date().toISOString(),
    });
  }

  return puzzles;
}
