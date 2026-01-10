/**
 * Cost-Aware Chat Example
 *
 * This example demonstrates cost tracking and optimization when using
 * the multi-model router backend. It shows how to:
 * - Get cost estimates before making requests
 * - Track cumulative costs
 * - Choose models based on cost/quality tradeoffs
 * - Set cost budgets and limits
 *
 * Run with:
 *   npx tsx examples/quick-start/cost-aware-chat.ts
 *
 * Prerequisites:
 *   - Backend workers must be running
 *   - Set API_URL environment variable (default: http://localhost:8787)
 */

// ═══════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════

interface ModelInfo {
  name: string;
  provider: string;
  costPerInputToken: number;
  costPerOutputToken: number;
  maxTokens: number;
  quality: 'fast' | 'balanced' | 'premium';
}

interface CostEstimate {
  estimatedCost: number;
  inputTokens: number;
  estimatedOutputTokens: number;
  model: ModelInfo;
}

interface ChatResponseWithCost {
  content: string;
  model: string;
  provider: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
  };
  finishReason: string;
}

interface CostTrackingResponse {
  totalCost: number;
  totalRequests: number;
  costsByModel: Record<string, number>;
  costsByProvider: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// Model Pricing Data (as of 2025)
// ═══════════════════════════════════════════════════════════════

const MODELS: Record<string, ModelInfo> = {
  // Fast/Cheap models (good for simple tasks)
  'claude-3-5-haiku': {
    name: 'claude-3-5-haiku',
    provider: 'anthropic',
    costPerInputToken: 0.0000008,  // $0.80 per million
    costPerOutputToken: 0.000004,   // $4 per million
    maxTokens: 200000,
    quality: 'fast',
  },
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    provider: 'openai',
    costPerInputToken: 0.00000015,  // $0.15 per million
    costPerOutputToken: 0.0000006,   // $0.60 per million
    maxTokens: 128000,
    quality: 'fast',
  },
  'llama-3.3-70b': {
    name: 'llama-3.3-70b',
    provider: 'cloudflare',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 128000,
    quality: 'fast',
  },
  'llama3.2:3b': {
    name: 'llama3.2:3b',
    provider: 'ollama',
    costPerInputToken: 0,
    costPerOutputToken: 0,
    maxTokens: 131072,
    quality: 'fast',
  },

  // Balanced models
  'claude-3-5-sonnet': {
    name: 'claude-3-5-sonnet',
    provider: 'anthropic',
    costPerInputToken: 0.000003,     // $3 per million
    costPerOutputToken: 0.000015,    // $15 per million
    maxTokens: 200000,
    quality: 'balanced',
  },
  'gpt-4o': {
    name: 'gpt-4o',
    provider: 'openai',
    costPerInputToken: 0.0000025,    // $2.50 per million
    costPerOutputToken: 0.00001,     // $10 per million
    maxTokens: 128000,
    quality: 'balanced',
  },

  // Premium models (best quality)
  'claude-opus-4-5': {
    name: 'claude-opus-4-5',
    provider: 'anthropic',
    costPerInputToken: 0.000015,     // $15 per million
    costPerOutputToken: 0.000075,    // $75 per million
    maxTokens: 200000,
    quality: 'premium',
  },
  'o1': {
    name: 'o1',
    provider: 'openai',
    costPerInputToken: 0.000015,     // $15 per million
    costPerOutputToken: 0.00006,     // $60 per million
    maxTokens: 100000,
    quality: 'premium',
  },
};

// ═══════════════════════════════════════════════════════════════
// Cost Estimation Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate the number of tokens in a text string
 * Approximation: ~4 characters per token for English text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for a chat request
 */
function estimateCost(message: string, model: string, maxOutputTokens = 500): CostEstimate {
  const modelInfo = MODELS[model];
  if (!modelInfo) {
    throw new Error(`Unknown model: ${model}`);
  }

  const inputTokens = estimateTokens(message);
  const outputTokens = maxOutputTokens;

  const estimatedCost = (
    inputTokens * modelInfo.costPerInputToken +
    outputTokens * modelInfo.costPerOutputToken
  );

  return {
    estimatedCost,
    inputTokens,
    estimatedOutputTokens: outputTokens,
    model: modelInfo,
  };
}

/**
 * Find the cheapest model for a given quality level
 */
function findCheapestModel(quality: 'fast' | 'balanced' | 'premium'): ModelInfo {
  const candidates = Object.values(MODELS).filter(m => m.quality === quality);
  return candidates.sort((a, b) =>
    a.costPerInputToken + a.costPerOutputToken -
    b.costPerInputToken - b.costPerOutputToken
  )[0];
}

// ═══════════════════════════════════════════════════════════════
// API Client
// ═══════════════════════════════════════════════════════════════

const API_URL = process.env.API_URL || 'http://localhost:8787';

/**
 * Send chat request with cost tracking
 */
