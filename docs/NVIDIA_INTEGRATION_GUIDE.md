# NVIDIA Integration Guide for StudyLoG.AI

## Overview

This guide provides detailed instructions for integrating NVIDIA technologies into the StudyLoG.AI educational platform, including ACE (Avatar Cloud Engine), Maxine, Audio2Face, Riva, and NIM (NVIDIA Inference Microservices).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [NVIDIA ACE Integration](#nvidia-ace-integration)
3. [NVIDIA Maxine Integration](#nvidia-maxine-integration)
4. [Audio2Face Integration](#audio2face-integration)
5. [NVIDIA Riva Integration](#nvidia-riva-integration)
6. [NVIDIA NIM Integration](#nvidia-nim-integration)
7. [Pricing & API Endpoints](#pricing--api-endpoints)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### NVIDIA Account Setup

1. **Create NVIDIA NGC Account**
   - Visit https://catalog.ngc.nvidia.com/
   - Sign up for a free account
   - Generate API key from https://org.ngc.nvidia.com/setup/api-key

2. **Required API Keys**

| Service | API Key Endpoint | Purpose |
|---------|------------------|---------|
| NGC Catalog | https://org.ngc.nvidia.com/setup/api-key | Base authentication |
| ACE | https://api.nvcf.nvidia.com/v2/nvcf/publish/v2 | Avatar animation |
| Audio2Face | https://api.nvcf.nvidia.com/v2/nvcf/publish/v2 | Face animation from audio |
| Riva | https://auth.nvidia.com/token | Speech AI services |
| NIM | https://build.nvidia.com/explore/discover | LLM microservices |

### Environment Variables

```bash
# NVIDIA API Keys
export NVIDIA_API_KEY="nvapi-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export NGC_API_KEY="your-ngc-api-key"

# Service Endpoints
export NVIDIA_ACE_ENDPOINT="https://api.nvcf.nvidia.com/v2/nvcf/publish/v2"
export NVIDIA_RIVA_ENDPOINT="https://riva.api.nvidia.com/v1"
export NVIDIA_NIM_ENDPOINT="https://integrate.api.nvidia.com/v1"

# For local NIM deployment
export LOCAL_NIM_ENDPOINT="http://localhost:8000"
export LOCAL_NIM_MODEL="meta/llama-3.1-8b-instruct"
```

---

## NVIDIA ACE Integration

### What is NVIDIA ACE?

ACE (Avatar Cloud Engine) provides technologies for creating intelligent, interactive game characters and digital humans. For StudyLoG.AI, we use ACE to create conversational digital tutors.

### Key ACE Components

| Component | Purpose | StudyLoG Use Case |
|-----------|---------|-------------------|
| Riva Speech | Speech recognition and synthesis | Voice conversations |
| Nemotron-3 | Large language model | Tutor reasoning |
| Animation Graph | Character animation system | Expressive gestures |
| Audio2Face | Audio-driven facial animation | Lip-sync and expressions |

### Setup Guide

#### 1. Install ACE SDK

```bash
# Download ACE SDK from NGC
# https://catalog.ngc.nvidia.com/orgs/nvidia/teams/ace/containers/ace-agent

# Pull the ACE Agent container
docker pull nvcr.io/nvidia/ace-agent:latest

# Run ACE Agent
docker run --gpus all -p 8080:8080 \
  -e NVIDIA_API_KEY=$NVIDIA_API_KEY \
  nvcr.io/nvidia/ace-agent:latest
```

#### 2. Configure ACE Agent

Create `ace-config.json`:

```json
{
  "avatar": {
    "name": "studylog_tutor_v1",
    "model_path": "models/avatars/studylog_tutor.usd",
    "blendshapes": ["ARKit", "Eyes"],
    "languages": ["en-US", "es-ES", "fr-FR"]
  },
  "speech": {
    "stt_model": "riva:stt:en-US",
    "tts_model": "riva:tts:emma",
    "sample_rate": 16000
  },
  "llm": {
    "model": "nemotron-3-8b",
    "temperature": 0.7,
    "max_tokens": 2048,
    "system_prompt": "You are a helpful STEM tutor for StudyLoG.AI. Explain concepts clearly and encourage student curiosity."
  },
  "animation": {
    "gesture_style": "educational",
    "idle_animations": ["idle_01", "idle_02"],
    "talking_animations": ["talk_01", "talk_02"]
  }
}
```

#### 3. TypeScript Client Implementation

```typescript
// src/modules/ace-client.ts
import { WebSocket } from 'ws';

interface ACEMessage {
  type: 'animation' | 'audio' | 'text' | 'emotion';
  timestamp: number;
  data: unknown;
}

interface ACEConfig {
  endpoint: string;
  apiKey: string;
  avatar: string;
}

export class ACEClient {
  private ws: WebSocket | null = null;
  private config: ACEConfig;
  private messageHandlers: Map<string, (data: unknown) => void>;

  constructor(config: ACEConfig) {
    this.config = config;
    this.messageHandlers = new Map();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.endpoint.replace('http', 'ws')}/avatar/${this.config.avatar}`;
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        console.log('ACE WebSocket connected');
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('ACE WebSocket error:', error);
        reject(error);
      });

      this.ws.on('message', (data) => {
        try {
          const message: ACEMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (e) {
          console.error('Failed to parse ACE message:', e);
        }
      });
    });
  }

  on(event: string, handler: (data: unknown) => void): void {
    this.messageHandlers.set(event, handler);
  }

  private handleMessage(message: ACEMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }

  async sendAudio(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('ACE WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'audio',
      format: 'wav',
      sample_rate: 16000,
      data: Array.from(new Uint8Array(audioBuffer)),
    }));
  }

  async setEmotion(emotion: 'happy' | 'thoughtful' | 'concerned' | 'excited'): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('ACE WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'emotion',
      emotion,
      blend_duration: 0.3,
    }));
  }

  async triggerGesture(gesture: 'wave' | 'point' | 'explain' | 'encourage'): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('ACE WebSocket not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'gesture',
      gesture,
    }));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

