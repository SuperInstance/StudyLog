/**
 * StudyLoG.AI - Skill Gap Calculator
 *
 * Analyzes student progress and identifies areas needing improvement.
 * Uses a competency model based on puzzle attempts, time spent, and hints used.
 */

export interface SkillProfile {
  studentId: string;
  skills: SkillLevel[];
  overallLevel: number;
  recommendedFocus: string[];
  lastUpdated: string;
}

export interface SkillLevel {
  skill: string;
  category: SkillCategory;
  level: number; // 0-100
  confidence: number; // 0-1
  recentTrend: 'improving' | 'stable' | 'declining';
  puzzlesSolved: number;
  averageHints: number;
  averageTime: number;
}

export type SkillCategory =
  | 'mechanics' // Physical/mechanical reasoning
  | 'logic' // Boolean logic, algorithms
  | 'systems' // Complex system understanding
  | 'economics' // Resource management, trade-offs
  | 'communication' // Protocols, signaling
  | 'agents'; // AI, autonomous behavior

// Skill definitions by module
export const SKILLS: Record<string, { category: SkillCategory; description: string }> = {
  // Cognitive-Mill skills
  'gear-ratios': { category: 'mechanics', description: 'Understanding mechanical advantage' },
  'energy-transfer': { category: 'mechanics', description: 'Energy flow and conservation' },
  'feedback-loops': { category: 'systems', description: 'Positive and negative feedback' },
  'binary-encoding': { category: 'communication', description: 'Binary representation' },
  'error-detection': { category: 'communication', description: 'Parity, checksums' },
  'logic-gates': { category: 'logic', description: 'AND, OR, NOT, XOR' },
  'algorithms': { category: 'logic', description: 'Step-by-step problem solving' },
  'neural-basics': { category: 'agents', description: 'Weights and activation' },

  // Sitka-Sound skills
  'resource-gathering': { category: 'economics', description: 'Efficient collection' },
  'inventory-management': { category: 'economics', description: 'Storage and logistics' },
  'coordination': { category: 'communication', description: 'Multi-agent coordination' },
  'market-dynamics': { category: 'economics', description: 'Supply and demand' },
  'ecosystem-balance': { category: 'systems', description: 'Sustainable systems' },
  'agent-design': { category: 'agents', description: 'Autonomous agent behavior' },

  // Intelligence-Ranch skills
  'direct-control': { category: 'mechanics', description: 'Real-time control' },
  'command-protocols': { category: 'communication', description: 'Instruction sets' },
  'delegation': { category: 'agents', description: 'Task distribution' },
  'optimization': { category: 'logic', description: 'Finding optimal solutions' },
  'emergent-behavior': { category: 'systems', description: 'Complex from simple rules' },
  'policy-design': { category: 'agents', description: 'Agent policy creation' },
};

// Calculate skill level from puzzle attempts
export function calculateSkillLevel(attempts: PuzzleAttempt[]): number {
  if (attempts.length === 0) return 0;

  const successRate = attempts.filter((a) => a.isCorrect).length / attempts.length;
  const avgHints = attempts.reduce((sum, a) => sum + a.hintsUsed, 0) / attempts.length;
  const avgTime = attempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / attempts.length;

  // Skill formula: success rate is primary, penalize heavy hint usage
  // Time is normalized (faster = slightly better, but not dominant)
  const hintPenalty = Math.max(0, 1 - avgHints * 0.15);
  const timeFactor = Math.min(1, 300 / avgTime); // Normalize to 5 min baseline

  return Math.round(successRate * 70 + hintPenalty * 20 + timeFactor * 10);
}

// Determine trend from recent attempts
export function calculateTrend(
  attempts: PuzzleAttempt[]
): 'improving' | 'stable' | 'declining' {
  if (attempts.length < 3) return 'stable';

  const recent = attempts.slice(-3);
  const older = attempts.slice(-6, -3);

  if (older.length < 3) return 'stable';

  const recentSuccess = recent.filter((a) => a.isCorrect).length / recent.length;
  const olderSuccess = older.filter((a) => a.isCorrect).length / older.length;

  const diff = recentSuccess - olderSuccess;
  if (diff > 0.15) return 'improving';
  if (diff < -0.15) return 'declining';
  return 'stable';
}

