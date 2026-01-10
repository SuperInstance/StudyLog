/**
 * Voice Chat Example
 *
 * This example demonstrates voice-enabled chat using the backend API.
 * It shows how to:
 * - Convert speech to text (STT)
 * - Send the text to an AI model
 * - Convert the response back to speech (TTS)
 *
 * This uses the G-Assist API endpoints which integrate with the
 * multi-model router backend.
 *
 * Run with:
 *   npx tsx examples/quick-start/voice-chat.ts
 *
 * Prerequisites:
 *   - Backend workers must be running
 *   - Set G_ASSIST_API_URL environment variable (default: http://localhost:8787)
 */

interface STTRequest {
  audioData: string;  // base64 encoded audio
  language?: string;
}

interface STTResponse {
  success: boolean;
  text: string;
  confidence?: number;
}

interface ChatRequest {
  message: string;
  model?: string;
  temperature?: number;
}

interface ChatResponse {
  content: string;
  model: string;
  cost: number;
}

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

interface TTSResponse {
  success: boolean;
  audioData: string;  // base64 encoded audio
  format: string;
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const API_URL = process.env.G_ASSIST_API_URL || 'http://localhost:8787';

// ═══════════════════════════════════════════════════════════════
// API Client Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Convert speech to text using the STT endpoint
 */
async function speechToText(audioData: string, language = 'en-US'): Promise<string> {
  console.log('Sending audio to STT service...');

  const response = await fetch(`${API_URL}/api/v1/g-assist/stt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioData,
      language,
    } satisfies STTRequest),
  });

  if (!response.ok) {
    throw new Error(`STT request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as STTResponse;

  if (!data.success) {
    throw new Error('STT processing failed');
  }

  console.log(`Recognized text: "${data.text}" (confidence: ${data.confidence || 'N/A'})`);
  return data.text;
}

/**
 * Send text to chat API and get AI response
 */
async function sendChatMessage(
  message: string,
  model = 'claude-3-5-haiku'
): Promise<ChatResponse> {
  console.log(`Sending to AI (${model}): "${message}"`);

  const response = await fetch(`${API_URL}/api/v1/g-assist/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      model,
      temperature: 0.7,
    } satisfies ChatRequest),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ChatResponse;

  console.log(`AI response: "${data.content}"`);
  console.log(`Cost: $${data.cost.toFixed(6)}`);

  return data;
}

/**
 * Convert text to speech using the TTS endpoint
 */
async function textToSpeech(
  text: string,
  voice = 'default',
  speed = 1.0
): Promise<string> {
  console.log(`Converting to speech (${voice}, speed: ${speed})...`);

  const response = await fetch(`${API_URL}/api/v1/g-assist/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice,
      speed,
    } satisfies TTSRequest),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as TTSResponse;

  if (!data.success) {
    throw new Error('TTS processing failed');
  }

  console.log(`Received audio data (${data.format}, ${data.audioData.length} chars base64)`);
  return data.audioData;
}

/**
 * Save base64 audio data to a file
 */
function saveAudioFile(base64Audio: string, filename: string): void {
  const buffer = Buffer.from(base64Audio, 'base64');
  require('fs').writeFileSync(filename, buffer);
  console.log(`Saved audio to: ${filename}`);
}

// ═══════════════════════════════════════════════════════════════
// Example: Full Voice Chat Flow
// ═══════════════════════════════════════════════════════════════

/**
 * Simulated voice chat - uses text input but processes through the full pipeline
 */
async function exampleVoiceChat() {
  console.log('\n=== Voice Chat Example ===\n');

  try {
    // Step 1: Simulate receiving speech input (normally from microphone)
    // In a real app, you would use MediaRecorder API in the browser
    const userInput = 'What is a neural network?';
    console.log(`[Simulated Voice Input] "${userInput}"`);

    // Step 2: Send to chat API (skip STT since we're simulating)
    const chatResponse = await sendChatMessage(userInput);

    // Step 3: Convert AI response to speech
    const audioData = await textToSpeech(chatResponse.content, 'default', 1.0);

    // Step 4: Save audio file (optional)
    const outputFile = `/tmp/response-${Date.now()}.wav`;
    saveAudioFile(audioData, outputFile);

    console.log('\n=== Voice Chat Complete ===\n');
    console.log(`Input: ${userInput}`);
    console.log(`Output: ${chatResponse.content}`);
    console.log(`Audio saved to: ${outputFile}`);

  } catch (error) {
    console.error('Voice chat error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// Example: Using STT with actual audio
// ═══════════════════════════════════════════════════════════════

/**
 * Example using the STT endpoint with actual audio data
 */
async function exampleSpeechToText(audioFilePath: string) {
  console.log('\n=== Speech to Text Example ===\n');

  try {
    // Read audio file and convert to base64
    const fs = require('fs');
    const audioBuffer = fs.readFileSync(audioFilePath);
    const base64Audio = audioBuffer.toString('base64');

    // Send to STT service
    const text = await speechToText(base64Audio, 'en-US');

    console.log(`\nTranscribed: "${text}"`);
    return text;

  } catch (error) {
    console.error('STT error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// Example: Batch TTS processing
// ═══════════════════════════════════════════════════════════════

/**
 * Convert multiple text strings to audio
 */
async function exampleBatchTTS() {
  console.log('\n=== Batch TTS Example ===\n');

  const messages = [
    'Welcome to StudyLoG.AI',
    'Let me explain how neural networks work',
    'First, we have the input layer',
  ];

  const audioFiles: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    console.log(`\nProcessing ${i + 1}/${messages.length}...`);

    const audioData = await textToSpeech(messages[i]);
    const filename = `/tmp/tts-${i}-${Date.now()}.wav`;
    saveAudioFile(audioData, filename);
    audioFiles.push(filename);
  }

  console.log('\n=== Batch TTS Complete ===');
  console.log(`Generated ${audioFiles.length} audio files`);

  return audioFiles;
}

// ═══════════════════════════════════════════════════════════════
// Example: Browser-compatible voice chat (for reference)
// ═══════════════════════════════════════════════════════════════

/**
 * This is a reference implementation for browser-based voice chat.
 * In a real browser environment, you would use:
 * - MediaRecorder API for recording audio
 * - WebSocket for real-time communication
 * - Web Audio API for playback
 *
 * See examples/frontend/vanilla-js.html for a complete browser example.
 */
function browserVoiceChatExample() {
  console.log('\n=== Browser Voice Chat Reference ===\n');
  console.log(`
// Browser-side voice chat implementation:

// 1. Record audio from microphone
const mediaRecorder = new MediaRecorder(stream);
const audioChunks: Blob[] = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

// 2. Convert to base64 and send to STT
const audioBlob = new Blob(audioChunks);
const audioData = await blobToBase64(audioBlob);
const text = await speechToText(audioData);

// 3. Get AI response
const response = await sendChatMessage(text);

// 4. Convert response to speech
const responseAudio = await textToSpeech(response.content);

// 5. Play audio
const audioBuffer = await decodeBase64Audio(responseAudio);
playAudio(audioBuffer);
  `);
}

// ═══════════════════════════════════════════════════════════════
// Main runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'chat';

  try {
    switch (command) {
      case 'chat':
        await exampleVoiceChat();
        break;
      case 'stt':
        if (args[1]) {
          await exampleSpeechToText(args[1]);
        } else {
          console.error('Usage: voice-chat.ts stt <audio-file-path>');
        }
        break;
      case 'batch-tts':
        await exampleBatchTTS();
        break;
      case 'browser-ref':
        browserVoiceChatExample();
        break;
      default:
        console.log(`
Usage:
  voice-chat.ts chat       - Run simulated voice chat
  voice-chat.ts stt <file> - Transcribe audio file
  voice-chat.ts batch-tts  - Generate multiple TTS files
  voice-chat.ts browser-ref- Show browser implementation reference
        `);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main();
}

export {
  speechToText,
  sendChatMessage,
  textToSpeech,
  saveAudioFile,
  exampleVoiceChat,
  exampleSpeechToText,
  exampleBatchTTS,
};