#### 4. Theia Integration

```typescript
// src/browser/ace-avatar-widget.tsx
import React from 'react';
import { ACEClient } from '../modules/ace-client';

export const ACEAvatarWidget: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const aceClientRef = React.useRef<ACEClient | null>(null);

  React.useEffect(() => {
    const aceClient = new ACEClient({
      endpoint: process.env.NVIDIA_ACE_ENDPOINT || '',
      apiKey: process.env.NVIDIA_API_KEY || '',
      avatar: 'studylog_tutor_v1',
    });

    aceClient.connect().then(() => {
      aceClientRef.current = aceClient;

      // Set up animation handlers
      aceClient.on('animation', (data) => {
        renderAnimationToCanvas(data);
      });
    });

    return () => {
      aceClient.disconnect();
    };
  }, []);

  const renderAnimationToCanvas = (data: unknown) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render avatar animation frame
    // This would integrate with Godot rendering context
  };

  return (
    <div className="ace-avatar-container">
      <canvas ref={canvasRef} width={640} height={480} />
      <div className="avatar-controls">
        <button onClick={() => aceClientRef.current?.setEmotion('happy')}>
          Happy
        </button>
        <button onClick={() => aceClientRef.current?.setEmotion('thoughtful')}>
          Thoughtful
        </button>
        <button onClick={() => aceClientRef.current?.triggerGesture('encourage')}>
          Encourage
        </button>
      </div>
    </div>
  );
};
```

---

## NVIDIA Maxine Integration

### What is NVIDIA Maxine?

Maxine is a suite of GPU-accelerated AI SDKs for video conferencing and streaming, including:
- **Eye Contact** - Gaze correction
- **Live Portrait** - Background segmentation
- **Studio Voice** - Audio enhancement

