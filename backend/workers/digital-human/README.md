# Digital Human Worker

NVIDIA Digital Human integration for StudyLoG.AI, providing ACE Agent SDK, Maxine AR SDK, and Audio2Face NIM microservice support.

## Overview

This worker enables StudyLoG.AI to create realistic digital humans (avatars) that can:

- **Converse naturally** using NVIDIA ACE Agent SDK
- **Display realistic facial expressions** with Audio2Face
- **Maintain eye contact** with Maxine Eye Contact
- **Animate from a single image** with Live Portrait
- **Enhance voice quality** with Studio Voice

## Features

### ACE (Avatar Cloud Engine)

- Multi-personality agents (Tutor, Captain, Teacher, Builder)
- Natural language conversation with context awareness
- Text-to-speech with multiple voice models
- Emotion-aware responses
- Session management and conversation history

### Maxine AR SDK

- **Eye Contact**: Gaze correction for video calls and presentations
- **Live Portrait**: Audio-driven animation from a single image
- **Studio Voice**: AI-powered noise reduction and voice enhancement

### Audio2Face

- Real-time facial animation from audio
- WebSocket-based streaming
- Lip-sync with blend shape output
- Emotion control
- Head motion simulation

## Installation

```bash
npm install @studylog/digital-human-worker
```

## Usage

### ACE Agent Client

```typescript
import { ACEClient, createDefaultAgentConfig } from '@studylog/digital-human-worker/ace';

// Create client
const ace = new ACEClient({
  apiKey: process.env.NVIDIA_API_KEY,
});

// Register an agent
ace.registerAgent(createDefaultAgentConfig('tutor-1', 'tutor'));

// Create a session
const sessionId = ace.createSession('tutor-1', 'user-123');

// Interact with the agent
const response = await ace.interact({
  agentId: 'tutor-1',
  input: 'Explain how neural networks learn',
  sessionId,
  enableAnimation: true,
  enableAudio: true,
});

console.log(response.text);
console.log(response.audioUrl);
console.log(response.blendShapes);
```

### Maxine Client

```typescript
import { MaxineClient } from '@studylog/digital-human-worker/maxine';

// Create client
const maxine = new MaxineClient({
  apiKey: process.env.NVIDIA_API_KEY,
});

// Enable eye contact on a video stream
const result = await maxine.enableEyeContact({
  input: videoStream,
  config: {
    mode: 'auto',
    strength: 0.7,
  },
});

videoElement.srcObject = result.output;

// Animate a portrait from audio
const animation = await maxine.animatePortrait({
  portraitImage: '/path/to/portrait.jpg',
  drivingAudio: audioBuffer,
  config: {
    style: 'realistic',
    enableEmotion: true,
  },
});

videoElement.src = animation.videoUrl;

// Enhance audio quality
const enhanced = await maxine.enhanceAudio({
  audioBuffer: rawAudio,
  config: {
    preset: 'voice-only',
    noiseReduction: 0.8,
  },
});
```

### Audio2Face Bridge

```typescript
import { Audio2FaceBridge, createDefaultConfig } from '@studylog/digital-human-worker/audio2face';

// Create bridge
const bridge = new Audio2FaceBridge(createDefaultConfig(
  'wss://audio2face.nvidia.com/ws',
  process.env.NVIDIA_API_KEY
));

// Connect
await bridge.connect();

// Subscribe to animation frames
bridge.onAnimationFrames((frames) => {
  // Apply blend shapes to avatar
  for (const frame of frames) {
    avatar.setBlendShapes(frame.blendShapes);
  }
});

// Start streaming
const requestId = bridge.startStream();

// Stream audio chunks
bridge.streamAudio(audioChunk);

// Control emotion
bridge.setEmotion('happy', 0.8);

// Stop streaming
bridge.stopStream();
```

## API Reference

### ACE Client

| Method | Description |
|--------|-------------|
| `registerAgent(config)` | Register an agent configuration |
| `interact(request)` | Send message and get response |
| `createSession(agentId, userId)` | Create a new session |
| `streamAudio(agentId, request)` | Stream audio for animation |

### Maxine Client

| Method | Description |
|--------|-------------|
| `enableEyeContact(request)` | Apply gaze correction to video |
| `animatePortrait(request)` | Animate portrait from audio |
| `enhanceAudio(request)` | Enhance audio quality |

### Audio2Face Bridge

| Method | Description |
|--------|-------------|
| `connect()` | Connect to WebSocket server |
| `disconnect()` | Disconnect from server |
| `startStream()` | Start streaming audio |
| `streamAudio(audioData)` | Send audio chunk |
| `stopStream()` | Stop streaming |
| `setEmotion(emotion, intensity)` | Set target emotion |

## Environment Variables

```bash
# NVIDIA API Key (required for most features)
NVIDIA_API_KEY=your_nvidia_api_key

# Optional: Custom API endpoints
ACE_API_URL=https://api.nvcf.nvidia.com/v2/nvc
MAXINE_API_URL=https://api.nvidia.com/maxine
AUDIO2FACE_WS_URL=wss://audio2face.nvidia.com/ws
```

## Architecture

```
Frontend (Theia IDE)
    |
    v
Digital Human Worker (Cloudflare)
    |
    +-- ACE Client --> NVIDIA ACE API
    +-- Maxine Client --> NVIDIA Maxine API
    +-- Audio2Face Bridge --> NVIDIA NIM Microservice
    |
    v
Response (text, audio, animation)
    |
    v
Frontend renders avatar with lip-sync
```

## Personality Types

| Type | Role | Description |
|------|------|-------------|
| `tutor` | Educational Guide | Step-by-step explanations, checks understanding |
| `captain` | Orchestrator | Manages learning journey, assigns tasks |
| `teacher` | Instructor | Clear explanations, comprehensive tutorials |
| `builder` | Technical Guide | Code help, debugging, technical solutions |

## Supported Emotions

- `neutral` - Default state
- `happy` - Positive, encouraging
- `sad` - Empathy for difficulties
- `angry` - Rarely used, for emphasis
- `surprised` - Discovery moments
- `confused` - When seeking clarification
- `thinking` - Processing information
- `excited` - Achievement celebration
- `concerned` - Warning or caution
- `encouraging` - Motivation and support

## Database Schema

```sql
CREATE TABLE digital_tutor_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  personality TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  messages TEXT, -- JSON array
  metadata TEXT, -- JSON object
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_sessions_user ON digital_tutor_sessions(user_id);
CREATE INDEX idx_sessions_agent ON digital_tutor_sessions(agent_id);
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Deploy to Cloudflare
wrangler publish
```

## License

MIT

## References

- [NVIDIA ACE for Games](https://developer.nvidia.com/ace-for-games)
- [NVIDIA Maxine AR SDK](https://docs.nvidia.com/maxine/ar/index.html)
- [Audio2Face NIM](https://docs.nvidia.com/nim/digital-human/a2f-3d/latest/index.html)
- [StudyLoG.AI](https://studylog.ai)
