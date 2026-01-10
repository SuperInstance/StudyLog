/**
 * Custom Agent Configuration Example
 *
 * This example demonstrates how to create custom AI agents with
 * specific behaviors, tools, and prompts. It shows:
 * - Creating a custom agent class
 * - Defining custom tools
 * - Setting system prompts
 * - Registering with the orchestrator
 *
 * Run with:
 *   npx tsx examples/integrations/custom-agent.ts
 */

import { BaseAgent } from '@studylog/agents';
import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  ToolDefinition,
  ToolCall,
  ExtendedAgentId,
} from '@studylog/agents';
import { AIClient, createAIClient } from '@studylog/agents';
import { AgentOrchestrator } from '@studylog/agents';

// ═══════════════════════════════════════════════════════════════
// Custom Agent: Coding Tutor
// ═══════════════════════════════════════════════════════════════

/**
 * Tools available to the Coding Tutor agent
 */
const CODING_TUTOR_TOOLS: ToolDefinition[] = [
  {
    name: 'explain_code',
    description: 'Explain a piece of code in simple terms',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to explain',
        },
        language: {
          type: 'string',
          description: 'Programming language',
          enum: ['javascript', 'typescript', 'python', 'java', 'cpp'],
        },
      },
      required: ['code', 'language'],
    },
  },
  {
    name: 'generate_example',
    description: 'Generate a code example for a concept',
    parameters: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          description: 'The programming concept to demonstrate',
        },
        language: {
          type: 'string',
          description: 'Programming language',
        },
      },
      required: ['concept', 'language'],
    },
  },
  {
    name: 'debug_code',
    description: 'Help debug code by suggesting fixes',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code with bugs',
        },
        error_message: {
          type: 'string',
          description: 'The error message received',
        },
      },
      required: ['code'],
    },
  },
];

/**
 * Custom Coding Tutor Agent
 *
 * This agent specializes in teaching programming concepts,
 * explaining code, and helping with debugging.
 */
class CodingTutorAgent extends BaseAgent {
  constructor(aiClient: AIClient) {
    const config: AgentConfig = {
      id: 'coding-tutor',
      name: 'Coding Tutor',
      description: 'A patient programming tutor that explains concepts and helps debug code',
      systemPrompt: `You are a friendly coding tutor specializing in TypeScript and Python.

Your teaching style:
- Start with simple explanations
- Use analogies and real-world examples
- Provide code examples that can be run immediately
- Encourage students by celebrating small wins
- When debugging, guide students to find the solution themselves

Remember:
- Every student learns at their own pace
- There are no stupid questions
- Debugging is a skill that takes practice to develop`,
      tools: CODING_TUTOR_TOOLS,
      temperature: 0.8,
      maxTokens: 1024,
    };

    super(config, aiClient);
  }

  /**
   * Execute tool calls (implemented from abstract BaseAgent)
   */
  protected async executeTool(
    call: ToolCall,
    _context: AgentContext
  ): Promise<unknown> {
    switch (call.name) {
      case 'explain_code':
        return this.explainCode(call.arguments as { code: string; language: string });

      case 'generate_example':
        return this.generateExample(call.arguments as { concept: string; language: string });

      case 'debug_code':
        return this.debugCode(call.arguments as { code: string; error_message?: string });

      default:
        return `Unknown tool: ${call.name}`;
    }
  }

  /**
   * Tool: Explain code
   */
  private async explainCode(args: { code: string; language: string }): Promise<string> {
    // In a real implementation, this might use AST analysis
    // For now, we'll provide a structured explanation
    return `
Code Explanation (${args.language}):

\`\`\`${args.language}
${args.code}
\`\`\`

Key points:
- This code demonstrates ${this.detectConcept(args.code)}
- The input/output flow is: ${this.analyzeFlow(args.code)}
- Common pitfalls to watch for: ${this.getPitfalls(args.language)}
`;
  }