### Setup Guide

#### 1. Install Maxine SDK

```bash
# Clone Maxine repositories
git clone https://github.com/NVIDIA-Maxine/maxine-asr.git
git clone https://github.com/NVIDIA-Maxine/maxine-tts.git
git clone https://github.com/NVIDIA-Maxine/maxine-eye-contact.git

# For WebRTC integration
npm install @nvidia/maxine-webrtc
```

#### 2. Eye Contact Implementation

```typescript
// src/modules/maxine-eye-contact.ts
export class MaxineEyeContact {
  private processor: any;
  private videoElement: HTMLVideoElement;

  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
  }

  async initialize(config: {
    gazeTarget?: 'camera' | 'screen';
    smoothingFactor?: number;
  } = {}): Promise<void> {
    // Load Maxine Eye Contact WebAssembly module
    const module = await import('@nvidia/maxine-webrtc/eye-contact');

    this.processor = await module.EyeContactProcessor.create({
      gazeTarget: config.gazeTarget || 'camera',
      smoothingFactor: config.smoothingFactor || 0.7,
    });

    await this.processor.initialize();
  }

  async processFrame(): Promise<ImageData> {
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(this.videoElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Apply eye contact correction
    const corrected = await this.processor.process(imageData);
    return corrected;
  }

  async startStream(
    callback: (frame: ImageData) => void
  ): Promise<void> {
    const processLoop = async () => {
      const frame = await this.processFrame();
      callback(frame);
      requestAnimationFrame(processLoop);
    };

    processLoop();
  }

  stop(): void {
    if (this.processor) {
      this.processor.dispose();
    }
  }
}
```

#### 3. Live Portrait (Background Replacement)

```typescript
// src/modules/maxine-portrait.ts
export class MaxineLivePortrait {
  private segmenter: any;

  async initialize(): Promise<void> {
    const module = await import('@nvidia/maxine-webrtc/portrait');

    this.segmenter = await module.PortraitSegmenter.create({
      model: 'segformer', // or 'unet'
      device: 'gpu',
    });

    await this.segmenter.loadModel();
  }

  async replaceBackground(
    videoFrame: ImageData,
    background: string | ImageData
  ): Promise<ImageData> {
    const mask = await this.segmenter.segment(videoFrame);

    // Apply background
    const result = new ImageData(
      videoFrame.width,
      videoFrame.height
    );

    const bgData = typeof background === 'string'
      ? await this.loadBackgroundImage(background)
      : background;

    for (let i = 0; i < mask.data.length; i++) {
      const isForeground = mask.data[i] > 128;
      const pixelIndex = i * 4;

      if (isForeground) {
        result.data[pixelIndex] = videoFrame.data[pixelIndex];
        result.data[pixelIndex + 1] = videoFrame.data[pixelIndex + 1];
        result.data[pixelIndex + 2] = videoFrame.data[pixelIndex + 2];
        result.data[pixelIndex + 3] = 255;
      } else {
        result.data[pixelIndex] = bgData.data[pixelIndex];
        result.data[pixelIndex + 1] = bgData.data[pixelIndex + 1];
        result.data[pixelIndex + 2] = bgData.data[pixelIndex + 2];
        result.data[pixelIndex + 3] = 255;
      }
    }

    return result;
  }

  private async loadBackgroundImage(src: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = reject;
      img.src = src;
    });
  }
}
```

#### 4. Studio Voice (Audio Enhancement)

