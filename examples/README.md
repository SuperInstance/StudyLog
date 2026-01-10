# StudyLoG.AI Examples

This directory contains comprehensive usage examples and sample code for the StudyLoG.AI agent system and integrated services.

## Directory Structure

```
examples/
├── quick-start/           # Basic getting started examples
│   ├── simple-chat.ts     # Basic chat without voice
│   ├── voice-chat.ts      # Voice-enabled chat
│   └── cost-aware-chat.ts # Chat with cost tracking
├── integrations/          # Integration examples
│   ├── with-godot.ts      # Using G-Assist with Godot scenes
│   ├── with-bazaar.ts     # Sharing to community Bazaar
│   └── custom-agent.ts    # Creating custom agent config
├── advanced/              # Advanced usage patterns
│   ├── streaming-responses.ts      # Streaming chat responses
│   ├── batch-classification.ts     # Classifying multiple messages
│   └── conversation-management.ts   # Full conversation lifecycle
└── frontend/              # Frontend integration examples
    ├── react-widget.tsx   # Using G-Assist in React
    ├── vanilla-js.html    # Using G-Assist from vanilla JS
    └── theia-extension.ts # Minimal Theia extension template
```

## Prerequisites

1. **Node.js 20+** installed
2. **pnpm** as package manager
3. **Backend workers** running (for most examples):
   ```bash
   cd /mnt/c/cognitivemill/studylog-github
   pnpm backend:dev
   ```
4. **Optional**: Ollama running locally for free AI
5. **Optional**: Anthropic API key for Claude access

## Quick Start Examples

### 1. Simple Chat (`quick-start/simple-chat.ts`)

The most basic way to use the StudyLoG.AI agent system.

**Run:**
```bash
npx tsx examples/quick-start/simple-chat.ts
```

**What it demonstrates:**
- Creating AI clients with different providers (Cloudflare, Anthropic, Ollama)
- Using the factory function for auto-provider selection
- Multi-turn conversations
- Basic error handling

**Expected output:**
```
=== Example 1: Cloudflare Workers AI ===

Cloudflare AI available: true
Response: [AI response about neural networks]
```

### 2. Voice Chat (`quick-start/voice-chat.ts`)

Voice-enabled chat using the G-Assist API with STT/TTS.

**Run:**
```bash
npx tsx examples/quick-start/voice-chat.ts chat
```

**What it demonstrates:**
- Speech-to-text (STT) for voice input
- Sending transcribed text to AI
- Text-to-speech (TTS) for responses
- Saving audio output

**Prerequisites:**
- Backend workers running on `http://localhost:8787`
- For audio input: Microphone access

**Expected output:**
```
=== Voice Chat Example ===

[Simulated Voice Input] "What is a neural network?"
Sending to AI (claude-3-5-haiku): "What is a neural network?"
AI response: [AI explanation]
Cost: $0.000120
Saved audio to: /tmp/response-1234567890.wav
```

### 3. Cost-Aware Chat (`quick-start/cost-aware-chat.ts`)

Chat with cost tracking and optimization.

**Run:**
```bash
npx tsx examples/quick-start/cost-aware-chat.ts compare
```

**What it demonstrates:**
- Cost estimation before requests
- Tracking cumulative costs
- Budget constraints
- Model comparison by cost
- Cascade routing (cheap -> expensive)

**Expected output:**
```
=== Example 1: Compare Model Costs ===

--- claude-3-5-haiku ---
Cost Estimate for claude-3-5-haiku:
  Input: ~12 tokens
  Output: ~500 tokens
  Est. Cost: $0.000002

Actual Cost:
  Input: 15
  Output: 142
  Cost: $0.000003
```

## Integration Examples

### 1. Godot Integration (`integrations/with-godot.ts`)

Using AI agents with Godot 4.3 scenes.

**Run:**
```bash
npx tsx examples/integrations/with-godot.ts connect
```

**What it demonstrates:**
- Connecting to Godot WebSocket server
- Sending commands to control scenes
- Receiving state updates
- AI-generated scene descriptions
- Component suggestions

**Prerequisites:**
- Godot 4.3+ with WebSocket support
- Theia IDE with si-godot-embed extension

### 2. Bazaar Integration (`integrations/with-bazaar.ts`)

Sharing creations to the community marketplace.

**Run:**
```bash
npx tsx examples/integrations/with-bazaar.ts browse
```

**What it demonstrates:**
- Browsing community creations
- Sharing your own creations
- Forking existing work
- Adding feedback and likes
- Millfile generation

**API Endpoints Used:**
- `GET /api/v1/bazaar/creations` - Browse
- `POST /api/v1/bazaar/creations` - Create
- `POST /api/v1/bazaar/creations/:id/fork` - Fork

### 3. Custom Agent (`integrations/custom-agent.ts`)

Creating custom AI agents with specific behaviors.

**Run:**
```bash
npx tsx examples/integrations/custom-agent.ts coding
```

**What it demonstrates:**
- Extending BaseAgent class
- Defining custom tools
- Setting system prompts
- Tool execution
- Agent with memory

**Example Agents:**
- CodingTutorAgent - Programming education
- CircuitHelperAgent - Electrical circuits
- GodotHelperAgent - Godot engine help

## Advanced Examples

### 1. Streaming Responses (`advanced/streaming-responses.ts`)

Token-by-token streaming for responsive UX.

**Run:**
```bash
npx tsx examples/advanced/streaming-responses.ts basic
```

