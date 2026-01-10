/**
 * Batch Classification Example
 *
 * This example demonstrates how to classify multiple messages efficiently
 * using batch processing and parallel requests. It shows:
 * - Classifying intent for multiple messages
 * - Batch processing with parallel requests
 * - Rate limiting and concurrency control
 * - Result aggregation and formatting
 *
 * Run with:
 *   npx tsx examples/advanced/batch-classification.ts
 *
 * Prerequisites:
 *   - Backend workers must be running
 *   - Set API_URL environment variable (default: http://localhost:8787)
 */

// ═══════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════

type IntentType =
  | 'code_help'
  | 'concept_explanation'
  | 'debugging'
  | 'godot_help'
  | 'bazaar_share'
  | 'general_chat'
  | 'unknown';

interface ClassificationResult {
  message: string;
  intent: IntentType;
  confidence: number;
  reasoning?: string;
}

interface BatchClassificationOptions {
  concurrency?: number;
  model?: string;
  onProgress?: (completed: number, total: number) => void;
}

// ═══════════════════════════════════════════════════════════════
// Classification Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Classify a single message's intent
 */
async function classifyMessage(message: string, model = 'claude-3-5-haiku'): Promise<ClassificationResult> {
  const prompt = `Classify the intent of this user message. Respond with JSON only.

Message: "${message}"

Possible intents:
- code_help: User needs help writing or understanding code
- concept_explanation: User wants to learn about a concept
- debugging: User is troubleshooting an error
- godot_help: User needs help with Godot engine
- bazaar_share: User wants to share something to the community
- general_chat: Casual conversation
- unknown: Cannot determine

Respond with: {"intent": "...", "confidence": 0.0-1.0, "reasoning": "..."}`;

  try {
    const response = await fetch(`${process.env.API_URL || 'http://localhost:8787'}/api/v1/g-assist/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        model,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Classification failed: ${response.status}`);
    }

    const data = await response.json() as { content: string };
    const parsed = JSON.parse(data.content) as ClassificationResult;

    return {
      message,
      intent: parsed.intent,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    // Fallback classification
    return classifyMessageFallback(message);
  }
}

/**
 * Fallback rule-based classification
 */
function classifyMessageFallback(message: string): ClassificationResult {
  const lower = message.toLowerCase();

  // Pattern matching
  const patterns: Array<{ pattern: RegExp; intent: IntentType; confidence: number }> = [
    [/\b(code|function|variable|loop|array|object|class)\b/, 'code_help', 0.7],
    [/\b(error|bug|issue|not working|crash|exception)\b/, 'debugging', 0.8],
    [/\b(godot|scene|node|gdscript|tscn)\b/, 'godot_help', 0.9],
    [/\b(share|publish|upload|bazaar|community)\b/, 'bazaar_share', 0.8],
    [/\b(what is|explain|how does|tell me about|learn)\b/, 'concept_explanation', 0.7],
    [/\b(hi|hello|hey|thanks|thank you)\b/, 'general_chat', 0.9],
  ];

  for (const [pattern, intent, confidence] of patterns) {
    if (pattern.test(lower)) {
      return { message, intent, confidence };
    }
  }

  return { message, intent: 'unknown', confidence: 0.3 };
}

/**
 * Batch classify multiple messages with concurrency control
 */
async function batchClassify(
  messages: string[],
  options: BatchClassificationOptions = {}
): Promise<ClassificationResult[]> {
  const {
    concurrency = 5,
    model = 'claude-3-5-haiku',
    onProgress,
  } = options;

  const results: ClassificationResult[] = [];
  let completed = 0;

  // Process in batches
  for (let i = 0; i < messages.length; i += concurrency) {
    const batch = messages.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(msg => classifyMessage(msg, model))
    );

    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, messages.length);
  }

  return results;
}

/**
 * Parallel classify (no concurrency limit)
 */
async function parallelClassify(
  messages: string[],
  model = 'claude-3-5-haiku'
): Promise<ClassificationResult[]> {
  return Promise.all(
    messages.map(msg => classifyMessage(msg, model))
  );
}

