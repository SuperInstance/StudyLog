/**
 * Conversation Management Example
 *
 * This example demonstrates full conversation lifecycle management
 * including creating, loading, updating, and persisting conversations.
 * It shows:
 * - Creating new conversations with metadata
 * - Managing conversation history
 * - Branching conversations for exploration
 * - Exporting and importing conversations
 * - Persisting to storage (D1)
 *
 * Run with:
 *   npx tsx examples/advanced/conversation-management.ts
 */

import { AIClient, createAIClient } from '@studylog/agents';
import type { Message, AgentContext } from '@studylog/agents';

// ═══════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════

interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  phase: 'player' | 'reader' | 'tweaker' | 'creator' | 'mentor';
  tags: string[];
  pinned: boolean;
}

interface ConversationBranch {
  id: string;
  parentId: string | null;
  fromMessageId: string;
  title: string;
  createdAt: number;
}

interface Conversation {
  metadata: ConversationMetadata;
  messages: Message[];
  branches: ConversationBranch[];
}

interface ConversationStorage {
  save(conversation: Conversation): Promise<void>;
  load(id: string): Promise<Conversation | null>;
  list(): Promise<ConversationMetadata[]>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<ConversationMetadata[]>;
}

// ═══════════════════════════════════════════════════════════════
// In-Memory Storage Implementation
// ═══════════════════════════════════════════════════════════════

class MemoryConversationStorage implements ConversationStorage {
  private conversations: Map<string, Conversation> = new Map();

  async save(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.metadata.id, conversation);
  }

  async load(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) || null;
  }

  async list(): Promise<ConversationMetadata[]> {
    return Array.from(this.conversations.values())
      .map(c => c.metadata)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    this.conversations.delete(id);
  }

  async search(query: string): Promise<ConversationMetadata[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.conversations.values())
      .filter(c =>
        c.metadata.title.toLowerCase().includes(lowerQuery) ||
        c.metadata.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
        c.messages.some(m => m.content.toLowerCase().includes(lowerQuery))
      )
      .map(c => c.metadata);
  }
}

// ═══════════════════════════════════════════════════════════════
// Conversation Manager
// ═══════════════════════════════════════════════════════════════

class ConversationManager {
  private storage: ConversationStorage;
  private currentConversation: Conversation | null = null;
  private aiClient: AIClient;

  constructor(storage: ConversationStorage, aiClient: AIClient) {
    this.storage = storage;
    this.aiClient = aiClient;
  }

  /**
   * Create a new conversation
   */
  async create(options: {
    title: string;
    module: ConversationMetadata['module'];
    phase?: ConversationMetadata['phase'];
    tags?: string[];
  }): Promise<Conversation> {
    const conversation: Conversation = {
      metadata: {
        id: crypto.randomUUID(),
        title: options.title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        module: options.module,
        phase: options.phase || 'player',
        tags: options.tags || [],
        pinned: false,
      },
      messages: [],
      branches: [],
    };

    await this.storage.save(conversation);
    this.currentConversation = conversation;

    return conversation;
  }

  /**
   * Load an existing conversation
   */
  async load(id: string): Promise<Conversation | null> {
    const conversation = await this.storage.load(id);
    if (conversation) {
      this.currentConversation = conversation;
    }
    return conversation;
  }

  /**
   * Add a message to the current conversation
   */
  async addMessage(
    role: Message['role'],
    content: string,
    agentId?: string
  ): Promise<Message> {
    if (!this.currentConversation) {
      throw new Error('No active conversation. Call create() or load() first.');
    }

    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      agentId,
      timestamp: Date.now(),
    };

    this.currentConversation.messages.push(message);
    this.currentConversation.metadata.updatedAt = Date.now();

    await this.storage.save(this.currentConversation);