// Calculate confidence based on sample size
export function calculateConfidence(attempts: PuzzleAttempt[]): number {
  // More attempts = more confidence, caps at 20 attempts
  return Math.min(1, attempts.length / 20);
}

// Identify skill gaps
export function identifyGaps(profile: SkillProfile): SkillGap[] {
  const gaps: SkillGap[] = [];

  for (const skill of profile.skills) {
    if (skill.level < 50 && skill.confidence > 0.3) {
      gaps.push({
        skill: skill.skill,
        category: skill.category,
        currentLevel: skill.level,
        targetLevel: 70, // Target proficiency
        priority: calculatePriority(skill),
        suggestedPuzzles: [], // Filled by RAG system
      });
    }
  }

  // Sort by priority
  return gaps.sort((a, b) => b.priority - a.priority);
}

// Calculate gap priority
function calculatePriority(skill: SkillLevel): number {
  let priority = 0;

  // Low level = high priority
  priority += (100 - skill.level) * 0.5;

  // Declining trend = higher priority
  if (skill.recentTrend === 'declining') priority += 20;

  // High confidence in low skill = definite gap
  priority += skill.confidence * 30;

  // Core skills get priority
  const coreSkills = ['logic-gates', 'algorithms', 'resource-gathering'];
  if (coreSkills.includes(skill.skill)) priority += 15;

  return Math.round(priority);
}

// Build full skill profile from database
export async function buildSkillProfile(
  db: D1Database,
  studentId: string
): Promise<SkillProfile> {
  // Fetch all puzzle attempts with skill tags
  const attempts = await db
    .prepare(`
      SELECT pa.*, p.tags, p.module
      FROM puzzle_attempts pa
      JOIN puzzles p ON pa.puzzle_id = p.id
      WHERE pa.student_id = ?
      ORDER BY pa.submitted_at ASC
    `)
    .bind(studentId)
    .all<PuzzleAttemptRow>();

  // Group attempts by skill
  const skillAttempts: Record<string, PuzzleAttempt[]> = {};

  for (const row of attempts.results) {
    const tags = JSON.parse(row.tags || '[]') as string[];
    for (const tag of tags) {
      if (!skillAttempts[tag]) skillAttempts[tag] = [];
      skillAttempts[tag].push({
        isCorrect: row.is_correct === 1,
        hintsUsed: row.hints_used,
        timeSpentSeconds: row.time_spent_seconds,
        submittedAt: row.submitted_at,
      });
    }
  }

  // Calculate levels for each skill
  const skills: SkillLevel[] = [];

  for (const [skill, skillDef] of Object.entries(SKILLS)) {
    const attempts = skillAttempts[skill] || [];
    skills.push({
      skill,
      category: skillDef.category,
      level: calculateSkillLevel(attempts),
      confidence: calculateConfidence(attempts),
      recentTrend: calculateTrend(attempts),
      puzzlesSolved: attempts.filter((a) => a.isCorrect).length,
      averageHints:
        attempts.length > 0
          ? attempts.reduce((sum, a) => sum + a.hintsUsed, 0) / attempts.length
          : 0,
      averageTime:
        attempts.length > 0
          ? attempts.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / attempts.length
          : 0,
    });
  }

  // Calculate overall level (weighted average by confidence)
  const totalWeight = skills.reduce((sum, s) => sum + s.confidence, 0);
  const overallLevel =
    totalWeight > 0
      ? skills.reduce((sum, s) => sum + s.level * s.confidence, 0) / totalWeight
      : 0;

  // Identify recommended focus areas
  const gaps = identifyGaps({ studentId, skills, overallLevel: 0, recommendedFocus: [], lastUpdated: '' });
  const recommendedFocus = gaps.slice(0, 3).map((g) => g.skill);

  return {
    studentId,
    skills,
    overallLevel: Math.round(overallLevel),
    recommendedFocus,
    lastUpdated: new Date().toISOString(),
  };
}

// Types
export interface PuzzleAttempt {
  isCorrect: boolean;
  hintsUsed: number;
  timeSpentSeconds: number;
  submittedAt: string;
}

interface PuzzleAttemptRow {
  is_correct: number;
  hints_used: number;
  time_spent_seconds: number;
  submitted_at: string;
  tags: string;
  module: string;
}

export interface SkillGap {
  skill: string;
  category: SkillCategory;
  currentLevel: number;
  targetLevel: number;
  priority: number;
  suggestedPuzzles: string[];
}
