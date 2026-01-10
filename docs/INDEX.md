# StudyLoG.AI Documentation Index

Complete documentation for StudyLoG.AI by SuperInstance.AI.

---

## Getting Started

- [Quick Start](../README.md#quick-start) - Get up and running in 5 minutes
- [Architecture Overview](ARCHITECTURE.md) - High-level system design
- [Component Reference](../COMPONENTS.md) - Rolodex of reusable components

### New to StudyLoG.AI?

1. Read the [main README](../README.md) for project overview
2. Follow the [Quick Start](../README.md#quick-start) to install and run
3. Explore [Components](../COMPONENTS.md) to understand the architecture
4. Check [Architecture Decisions](adr/) for design rationale

---

## Setup & Deployment

- [Deployment Guide](DEPLOYMENT.md) - Production deployment instructions
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [API Reference](API_REFERENCE.md) - Complete API documentation

### Deployment Checklist

- [ ] Set up Cloudflare account
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Deploy workers to Cloudflare
- [ ] Configure custom domain (optional)

---

## API Reference

- [API Documentation](API_REFERENCE.md) - Complete REST API reference
  - Authentication endpoints
  - Student progress tracking
  - AI inference endpoints
  - Game state management
  - Asset management

### Core API Endpoints

```
POST /api/v1/auth/login
GET  /api/v1/student/progress
POST /api/v1/ai/chat
POST /api/v1/game/session/start
POST /api/v1/assets/upload
```

---

## Architecture Decision Records

### Core Architecture

- [ADR-001: Cascade Routing Architecture](adr/ADR-001-cascade-routing-architecture.md) - Intent classification and LLM provider cascading
- [ADR-002: Theia Extension Architecture](adr/ADR-002-theia-extension-architecture.md) - Theia IDE extension design patterns
- [ADR-003: Cloudflare Workers Backend](adr/ADR-003-cloudflare-workers-backend.md) - Serverless backend architecture
- [ADR-004: Agent-Based Voice Assistant](adr/ADR-004-agent-based-voice-assistant.md) - Voice interaction design

### Legacy ADRs

- [ADR-0001: G-Assist Integration](adr/0001-g-assist-integration.md) - Initial G-Assist integration approach
- [ADR-0002: Messenger UI Pattern](adr/0002-messenger-ui-pattern.md) - PersonalLog chat interface design
- [ADR-0003: Component Rolodex](adr/0003-component-rolodex.md) - Reusable component system design
- [ADR-0004: Multi-Agent Swarm](adr/0004-multi-agent-swarm.md) - Agent orchestration patterns

---

## Project Documentation

- [IMPLEMENTATION.md](../IMPLEMENTATION.md) - Current implementation status and phase details
- [ROADMAP.md](../ROADMAP.md) - Project roadmap and milestones
- [CLAUDE.md](../CLAUDE.md) - Build manifest and orchestration guide
- [Code Comment Standards](CODE_COMMENT_STANDARDS.md) - Documentation and commenting guidelines
- [Documentation Audit Report](DOCUMENTATION_AUDIT_REPORT.md) - Code comment quality assessment

---

## Component Documentation

### Theia Extensions

- [si-gassist](../apps/theia-ide/extensions/si-gassist/README.md) - Voice assistant widget
- [si-multi-model](../apps/theia-ide/extensions/si-multi-model/) - Multi-model router UI
- [si-godot-embed](../apps/theia-ide/extensions/si-godot-embed/) - Godot panel embedding
- [si-agent-director](../apps/theia-ide/extensions/si-agent-director/) - Agent orchestration
- [si-cognitive-mill](../apps/theia-ide/extensions/si-cognitive-mill/) - AI learning module
- [si-intelligence-ranch](../apps/theia-ide/extensions/si-intelligence-ranch/) - Agent training
- [si-sitka-sound](../apps/theia-ide/extensions/si-sitka-sound/) - Multi-agent ecosystems
- [si-bazaar](../apps/theia-ide/extensions/si-bazaar/) - Community marketplace

### Backend Workers

- [first-mile-router](../backend/workers/first-mile-router/README.md) - Intent classification
- [multi-model-router](../backend/workers/multi-model-router/README.md) - LLM cascade routing
- [g-assist-api](../backend/workers/g-assist-api/README.md) - Voice backend
- [code-generator](../backend/workers/code-generator/README.md) - AI code generation
- [bazaar](../backend/workers/bazaar/README.md) - Community API

---

## Learning Modules

### Cognitive Mill
Learn how AI models work through interactive simulations.

- Circuits and logic gates
- Neural network visualization
- Token embeddings and transformers
- Training and inference

### Intelligence Ranch
Train and breed AI agents with LoRA adapters.

- Agent selection and breeding
- Fine-tuning with custom data
- Performance evaluation
- Agent marketplace

### Sitka Sound
Multi-agent ecosystems and game theory.

- Agent-to-agent communication
- Ecological simulation
- Game theory scenarios
- Fleet orchestration

---

## Examples

- [Quick Start Examples](../examples/README.md) - Basic usage examples
- [Integration Examples](../examples/integrations/README.md) - Third-party integrations

---

## Contributing

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
  - Code of conduct
  - Development setup
  - Pull request process
  - Coding standards
  - Testing requirements

---

## Community

- **Bazaar**: Community marketplace for sharing creations
- **Discussions**: GitHub Discussions for questions and ideas
- **Issues**: Bug reports and feature requests

---

## Philosophy

**Every layer is a mill. Every agent is a millwright. Every user graduates to building mills.**

StudyLoG.AI is the first product in the SuperInstance.AI ecosystem. The same backend will power:

- **DMLoG.AI** - TTRPG with AI agents as players
- **MakerLoG.AI** - IoT/Robotics with 3D printing marketplace
- **FishingLoG.AI** - Ecological simulation

---

## Quick Links

| Link | Description |
|------|-------------|
| [Main README](../README.md) | Project overview |
| [COMPONENTS.md](../COMPONENTS.md) | Component reference |
| [ROADMAP.md](../ROADMAP.md) | Development roadmap |
| [CLAUDE.md](../CLAUDE.md) | Build manifest |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guide |

---

**Remember**: We're building a network of thinkers and makers who create products on tools they grew up playing with.
