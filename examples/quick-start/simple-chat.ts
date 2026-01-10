/**
 * Simple Chat Example
 *
 * This example shows the most basic way to use the StudyLoG.AI agent system.
 * It demonstrates:
 * - Creating an AI client with different providers
 * - Setting up the agent orchestrator
 * - Having a simple conversation
 * - Handling agent responses
 *
 * Run with:
 *   npx tsx examples/quick-start/simple-chat.ts
 */

import { AIClient, createAIClient } from '@studylog/agents';

// ═══════════════════════════════════════════════════════════════
// Example 1: Using Cloudflare Workers AI (Free tier, default)
// ═══════════════════════════════════════════════════════════════

async function exampleCloudflareAI() {
  console.log('\n=== Example 1: Cloudflare Workers AI ===\n');

  // Create a Cloudflare AI client
  const client = new AIClient({
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    baseUrl: 'https://api.cloudflare.com/client/v4',
    apiKey: process.env.CLOUDFLARE_ACCOUNT_ID, // Your Cloudflare Account ID
  });

  // Check if the service is available
  const isAvailable = await client.isAvailable();
  console.log('Cloudflare AI available:', isAvailable);

  if (!isAvailable) {
    console.log('Cloudflare AI is not available. Check your API credentials.');
    return;
  }

  // Simple completion
  const response = await client.complete(
    'Explain what a neural network is in one sentence.',
    100
  );

  console.log('Response:', response);
}

// ═══════════════════════════════════════════════════════════════
// Example 2: Using Anthropic Claude (Premium, requires API key)
// ═══════════════════════════════════════════════════════════════

async function exampleAnthropic() {
  console.log('\n=== Example 2: Anthropic Claude ===\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('Skip: ANTHROPIC_API_KEY not set');
    return;
  }

  const client = new AIClient({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey,
  });

  const response = await client.chat({
    messages: [
      {
        role: 'system',
        content: 'You are a helpful AI tutor for students learning about AI.',
      },
      {
        role: 'user',
        content: 'What is the difference between a token and a vector?',
      },
    ],
    temperature: 0.7,
    maxTokens: 200,
  });

  console.log('Response:', response.content);
  console.log('Usage:', response.usage);
}

// ═══════════════════════════════════════════════════════════════
// Example 3: Using Ollama (Local, free)
// ═══════════════════════════════════════════════════════════════

async function exampleOllama() {
  console.log('\n=== Example 3: Ollama (Local) ===\n');

  const client = new AIClient({
    provider: 'ollama',
    model: 'llama3.2:3b',
    baseUrl: 'http://127.0.0.1:11434',
  });

  const isAvailable = await client.isAvailable();
  console.log('Ollama available:', isAvailable);

  if (!isAvailable) {
    console.log('Ollama is not running. Start it with: ollama serve');
    return;
  }

  const response = await client.chat({
    messages: [
      {
        role: 'user',
        content: 'List three key concepts in machine learning.',
      },
    ],
    temperature: 0.8,
    maxTokens: 150,
  });

  console.log('Response:', response.content);
  console.log('Usage:', response.usage);
}

// ═══════════════════════════════════════════════════════════════
// Example 4: Using the factory function with auto-selection
// ═══════════════════════════════════════════════════════════════

async function exampleFactoryFunction() {
  console.log('\n=== Example 4: Auto-select Provider ===\n');

  // Priority: Local Ollama > Anthropic > Cloudflare
  const client = createAIClient(
    process.env.PREFER_LOCAL === 'true',  // prefer local if available
    process.env.ANTHROPIC_API_KEY          // Anthropic key if using Anthropic
  );

  console.log('Created client with provider selection');

  const prompt = 'What is StudyLoG.AI?';
  const response = await client.complete(prompt, 100);

  console.log('Prompt:', prompt);
  console.log('Response:', response);
}

// ═══════════════════════════════════════════════════════════════
// Example 5: Multi-turn conversation
// ═══════════════════════════════════════════════════════════════

async function exampleConversation() {
  console.log('\n=== Example 5: Multi-turn Conversation ===\n');

  const client = createAIClient();

  const conversation = [
    { role: 'system' as const, content: 'You are a coding tutor.' },
    { role: 'user' as const, content: 'What is TypeScript?' },
  ];

  // First turn
  let response = await client.chat({ messages: conversation });
  console.log('Bot:', response.content);

  // Add response to conversation
  conversation.push({ role: 'assistant' as const, content: response.content });

  // Second turn
  conversation.push({ role: 'user' as const, content: 'How is it different from JavaScript?' });
  response = await client.chat({ messages: conversation });
  console.log('Bot:', response.content);
}

// ═══════════════════════════════════════════════════════════════
// Main runner with error handling
// ═══════════════════════════════════════════════════════════════

async function main() {
  try {
    await exampleCloudflareAI();
    await exampleAnthropic();
    await exampleOllama();
    await exampleFactoryFunction();
    await exampleConversation();

    console.log('\n=== All examples completed ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main();
}

export {
  exampleCloudflareAI,
  exampleAnthropic,
  exampleOllama,
  exampleFactoryFunction,
  exampleConversation,
};
