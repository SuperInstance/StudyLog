/**
 * Godot Integration Example
 *
 * This example demonstrates how to integrate AI agents with Godot scenes
 * for interactive simulations. It shows:
 * - Connecting to the Godot WebSocket server
 * - Sending commands to control Godot scenes
 * - Receiving state updates from Godot
 * - Using AI to generate scene descriptions and modifications
 *
 * Run with:
 *   npx tsx examples/integrations/with-godot.ts
 *
 * Prerequisites:
 *   - Godot 4.3+ running with WebSocket support
 *   - Theia IDE with si-godot-embed extension running
 *   - Set GODOT_WS_URL environment variable (default: ws://localhost:9876)
 */

// ═══════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════

interface GodotCommand {
  type: 'load_scene' | 'set_variable' | 'pause' | 'resume' | 'trigger_event' | 'call_function';
  payload: Record<string, unknown>;
}

interface GodotState {
  scene: string;
  variables: Record<string, unknown>;
  paused: boolean;
  lastUpdate: number;
}

interface GodotWebSocketMessage {
  type: 'state' | 'event' | 'error' | 'command_response';
  data: Record<string, unknown>;
}

interface SceneComponent {
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

interface SceneDescription {
  sceneName: string;
  description: string;
  components: SceneComponent[];
  connections: Array<{ from: string; to: string; type: string }>;
}

// ═══════════════════════════════════════════════════════════════
// Godot WebSocket Client
// ═══════════════════════════════════════════════════════════════

class GodotWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Array<(msg: GodotWebSocketMessage) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to Godot WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log(`Connected to Godot at ${this.url}`);
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data.toString()) as GodotWebSocketMessage;
            this.notifyHandlers(message);
          } catch (error) {
            console.error('Failed to parse Godot message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from Godot');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect after disconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnect failed:', error);
        });
      }, 2000 * this.reconnectAttempts);
    }
  }

  /**
   * Send a command to Godot
   */
  sendCommand(command: GodotCommand): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(command));
  }

  /**
   * Register a message handler
   */
  onMessage(handler: (msg: GodotWebSocketMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Notify all registered handlers
   */
  private notifyHandlers(message: GodotWebSocketMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Handler error:', error);
      }
    }
  }

  /**
   * Disconnect from Godot
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ═══════════════════════════════════════════════════════════════
// Godot Service Interface (compatible with Theia backend service)
// ═══════════════════════════════════════════════════════════════

interface GodotService {
  isRunning(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getPort(): Promise<number>;
  getVersion(): Promise<string>;
  loadScene(scenePath: string): Promise<void>;
  setVariable(name: string, value: unknown): Promise<void>;
  callFunction(nodePath: string, functionName: string, args: unknown[]): Promise<unknown>;
}

/**
 * GodotService implementation using WebSocket
 */
class RemoteGodotService implements GodotService {
  private client: GodotWebSocketClient;
  private port: number;
  private version = '4.3.0';

  constructor(client: GodotWebSocketClient, port: number) {
    this.client = client;
    this.port = port;
  }

  async isRunning(): Promise<boolean> {
    return this.client.isConnected();
  }

  async start(): Promise<void> {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
  }

  async stop(): Promise<void> {
    this.client.disconnect();
  }

  async getPort(): Promise<number> {
    return this.port;
  }

  async getVersion(): Promise<string> {
    return this.version;
  }

  async loadScene(scenePath: string): Promise<void> {
    this.client.sendCommand({
      type: 'load_scene',
      payload: { scene_path: scenePath },
    });
  }

  async setVariable(name: string, value: unknown): Promise<void> {
    this.client.sendCommand({
      type: 'set_variable',
      payload: { name, value },
    });
  }