```typescript
// src/modules/maxine-voice.ts
export class MaxineStudioVoice {
  private enhancer: any;

  async initialize(): Promise<void> {
    const module = await import('@nvidia/maxine-webrtc/studio-voice');

    this.enhancer = await module.StudioVoice.create({
      noiseSuppression: true,
      echoCancellation: true,
      autoGain: true,
    });

    await this.enhancer.initialize();
  }

  async enhanceStream(audioStream: MediaStream): Promise<MediaStream> {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(audioStream);
    const destination = context.createMediaStreamDestination();

    const processor = context.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = async (e) => {
      const inputBuffer = e.inputBuffer.getChannelData(0);
      const enhanced = await this.enhancer.process(inputBuffer);

      const outputBuffer = e.outputBuffer;
      outputBuffer.getChannelData(0).set(enhanced);
    };

    source.connect(processor);
    processor.connect(destination);

    return destination.stream;
  }

  dispose(): void {
    if (this.enhancer) {
      this.enhancer.dispose();
    }
  }
}
```

---

## Audio2Face Integration

### What is Audio2Face?

Audio2Face is NVIDIA's AI-powered solution for generating facial animations from audio input. It analyzes speech to create realistic lip-sync and expressions.

### Setup Guide

#### 1. Audio2Face WebSocket Connection

```typescript
// src/modules/audio2face-client.ts
export interface BlendShape {
  name: string;
  value: number;
}

export interface Audio2FaceFrame {
  timestamp: number;
  blendshapes: BlendShape[];
}

export class Audio2FaceClient {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private apiKey: string;
  private avatar: string;

  constructor(config: {
    endpoint?: string;
    apiKey: string;
    avatar: string;
  }) {
    this.endpoint = config.endpoint || 'wss://api.nvcf.nvidia.com/v2/a2f';
    this.apiKey = config.apiKey;
    this.avatar = config.avatar;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${this.endpoint}/${this.avatar}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      this.ws.onopen = () => {
        // Initialize session
        this.ws?.send(JSON.stringify({
          type: 'init',
          blendshape_set: 'ARKit',
          features: ['lip_sync', 'expression'],
        }));
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }

  async streamAudio(
    audioData: Float32Array,
    onFrame: (frame: Audio2FaceFrame) => void
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Audio2Face not connected');
    }

    this.ws.onmessage = (event) => {
      const frame: Audio2FaceFrame = JSON.parse(event.data);
      onFrame(frame);
    };

    // Convert to required format and send
    this.ws.send(JSON.stringify({
      type: 'audio',
      data: Array.from(audioData),
      sample_rate: 16000,
      format: 'f32_le',
    }));
  }

  async setMood(mood: 'neutral' | 'happy' | 'sad' | 'excited'): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Audio2Face not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'mood',
      value: mood,
    }));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

#### 2. Godot Integration

```gdscript
# Audio2FaceReceiver.gd - Godot node that receives blendshape data
extends MeshInstance3D

signal blendshapes_updated(blendshapes: Dictionary)

var _ws: WebSocketPeer = WebSocketPeer.new()
var _blendshape_dict: Dictionary = {}

# ARKit blendshape names (52 total)
const ARKIT_BLENDSHAPES = [
	"eyeBlinkLeft", "eyeLookDownLeft", "eyeLookInLeft", "eyeLookOutLeft", "eyeLookUpLeft",
	"eyeSquintLeft", "eyeWideLeft", "eyeBlinkRight", "eyeLookDownRight", "eyeLookInRight",
	"eyeLookOutRight", "eyeLookUpRight", "eyeSquintRight", "eyeWideRight", "jawForward",
	"jawLeft", "jawOpen", "jawRight", "mouthClose", "mouthDimpleLeft",
	"mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight", "mouthFunnel", "mouthLeft",
	"mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight", "mouthPucker",
	"mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
	"mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft",
	"mouthUpperUpRight", "noseSneerLeft", "noseSneerRight", "cheekPuff", "cheekSquintLeft",
	"cheekSquintRight", "tongueOut", "browDownLeft", "browDownRight", "browInnerUp",
	"browOuterUpLeft", "browOuterUpRight"
]

func _ready() -> void:
	var error = _ws.connect_to_url("ws://localhost:8080/a2f")
	if error != OK:
		push_error("Failed to connect to Audio2Face: %s" % error)

