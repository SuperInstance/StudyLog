# Multi-Provider Expansion Plan

**Status:** Research & Planning
**Last Updated:** 2026-01-10
**Owner:** SuperInstance.AI Backend Team

---

## Executive Summary

This document outlines the expansion of StudyLoG.AI's multi-provider AI router to include:

1. **Additional LLM providers** for cost optimization and geographic redundancy
2. **Image/video generation APIs** with cascade routing for quality tiers
3. **Audio generation capabilities** for multimodal agent interactions
4. **Agent-driven prompting** where agents orchestrate generative tasks

---

## Provider Summary Table

| Provider | Type | Models | Pricing (per 1M tokens) | Priority |
|----------|------|--------|-------------------------|----------|
| **Z.ai (Zhipu AI)** | LLM + Image/Video | GLM-4.7, GLM-4.5, CogView-4 | $0.08-$0.30 | **P0** |
| **DeepSeek** | LLM | DeepSeek-V3, DeepSeek-V3.2 | $0.14-$0.28 | **P0** |
| **Kimi (Moonshot)** | LLM | Kimi K2, K2 Thinking | $0.50-$2.50 | **P1** |
| **X.ai (Grok)** | LLM | Grok 4, Grok 4.1 Fast | $0.20-$15.00 | **P1** |
| **DeepInfra** | LLM (aggregator) | Llama, Mixtral, Claude | $0.05-$0.60 | **P1** |
| **Replicate** | Image/Video | Stable Diffusion, FLUX, Sora | Per-second compute | **P2** |
| **ElevenLabs** | Audio | Eleven v3, Multilingual v2 | $5-$30 per 1M chars | **P2** |
| **Cloudflare Workers AI** | Image | Stable Diffusion, LCM | Included with Workers | **P2** |
| **OpenAI** | Image/Video | DALL-E 3, GPT-image-1, Sora | $5-$20 per image | **P2** |

**Legend:**
- **P0**: Immediate (cost advantage + coding capabilities)
- **P1**: High (regional redundancy, specialized models)
- **P2**: Medium (multimodal expansion)

---

## Implementation Phases

### Phase 1: High-Value LLM Providers (Week 1-2)

**Goal:** Integrate Z.ai and DeepSeek for maximum cost savings on coding tasks.

#### 1.1 Z.ai (Zhipu AI) Integration

**Why First:**
- Extremely competitive pricing (~$0.08/M input tokens)
- GLM-4.7 specifically optimized for agentic coding
- 200K context window for large codebase analysis
- Strong Chinese market presence (future product expansion)

**Models to Integrate:**
```
- glm-4.7        // Latest flagship, coding specialist
- glm-4.5        // General purpose
- glm-4-plus     // High-quality reasoning
- glm-4-flash    // Fast, cheap (fallback)
- glm-4-long     // 200K context for large files
```

**API Details:**
- **Base URL:** `https://open.bigmodel.cn/api/paas/v4`
- **Auth:** Bearer token (API key)
- **Format:** OpenAI-compatible chat completions
- **Rate Limits:** 1000 requests/minute (paid tier)

**Integration Points:**
```typescript
// backend/workers/providers/zhipu.ts
interface ZhipuConfig {
  apiKey: string;
  baseUrl: string;
  models: ['glm-4.7', 'glm-4.5', 'glm-4-plus', 'glm-4-flash', 'glm-4-long'];
}

async function callZhipu(
  model: string,
  messages: ChatMessage[],
  options: GenerationOptions
): Promise<ChatResponse>
```

#### 1.2 DeepSeek Integration

**Why Second:**
- Ultra-low pricing ($0.14/$0.28 per 1M tokens)
- Strong reasoning capabilities
- OpenAI-compatible API (minimal integration effort)
- Rapidly improving model quality

**Models to Integrate:**
```
- deepseek-chat       // General chat (V3)
- deepseek-coder      // Code specialist
- deepseek-reasoner   // Complex reasoning
```