  /**
   * Tool: Generate example
   */
  private async generateExample(args: { concept: string; language: string }): Promise<string> {
    const examples: Record<string, Record<string, string>> = {
      'loop': {
        typescript: `for (let i = 0; i < 5; i++) {
  console.log('Count:', i);
}`,
        python: `for i in range(5):
    print(f"Count: {i}")`,
      },
      'function': {
        typescript: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`,
        python: `def greet(name: str) -> str:
    return f"Hello, {name}!"`,
      },
      'async': {
        typescript: `async function fetchData(url: string) {
  const response = await fetch(url);
  return await response.json();
}`,
        python: `async def fetch_data(url: str):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()`,
      },
    };

    return examples[args.concept]?.[args.language] || `Example for ${args.concept} in ${args.language}`;
  }

  /**
   * Tool: Debug code
   */
  private async debugCode(args: { code: string; error_message?: string }): Promise<string> {
    const issues: string[] = [];

    // Check for common issues
    if (!args.code.includes(';') && !args.code.includes('\n')) {
      issues.push('Possible missing semicolons or line breaks');
    }

    if (args.error_message) {
      issues.push(`Error message: ${args.error_message}`);
    }

    if (issues.length === 0) {
      return 'No obvious issues found. Please provide more context about the problem.';
    }

    return `Debugging suggestions:\n${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`;
  }

  // Helper methods
  private detectConcept(code: string): string {
    if (code.includes('for ') || code.includes('while ')) return 'loops';
    if (code.includes('function ') || code.includes('=> ')) return 'functions';
    if (code.includes('class ')) return 'classes';
    if (code.includes('async ') || code.includes('await ')) return 'asynchronous programming';
    return 'basic syntax';
  }

  private analyzeFlow(code: string): string {
    const lines = code.split('\n').filter(l => l.trim());
    return `${lines.length} lines of code, executing sequentially`;
  }

  private getPitfalls(language: string): string {
    const pitfalls: Record<string, string> = {
      javascript: 'off-by-one errors, undefined vs null, async/await misuse',
      typescript: 'type mismatches, missing type annotations, any overuse',
      python: 'indentation errors, mutable default arguments, scope issues',
    };
    return pitfalls[language] || 'syntax errors, logic errors, runtime errors';
  }
}

// ═══════════════════════════════════════════════════════════════
// Custom Agent: Circuit Simulator Helper
// ═══════════════════════════════════════════════════════════════

const CIRCUIT_HELPER_TOOLS: ToolDefinition[] = [
  {
    name: 'calculate_current',
    description: 'Calculate current using Ohm\'s Law',
    parameters: {
      type: 'object',
      properties: {
        voltage: { type: 'number', description: 'Voltage in volts' },
        resistance: { type: 'number', description: 'Resistance in ohms' },
      },
      required: ['voltage', 'resistance'],
    },
  },
  {
    name: 'suggest_components',
    description: 'Suggest components for a circuit',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'What the circuit should do' },
      },
      required: ['goal'],
    },
  },
];

/**
 * Circuit Simulator Helper Agent
 *
 * Helps users with electrical circuit concepts and calculations.
 */
class CircuitHelperAgent extends BaseAgent {
  constructor(aiClient: AIClient) {
    const config: AgentConfig = {
      id: 'circuit-helper',
      name: 'Circuit Helper',
      description: 'Helps with circuit design, calculations, and electrical concepts',
      systemPrompt: `You are a patient electrical engineering tutor helping students learn about circuits.

Key concepts to explain:
- Voltage (V), Current (I), Resistance (R) and Ohm's Law: V = I × R
- Series vs parallel circuits
- Power calculation: P = V × I
- Component functions (resistors, capacitors, LEDs, etc.)

When explaining:
- Start with the water analogy (voltage = pressure, current = flow, resistance = pipe width)
- Show calculations step by step
- Relate to real-world examples
- Encourage hands-on experimentation with the simulator`,
      tools: CIRCUIT_HELPER_TOOLS,
      temperature: 0.7,
      maxTokens: 1024,
    };

    super(config, aiClient);
  }

  protected async executeTool(call: ToolCall): Promise<unknown> {
    switch (call.name) {
      case 'calculate_current':
        const args = call.arguments as { voltage: number; resistance: number };
        const current = args.voltage / args.resistance;
        return `Using Ohm's Law (I = V / R):\nI = ${args.voltage}V / ${args.resistance}Ω = ${current.toFixed(2)}A`;

      case 'suggest_components':
        const goal = (call.arguments as { goal: string }).goal;
        return this.suggestComponents(goal);

      default:
        return `Unknown tool: ${call.name}`;
    }
  }

  private suggestComponents(goal: string): string {
    const suggestions: Record<string, string[]> = {
      'light up': ['Battery', 'LED', 'Resistor (220Ω)', 'Switch'],
      'measure': ['Multimeter', 'Test leads', 'Breadboard'],
      'timer': ['555 timer IC', 'Capacitors', 'Resistors', 'LED'],
      'amplify': ['Transistor (NPN)', 'Resistors', 'Capacitors', 'Speaker'],
    };

    const goalLower = goal.toLowerCase();
    for (const [key, components] of Object.entries(suggestions)) {
      if (goalLower.includes(key)) {
        return `Components for "${goal}":\n${components.join('\n')}`;
      }
    }

    return 'Please describe what you want your circuit to do (e.g., "light up an LED", "create a timer")';
  }
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Use Coding Tutor directly
 */
async function exampleCodingTutor() {
  console.log('\n=== Example 1: Coding Tutor Agent ===\n');

  const aiClient = createAIClient();
  const tutor = new CodingTutorAgent(aiClient);

  // Create context
  const context: AgentContext = {
    module: 'cognitive-mill',
    stage: 1,
    phase: 'player',
    conversationHistory: [],
    agentState: {},
  };

  // Ask a question
  const response = await tutor.process('What is a closure in JavaScript?', context);

  console.log(`Response from ${response.agentId}:`);
  console.log(response.content);
}

/**
 * Example 2: Use Circuit Helper directly
 */
async function exampleCircuitHelper() {
  console.log('\n=== Example 2: Circuit Helper Agent ===\n');

  const aiClient = createAIClient();
  const helper = new CircuitHelperAgent(aiClient);

  const context: AgentContext = {
    module: 'cognitive-mill',
    stage: 1,
    phase: 'player',
    conversationHistory: [],
    agentState: {},
  };

  const response = await helper.process('I want to light up an LED. What components do I need?', context);

  console.log(`Response from ${response.agentId}:`);
  console.log(response.content);
}

/**
 * Example 3: Register custom agent with orchestrator
 */
async function exampleCustomAgentInOrchestrator() {
  console.log('\n=== Example 3: Custom Agent in Orchestrator ===\n');

  const orchestrator = new AgentOrchestrator({
    preferLocalAI: true,
  });

  // Register the custom agent
  const aiClient = createAIClient();
  const customAgent = new CodingTutorAgent(aiClient);

  // Add to orchestrator's agent registry
  (orchestrator as any).agents.set('coding-tutor', customAgent);

  // Now we can use it through the orchestrator
  const response = await customAgent.process(
    'Explain what a callback function is',
    {
      module: 'cognitive-mill',
      stage: 1,
      phase: 'player',
      conversationHistory: [],
      agentState: {},
    }
  );

  console.log(`Response: ${response.content}`);
}

/**
 * Example 4: Create a domain-specific agent
 */
async function exampleCreateDomainAgent() {
  console.log('\n=== Example 4: Domain-Specific Agent ===\n');

  // Define a custom agent for Godot scene development
  const GODOT_HELPER_TOOLS: ToolDefinition[] = [
    {
      name: 'create_node',
      description: 'Suggest Godot node type for a purpose',
      parameters: {
        type: 'object',
        properties: {
          purpose: { type: 'string', description: 'What the node should do' },
        },
        required: ['purpose'],
      },
    },
  ];

  class GodotHelperAgent extends BaseAgent {
    constructor(aiClient: AIClient) {
      super({
        id: 'godot-helper',
        name: 'Godot Helper',
        description: 'Helps with Godot engine scene creation',
        systemPrompt: `You are a Godot 4.3 engine expert. Help students create scenes and choose the right nodes.

Common node types:
- Node3D: 3D object base
- Camera3D: 3D camera
- MeshInstance3D: 3D mesh
- RigidBody3D: Physics body
- Area3D: Detection area
- AnimationPlayer: Animation control`,
        tools: GODOT_HELPER_TOOLS,
      }, aiClient);
    }

    protected async executeTool(call: ToolCall): Promise<unknown> {
      if (call.name === 'create_node') {
        const { purpose } = call.arguments as { purpose: string };
        const nodeMap: Record<string, string> = {
          'display': 'MeshInstance3D with a mesh resource',
          'camera': 'Camera3D',
          'physics': 'RigidBody3D or StaticBody3D',
          'detect': 'Area3D with collision shape',
          'move': 'CharacterBody3D for player control',
        };
        return nodeMap[purpose.toLowerCase()] || 'Node (base class)';
      }
      return 'Unknown tool';
    }
  }

  const aiClient = createAIClient();
  const agent = new GodotHelperAgent(aiClient);

  const response = await agent.process('I need a node for detecting when the player enters a room', {
    module: 'cognitive-mill',
    stage: 1,
    phase: 'player',
    conversationHistory: [],
    agentState: {},
  });

  console.log(`Response: ${response.content}`);
}

/**
 * Example 5: Agent with memory
 */
async function exampleAgentWithMemory() {
  console.log('\n=== Example 5: Agent with Memory ===\n');

  // Create an agent that remembers student progress
  class MemoryTutorAgent extends BaseAgent {
    private studentProgress: Map<string, { topics: string[]; level: number }> = new Map();

    constructor(aiClient: AIClient) {
      super({
        id: 'memory-tutor',
        name: 'Memory Tutor',
        description: 'Tutor that remembers student progress',
        systemPrompt: `You are a tutor that tracks student progress.

Adapt your explanations based on what the student has learned before.
Celebrate when they demonstrate understanding.
Introduce new concepts gradually.`,
        tools: [],
      }, aiClient);
    }

    protected async executeTool(): Promise<unknown> {
      return '';
    }

    protected buildSystemPrompt(context: AgentContext): string {
      const studentId = context.student?.id || 'anonymous';
      const progress = this.studentProgress.get(studentId) || { topics: [], level: 1 };

      let prompt = super.buildSystemPrompt(context);
      prompt += `\n\nStudent Progress:`;
      prompt += `\n- Topics covered: ${progress.topics.join(', ') || 'None yet'}`;
      prompt += `\n- Current level: ${progress.level}`;

      return prompt;
    }

    updateProgress(studentId: string, topic: string): void {
      const current = this.studentProgress.get(studentId) || { topics: [], level: 1 };
      if (!current.topics.includes(topic)) {
        current.topics.push(topic);
      }
      this.studentProgress.set(studentId, current);
    }
  }

  const aiClient = createAIClient();
  const agent = new MemoryTutorAgent(aiClient);

  const context: AgentContext = {
    module: 'cognitive-mill',
    stage: 1,
    phase: 'player',
    conversationHistory: [],
    agentState: {},
    student: {
      id: 'student-123',
      displayName: 'Alex',
      skillLevels: { programming: 2, circuits: 1 },
      preferences: { hintLevel: 'moderate', pace: 'normal' },
    },
  };

  // First question
  let response = await agent.process('What is a variable?', context);
  console.log('First response:', response.content);

  // Update progress
  (agent as any).updateProgress('student-123', 'variables');

  // Follow-up question (agent now remembers)
  response = await agent.process('How do I use a variable in a loop?', context);
  console.log('\nFollow-up response:', response.content);
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    coding: exampleCodingTutor,
    circuit: exampleCircuitHelper,
    orchestrator: exampleCustomAgentInOrchestrator,
    domain: exampleCreateDomainAgent,
    memory: exampleAgentWithMemory,
  };

  try {
    if (example === 'all') {
      await exampleCodingTutor();
      await exampleCircuitHelper();
      await exampleCreateDomainAgent();
    } else if (examples[example]) {
      await examples[example]();
    } else {
      console.log(`Available examples: ${Object.keys(examples).join(', ')}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main();
}

export {
  CodingTutorAgent,
  CircuitHelperAgent,
  exampleCodingTutor,
  exampleCircuitHelper,
  exampleCustomAgentInOrchestrator,
  exampleCreateDomainAgent,
  exampleAgentWithMemory,
};
