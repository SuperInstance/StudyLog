/**
 * StudyLoG.AI - Agent Director Common Types
 *
 * The Director orchestrates all other agents and manages
 * the overall learning experience.
 */

// Agent types in the hierarchy
export type AgentType =
  | 'director' // Top-level orchestrator
  | 'captain' // Game/simulation controller
  | 'teacher' // Pedagogy and explanations
  | 'builder' // Code assistance
  | 'tester'; // Validation and QA

// Agent status
export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'waiting' | 'error';

// Agent definition
export interface AgentDefinition {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
}

// Agent state
export interface AgentState {
  id: string;
  type: AgentType;
  status: AgentStatus;
  currentTask?: string;
  context: AgentContext;
  lastActivity: number;
}

// Agent context (what the agent knows)
export interface AgentContext {
  module: string;
  stage: number;
  studentProfile?: StudentProfile;
  gameState?: Record<string, unknown>;
  conversationHistory: ConversationMessage[];
}

// Student profile for personalization
export interface StudentProfile {
  id: string;
  displayName: string;
  phase: 'player' | 'reader' | 'tweaker' | 'creator' | 'mentor';
  skillLevels: Record<string, number>;
  preferences: {
    hintLevel: 'minimal' | 'moderate' | 'verbose';
    codeStyle: 'simple' | 'idiomatic' | 'advanced';
    pace: 'slow' | 'normal' | 'fast';
  };
}

// Conversation message
export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent';
  agent?: AgentType;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Task for agents
export interface AgentTask {
  id: string;
  type: 'query' | 'action' | 'delegation';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: AgentType | 'user';
  target: AgentType;
  payload: unknown;
  deadline?: number;
}

// Task result
export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

// Director commands
export type DirectorCommand =
  | { type: 'start_module'; module: string }
  | { type: 'advance_stage' }
  | { type: 'provide_hint'; level: number }
  | { type: 'explain_concept'; concept: string }
  | { type: 'review_code'; code: string }
  | { type: 'run_test'; test: string }
  | { type: 'delegate'; agent: AgentType; task: AgentTask };

// Default agent definitions
export const DEFAULT_AGENTS: AgentDefinition[] = [
  {
    id: 'director',
    type: 'director',
    name: 'Director',
    description: 'Orchestrates all agents and manages the learning experience',
    capabilities: ['routing', 'context-management', 'delegation'],
    systemPrompt: `You are the Director agent for StudyLoG.AI.
Your role is to orchestrate the learning experience by:
1. Understanding the student's current context and needs
2. Delegating tasks to specialist agents (Captain, Teacher, Builder, Tester)
3. Maintaining conversation coherence across agents
4. Adapting the experience based on student progress

Always prioritize the student's learning journey over task completion.`,
  },
  {
    id: 'captain',
    type: 'captain',
    name: 'Captain',
    description: 'Controls game simulation and narrates story',
    capabilities: ['game-control', 'story-telling', 'npc-behavior'],
    systemPrompt: `You are the Captain agent for StudyLoG.AI.
Your role is to:
1. Control the game simulation state
2. Narrate story beats and game events
3. Manage NPC behaviors and dialogue
4. Create engaging scenarios that teach concepts

Speak in character appropriate to the current module.`,
  },
  {
    id: 'teacher',
    type: 'teacher',
    name: 'Teacher',
    description: 'Explains concepts and provides hints',
    capabilities: ['explanation', 'hints', 'assessment'],
    systemPrompt: `You are the Teacher agent for StudyLoG.AI.
Your role is to:
1. Explain computing concepts at the student's level
2. Provide progressive hints (vague → specific)
3. Assess understanding through questions
4. Adapt explanations based on learning style

Use analogies from the current game module when explaining.`,
  },
  {
    id: 'builder',
    type: 'builder',
    name: 'Builder',
    description: 'Assists with code writing and review',
    capabilities: ['code-completion', 'code-review', 'refactoring'],
    systemPrompt: `You are the Builder agent for StudyLoG.AI.
Your role is to:
1. Help students write code at their skill level
2. Review code and suggest improvements
3. Explain code patterns and best practices
4. Guide refactoring without doing it for them

Match code complexity to the student's phase.`,
  },
  {
    id: 'tester',
    type: 'tester',
    name: 'Tester',
    description: 'Validates code and provides feedback',
    capabilities: ['testing', 'validation', 'debugging'],
    systemPrompt: `You are the Tester agent for StudyLoG.AI.
Your role is to:
1. Run tests on student code
2. Provide clear, educational error messages
3. Suggest debugging strategies
4. Celebrate successes appropriately

Frame failures as learning opportunities.`,
  },
];