/**
 * Sequential classify (one at a time)
 */
async function sequentialClassify(
  messages: string[],
  model = 'claude-3-5-haiku'
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  for (const message of messages) {
    const result = await classifyMessage(message, model);
    results.push(result);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Result Analysis
// ═══════════════════════════════════════════════════════════════

/**
 * Aggregate classification results
 */
function aggregateResults(results: ClassificationResult[]): {
  intentCounts: Record<IntentType, number>;
  averageConfidence: number;
  lowConfidence: ClassificationResult[];
} {
  const intentCounts: Record<string, number> = {};
  let totalConfidence = 0;
  const lowConfidence: ClassificationResult[] = [];

  for (const result of results) {
    intentCounts[result.intent] = (intentCounts[result.intent] || 0) + 1;
    totalConfidence += result.confidence;

    if (result.confidence < 0.5) {
      lowConfidence.push(result);
    }
  }

  return {
    intentCounts: intentCounts as Record<IntentType, number>,
    averageConfidence: totalConfidence / results.length,
    lowConfidence,
  };
}

/**
 * Format results for display
 */
function formatResults(results: ClassificationResult[]): void {
  console.log('\n=== Classification Results ===\n');

  for (const result of results) {
    const confidenceBar = '█'.repeat(Math.round(result.confidence * 10));
    console.log(`[${result.intent.padEnd(15)}] ${confidenceBar} ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`  "${result.message}"`);
    if (result.reasoning) {
      console.log(`  Reasoning: ${result.reasoning}`);
    }
    console.log();
  }
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Classify a single message
 */
async function exampleSingleClassification() {
  console.log('\n=== Example 1: Single Message Classification ===\n');

  const message = 'How do I create a loop in TypeScript?';
  console.log(`Message: "${message}"`);

  const result = await classifyMessage(message);

  console.log('\nResult:');
  console.log(`  Intent: ${result.intent}`);
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  if (result.reasoning) {
    console.log(`  Reasoning: ${result.reasoning}`);
  }
}

/**
 * Example 2: Batch classify multiple messages
 */
async function exampleBatchClassification() {
  console.log('\n=== Example 2: Batch Classification ===\n');

  const messages = [
    'What is a neural network?',
    'My code keeps throwing an error',
    'How do I add a mesh in Godot?',
    'I want to share my simulation',
    'Thanks for the help!',
    'undefined is not a function',
    'Explain the difference between let and const',
  ];

  console.log(`Classifying ${messages.length} messages...\n`);

  const results = await batchClassify(messages, {
    concurrency: 3,
    onProgress: (completed, total) => {
      process.stdout.write(`\rProgress: ${completed}/${total} (${((completed / total) * 100).toFixed(0)}%)`);
    },
  });

  console.log('\n');
  formatResults(results);

  const summary = aggregateResults(results);
  console.log('=== Summary ===');
  console.log(`Intent distribution:`, summary.intentCounts);
  console.log(`Average confidence: ${(summary.averageConfidence * 100).toFixed(1)}%`);
  console.log(`Low confidence items: ${summary.lowConfidence.length}`);
}

/**
 * Example 3: Compare batch vs sequential vs parallel
 */
async function exampleCompareStrategies() {
  console.log('\n=== Example 3: Strategy Comparison ===\n');

  const messages = [
    'Help with code',
    'Debug error',
    'Godot scene question',
    'Explain concept',
    'Share to bazaar',
  ];

  const strategies = [
    { name: 'Sequential', fn: () => sequentialClassify(messages) },
    { name: 'Batch (concurrency=3)', fn: () => batchClassify(messages, { concurrency: 3 }) },
    { name: 'Parallel', fn: () => parallelClassify(messages) },
  ];

  for (const strategy of strategies) {
    const start = Date.now();
    const results = await strategy.fn();
    const duration = Date.now() - start;

    console.log(`\n${strategy.name}:`);
    console.log(`  Time: ${duration}ms`);
    console.log(`  Results: ${results.length}`);
    console.log(`  Avg confidence: ${(results.reduce((a, b) => a + b.confidence, 0) / results.length * 100).toFixed(1)}%`);
  }
}

/**
 * Example 4: Classify conversation history
 */
async function exampleConversationClassification() {
  console.log('\n=== Example 4: Conversation Classification ===\n');

  const conversation = [
    'Hi there!',
    'I need help with my code',
    'How do I fix this error?',
    'undefined is not a function',
    'Oh, I see the issue now',
    'Thanks for your help!',
    'Can you explain how closures work?',
    'That makes sense',
    'I want to share my project',
  ];

  console.log('Classifying conversation flow...\n');

  const results = await batchClassify(conversation);

  // Show intent flow
  console.log('Intent Flow:');
  const flow = results.map(r => r.intent.split('_')[0]);
  console.log(`  ${flow.join(' → ')}\n`);

  // Show transition patterns
  console.log('Conversation Analysis:');
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1].intent;
    const curr = results[i].intent;
    console.log(`  ${prev} → ${curr}`);
  }
}

/**
 * Example 5: Route messages based on classification
 */
async function exampleRoutingByIntent() {
  console.log('\n=== Example 5: Intent-Based Routing ===\n');

  const messages = [
    'How do I create a for loop?',
    'My Godot scene won\'t load',
    'I want to publish my simulation',
    'What is a callback function?',
  ];

  // Route handlers
  const handlers: Record<IntentType, (msg: string) => void> = {
    code_help: (msg) => console.log(`[CODE ASSIST] Processing: "${msg}"`),
    concept_explanation: (msg) => console.log(`[TUTOR] Explaining: "${msg}"`),
    debugging: (msg) => console.log(`[DEBUGGER] Analyzing: "${msg}"`),
    godot_help: (msg) => console.log(`[GODOT ASSIST] Helping with: "${msg}"`),
    bazaar_share: (msg) => console.log(`[BAZAAR] Sharing: "${msg}"`),
    general_chat: (msg) => console.log(`[CHAT] Responding to: "${msg}"`),
    unknown: (msg) => console.log(`[DEFAULT] Handling: "${msg}"`),
  };

  const results = await batchClassify(messages);

  console.log('Routing messages to handlers:\n');
  for (const result of results) {
    handlers[result.intent]?.(result.message);
  }
}

/**
 * Example 6: Classify with confidence filtering
 */
async function exampleConfidenceFiltering() {
  console.log('\n=== Example 6: Confidence Filtering ===\n');

  const messages = [
    'Help me write a function',
    'asdfghjkl',  // Gibberish
    'What is AI?',
    '9+10',  // Too brief
    'Explain quantum computing',
  ];

  const results = await batchClassify(messages);
  const threshold = 0.5;

  console.log(`Confidence threshold: ${threshold * 100}%\n`);

  const highConfidence = results.filter(r => r.confidence >= threshold);
  const lowConfidence = results.filter(r => r.confidence < threshold);

  console.log('High Confidence (auto-process):');
  for (const r of highConfidence) {
    console.log(`  [${(r.confidence * 100).toFixed(0)}%] ${r.intent}: "${r.message}"`);
  }

  console.log('\nLow Confidence (manual review):');
  for (const r of lowConfidence) {
    console.log(`  [${(r.confidence * 100).toFixed(0)}%] ${r.intent}: "${r.message}"`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    single: exampleSingleClassification,
    batch: exampleBatchClassification,
    compare: exampleCompareStrategies,
    conversation: exampleConversationClassification,
    routing: exampleRoutingByIntent,
    filter: exampleConfidenceFiltering,
  };

  try {
    if (example === 'all') {
      await exampleSingleClassification();
      await exampleBatchClassification();
      await exampleRoutingByIntent();
      await exampleConfidenceFiltering();
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
  classifyMessage,
  batchClassify,
  parallelClassify,
  sequentialClassify,
  aggregateResults,
  formatResults,
  exampleSingleClassification,
  exampleBatchClassification,
  exampleCompareStrategies,
  exampleConversationClassification,
  exampleRoutingByIntent,
  exampleConfidenceFiltering,
};
