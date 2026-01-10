/**
 * Streaming Responses Example
 *
 * This example demonstrates how to stream AI responses token-by-token
 * for a more responsive user experience. It shows:
 * - Using Server-Sent Events (SSE) for streaming
 * - Processing streaming chunks
 * - Displaying partial responses
 * - Handling stream interruptions
 *
 * Run with:
 *   npx tsx examples/advanced/streaming-responses.ts
 *
 * Prerequisites:
 *   - Backend workers must be running
 *   - Set API_URL environment variable (default: http://localhost:8787)
 */

// ═══════════════════════════════════════════════════════════════
// Types and Interfaces
// ═══════════════════════════════════════════════════════════════

interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  error?: string;
  finishReason?: string;
}

interface StreamOptions {
  onToken?: (token: string) => void;
  onDone?: (finishReason: string) => void;
  onError?: (error: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// Streaming Client
// ═══════════════════════════════════════════════════════════════

const API_URL = process.env.API_URL || 'http://localhost:8787';

/**
 * Send a chat request with streaming response
 */
async function streamChat(
  message: string,
  model: string,
  options: StreamOptions = {}
): Promise<string> {
  const response = await fetch(`${API_URL}/api/v1/g-assist/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      model,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const decoder = new TextDecoder();
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6); // Remove 'data: ' prefix

        if (data === '[DONE]') {
          options.onDone?.('completed');
          break;
        }

        try {
          const parsed = JSON.parse(data) as StreamChunk;

          switch (parsed.type) {
            case 'token':
              if (parsed.content) {
                fullContent += parsed.content;
                options.onToken?.(parsed.content);
              }
              break;

            case 'done':
              options.onDone?.(parsed.finishReason || 'completed');
              break;

            case 'error':
              options.onError?.(parsed.error || 'Unknown error');
              break;
          }
        } catch (parseError) {
          // Ignore JSON parse errors for incomplete chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

/**
 * Simulated streaming (for when backend doesn't support streaming)
 */
async function streamChatSimulated(
  message: string,
  model: string,
  options: StreamOptions = {}
): Promise<string> {
  console.log(`[Simulated Stream] Sending to ${model}: ${message}`);

  // Simulate a response
  const fullResponse = `This is a simulated streaming response from ${model}. In a real implementation, tokens would arrive one at a time as they're generated, providing a more responsive user experience.`;

  // Simulate token-by-token delivery
  const tokens = fullResponse.split(' ');

  for (const token of tokens) {
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
    options.onToken?.(token + ' ');
  }

  options.onDone?.('completed');

  return fullResponse;
}

// ═══════════════════════════════════════════════════════════════
// UI Helpers for Streaming
// ═══════════════════════════════════════════════════════════════

/**
 * Create a simple progress indicator for streaming
 */
class StreamProgress {
  private interval: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  start(message = 'Receiving'): void {
    process.stdout.write(`\r${message} ${this.frames[0]}`);
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      process.stdout.write(`\r${message} ${this.frames[this.frameIndex]}`);
    }, 100);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }
}

/**
 * Display streaming tokens with a typewriter effect
 */
async function typewriterDisplay(
  text: string,
  delay = 30
): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Basic streaming
 */
async function exampleBasicStreaming() {
  console.log('\n=== Example 1: Basic Streaming ===\n');

  let buffer = '';

  const fullResponse = await streamChatSimulated(
    'Explain what a neural network is',
    'claude-3-5-haiku',
    {
      onToken: (token) => {
        buffer += token;
        process.stdout.write(token);
      },
      onDone: (reason) => {
        console.log(`\n\nStream completed: ${reason}`);
      },
      onError: (error) => {
        console.error(`Stream error: ${error}`);
      },
    }
  );

  console.log(`\nFull response length: ${fullResponse.length} characters`);
}

/**
 * Example 2: Streaming with progress indicator
 */
async function exampleStreamingWithProgress() {
  console.log('\n=== Example 2: Streaming with Progress ===\n');

  const progress = new StreamProgress();
  let tokenCount = 0;
  const responseParts: string[] = [];

  progress.start('Thinking');

  await streamChatSimulated(
    'What are the benefits of streaming responses?',
    'claude-3-5-haiku',
    {
      onToken: (token) => {
        tokenCount++;
        responseParts.push(token);
        progress.stop();
        process.stdout.write(token);
        progress.start('Streaming');
      },
      onDone: () => {
        progress.stop();
        console.log(`\n\nReceived ${tokenCount} tokens`);
      },
    }
  );
}

/**
 * Example 3: Streaming with buffering for display
 */
async function exampleStreamingWithBuffer() {
  console.log('\n=== Example 3: Streaming with Buffer ===\n');

  const buffer: string[] = [];
  const displayThreshold = 5; // Display after every 5 tokens

  const fullResponse = await streamChatSimulated(
    'Tell me a short story about AI',
    'claude-3-5-haiku',
    {
      onToken: (token) => {
        buffer.push(token);

        if (buffer.length >= displayThreshold) {
          process.stdout.write(buffer.join(''));
          buffer.length = 0; // Clear buffer
        }
      },
      onDone: () => {
        // Display remaining tokens
        if (buffer.length > 0) {
          process.stdout.write(buffer.join(''));
        }
        console.log('\n\nStory complete!');
      },
    }
  );
}

/**
 * Example 4: Multi-model streaming comparison
 */
async function exampleMultiModelStream() {
  console.log('\n=== Example 4: Multi-Model Streaming Comparison ===\n');

  const models = ['claude-3-5-haiku', 'gpt-4o-mini', 'llama-3.3-70b'];
  const message = 'What is TypeScript?';

  for (const model of models) {
    console.log(`\n--- ${model} ---`);

    const startTime = Date.now();
    let firstTokenTime: number | null = null;

    await streamChatSimulated(message, model, {
      onToken: () => {
        if (firstTokenTime === null) {
          firstTokenTime = Date.now();
          const ttft = firstTokenTime - startTime;
          console.log(`[Time to first token: ${ttft}ms]`);
        }
      },
      onDone: () => {
        const totalTime = Date.now() - startTime;
        console.log(`[Total time: ${totalTime}ms]`);
      },
    });
  }
}

/**
 * Example 5: Streaming with token counting
 */
async function exampleStreamingWithMetrics() {
  console.log('\n=== Example 5: Streaming with Metrics ===\n');

  const metrics = {
    tokenCount: 0,
    charCount: 0,
    startTime: Date.now(),
    firstTokenTime: 0 as number | null,
    endTime: 0 as number | null,
  };

  const fullResponse = await streamChatSimulated(
    'Explain recursion in programming',
    'claude-3-5-haiku',
    {
      onToken: (token) => {
        metrics.tokenCount++;
        metrics.charCount += token.length;

        if (metrics.firstTokenTime === null) {
          metrics.firstTokenTime = Date.now();
        }
      },
      onDone: () => {
        metrics.endTime = Date.now();

        console.log('\n\n=== Metrics ===');
        console.log(`Total tokens: ${metrics.tokenCount}`);
        console.log(`Total characters: ${metrics.charCount}`);
        console.log(`Time to first token: ${metrics.firstTokenTime! - metrics.startTime}ms`);
        console.log(`Total time: ${metrics.endTime! - metrics.startTime}ms`);
        console.log(`Tokens/second: ${(metrics.tokenCount / ((metrics.endTime! - metrics.startTime) / 1000)).toFixed(2)}`);
      },
    }
  );
}

/**
 * Example 6: Handling stream interruptions
 */
async function exampleStreamInterruption() {
  console.log('\n=== Example 6: Stream Interruption Handling ===\n');

  let aborted = false;

  // Simulate a stream that might be interrupted
  const controller = new AbortController();

  const streamPromise = streamChatSimulated(
    'Explain quantum computing',
    'claude-3-5-haiku',
    {
      onToken: (token) => {
        process.stdout.write(token);

        // Simulate interruption after 3 tokens
        if (!aborted && Math.random() > 0.7) {
          aborted = true;
          controller.abort();
          console.log('\n\n[Stream interrupted by user]');
        }
      },
      onError: (error) => {
        console.log(`\nError: ${error}`);
      },
    }
  );

  await streamPromise;
}

/**
 * Example 7: Server-Sent Events (SSE) client
 */
async function exampleSSEClient() {
  console.log('\n=== Example 7: SSE Client ===\n');

  console.log(`
Server-Sent Events (SSE) Format:

data: {"type":"token","content":"Hello"}
data: {"type":"token","content":" there"}
data: {"type":"token","content":"!"}
data: {"type":"done","finishReason":"completed"}

Implementation notes:
- Use EventSource for browser clients
- Use fetch with ReadableStream for Node.js
- Each line starts with "data: "
- End stream with "data: [DONE]"
- Handle reconnection with Last-Event-ID header
  `);

  // Simulated SSE stream processing
  const simulatedSSEStream = [
    'data: {"type":"token","content":"Streaming"}',
    'data: {"type":"token","content":" responses"}',
    'data: {"type":"token","content":" allow"}',
    'data: {"type":"token","content":" real-time"}',
    'data: {"type":"token","content":" feedback"}',
    'data: {"type":"done","finishReason":"completed"}',
  ];

  console.log('\nProcessing simulated SSE stream:');

  for (const line of simulatedSSEStream) {
    await new Promise(resolve => setTimeout(resolve, 200));

    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        console.log('[Stream complete]');
        break;
      }

      try {
        const parsed = JSON.parse(data) as StreamChunk;
        if (parsed.type === 'token' && parsed.content) {
          process.stdout.write(parsed.content + ' ');
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  console.log('\n');
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    basic: exampleBasicStreaming,
    progress: exampleStreamingWithProgress,
    buffer: exampleStreamingWithBuffer,
    multi: exampleMultiModelStream,
    metrics: exampleStreamingWithMetrics,
    interrupt: exampleStreamInterruption,
    sse: exampleSSEClient,
  };

  try {
    if (example === 'all') {
      await exampleBasicStreaming();
      await exampleStreamingWithProgress();
      await exampleStreamingWithMetrics();
      await exampleSSEClient();
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
  streamChat,
  streamChatSimulated,
  StreamProgress,
  typewriterDisplay,
  exampleBasicStreaming,
  exampleStreamingWithProgress,
  exampleStreamingWithBuffer,
  exampleMultiModelStream,
  exampleStreamingWithMetrics,
  exampleStreamInterruption,
  exampleSSEClient,
};