**API Details:**
- **Base URL:** `https://api.deepseek.com`
- **Auth:** Bearer token
- **Format:** OpenAI-compatible
- **Special:** `deepseek-reasoner` returns thinking tokens

**Integration Points:**
```typescript
// backend/workers/providers/deepseek.ts
interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
}
```

---

### Phase 2: Image Generation Cascade (Week 3-4)

**Goal:** Implement quality-tiered routing for image generation:
1. **Local/Cloudflare** for rapid prototyping (fast, low quality)
2. **Z.ai CogView** for production-ready images (balanced)
3. **DALL-E/Sora** for final renders (premium quality)

#### 2.1 Cascade Architecture

```
User Request: "Generate a futuristic city scene"
    |
    v
[Intent Classifier] -> Detects: image generation, concept stage
    |
    v
[Quality Selector] -> Chooses tier based on:
    - User tier (free/studio/lab)
    - Stage of work (prototype/production/final)
    - Previous generations count
    |
    +--> Tier 1: Cloudflare Workers AI (Fast, ~1s)
    |     - Stable Diffusion XL
    |     - LCM (Latent Consistency Model)
    |
    +--> Tier 2: Z.ai CogView-4 (Balanced, ~5s)
    |     - 1024x1024 default
    |     - Good prompt adherence
    |
    +--> Tier 3: DALL-E 3 / GPT-image-1 (Premium, ~10s)
          - 4096x4096 resolution
          - Best quality, highest cost
```

#### 2.2 Z.ai Image Generation

**Models:**
```
- cogview-4          // Latest text-to-image
- cogview-3-plus     // High quality
- cogvideox          // Video generation
```

**API Details:**
- **Base URL:** `https://open.bigmodel.cn/api/paas/v4`
- **Endpoint:** `/images/generations`
- **Pricing:** ~$0.01-$0.02 per image

**Implementation:**
```typescript
// backend/workers/providers/zhipu-image.ts
interface ImageGenerationRequest {
  prompt: string;
  model: 'cogview-4' | 'cogview-3-plus';
  size?: '1024x1024' | '768x768' | '512x512';
  n?: number;
}

interface ImageGenerationResponse {
  images: Array<{ url: string; revised_prompt?: string }>;
  model: string;
  provider: 'zhipu';
  cost: number;
}
```

---

### Phase 3: Replicate & ElevenLabs Integration (Week 5-6)

#### 3.1 Replicate Integration

**Why Include:**
- Access to 100+ open-source models
- No monthly fees, pay-per-use
- Stable diffusion ecosystem access
- Video generation models (Sora alternatives)

**Models:**
```
- stability-ai/sdxl      // Image generation
- black-forest-labs/flux  // High quality images
- lucataco/real-esrgan   // Upscaling
- minimax/video-01       // Video generation
```

**API Details:**
- **Base URL:** `https://api.replicate.com/v1`
- **Auth:** Bearer token
- **Pricing:** Per-second compute (~$0.0001-$0.001/sec)

#### 3.2 ElevenLabs Integration

**Use Cases:**
- Agent voice synthesis (Captain, Teacher, Builder agents)
- Audio generation for simulations
- Text-to-speech for accessibility

**Models:**
```
- eleven_multilingual_v2    // 29 languages
- eleven_v3                 // Latest English model
- eleven_turbo_v2           // Low latency
```

**API Details:**
- **Base URL:** `https://api.elevenlabs.io/v1`
- **Pricing:** ~$5-$30 per 1M characters
- **Special:** Speed control, timestamp support

---

### Phase 4: International Providers (Week 7-8)

#### 4.1 Kimi (Moonshot AI) Integration

**Why Include:**
- Strong Chinese market presence
- 256K context window
- Excellent Chinese language support
- K2 Thinking model for complex reasoning

**API Details:**
- **Base URL:** `https://api.moonshot.cn/v1`
- **Pricing:** $0.50-$2.50 per 1M tokens
- **Models:** `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k`

#### 4.2 X.ai (Grok) Integration