  async callFunction(nodePath: string, functionName: string, args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Function call timeout')), 5000);

      const handler = (msg: GodotWebSocketMessage) => {
        if (msg.type === 'command_response' && msg.data.function === functionName) {
          clearTimeout(timeout);
          resolve(msg.data.result);
        }
      };

      this.client.onMessage(handler);

      this.client.sendCommand({
        type: 'call_function',
        payload: { node_path: nodePath, function_name: functionName, args },
      });
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// AI + Godot Integration Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Use AI to describe a Godot scene
 */
async function describeSceneWithAI(scenePath: string): Promise<SceneDescription> {
  // This would call the AI service to analyze the scene
  // For now, return a mock description
  return {
    sceneName: scenePath.split('/').pop() || scenePath,
    description: 'A 3D scene with interactive elements',
    components: [
      { type: 'Node3D', name: 'Main', properties: {} },
      { type: 'Camera3D', name: 'Camera', properties: { position: [0, 5, 10] } },
      { type: 'MeshInstance3D', name: 'Cube', properties: { mesh: 'cube' } },
    ],
    connections: [],
  };
}

/**
 * Generate Godot scene from AI description
 */
async function generateSceneFromDescription(
  description: string,
  aiClient: any
): Promise<string> {
  const prompt = `
Generate a Godot 4.3 scene (.tscn) for: ${description}

Return only the scene file content, no explanation.
  `;

  const response = await aiClient.complete(prompt, 2000);
  return response;
}

/**
 * Generate component suggestions based on simulation goals
 */
async function generateComponentSuggestions(
  goal: string,
  aiClient: any
): Promise<string[]> {
  const prompt = `
Suggest 5 Godot nodes/components needed for: ${goal}

Return as a JSON array of component names.
  `;

  const response = await aiClient.complete(prompt, 500);

  try {
    const parsed = JSON.parse(response);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: extract component names from text
    return response.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .slice(0, 5);
  }
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Connect to Godot and check status
 */
async function exampleConnectToGodot() {
  console.log('\n=== Example 1: Connect to Godot ===\n');

  const wsUrl = process.env.GODOT_WS_URL || 'ws://localhost:9876';
  const client = new GodotWebSocketClient(wsUrl);

  try {
    await client.connect();
    console.log('Successfully connected to Godot');

    // Listen for state updates
    const unsubscribe = client.onMessage((msg) => {
      console.log('Received from Godot:', msg.type, msg.data);
    });

    // Keep connection open for a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    unsubscribe();
    client.disconnect();
  } catch (error) {
    console.log('Note: Could not connect to Godot. Make sure Godot is running with WebSocket support.');
    console.log('Error:', error);
  }
}

/**
 * Example 2: Load a scene and set variables
 */
async function exampleSceneControl() {
  console.log('\n=== Example 2: Scene Control ===\n');

  const wsUrl = process.env.GODOT_WS_URL || 'ws://localhost:9876';
  const client = new GodotWebSocketClient(wsUrl);

  try {
    await client.connect();

    const service = new RemoteGodotService(client, 9876);

    // Check if running
    const running = await service.isRunning();
    console.log('Godot running:', running);

    // Load a scene
    await service.loadScene('res://scenes/cognitive_mill.tscn');
    console.log('Scene loaded');

    // Set variables
    await service.setVariable('simulation_speed', 1.0);
    await service.setVariable('show_labels', true);
    console.log('Variables set');

    client.disconnect();
  } catch (error) {
    console.log('Note: Godot not available. This example requires a running Godot instance.');
  }
}

/**
 * Example 3: Generate scene with AI
 */
async function exampleAISceneGeneration() {
  console.log('\n=== Example 3: AI Scene Generation ===\n');

  const { createAIClient } = await import('@studylog/agents');
  const aiClient = createAIClient();

  const goal = 'A simple circuit simulator with a battery, switch, and LED';

  // Generate component suggestions
  console.log('Generating component suggestions...');
  const suggestions = await generateComponentSuggestions(goal, aiClient);
  console.log('Suggested components:', suggestions);

  // Generate scene description
  console.log('\nGenerating scene description...');
  const description = await describeSceneWithAI('circuit_simulator.tscn');
  console.log('Scene description:', description);
}

/**
 * Example 4: Interactive simulation with AI helper
 */
async function exampleInteractiveSimulation() {
  console.log('\n=== Example 4: Interactive AI + Godot ===\n');

  const { createAIClient } = await import('@studylog/agents');
  const aiClient = createAIClient();

  // AI explains the simulation while user interacts with Godot
  const questions = [
    'What happens when I close the switch?',
    'Why is the LED not lighting up?',
    'How do I calculate the current?',
  ];

  for (const question of questions) {
    console.log(`\nQuestion: ${question}`);
    const response = await aiClient.complete(
      `You are a helpful tutor for a circuit simulation. Answer: ${question}`,
      150
    );
    console.log(`Answer: ${response}`);
  }
}

/**
 * Example 5: State synchronization between AI and Godot
 */
async function exampleStateSync() {
  console.log('\n=== Example 5: State Synchronization ===\n');

  const wsUrl = process.env.GODOT_WS_URL || 'ws://localhost:9876';
  const client = new GodotWebSocketClient(wsUrl);

  // Track state
  const state: GodotState = {
    scene: '',
    variables: {},
    paused: false,
    lastUpdate: Date.now(),
  };

  try {
    await client.connect();

    // Listen for state updates
    client.onMessage((msg) => {
      if (msg.type === 'state') {
        Object.assign(state.variables, msg.data);
        state.lastUpdate = Date.now();
        console.log('State updated:', state.variables);
      }
    });

    // Send initial state
    client.sendCommand({
      type: 'set_variable',
      payload: { name: 'ai_connected', value: true },
    });

    // Simulate AI making changes to simulation
    setTimeout(() => {
      client.sendCommand({
        type: 'set_variable',
        payload: { name: 'simulation_speed', value: 2.0 },
      });
    }, 1000);

    await new Promise(resolve => setTimeout(resolve, 2000));
    client.disconnect();
  } catch (error) {
    console.log('Note: Godot not available for state sync example.');
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    connect: exampleConnectToGodot,
    control: exampleSceneControl,
    generate: exampleAISceneGeneration,
    interactive: exampleInteractiveSimulation,
    sync: exampleStateSync,
  };

  try {
    if (example === 'all') {
      await exampleConnectToGodot();
      await exampleAISceneGeneration();
      await exampleInteractiveSimulation();
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
  GodotWebSocketClient,
  RemoteGodotService,
  describeSceneWithAI,
  generateSceneFromDescription,
  generateComponentSuggestions,
  exampleConnectToGodot,
  exampleSceneControl,
  exampleAISceneGeneration,
  exampleInteractiveSimulation,
  exampleStateSync,
};