func _process(delta: float) -> void:
	_ws.poll()
	var state: WebSocketPeer.State = _ws.get_ready_state()

	if state == WebSocketPeer.STATE_OPEN:
		_process_messages()

func _process_messages() -> void:
	while _ws.get_available_packet_count() > 0:
		var packet: PackedByteArray = _ws.get_packet()
		var json_string: String = packet.get_string_from_utf8()
		var json: JSON = JSON.new()

		var parse_error = json.parse(json_string)
		if parse_error == OK:
			_apply_blendshapes(json.data)
		else:
			push_error("Failed to parse Audio2Face data")

func _apply_blendshapes(data: Dictionary) -> void:
	if data.has("blendshapes"):
		_blendshape_dict = data.blendshapes
		blendshapes_updated.emit(_blendshape_dict)

		# Apply to blendshape driver (if available)
		if has_method("set_blend_shape_value"):
			for shape_name: String in _blendshape_dict:
				var shape_idx: int = find_blend_shape_by_name(shape_name)
				if shape_idx >= 0:
					set_blend_shape_value(shape_idx, _blendshape_dict[shape_name])

func get_current_blendshapes() -> Dictionary:
	return _blendshape_dict.duplicate()
```

---

## NVIDIA Riva Integration

### What is NVIDIA Riva?

Riva is a GPU-accelerated SDK for building speech AI applications, including:
- **Automatic Speech Recognition (ASR)** - 26+ languages
- **Text-to-Speech (TTS)** - Natural voice synthesis
- **Translation** - Real-time language translation

### Setup Guide

#### 1. Riva API Client

```typescript
// src/modules/riva-client.ts
export interface RivaConfig {
  endpoint: string;
  apiKey: string;
  languageCode: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class RivaClient {
  private config: RivaConfig;

  constructor(config: RivaConfig) {
    this.config = config;
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<TranscriptionResult> {
    const response = await fetch(`${this.config.endpoint}/v1/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      throw new Error(`Riva transcription failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      text: result.text,
      confidence: result.confidence,
      words: result.words || [],
    };
  }

  async synthesize(
    text: string,
    voice?: string
  ): Promise<ArrayBuffer> {
    const response = await fetch(`${this.config.endpoint}/v1/synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: voice || 'english-us-female-1',
        language_code: this.config.languageCode,
        sample_rate: 22050,
      }),
    });

    if (!response.ok) {
      throw new Error(`Riva synthesis failed: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }

  async translate(
    text: string,
    targetLanguage: string
  ): Promise<{ text: string; detectedLanguage?: string }> {
    const response = await fetch(`${this.config.endpoint}/v1/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        source_language_code: this.config.languageCode,
        target_language_code: targetLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Riva translation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // Streaming transcription for real-time input
  async *streamTranscribe(audioStream: ReadableStream): AsyncGenerator<TranscriptionResult> {
    const reader = audioStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const result = await this.transcribe(value);
      yield result;
    }
  }
}
```

#### 2. Cloudflare Worker Integration

```typescript
// workers/riva-service/src/index.ts
import { RivaClient } from './riva-client';

export interface Env {
  RIVA_ENDPOINT: string;
  RIVA_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/transcribe' && request.method === 'POST') {
      return await handleTranscribe(request, env);
    }

    if (path === '/synthesize' && request.method === 'POST') {
      return await handleSynthesize(request, env);
    }

    if (path === '/translate' && request.method === 'POST') {
      return await handleTranslate(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleTranscribe(request: Request, env: Env): Promise<Response> {
  const audioBuffer = await request.arrayBuffer();
  const language = request.headers.get('X-Language') || 'en-US';

  const riva = new RivaClient({
    endpoint: env.RIVA_ENDPOINT,
    apiKey: env.RIVA_API_KEY,
    languageCode: language,
  });

  try {
    const result = await riva.transcribe(audioBuffer);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleSynthesize(request: Request, env: Env): Promise<Response> {
  const { text, voice } = await request.json();
  const language = request.headers.get('X-Language') || 'en-US';

  const riva = new RivaClient({
    endpoint: env.RIVA_ENDPOINT,
    apiKey: env.RIVA_API_KEY,
    languageCode: language,
  });

  try {
    const audioBuffer = await riva.synthesize(text, voice);
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleTranslate(request: Request, env: Env): Promise<Response> {
  const { text, targetLanguage } = await request.json();
  const sourceLanguage = request.headers.get('X-Language') || 'en-US';

  const riva = new RivaClient({
    endpoint: env.RIVA_ENDPOINT,
    apiKey: env.RIVA_API_KEY,
    languageCode: sourceLanguage,
  });

  try {
    const result = await riva.translate(text, targetLanguage);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

## NVIDIA NIM Integration

### What is NVIDIA NIM?

NVIDIA NIM (NVIDIA Inference Microservices) provides containerized inference for running LLMs efficiently. It supports:
- **Llama 3.1/3.2** - Meta's open models
- **Nemotron-3** - NVIDIA's instruction-tuned models
- **Mistral** - Mistral AI models
- **Mixtral** - Mixture of Experts models

### Setup Guide

#### 1. Local NIM Deployment

```bash
# Pull and run NIM container
docker run -d --name llama-nim \
  --gpus all \
  -p 8000:8000 \
  -e NGC_API_KEY=$NGC_API_KEY \
  nvcr.io/nim/meta/llama-3.1-8b-instruct:latest

# Or with Docker Compose
version: '3.8'
services:
  nim:
    image: nvcr.io/nim/meta/llama-3.1-8b-instruct:latest
    ports:
      - "8000:8000"
    environment:
      - NGC_API_KEY=${NGC_API_KEY}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

#### 2. NIM API Client

```typescript
// src/modules/nim-client.ts
export interface NIMConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export class NIMClient {
  private config: NIMConfig;

  constructor(config: NIMConfig) {
    this.config = config;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        top_p: options?.topP ?? 0.9,
        stream: options?.stream ?? false,
      }),
    });

    if (!response.ok) {
      throw new Error(`NIM request failed: ${response.statusText}`);
    }

    if (options?.stream) {
      return this.streamResponse(response.body!);
    }

    return await response.json();
  }

  private async *streamResponse(body: ReadableStream): AsyncGenerator<any> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  // StudyLoG.AI specific methods
  async generateStudyNotes(topic: string, difficulty: string): Promise<string> {
    const response = await this.chat([
      {
        role: 'system',
        content: `You are an expert educator who creates clear, structured study notes for ${difficulty} level students. Organize content with headings, bullet points, and examples.`,
      },
      {
        role: 'user',
        content: `Create study notes for: ${topic}`,
      },
    ]);

    return response.choices[0].message.content;
  }

  async generateQuiz(topic: string, questionCount: number): Promise<Quiz> {
    const response = await this.chat([
      {
        role: 'system',
        content: 'You generate educational quiz questions with correct answers and explanations.',
      },
      {
        role: 'user',
        content: `Generate ${questionCount} multiple choice questions about ${topic}. Return as JSON with format: { "questions": [{ "question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..." } ] }`,
      },
    ]);

    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse quiz JSON');
  }

  async explainError(
    code: string,
    language: string,
    error: string
  ): Promise<string> {
    const response = await this.chat([
      {
        role: 'system',
        content: `You are a helpful programming tutor who explains errors clearly for ${language} developers.`,
      },
      {
        role: 'user',
        content: `Explain this error and suggest a fix:\n\nLanguage: ${language}\nError: ${error}\n\nCode:\n${code}`,
      },
    ]);

    return response.choices[0].message.content;
  }
}

interface Quiz {
  questions: Array<{
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }>;
}
```

#### 3. Cloudflare Worker with NIM Fallback

```typescript
// workers/hybrid-llm/src/index.ts
import { NIMClient } from './nim-client';

export interface Env {
  // Local NIM endpoint (if available)
  LOCAL_NIM_ENDPOINT?: string;
  // Cloudflare Workers AI
  AI: Ai;
  // Cache for responses
  KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { messages } = await request.json();

    // Try local NIM first (for RTX AI PCs)
    if (env.LOCAL_NIM_ENDPOINT) {
      try {
        const nim = new NIMClient({
          endpoint: env.LOCAL_NIM_ENDPOINT,
          model: 'meta/llama-3.1-8b-instruct',
        });

        const response = await nim.chat(messages);
        return Response.json(response);
      } catch (error) {
        console.warn('Local NIM unavailable, falling back to Workers AI:', error);
      }
    }

    // Fallback to Cloudflare Workers AI
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
    });

    return Response.json(response);
  },
};
```

---

## Pricing & API Endpoints

### NVIDIA Services Pricing

| Service | Pricing Model | Cost (as of 2025) | Notes |
|---------|--------------|-------------------|-------|
| **ACE Agent** | Per character | $0.0002/1K chars | For animation |
| **Audio2Face** | Per request | $0.001 per session | WebSocket session |
| **Riva ASR** | Per hour | $0.05/hour | Speech recognition |
| **Riva TTS** | Per character | $0.0001/1K chars | Text-to-speech |
| **NIM (Cloud)** | Per token | $0.0001/1K tokens | Llama 3.1 8B |
| **NIM (Local)** | Free (hardware) | $0 | Self-hosted |
| **Maxine** | Per minute | $0.005/minute | Video processing |

### API Endpoints

| Service | Endpoint | Protocol |
|---------|----------|----------|
| ACE | `wss://api.nvcf.nvidia.com/v2/nvcf/publish/v2/ace` | WebSocket |
| Audio2Face | `wss://api.nvcf.nvidia.com/v2/nvcf/publish/v2/a2f` | WebSocket |
| Riva | `https://riva.api.nvidia.com/v1` | HTTPS |
| NIM Cloud | `https://integrate.api.nvidia.com/v1` | HTTPS |
| NIM Local | `http://localhost:8000/v1` | HTTP |

---

## Troubleshooting

### Common Issues

#### Issue: "Invalid API Key"

```
Solution: Ensure your API key is correctly set in environment variables
and has the proper permissions for the service you're accessing.
```

#### Issue: "WebSocket Connection Failed"

```
Solution: Check if:
1. The endpoint URL is correct
2. Your network allows WebSocket connections
3. The service is currently available (check NVIDIA status page)
```

#### Issue: "Audio2Face Returns No Blendshapes"

```
Solution: Ensure:
1. Audio format is correct (16kHz, mono, WAV)
2. Audio buffer has sufficient data
3. Avatar model is properly loaded
```

#### Issue: "NIM Response Timeout"

```
Solution:
1. Check GPU availability with `nvidia-smi`
2. Verify NIM container is running
3. Check container logs: `docker logs <container-name>`
4. For local NIM, ensure sufficient VRAM
```

### Debug Mode

```typescript
// Enable debug logging
const DEBUG = true;

function logDebug(category: string, message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[NVIDIA:${category}]`, message, data || '');
  }
}

// In production, send to error tracking service
function logError(category: string, error: Error) {
  console.error(`[NVIDIA:${category}] ERROR:`, error.message);
  // Sentry.captureException(error);
}
```

---

## Related Documentation

- [Educational Stack Architecture](./EDUCATIONAL_STACK_ARCHITECTURE.md) - Overall system design
- [Edge AI Deployment](./EDGE_AI_DEPLOYMENT.md) - RTX PC deployment
- [NVIDIA Official Docs](https://docs.nvidia.com/) - Official NVIDIA documentation
- [NGC Catalog](https://catalog.ngc.nvidia.com/) - Available containers and models

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Maintained By:** SuperInstance.AI
