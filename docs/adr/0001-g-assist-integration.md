# ADR 0001: G-Assist Integration Approach

**Status**: Proposed
**Date**: 2026-01-10
**Deciders**: StudyLoG.AI Team
**Related**: ADR-0002 (Messenger UI), ADR-0003 (Component Rolodex)

---

## Context

StudyLoG.AI needs a voice-enabled AI assistant to provide natural, conversational access to the IDE's AI capabilities. We're researching NVIDIA's Project G-Assist as a reference implementation for game-focused AI assistants, but we need to adapt it for our educational IDE context.

### Key Requirements

1. **Voice-first interaction** - Users should be able to speak naturally
2. **First-mile routing** - Queries must go to the right AI agent
3. **Local-first design** - Work offline when possible
4. **Cloud fallback** - Use premium services when needed
5. **Educational focus** - Prioritize learning over simple task completion

### Constraints

1. **Browser-based** - Must work in Web IDE (Theia)
2. **Free tier compatible** - Default to Cloudflare free tier
3. **Web Audio API** - Limited audio processing in browser
4. **No native dependencies** - Pure web technologies

---

## Decision

We will implement a custom G-Assist-inspired integration with the following architecture:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Theia IDE Frontend                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   STT UI    │  │   Chat UI   │  │     TTS Playback    │ │
│  │ (Recorder)  │  │ (Messages)  │  │    (Web Speech)     │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘ │
└─────────┼────────────────┼─────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Workers                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ STT Handler  │  │First-Mile    │  │   Chat Handler   │  │
│  │ (Whisper)    │  │Router        │  │   (Agent Proxy)  │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────┴──────────────────────────┐    │
│  │            Multi-Model Router Worker               │    │
│  │  (Ollama -> Cloudflare -> Google -> NVIDIA -> ...) │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **STT** | Cloudflare Workers AI (Whisper) | Free tier, fast, WebAssembly |
| **TTS** | Web Speech API (browser native) | No API cost, works offline |
| **Routing** | Custom intent classifier | Lightweight, no external API |
| **Audio** | Web Audio API + MediaRecorder | Browser native, no plugins |
| **Storage** | D1 (SQLite) | Free tier, persistent history |

---

## Alternatives Considered

### Alternative 1: Full NVIDIA G-Assist Integration

**Description**: Use NVIDIA's Project G-Assist SDK directly.

**Pros**:
- Proven technology
- Gaming-focused features
- ACE integration

**Cons**:
- Requires NVIDIA GPU
- Not browser-compatible
- Vendor lock-in
- Not education-focused

**Decision**: **REJECTED** - Doesn't fit our web-based, accessible-anywhere philosophy.

### Alternative 2: Third-Party Voice API (e.g., Deepgram)

**Description**: Use a dedicated speech-to-text API service.

**Pros**:
- High accuracy
- Easy integration
- Good documentation

**Cons**:
- Cost scales with usage
- Requires internet
- Another vendor dependency

**Decision**: **REJECTED** - We prefer the free tier approach with Cloudflare.

### Alternative 3: Pure Browser-Only Solution

**Description**: Use only Web Speech API for both STT and TTS.

**Pros**:
- No backend costs
- Works offline
- Simple architecture

**Cons**:
- Limited accuracy
- Browser compatibility issues
- No fallback options

**Decision**: **REJECTED** - Quality is too inconsistent for educational use.

---

## Consequences

### Positive

1. **Cost-effective** - Leverages Cloudflare free tier
2. **Browser-compatible** - Works on any modern browser
3. **Progressive enhancement** - Better hardware = better experience
4. **Educational** - First-mile routing helps users learn agent roles
5. **Extensible** - Easy to add new STT/TTS providers

### Negative

1. **Accuracy variance** - STT accuracy depends on provider
2. **Latency** - Round-trip to Cloudflare Workers
3. **Complexity** - Multiple fallback paths to maintain
4. **Browser limits** - Web Audio API has constraints

### Risks

1. **Cloudflare changes** - API changes could break integration
2. **Quality perception** - Poor STT could frustrate users
3. **Privacy concerns** - Audio data sent to cloud

### Mitigations

1. **Abstraction layer** - Provider-agnostic interface
2. **Fallback chain** - Multiple providers available
3. **Privacy mode** - Local-only option with Ollama
4. **Clear communication** - Show confidence scores to users

---

## Implementation Plan

See `/PHASE1_TASKS.md` for detailed implementation steps.

### Key Milestones

1. **Week 1**: Basic chat UI + STT/TTS handlers
2. **Week 2**: First-mile router + context extraction
3. **Week 3**: Integration testing + polish

---

## Related Decisions

- **ADR-0002**: Messenger UI pattern for tutoring
- **ADR-0003**: Component Rolodex for agent composition
- **ADR-0004**: Multi-agent swarm orchestration

---

## References

- NVIDIA Project G-Assist: https://www.nvidia.com/en-us/ai-data-science/g-assist/
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