async function sendChatWithCost(
  message: string,
  model: string,
  budget?: number
): Promise<ChatResponseWithCost> {
  // Get cost estimate first
  const estimate = estimateCost(message, model);

  console.log(`\nCost Estimate for ${model}:`);
  console.log(`  Input: ~${estimate.inputTokens} tokens`);
  console.log(`  Output: ~${estimate.estimatedOutputTokens} tokens`);
  console.log(`  Est. Cost: $${estimate.estimatedCost.toFixed(6)}`);

  // Check budget
  if (budget !== undefined && estimate.estimatedCost > budget) {
    throw new Error(`Estimated cost ($${estimate.estimatedCost.toFixed(6)}) exceeds budget ($${budget.toFixed(6)})`);
  }

  // Send request
  const response = await fetch(`${API_URL}/api/v1/g-assist/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      model,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const data = await response.json() as ChatResponseWithCost;

  // Compare actual vs estimated
  console.log(`\nActual Cost:`);
  console.log(`  Input: ${data.tokens.input} tokens`);
  console.log(`  Output: ${data.tokens.output} tokens`);
  console.log(`  Cost: $${data.cost.toFixed(6)}`);

  return data;
}

/**
 * Get total cost tracking from backend
 */
async function getCostTracking(): Promise<CostTrackingResponse> {
  const response = await fetch(`${API_URL}/api/v1/costs/total`);
  if (!response.ok) {
    throw new Error(`Failed to get cost tracking: ${response.status}`);
  }
  return await response.json();
}

/**
 * Reset cost tracking
 */
async function resetCostTracking(): Promise<void> {
  await fetch(`${API_URL}/api/v1/costs/reset`, { method: 'POST' });
  console.log('Cost tracking reset');
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Compare costs across models
 */
async function exampleCompareModels() {
  console.log('\n=== Example 1: Compare Model Costs ===\n');

  const message = 'Explain what a transformer architecture is in AI.';

  for (const model of ['claude-3-5-haiku', 'claude-3-5-sonnet', 'claude-opus-4-5']) {
    console.log(`\n--- ${model} ---`);
    try {
      await sendChatWithCost(message, model);
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  }
}

/**
 * Example 2: Budget-constrained chat
 */
async function exampleBudgetConstrained() {
  console.log('\n=== Example 2: Budget Constrained Chat ===\n');

  const message = 'What is machine learning?';
  const budget = 0.0001; // $0.0001 max

  // Try with Haiku (should be under budget)
  try {
    console.log('\nTrying claude-3-5-haiku...');
    await sendChatWithCost(message, 'claude-3-5-haiku', budget);
  } catch (error) {
    console.log(`Error: ${error}`);
  }
}

/**
 * Example 3: Auto-select cheapest model for quality
 */
async function exampleAutoSelectModel() {
  console.log('\n=== Example 3: Auto-Select Cheapest Model ===\n');

  const quality = 'balanced' as const;
  const model = findCheapestModel(quality);

  console.log(`Cheapest ${quality} model: ${model.name} (${model.provider})`);
  console.log(`Cost per million tokens: Input $${(model.costPerInputToken * 1000000).toFixed(2)}, Output $${(model.costPerOutputToken * 1000000).toFixed(2)}`);

  const message = 'Explain backpropagation in simple terms.';
  await sendChatWithCost(message, model.name);
}

/**
 * Example 4: Cost tracking over multiple requests
 */
async function exampleCostTracking() {
  console.log('\n=== Example 4: Multi-Request Cost Tracking ===\n');

  // Reset first
  await resetCostTracking();

  const messages = [
    'What is AI?',
    'What is machine learning?',
    'What is deep learning?',
  ];

  const model = 'claude-3-5-haiku';
  let totalCost = 0;

  for (const msg of messages) {
    const response = await sendChatWithCost(msg, model);
    totalCost += response.cost;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total requests: ${messages.length}`);
  console.log(`Total cost: $${totalCost.toFixed(6)}`);

  // Get backend cost tracking
  try {
    const tracking = await getCostTracking();
    console.log('\nBackend cost tracking:');
    console.log(`  Total cost: $${tracking.totalCost.toFixed(6)}`);
    console.log(`  Total requests: ${tracking.totalRequests}`);
  } catch (error) {
    console.log('Backend cost tracking not available');
  }
}

/**
 * Example 5: Model quality vs cost tradeoff
 */
async function exampleQualityTradeoff() {
  console.log('\n=== Example 5: Quality vs Cost Tradeoff ===\n');

  const message = 'Write a short poem about artificial intelligence.';
  const results: Array<{ model: string; cost: number; content: string }> = [];

  for (const model of ['claude-3-5-haiku', 'claude-3-5-sonnet']) {
    try {
      const response = await sendChatWithCost(message, model);
      results.push({
        model,
        cost: response.cost,
        content: response.content.slice(0, 100) + '...',
      });
    } catch (error) {
      console.log(`Error with ${model}: ${error}`);
    }
  }

  console.log('\n=== Comparison ===');
  for (const r of results) {
    console.log(`\n${r.model}:`);
    console.log(`  Cost: $${r.cost.toFixed(6)}`);
    console.log(`  Preview: ${r.content}`);
  }
}

/**
 * Example 6: Cascade routing (cheap -> expensive on failure)
 */
async function exampleCascadeRouting() {
  console.log('\n=== Example 6: Cascade Routing ===\n');

  const cascade = ['llama-3.3-70b', 'claude-3-5-haiku', 'claude-3-5-sonnet'];
  const message = 'Explain the difference between supervised and unsupervised learning.';

  for (const model of cascade) {
    console.log(`\nTrying ${model}...`);
    try {
      const response = await sendChatWithCost(message, model);
      console.log(`Success with ${model}! Cost: $${response.cost.toFixed(6)}`);
      return; // Stop at first success
    } catch (error) {
      console.log(`Failed: ${error}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    compare: exampleCompareModels,
    budget: exampleBudgetConstrained,
    auto: exampleAutoSelectModel,
    tracking: exampleCostTracking,
    tradeoff: exampleQualityTradeoff,
    cascade: exampleCascadeRouting,
  };

  try {
    if (example === 'all') {
      await exampleAutoSelectModel();
      await exampleBudgetConstrained();
      await exampleQualityTradeoff();
      await exampleCostTracking();
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
  estimateCost,
  estimateTokens,
  findCheapestModel,
  sendChatWithCost,
  getCostTracking,
  resetCostTracking,
  MODELS,
};