**What it demonstrates:**
- Server-Sent Events (SSE) format
- Processing streaming chunks
- Displaying partial responses
- Metrics (time to first token, tokens/second)
- Stream interruption handling

**API Endpoint:**
- `POST /api/v1/g-assist/chat/stream`

### 2. Batch Classification (`advanced/batch-classification.ts`)

Classifying multiple messages efficiently.

**Run:**
```bash
npx tsx examples/advanced/batch-classification.ts batch
```

**What it demonstrates:**
- Intent classification for messages
- Batch processing with concurrency control
- Parallel vs sequential strategies
- Confidence filtering
- Intent-based routing

**Intent Types:**
- `code_help` - User needs coding help
- `concept_explanation` - Learning concepts
- `debugging` - Troubleshooting errors
- `godot_help` - Godot engine questions
- `bazaar_share` - Sharing to community

### 3. Conversation Management (`advanced/conversation-management.ts`)

Full conversation lifecycle management.

**Run:**
```bash
npx tsx examples/advanced/conversation-management.ts lifecycle
```

**What it demonstrates:**
- Creating conversations with metadata
- Managing message history
- Branching conversations
- Exporting/importing conversations
- Searching conversations
- Persistence to storage (D1)

## Frontend Examples

### 1. React Widget (`frontend/react-widget.tsx`)

Using G-Assist in a React application.

**What it includes:**
- `GAssistWidget` component
- `useGAssist` hook for API calls
- `useVoiceInput` hook for voice input
- `ChatMessage` component
- TypeScript types

**Usage:**
```tsx
import { GAssistWidget } from './g-assist-widget';

<GAssistWidget
  apiUrl="http://localhost:8787"
  defaultModel="claude-3-5-haiku"
  enableVoice={true}
  showCost={true}
  theme={{ primary: '#6366f1' }}
  onMessageSent={(msg) => console.log(msg)}
  onResponseReceived={(res) => console.log(res)}
/>
```

### 2. Vanilla JS (`frontend/vanilla-js.html`)

A standalone HTML file with no build step required.

**Usage:**
1. Open `vanilla-js.html` in a browser
2. Interact with the chat widget
3. Uses API endpoints directly via fetch

**Features:**
- Fully styled widget
- Voice input (if supported)
- Model selection
- Cost tracking
- Message history

### 3. Theia Extension (`frontend/theia-extension.ts`)

Minimal template for creating Theia extensions.

**What it includes:**
- Backend service with RPC
- Frontend widget
- Command registration
- Menu integration
- Common types

**To create a new extension:**
1. Copy the template to `apps/theia-ide/extensions/your-extension/`
2. Rename classes and files
3. Implement your functionality
4. Build and restart Theia

## API Endpoints Reference

### G-Assist API
- `POST /api/v1/g-assist/chat` - Send chat message
- `POST /api/v1/g-assist/chat/stream` - Stream chat response
- `POST /api/v1/g-assist/stt` - Speech to text
- `POST /api/v1/g-assist/tts` - Text to speech

### Cost Tracking API
- `GET /api/v1/costs/total` - Get total cost
- `GET /api/v1/costs/cascade` - Get cascade routing costs
- `POST /api/v1/costs/reset` - Reset cost tracking

### Bazaar API
- `GET /api/v1/bazaar/creations` - Browse creations
- `POST /api/v1/bazaar/creations` - Create creation
- `GET /api/v1/bazaar/creations/:id` - Get creation
- `POST /api/v1/bazaar/creations/:id/fork` - Fork creation
- `POST /api/v1/bazaar/creations/:id/feedback` - Add feedback
- `GET /api/v1/bazaar/profile/:id` - Get user profile

### Multi-Model Router API
- `POST /api/v1/models/chat` - Route chat to best model
- `GET /api/v1/models/providers` - Get available providers

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Backend API base URL | `http://localhost:8787` |
| `G_ASSIST_API_URL` | G-Assist API URL | `http://localhost:8787` |
| `GODOT_WS_URL` | Godot WebSocket URL | `ws://localhost:9876` |
| `BAZAAR_API_URL` | Bazaar API URL | `http://localhost:8787` |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | - |
| `PREFER_LOCAL` | Use local Ollama first | `false` |

## Troubleshooting

### "API not available" errors
- Ensure backend workers are running: `pnpm backend:dev`
- Check the API_URL environment variable
- Verify no firewall blocking localhost:8787

### "Ollama not available" errors
- Start Ollama: `ollama serve`
- Pull a model: `ollama pull llama3.2:3b`
- Check Ollama is accessible at `http://127.0.0.1:11434`

### TypeScript errors when running examples
- Ensure dependencies are installed: `pnpm install`
- Build packages: `pnpm build`
- Use `npx tsx` to run TypeScript directly

### Voice input not working
- Check microphone permissions in browser
- Ensure HTTPS (required for microphone in some browsers)
- Verify STT endpoint is available

## Contributing Examples

To add a new example:

1. Create the file in the appropriate directory
2. Add comprehensive comments
3. Include error handling
4. Show expected outputs
5. Update this README with:
   - Description
   - How to run
   - Prerequisites
   - Expected results

## Additional Resources

- [Main README](../../README.md)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [API Reference](../../docs/API_REFERENCE.md)
- [Component Reference](../../COMPONENTS.md)
- [Implementation Status](../../IMPLEMENTATION.md)