**Why Include:**
- Grok 4 Fast with 98% price reduction
- Real-time knowledge via X platform
- Good for current events queries
- Agent tools support

**API Details:**
- **Base URL:** `https://api.x.ai/v1`
- **Pricing:** $0.20-$15 per 1M tokens
- **Models:** `grok-4-1-fast-reasoning`, `grok-4-fast`

---

## Architecture Changes

### 1. Provider Abstraction Layer

```typescript
// backend/workers/providers/base.ts
export interface AIProvider {
  name: string;
  type: 'llm' | 'image' | 'audio' | 'video';
  baseUrl: string;
  authenticate(): Promise<void>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  generateImage(request: ImageRequest): Promise<ImageResponse>;
  generateAudio(request: AudioRequest): Promise<AudioResponse>;
  estimateCost(request: CostRequest): number;
  isAvailable(): boolean;
}

export interface ProviderConfig {
  name: string;
  type: 'llm' | 'image' | 'audio' | 'video';
  apiKey: string;
  baseUrl: string;
  models: ModelInfo[];
  costPerMillion: number;
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
  capabilities: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    maxContext: number;
  };
}
```

### 2. Multi-Model Router Enhancements

```typescript
// backend/workers/multi-model-router/types.ts
export interface CascadeConfig {
  enabled: boolean;
  imageQualityTiers: {
    prototype: string[];    // ['cloudflare', 'zhipu-flash']
    production: string[];   // ['cogview-4', 'sdxl']
    final: string[];        // ['dall-e-3', 'gpt-image-1']
  };
  costThresholds: {
    freeUser: number;      // Max cost per request
    studioUser: number;
    labUser: number;
  };
}

export interface ImageCascadeRequest {
  prompt: string;
  userTier: 'free' | 'forge' | 'studio' | 'lab';
  stage: 'prototype' | 'production' | 'final';
  preferredProvider?: string;
}
```

### 3. Agent Prompting System

```typescript
// packages/agents/prompting.ts
export interface AgentPrompter {
  /**
   * Agent orchestrates image generation by:
   * 1. Analyzing the user's intent
   * 2. Selecting appropriate model tier
   * 3. Crafting optimized prompts
   * 4. Iterating based on quality feedback
   */
  orchestrateImageGeneration(
    intent: string,
    context: GenerationContext
  ): Promise<ImageGenerationResult>;

  /**
   * Agent-driven prompt optimization for specific providers
   */
  optimizePromptForProvider(
    basePrompt: string,
    provider: string,
    model: string
  ): Promise<string>;
}
```

---

## API Endpoints to Add

### Multi-Model Router

```
POST /v1/chat/completions     // Existing - add new providers
POST /v1/images/generate      // NEW - image generation cascade
POST /v1/audio/generate       // NEW - audio generation
POST /v1/video/generate       // NEW - video generation
GET  /v1/models               // UPDATE - include all providers
GET  /v1/costs/estimate       // NEW - estimate cost before generation
GET  /v1/capabilities         // NEW - provider capabilities matrix
```

### Backend Workers

```
POST /api/generate/code       // Route to DeepSeek Coder or GLM-4.7
POST /api/generate/image      // Route through cascade
POST /api/generate/audio      // Route to ElevenLabs
POST /api/agents/delegate     // Agent-to-agent provider selection
```

---

## Cost Comparison Table

| Provider | Input Cost | Output Cost | Quality | Speed | Best For |
|----------|------------|-------------|---------|-------|----------|
| Ollama (local) | $0 | $0 | Variable | Slow | Privacy, cost-sensitive |
| DeepSeek | $0.14 | $0.28 | High | Medium | Coding, reasoning |
| Z.ai GLM-4.7 | $0.08 | $0.30 | High | Medium | Coding, Chinese markets |
| NVIDIA | $0.40 | $0.40 | High | Fast | General LLM |
| Google Gemini | $1.00 | $1.00 | High | Fast | Analysis, long context |
| Kimi K2 | $0.50 | $2.50 | High | Medium | Chinese, long context |
| X.ai Grok 4 Fast | $0.20 | $0.50 | High | Fast | Current events |
| Anthropic Claude | $3.00 | $15.00 | Excellent | Medium | Complex reasoning |
| OpenAI GPT-4o | $5.00 | $15.00 | Excellent | Fast | General purpose |