    return message;
  }

  /**
   * Get conversation history as AI context
   */
  getHistory(limit?: number): Message[] {
    if (!this.currentConversation) {
      return [];
    }

    const messages = this.currentConversation.messages;
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * Create a branch from a specific message
   */
  async createBranch(
    fromMessageId: string,
    title: string
  ): Promise<Conversation> {
    if (!this.currentConversation) {
      throw new Error('No active conversation');
    }

    // Find the message index
    const messageIndex = this.currentConversation.messages.findIndex(
      m => m.id === fromMessageId
    );

    if (messageIndex === -1) {
      throw new Error('Message not found');
    }

    // Create new conversation with messages up to branch point
    const branch: Conversation = {
      metadata: {
        id: crypto.randomUUID(),
        title: title || `Branch: ${this.currentConversation.metadata.title}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        module: this.currentConversation.metadata.module,
        phase: this.currentConversation.metadata.phase,
        tags: [...this.currentConversation.metadata.tags, 'branch'],
        pinned: false,
      },
      messages: this.currentConversation.messages.slice(0, messageIndex + 1),
      branches: [],
    };

    // Add branch reference to parent
    this.currentConversation.branches.push({
      id: branch.metadata.id,
      parentId: this.currentConversation.metadata.id,
      fromMessageId,
      title,
      createdAt: Date.now(),
    });

    await this.storage.save(this.currentConversation);
    await this.storage.save(branch);

    this.currentConversation = branch;

    return branch;
  }

  /**
   * Send a message and get AI response
   */
  async chat(userMessage: string): Promise<string> {
    if (!this.currentConversation) {
      throw new Error('No active conversation');
    }

    // Add user message
    await this.addMessage('user', userMessage);

    // Build AI context
    const context: AgentContext = {
      module: this.currentConversation.metadata.module,
      stage: 1,
      phase: this.currentConversation.metadata.phase,
      conversationHistory: this.getHistory(10),
      agentState: {},
    };

    // Get AI response
    const response = await this.aiClient.chat({
      messages: context.conversationHistory.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: 0.7,
      maxTokens: 500,
    });

    // Add assistant message
    await this.addMessage('assistant', response.content);

    return response.content;
  }

  /**
   * Regenerate the last assistant message
   */
  async regenerateLast(): Promise<string> {
    if (!this.currentConversation) {
      throw new Error('No active conversation');
    }

    const messages = this.currentConversation.messages;
    const lastIndex = messages.findLastIndex(m => m.role === 'assistant');

    if (lastIndex === -1) {
      throw new Error('No assistant messages to regenerate');
    }

    // Remove the last assistant message
    messages.splice(lastIndex, 1);

    // Get the last user message and resend
    const lastUserMessage = messages.findLast(m => m.role === 'user');
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    return this.chat(lastUserMessage.content);
  }

  /**
   * List all conversations
   */
  async list(): Promise<ConversationMetadata[]> {
    return this.storage.list();
  }

  /**
   * Search conversations
   */
  async search(query: string): Promise<ConversationMetadata[]> {
    return this.storage.search(query);
  }

  /**
   * Delete current conversation
   */
  async delete(): Promise<void> {
    if (!this.currentConversation) {
      return;
    }

    await this.storage.delete(this.currentConversation.metadata.id);
    this.currentConversation = null;
  }

  /**
   * Export conversation as JSON
   */
  export(): string {
    if (!this.currentConversation) {
      throw new Error('No active conversation');
    }

    return JSON.stringify(this.currentConversation, null, 2);
  }

  /**
   * Import conversation from JSON
   */
  async import(json: string): Promise<Conversation> {
    const conversation = JSON.parse(json) as Conversation;

    // Generate new ID for imported conversation
    conversation.metadata.id = crypto.randomUUID();
    conversation.metadata.createdAt = Date.now();
    conversation.metadata.updatedAt = Date.now();

    await this.storage.save(conversation);
    this.currentConversation = conversation;

    return conversation;
  }

  /**
   * Update conversation metadata
   */
  async updateMetadata(updates: Partial<Omit<ConversationMetadata, 'id' | 'createdAt'>>): Promise<void> {
    if (!this.currentConversation) {
      throw new Error('No active conversation');
    }

    Object.assign(this.currentConversation.metadata, updates);
    this.currentConversation.metadata.updatedAt = Date.now();

    await this.storage.save(this.currentConversation);
  }

  /**
   * Get current conversation
   */
  getCurrent(): Conversation | null {
    return this.currentConversation;
  }
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Create and manage a conversation
 */
async function exampleCreateConversation() {
  console.log('\n=== Example 1: Create Conversation ===\n');

  const storage = new MemoryConversationStorage();
  const aiClient = createAIClient();
  const manager = new ConversationManager(storage, aiClient);

  // Create a new conversation
  const conversation = await manager.create({
    title: 'Learning about Neural Networks',
    module: 'cognitive-mill',
    phase: 'player',
    tags: ['AI', 'machine-learning', 'beginner'],
  });

  console.log(`Created conversation: ${conversation.metadata.id}`);
  console.log(`Title: ${conversation.metadata.title}`);
  console.log(`Tags: ${conversation.metadata.tags.join(', ')}`);

  // Add some messages
  await manager.addMessage('user', 'What is a neural network?');
  await manager.addMessage('assistant', 'A neural network is a computational model inspired by the human brain...');

  console.log(`\nMessages: ${conversation.messages.length}`);
}

/**
 * Example 2: Chat with history tracking
 */
async function exampleChatWithHistory() {
  console.log('\n=== Example 2: Chat with History ===\n');

  const storage = new MemoryConversationStorage();
  const aiClient = createAIClient();
  const manager = new ConversationManager(storage, aiClient);

  await manager.create({
    title: 'Coding Tutorial',
    module: 'cognitive-mill',
    phase: 'player',
  });

  // Simulated chat (since we might not have actual AI available)
  const questions = [
    'What is a variable?',
    'How do I declare one in TypeScript?',
    'What about constants?',
  ];

  for (const question of questions) {
    console.log(`\nUser: ${question}`);

    // Add user message
    await manager.addMessage('user', question);

    // Simulated AI response
    const response = `[Simulated response to: ${question}]`;
    console.log(`Assistant: ${response}`);

    await manager.addMessage('assistant', response);
  }

  // Show history
  const history = manager.getHistory();
  console.log(`\n\nTotal messages in history: ${history.length}`);

  for (const msg of history) {
    console.log(`  [${msg.role}] ${msg.content.slice(0, 50)}...`);
  }
}

/**
 * Example 3: Branch a conversation
 */
async function exampleBranchConversation() {
  console.log('\n=== Example 3: Branch Conversation ===\n');

  const storage = new MemoryConversationStorage();
  const aiClient = createAIClient();
  const manager = new ConversationManager(storage, aiClient);

  // Create original conversation
  await manager.create({
    title: 'Circuit Tutorial',
    module: 'cognitive-mill',
    phase: 'player',
  });

  await manager.addMessage('user', 'How do I build a simple circuit?');
  await manager.addMessage('assistant', 'Start with a battery, LED, and resistor...');

  const originalId = manager.getCurrent()!.metadata.id;
  console.log(`Original conversation: ${originalId}`);

  // Get the messages before branching
  const messagesBefore = [...manager.getHistory()];

  // Continue conversation
  await manager.addMessage('user', 'What about with a switch?');
  await manager.addMessage('assistant', 'Add a switch in series with the LED...');

  // Create branch from earlier point
  const branch = await manager.createBranch(
    messagesBefore[1].id, // Branch after first assistant message
    'Circuit with Capacitor'
  );

  console.log(`\nBranch created: ${branch.metadata.id}`);
  console.log(`Branch messages: ${branch.messages.length}`);
  console.log(`Original branches: ${manager.getCurrent()?.branches.length || 0}`);
}

/**
 * Example 4: List and search conversations
 */
async function exampleListAndSearch() {
  console.log('\n=== Example 4: List and Search ===\n');

  const storage = new MemoryConversationStorage();
  const aiClient = createAIClient();
  const manager = new ConversationManager(storage, aiClient);

  // Create multiple conversations
  await manager.create({
    title: 'Python Basics',
    module: 'cognitive-mill',
    tags: ['python', 'programming'],
  });

  await manager.create({
    title: 'Godot 3D Tutorial',
    module: 'cognitive-mill',
    tags: ['godot', '3d', 'game-dev'],
  });

  await manager.create({
    title: 'Machine Learning Intro',
    module: 'intelligence-ranch',
    tags: ['AI', 'ML'],
  });

  // List all
  const all = await manager.list();
  console.log('\nAll conversations:');
  for (const conv of all) {
    console.log(`  - ${conv.title} (${conv.module}) [${conv.tags.join(', ')}]`);
  }

  // Search
  const results = await manager.search('godot');
  console.log(`\nSearch for "godot":`);
  for (const conv of results) {
    console.log(`  - ${conv.title}`);
  }
}

/**
 * Example 5: Export and import
 */
async function exampleExportImport() {
  console.log('\n=== Example 5: Export and Import ===\n');

  const storage = new MemoryConversationStorage();
  const aiClient = createAIClient();
  const manager = new ConversationManager(storage, aiClient);

  await manager.create({
    title: 'Export Test',
    module: 'cognitive-mill',
  });

  await manager.addMessage('user', 'Hello!');
  await manager.addMessage('assistant', 'Hi there!');

  // Export
  const exported = manager.export();
  console.log('Exported conversation:');
  console.log(exported.slice(0, 200) + '...');

  // Import into new manager
  const newStorage = new MemoryConversationStorage();
  const newManager = new ConversationManager(newStorage, aiClient);

  await newManager.import(exported);
  console.log(`\nImported conversation: ${newManager.getCurrent()?.metadata.title}`);
  console.log(`Messages: ${newManager.getHistory().length}`);
}

/**
 * Example 6: Full conversation lifecycle
 */
async function exampleFullLifecycle() {
  console.log('\n=== Example 6: Full Lifecycle ===\n');

  const storage = new MemoryConversationStorage();
  const aiClient = createAIClient();
  const manager = new ConversationManager(storage, aiClient);

  // 1. Create
  console.log('1. Creating conversation...');
  await manager.create({
    title: 'My Learning Journey',
    module: 'cognitive-mill',
    phase: 'player',
    tags: ['learning'],
  });

  // 2. Add messages
  console.log('2. Adding messages...');
  await manager.addMessage('user', 'I want to learn about recursion');
  await manager.addMessage('assistant', 'Recursion is when a function calls itself...');

  // 3. Update metadata
  console.log('3. Updating metadata...');
  await manager.updateMetadata({
    title: 'My Learning Journey - Recursion',
    tags: ['learning', 'recursion', 'algorithms'],
  });

  // 4. Create branch
  console.log('4. Creating branch...');
  const messages = manager.getHistory();
  await manager.createBranch(messages[0].id, 'Alternative explanation');

  // 5. List all
  console.log('5. Listing all conversations...');
  const all = await manager.list();
  console.log(`Total conversations: ${all.length}`);

  // 6. Search
  console.log('6. Searching...');
  const searchResults = await manager.search('recursion');
  console.log(`Found ${searchResults.length} conversations`);

  // 7. Export
  console.log('7. Exporting...');
  const exported = manager.export();

  // 8. Delete
  console.log('8. Deleting...');
  await manager.delete();
  console.log(`Current conversation after delete: ${manager.getCurrent() ? 'exists' : 'null'}`);

  // 9. Import back
  console.log('9. Importing from export...');
  await manager.import(exported);
  console.log(`Restored: ${manager.getCurrent()?.metadata.title}`);
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    create: exampleCreateConversation,
    chat: exampleChatWithHistory,
    branch: exampleBranchConversation,
    list: exampleListAndSearch,
    export: exampleExportImport,
    lifecycle: exampleFullLifecycle,
  };

  try {
    if (example === 'all') {
      await exampleCreateConversation();
      await exampleChatWithHistory();
      await exampleBranchConversation();
      await exampleListAndSearch();
      await exampleExportImport();
      await exampleFullLifecycle();
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
  ConversationManager,
  MemoryConversationStorage,
  Conversation,
  ConversationMetadata,
  exampleCreateConversation,
  exampleChatWithHistory,
  exampleBranchConversation,
  exampleListAndSearch,
  exampleExportImport,
  exampleFullLifecycle,
};