**Note:** Prices are approximate and may vary. Check official sources for current pricing.

---

## Implementation Priority Ranking

### Immediate (Week 1-2)
1. **Z.ai integration** - Best cost-quality ratio for coding
2. **DeepSeek integration** - Cheapest capable LLM

### High Priority (Week 3-4)
3. **Image generation cascade** - Unlock multimodal capabilities
4. **Z.ai CogView** - Balance of quality and cost

### Medium Priority (Week 5-6)
5. **Replicate integration** - Access to open-source models
6. **ElevenLabs integration** - Voice for agents

### Lower Priority (Week 7-8)
7. **Kimi integration** - Chinese market preparation
8. **X.ai Grok** - Alternative reasoning model

---

## Testing Strategy

### Unit Tests
- Provider authentication
- Cost calculation accuracy
- Prompt formatting per provider
- Error handling and fallback logic

### Integration Tests
- End-to-end generation flows
- Cascade routing behavior
- Rate limit handling
- Multi-provider fallback

### Load Tests
- Concurrent request handling
- Cache effectiveness
- Provider failover timing

---

## Migration Plan

### Step 1: Backend Updates
1. Create `backend/workers/providers/` directory structure
2. Implement provider abstraction layer
3. Add new providers incrementally
4. Update multi-model-router with new providers

### Step 2: Configuration
1. Add new API keys to wrangler.toml
2. Update routing configuration
3. Configure cascade quality tiers
4. Set cost thresholds per user tier

### Step 3: Frontend Updates
1. Update model selector UI
2. Add quality tier selector for images
3. Display cost estimates before generation
4. Show provider badges on responses

---

## Security Considerations

1. **API Key Storage:** All keys in Cloudflare Workers secrets, never committed
2. **Rate Limiting:** Per-user and per-provider limits
3. **Cost Protection:** Maximum spend limits per user tier
4. **Content Filtering:** Provider-specific content policies
5. **Data Privacy:** User data handling per provider terms

---

## Monitoring & Observability

### Metrics to Track
- Cost per provider
- Success rate per provider
- Average latency
- Cache hit rate
- Cascade tier distribution
- Error rates by provider

### Dashboards
1. **Cost Dashboard:** Real-time spending by provider
2. **Performance Dashboard:** Latency and success rates
3. **Usage Dashboard:** Request volume by provider/model
4. **Cascade Dashboard:** Tier distribution and savings

---

## References

### API Documentation
- [Zhipu AI Developer Docs](https://docs.z.ai/guides/llm/glm-4.7)
- [Zhipu AI Pricing](https://bigmodel.cn/pricing)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Kimi Moonshot Platform](https://platform.moonshot.cn/)
- [xAI Developer Docs](https://docs.x.ai/docs/overview)
- [xAI Models & Pricing](https://docs.x.ai/docs/models)
- [DeepInfra Docs](https://deepinfra.com/docs)
- [Replicate Docs](https://replicate.com/docs)
- [ElevenLabs Docs](https://elevenlabs.io/docs)
- [ElevenLabs Changelog 2025](https://elevenlabs.io/docs/changelog/2025/)

### Internal References
- `docs/ARCHITECTURE.md` - System architecture
- `docs/API_REFERENCE.md` - Existing API documentation
- `apps/theia-ide/extensions/si-multi-model/` - Frontend multi-model UI
- `backend/workers/multi-model-router/` - Current router implementation
- `backend/workers/first-mile-router/` - Intent classification

---

**Next Steps:**
1. Review and approve this plan
2. Create provider implementation tickets
3. Begin Phase 1: Z.ai integration
4. Update wrangler.toml with new provider configurations
