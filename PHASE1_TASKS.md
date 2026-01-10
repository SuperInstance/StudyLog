# Phase 1: G-Assist Integration - Detailed Task Breakdown

> Complete implementation guide for Phase 1 of StudyLoG.AI

**Phase**: 1 - G-Assist Integration
**Timeline**: 2-3 weeks
**Total Estimate**: 38 hours (5 days)

---

## Task Overview

| ID | Task | Estimate | Dependencies |
|----|------|----------|--------------|
| 1.1.1 | Create `si-g-assist` extension skeleton | 2h | Theia setup |
| 1.1.2 | Implement basic chat UI widget | 4h | 1.1.1 |
| 1.1.3 | Add audio capture UI | 3h | 1.1.2 |
| 1.1.4 | Add voice visualizer component | 2h | 1.1.3 |
| 1.2.1 | Implement STT handler worker | 6h | 1.1.1 |
| 1.2.2 | Implement TTS handler worker | 4h | 1.1.1 |
| 1.2.3 | Implement first-mile router | 8h | 1.2.1 |
| 1.2.4 | Implement context extractor | 4h | 1.2.3 |
| 1.3.1 | Wire up API endpoints | 3h | 1.2.1, 1.2.2 |
| 1.3.2 | Add WebSocket for streaming | 4h | 1.3.1 |
| 1.4.1 | Add database migrations | 1h | Backend setup |
| 1.5.1 | Write integration tests | 4h | All above |
| 1.5.2 | End-to-end testing | 3h | All above |

---

## Task 1.1.1: Create `si-g-assist` Extension Skeleton

**Estimate**: 2 hours
**Priority**: High (Blocker)

### Description

Create the basic Theia extension structure for G-Assist integration.

### File Structure to Create

```
apps/theia-ide/extensions/si-g-assist/
├── package.json
├── tsconfig.json
├── .npmrc
├── src/
│   ├── browser/
│   │   ├── g-assist-widget.tsx
│   │   ├── g-assist-frontend-service.ts
│   │   ├── audio-processor.ts
│   │   ├── voice-visualizer.tsx
│   │   ├── g-assist-commands.ts
│   │   ├── g-assist-menu.ts
│   │   └── si-g-assist-frontend-module.ts
│   └── common/
│       ├── types.ts
│       └── constants.ts
└── style/
    └── index.css
```

### Implementation Steps

#### Step 1: Create package.json

```json
{
  "name": "@studylog/si-g-assist",
  "version": "0.1.0",
  "description": "G-Assist voice-enabled AI chatbot for StudyLoG.AI",
  "main": "lib/browser/si-g-assist-frontend-module",
  "types": "lib/common",
  "keywords": [
    "theia-extension",
    "ai",
    "voice",
    "chatbot"
  ],
  "license": "MIT",
  "dependencies": {
    "@theia/core": "^1.54.0",
    "@theia/core/lib/browser": "^1.54.0",
    "@theia/messages": "^1.54.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "inversify": "^6.0.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "rimraf": "^5.0.0",
    "typescript": "^5.7.0"
  },
  "scripts": {
    "build": "theiaext build",
    "clean": "rimraf lib",
    "compile": "tsc",
    "watch": "tsc -w"
  },
  "theiaExtensions": [
    {
      "frontend": "lib/browser/si-g-assist-frontend-module"
    }
  ]
}
```

#### Step 2: Create tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": "src",
    "jsx": "react",
    "esModuleInterop": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "lib"
  ]
}
```

#### Step 3: Create base types (src/common/types.ts)

```typescript
/**
 * G-Assist Type Definitions
 */

export interface STTResult {
  text: string;
  confidence: number;
  alternatives: string[];
  processingTime: number;
  provider: 'local' | 'cloudflare' | 'google';
}

export interface TTSResult {
  audioUrl: string;
  duration: number;
  provider: 'web-speech' | 'piper' | 'elevenlabs';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: string;
}

export interface RouteDecision {
  agent: 'captain' | 'teacher' | 'builder' | 'tester' | 'director';
  confidence: number;
  reasoning: string;
  suggestedPrompt?: string;
}

export interface GAssistConfig {
  sttProvider: 'local' | 'cloudflare' | 'google';
  ttsProvider: 'web-speech' | 'piper' | 'elevenlabs';
  autoRoute: boolean;
  voiceActivation: boolean;
}

export interface IDEContext {
  activeModule?: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  activePanel?: string;
  openFiles: string[];
  currentSelection?: {
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
```

#### Step 4: Create constants (src/common/constants.ts)

```typescript
/**
 * G-Assist Constants
 */

export const GAssistWidget = {
  ID: 'si-g-assist:widget',
  LABEL: 'G-Assist',
  ICON_CLASS: 'fa fa-microphone',
};

export const AGENT_INFO = {
  captain: {
    name: 'Captain',
    description: 'Game simulation and NPC behavior',
    icon: 'fa fa-anchor',
  },
  teacher: {
    name: 'Teacher',
    description: 'Explanations, hints, and tutoring',
    icon: 'fa fa-graduation-cap',
  },
  builder: {
    name: 'Builder',
    description: 'Code generation and review',
    icon: 'fa fa-hammer',
  },
  tester: {
    name: 'Tester',
    description: 'Verification and error analysis',
    icon: 'fa fa-check-circle',
  },
  director: {
    name: 'Director',
    description: 'Orchestration and meta-questions',
    icon: 'fa fa-sitemap',
  },
};

export const API_ENDPOINTS = {
  STT: '/api/v1/g-assist/stt',
  TTS: '/api/v1/g-assist/tts',
  ROUTE: '/api/v1/g-assist/route',
  CHAT: '/api/v1/g-assist/chat',
};

export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channelCount: 1,
  bitDepth: 16,
  mimeTypes: [
    'audio/webm',
    'audio/ogg',
    'audio/wav',
  ],
} as const;
```

#### Step 5: Create frontend module (src/browser/si-g-assist-frontend-module.ts)

```typescript
/**
 * SI G-Assist Frontend Module
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { GAssistWidget } from './g-assist-widget';
import { GAssistCommandContribution } from './g-assist-commands';
import { GAssistMenuContribution } from './g-assist-menu';
import { GAssistFrontendService } from './g-assist-frontend-service';

export default new ContainerModule((bind) => {
  // Bind widget
  bind(GAssistWidget).toSelf();

  // Register widget factory
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: GAssistWidget.ID,
    createWidget: () => ctx.container.get(GAssistWidget),
  }));

  // Bind service
  bind(GAssistFrontendService).toSelf().inSingletonScope();

  // Bind commands
  bind(GAssistCommandContribution).toSelf();
  bind(CommandContribution).toService(GAssistCommandContribution);

  // Bind menu contributions
  bind(MenuContribution).toService(GAssistMenuContribution);
});
```

### Acceptance Criteria

- [ ] Extension structure created
- [ ] package.json configured with correct dependencies
- [ ] TypeScript configured
- [ ] Base types and constants defined
- [ ] Frontend module structure in place
- [ ] Extension compiles without errors

---

## Task 1.1.2: Implement Basic Chat UI Widget

**Estimate**: 4 hours
**Priority**: High
**Dependencies**: 1.1.1

### Description

Create the main chat interface widget with message list, input area, and basic styling.

### Implementation Steps

#### Step 1: Create widget structure (src/browser/g-assist-widget.tsx)

```typescript
/**
 * G-Assist Widget
 *
 * Main chat interface for voice-enabled AI assistant
 */

import * as React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { GAssistFrontendService } from './g-assist-frontend-service';
import { GAssistWidget, AGENT_INFO } from '../common/constants';
import { ChatMessage, RouteDecision, GAssistConfig } from '../common/types';

interface GAssistState {
  messages: ChatMessage[];
  inputText: string;
  isProcessing: boolean;
  currentAgent: string | null;
  routeDecision: RouteDecision | null;
  config: GAssistConfig;
}

@injectable()
export class GAssistWidget extends ReactWidget {
  static readonly ID = GAssistWidget.ID;
  static readonly LABEL = GAssistWidget.LABEL;

  @inject(GAssistFrontendService)
  protected readonly service: GAssistFrontendService;

  protected state: GAssistState = {
    messages: [],
    inputText: '',
    isProcessing: false,
    currentAgent: null,
    routeDecision: null,
    config: {
      sttProvider: 'local',
      ttsProvider: 'web-speech',
      autoRoute: true,
      voiceActivation: false,
    },
  };

  constructor() {
    super();
    this.id = GAssistWidget.ID;
    this.title.label = GAssistWidget.LABEL;
    this.title.caption = 'Voice-enabled AI Assistant';
    this.title.iconClass = GAssistWidget.ICON_CLASS;
    this.addClass('si-g-assist');
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-g-assist-container">
        {/* Header */}
        <div className="g-assist-header">
          <h2>G-Assist</h2>
          {this.state.currentAgent && (
            <div className="current-agent">
              <span className={`agent-icon ${this.state.currentAgent}`}>
                <i className={`fa ${AGENT_INFO[this.state.currentAgent as keyof typeof AGENT_INFO]?.icon}`} />
              </span>
              <span className="agent-name">
                {AGENT_INFO[this.state.currentAgent as keyof typeof AGENT_INFO]?.name}
              </span>
            </div>
          )}
        </div>

        {/* Route Decision Indicator */}
        {this.state.routeDecision && (
          <div className="route-indicator">
            <span className="route-label">Routed to:</span>
            <span className="route-agent">
              {AGENT_INFO[this.state.routeDecision.agent]?.name}
            </span>
            <span className="route-confidence">
              {Math.round(this.state.routeDecision.confidence * 100)}%
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="messages-container">
          {this.state.messages.map((msg) => this.renderMessage(msg))}
          {this.state.isProcessing && (
            <div className="message assistant processing">
              <div className="message-avatar">
                <i className="fa fa-spinner fa-spin" />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="input-area">
          <textarea
            value={this.state.inputText}
            onChange={(e) => this.setState({ inputText: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
              }
            }}
            placeholder="Type or speak your message..."
            disabled={this.state.isProcessing}
          />
          <div className="input-actions">
            <button
              className="voice-button"
              onClick={() => this.handleVoiceInput()}
              disabled={this.state.isProcessing}
            >
              <i className="fa fa-microphone" />
            </button>
            <button
              className="send-button"
              onClick={() => this.handleSend()}
              disabled={this.state.isProcessing || !this.state.inputText.trim()}
            >
              <i className="fa fa-paper-plane" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderMessage(msg: ChatMessage): React.ReactNode {
    const isUser = msg.role === 'user';
    const agentInfo = msg.agent ? AGENT_INFO[msg.agent as keyof typeof AGENT_INFO] : null;

    return (
      <div key={msg.id} className={`message ${msg.role}`}>
        {!isUser && (
          <div className="message-avatar">
            <i className={`fa ${agentInfo?.icon || 'fa fa-robot'}`} />
          </div>
        )}
        <div className="message-content">
          {!isUser && agentInfo && (
            <div className="message-agent">{agentInfo.name}</div>
          )}
          <div className="message-text">{msg.content}</div>
          <div className="message-time">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  }

  private async handleSend(): Promise<void> {
    const text = this.state.inputText.trim();
    if (!text || this.state.isProcessing) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    this.setState({
      messages: [...this.state.messages, userMessage],
      inputText: '',
      isProcessing: true,
    });

    try {
      // Route the message
      const routeDecision = await this.service.route(text, await this.getIDEContext());

      this.setState({ routeDecision, currentAgent: routeDecision.agent });

      // Get response from the routed agent
      const response = await this.service.chat(
        routeDecision.agent,
        [...this.state.messages, userMessage],
        await this.getIDEContext()
      );

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        agent: routeDecision.agent,
      };

      this.setState({
        messages: [...this.state.messages, userMessage, assistantMessage],
        isProcessing: false,
      });

      // Optionally speak response
      if (this.state.config.ttsProvider !== 'none') {
        this.service.speak(response.content, this.state.config.ttsProvider);
      }
    } catch (error) {
      console.error('[G-Assist] Error:', error);
      this.setState({ isProcessing: false });
    }
  }

  private handleVoiceInput(): void {
    // TODO: Implement in Task 1.1.3
    console.log('[G-Assist] Voice input not yet implemented');
  }

  private async getIDEContext() {
    // TODO: Implement in Task 1.2.4
    return {
      activeModule: undefined,
      activePanel: undefined,
      openFiles: [],
    };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### Step 2: Create service stub (src/browser/g-assist-frontend-service.ts)

```typescript
/**
 * G-Assist Frontend Service
 *
 * Handles API communication for G-Assist features
 */

import { injectable } from '@theia/core/shared/inversify';
import { STTResult, TTSResult, RouteDecision, ChatMessage, IDEContext } from '../common/types';
import { API_ENDPOINTS } from '../common/constants';

@injectable()
export class GAssistFrontendService {
  private apiBase: string;

  constructor() {
    // TODO: Configure from settings
    this.apiBase = '/api/v1/g-assist';
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(audioBuffer: ArrayBuffer, provider: string): Promise<STTResult> {
    const response = await fetch(`${this.apiBase}/stt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/webm',
        'X-STT-Provider': provider,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      throw new Error(`STT failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, provider: string): Promise<TTSResult> {
    const response = await fetch(`${this.apiBase}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, provider }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Route user query to appropriate agent
   */
  async route(query: string, context: IDEContext): Promise<RouteDecision> {
    const response = await fetch(`${this.apiBase}/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, context }),
    });

    if (!response.ok) {
      throw new Error(`Routing failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send chat message to agent
   */
  async chat(
    agent: string,
    messages: ChatMessage[],
    context: IDEContext
  ): Promise<{ content: string; agent: string; model: string }> {
    const response = await fetch(`${this.apiBase}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent, messages, context }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Speak text using browser TTS
   */
  async speak(text: string, provider: string): Promise<void> {
    if (provider === 'web-speech' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } else {
      // Use API-based TTS
      const result = await this.synthesize(text, provider);
      const audio = new Audio(result.audioUrl);
      audio.play();
    }
  }
}
```

#### Step 3: Create commands (src/browser/g-assist-commands.ts)

```typescript
/**
 * G-Assist Command Contributions
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { CommonCommands } from '@theia/core/lib/browser/common-commands';
import { GAssistWidget } from './g-assist-widget';

@injectable()
export class GAssistCommandContribution implements CommandContribution {
  @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand({
      id: 'gAssist.open',
      label: 'Open G-Assist',
      iconClass: 'fa fa-microphone',
    });
    registry.registerCommand({
      id: 'gAssist.clearHistory',
      label: 'Clear Chat History',
    });
    registry.registerCommand({
      id: 'gAssist.voiceToggle',
      label: 'Toggle Voice Input',
    });
  }
}
```

#### Step 4: Create menu contributions (src/browser/g-assist-menu.ts)

```typescript
/**
 * G-Assist Menu Contributions
 */

import { injectable } from '@theia/core/shared/inversify';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';

@injectable()
export class GAssistMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    // Add to View menu
    menus.registerMenuAction(CommonMenus.VIEW_VIEW, {
      commandId: 'gAssist.open',
      label: 'G-Assist',
      order: '5',
    });
  }
}
```

#### Step 5: Create styles (style/index.css)

```css
/* G-Assist Widget Styles */

.si-g-assist {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--theia-layout-background);
  color: var(--theia-ui-font-color1);
}

.si-g-assist-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.g-assist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--theia-border-color);
  background: var(--theia-editorGroupHeader-tabsBackground);
}

.g-assist-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.current-agent {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--theia-notificationInfo-foreground);
  color: var(--theia-notificationInfo-background);
  border-radius: 16px;
  font-size: 12px;
}

/* Route Indicator */
.route-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--theia-notificationsInfoIcon-foreground);
  color: var(--theia-notificationsInfoIcon-background);
  font-size: 12px;
}

.route-label {
  opacity: 0.8;
}

.route-agent {
  font-weight: 600;
}

.route-confidence {
  margin-left: auto;
  opacity: 0.7;
}

/* Messages Container */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--theia-button-secondaryBackground);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-agent {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.7;
}

.message-text {
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--theia-inputOption-activeBackground);
  word-wrap: break-word;
  line-height: 1.5;
}

.message.user .message-text {
  background: var(--theia-button-primaryBackground);
  color: var(--theia-button-foreground);
}

.message-time {
  font-size: 10px;
  opacity: 0.5;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

/* Input Area */
.input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--theia-border-color);
}

.input-area textarea {
  width: 100%;
  min-height: 60px;
  max-height: 120px;
  padding: 10px;
  border: 1px solid var(--theia-border-color);
  border-radius: 8px;
  background: var(--theia-input-background);
  color: var(--theia-input-foreground);
  font-family: var(--theia-ui-font-family);
  font-size: 14px;
  resize: vertical;
}

.input-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.input-actions button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: var(--theia-button-secondaryBackground);
  color: var(--theia-button-foreground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.input-actions button:hover:not(:disabled) {
  background: var(--theia-button-secondaryHoverBackground);
}

.input-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.voice-button {
  position: relative;
}

.voice-button.recording {
  background: var(--theia-error-background);
  color: var(--theia-error-foreground);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.send-button {
  background: var(--theia-button-primaryBackground);
  color: var(--theia-button-foreground);
}

.send-button:hover:not(:disabled) {
  background: var(--theia-button-primaryHoverBackground);
}
```

### Acceptance Criteria

- [ ] Widget renders in Theia
- [ ] Message list displays messages
- [ ] Text input works
- [ ] Send button sends messages
- [ ] Enter key sends messages
- [ ] Messages show timestamps
- [ ] User messages styled differently from assistant
- [ ] Route decision indicator displays
- [ ] Commands registered in menu

---

## Task 1.1.3: Add Audio Capture UI

**Estimate**: 3 hours
**Priority**: Medium
**Dependencies**: 1.1.2

### Description

Implement audio capture using Web Audio API and MediaRecorder.

### Implementation Steps

#### Step 1: Create audio processor (src/browser/audio-processor.ts)

```typescript
/**
 * Audio Processor
 *
 * Handles audio capture, processing, and visualization
 */

export interface AudioProcessorConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

export interface AudioLevel {
  rms: number;
  peak: number;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private onAudioLevelCallback?: (level: AudioLevel) => void;
  private isRecording = false;
  private animationFrame: number | null = null;

  constructor(private config: AudioProcessorConfig) {}

  /**
   * Initialize audio context and request microphone access
   */
  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channelCount,
          sampleRate: this.config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.bufferSize;
      source.connect(this.analyser);

      // Set up MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
      };
    } catch (error) {
      console.error('[AudioProcessor] Initialization failed:', error);
      throw new Error('Failed to access microphone');
    }
  }

  /**
   * Start recording audio
   */
  startRecording(): void {
    if (!this.mediaRecorder || this.isRecording) return;

    this.audioChunks = [];
    this.mediaRecorder.start(100); // Collect data every 100ms
    this.isRecording = true;
    this.startAudioLevelMonitoring();
  }

  /**
   * Stop recording and return audio blob
   */
  async stopRecording(): Promise<Blob> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Not recording');
    }

    this.mediaRecorder.stop();
    this.stopAudioLevelMonitoring();

    return new Promise((resolve) => {
      setTimeout(() => {
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType });
        resolve(blob);
      }, 100);
    });
  }

  /**
   * Get current audio level
   */
  private getAudioLevel(): AudioLevel {
    if (!this.analyser) return { rms: 0, peak: 0 };

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    let peak = 0;

    for (let i = 0; i < bufferLength; i++) {
      const x = (dataArray[i] - 128) / 128;
      sum += x * x;
      peak = Math.max(peak, Math.abs(x));
    }

    const rms = Math.sqrt(sum / bufferLength);

    return { rms, peak };
  }

  /**
   * Start monitoring audio levels
   */
  private startAudioLevelMonitoring(): void {
    const monitor = () => {
      const level = this.getAudioLevel();
      this.onAudioLevelCallback?.(level);

      if (this.isRecording) {
        this.animationFrame = requestAnimationFrame(monitor);
      }
    };

    monitor();
  }

  /**
   * Stop monitoring audio levels
   */
  private stopAudioLevelMonitoring(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Set callback for audio level updates
   */
  onAudioLevel(callback: (level: AudioLevel) => void): void {
    this.onAudioLevelCallback = callback;
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAudioLevelMonitoring();

    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  /**
   * Get supported MIME type for MediaRecorder
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/ogg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }
}
```

#### Step 2: Update widget with voice input

```typescript
// Add to G-Assist widget state
interface GAssistState {
  // ... existing state
  isRecording: boolean;
  audioLevel: number;
}

// Add to constructor
private audioProcessor: AudioProcessor | null = null;

// Add audio processor initialization in onAfterAttach
protected async onAfterAttach(msg: Message): Promise<void> {
  super.onAfterAttach(msg);

  try {
    this.audioProcessor = new AudioProcessor({
      sampleRate: 16000,
      channelCount: 1,
      bufferSize: 2048,
    });

    await this.audioProcessor.initialize();

    this.audioProcessor.onAudioLevel((level) => {
      this.setState({ audioLevel: level.peak * 100 });
    });
  } catch (error) {
    console.error('[G-Assist] Failed to initialize audio:', error);
  }
}

// Implement voice input handler
private async handleVoiceInput(): Promise<void> {
  if (!this.audioProcessor) return;

  if (this.audioProcessor.isActive()) {
    // Stop recording
    this.audioProcessor.stopRecording();
    this.setState({ isRecording: false });

    const blob = await this.audioProcessor.stopRecording();
    const arrayBuffer = await blob.arrayBuffer();

    try {
      const result = await this.service.transcribe(
        arrayBuffer,
        this.state.config.sttProvider
      );

      this.setState({ inputText: result.text });
    } catch (error) {
      console.error('[G-Assist] Transcription failed:', error);
    }
  } else {
    // Start recording
    this.audioProcessor.startRecording();
    this.setState({ isRecording: true });
  }
}

// Update input button
<button
  className={`voice-button ${this.state.isRecording ? 'recording' : ''}`}
  onClick={() => this.handleVoiceInput()}
  disabled={this.state.isProcessing}
>
  <i className={`fa fa-${this.state.isRecording ? 'stop' : 'microphone'}`} />
</button>
```

### Acceptance Criteria

- [ ] Microphone permission requested
- [ ] Recording starts/stops correctly
- [ ] Audio levels monitored
- [ ] Recorded audio transcribed
- [ ] Errors handled gracefully
- [ ] Cleanup on dispose

---

## Task 1.2.1: Implement STT Handler Worker

**Estimate**: 6 hours
**Priority**: High
**Dependencies**: 1.1.1

### Description

Create Cloudflare Worker for Speech-to-Text with multiple provider fallbacks.

### File Structure

```
backend/workers/g-assist/
├── index.ts
├── stt-handler.ts
├── tts-handler.ts
├── router.ts
└── __tests__/
    └── stt-handler.test.ts
```

### Implementation Steps

#### Step 1: Create STT handler (backend/workers/g-assist/stt-handler.ts)

```typescript
/**
 * G-Assist STT Handler
 *
 * Speech-to-Text with provider fallback:
 * 1. Cloudflare Workers AI (Whisper)
 * 2. Google Speech-to-Text
 */

export interface STTConfig {
  provider: 'cloudflare' | 'google';
  language: string;
}

export interface STTResult {
  text: string;
  confidence: number;
  processingTime: number;
  provider: string;
}

export class STTHandler {
  constructor(
    private env: {
      AI: any; // Cloudflare AI binding
      GOOGLE_API_KEY?: string;
    }
  ) {}

  async transcribe(audio: ArrayBuffer, config: STTConfig): Promise<STTResult> {
    const startTime = Date.now();

    try {
      if (config.provider === 'cloudflare') {
        return await this.transcribeCloudflare(audio);
      }
      return await this.transcribeGoogle(audio);
    } catch (error) {
      console.error('[STT] Provider failed:', error);
      throw error;
    }
  }

  private async transcribeCloudflare(audio: ArrayBuffer): Promise<STTResult> {
    try {
      const response = await this.env.AI.run('@cf/openai/whisper', {
        audio: Array.from(new Uint8Array(audio)),
      });

      return {
        text: response.text,
        confidence: 0.9, // Whisper doesn't provide confidence
        processingTime: Date.now(),
        provider: 'cloudflare',
      };
    } catch (error) {
      throw new Error(`Cloudflare STT failed: ${error.message}`);
    }
  }

  private async transcribeGoogle(audio: ArrayBuffer): Promise<STTResult> {
    if (!this.env.GOOGLE_API_KEY) {
      throw new Error('Google API key not configured');
    }

    // Convert audio to base64
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audio))
    );

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
          },
          audio: { content: base64Audio },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google STT failed: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];

    return {
      text: results.map((r: any) => r.alternatives[0].transcript).join(' '),
      confidence: results[0]?.alternatives[0]?.confidence || 0.8,
      processingTime: Date.now(),
      provider: 'google',
    };
  }
}
```

#### Step 2: Create worker entry point (backend/workers/g-assist/index.ts)

```typescript
/**
 * G-Assist Worker
 *
 * Main entry point for G-Assist API endpoints
 */

import { Router } from 'itty-router';
import { STTHandler } from './stt-handler';
import { TTSHandler } from './tts-handler';
import { FirstMileRouter } from './router';

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/', () => {
  return new Response(
    JSON.stringify({ status: 'healthy', service: 'g-assist' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

// STT endpoint
router.post('/stt', async (request) => {
  const env = request.env as any;
  const handler = new STTHandler(env);

  try {
    const audio = await request.arrayBuffer();
    const provider = request.headers.get('X-STT-Provider') || 'cloudflare';

    const result = await handler.transcribe(audio, {
      provider: provider as any,
      language: 'en',
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default {
  fetch: (request: Request, env: any, ctx: any) => {
    return router.handle(request, env, ctx).catch((err: Error) => {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    });
  },
};
```

### Acceptance Criteria

- [ ] STT endpoint accepts audio
- [ ] Cloudflare Whisper integration works
- [ ] Google fallback works
- [ ] Error handling implemented
- [ ] CORS configured
- [ ] Tests written

---

## Task 1.2.3: Implement First-Mile Router

**Estimate**: 8 hours
**Priority**: High
**Dependencies**: 1.2.1

### Description

Create intelligent router that directs queries to appropriate AI agents.

### Implementation Steps

#### Step 1: Create router (backend/workers/g-assist/router.ts)

```typescript
/**
 * First-Mile Router
 *
 * Analyzes user queries and routes to appropriate AI agent
 */

export interface RouteDecision {
  agent: 'captain' | 'teacher' | 'builder' | 'tester' | 'director';
  confidence: number;
  reasoning: string;
  suggestedPrompt?: string;
}

export interface IDEContext {
  activeModule?: string;
  activePanel?: string;
  openFiles: string[];
}

interface IntentAnalysis {
  category: string;
  confidence: number;
  keywords: string[];
}

export class FirstMileRouter {
  private readonly INTENT_PATTERNS = {
    // Code-related -> Builder
    code: {
      patterns: [
        /\b(write|create|generate|fix|debug|refactor|implement).*code\b/i,
        /\b(function|class|method|algorithm).*\b/i,
      ],
      agent: 'builder' as const,
    },

    // Game-related -> Captain
    game: {
      patterns: [
        /\b(game|simulation|scene|npc|character|story|quest)\b/i,
        /\b(godot|unity|unreal).*\b/i,
      ],
      agent: 'captain' as const,
    },

    // Learning-related -> Teacher
    learning: {
      patterns: [
        /\b(explain|teach|show|how|why|what is|understand|learn)\b/i,
        /\b(meaning|concept|definition).*\b/i,
      ],
      agent: 'teacher' as const,
    },

    // Testing-related -> Tester
    testing: {
      patterns: [
        /\b(test|verify|check|validate|error|bug|debug).*\b/i,
        /\b(assert|expect|mock|stub).*\b/i,
      ],
      agent: 'tester' as const,
    },

    // Meta-questions -> Director
    meta: {
      patterns: [
        /\b(what can you do|help|overview|status|available)\b/i,
        /\b(capabilities|features|options).*\b/i,
      ],
      agent: 'director' as const,
    },
  };

  async route(query: string, context: IDEContext): Promise<RouteDecision> {
    // 1. Analyze query intent
    const intent = this.analyzeIntent(query);

    // 2. Check context for hints
    const contextHint = this.analyzeContext(context);

    // 3. Make routing decision
    return this.makeDecision(intent, contextHint, query);
  }

  private analyzeIntent(query: string): IntentAnalysis {
    const scores: Record<string, { count: number; confidence: number; keywords: string[] }> = {};

    for (const [category, config] of Object.entries(this.INTENT_PATTERNS)) {
      scores[category] = {
        count: 0,
        confidence: 0,
        keywords: [],
      };

      for (const pattern of config.patterns) {
        const matches = query.match(pattern);
        if (matches) {
          scores[category].count++;
          scores[category].keywords.push(...matches.filter(m => typeof m === 'string'));
        }
      }

      // Calculate confidence based on match count and query coverage
      scores[category].confidence = Math.min(
        scores[category].count * 0.3,
        0.9
      );
    }

    // Find best match
    let bestCategory = 'meta';
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score.confidence > bestScore) {
        bestScore = score.confidence;
        bestCategory = category;
      }
    }

    return {
      category: bestCategory,
      confidence: bestScore,
      keywords: scores[bestCategory].keywords,
    };
  }

  private analyzeContext(context: IDEContext): { agent?: string; boost: number } {
    // Context-based routing hints
    if (context.activePanel === 'si-godot-embed') {
      return { agent: 'captain', boost: 0.2 };
    }

    if (context.activeModule === 'cognitive-mill') {
      return { agent: 'teacher', boost: 0.1 };
    }

    if (context.openFiles.some(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts'))) {
      return { agent: 'tester', boost: 0.3 };
    }

    return { boost: 0 };
  }

  private makeDecision(
    intent: IntentAnalysis,
    contextHint: { agent?: string; boost: number },
    query: string
  ): RouteDecision {
    const baseAgent = this.INTENT_PATTERNS[intent.category as keyof typeof this.INTENT_PATTERNS]?.agent || 'director';
    let confidence = intent.confidence + contextHint.boost;
    let agent = baseAgent;

    // Apply context hint if it increases confidence
    if (contextHint.agent && confidence < 0.8) {
      agent = contextHint.agent as any;
      confidence = Math.min(confidence + 0.2, 0.95);
    }

    // Generate suggested prompt
    const suggestedPrompt = this.enhancePrompt(query, agent);

    // Generate reasoning
    const reasoning = this.generateReasoning(intent, contextHint, agent);

    return {
      agent,
      confidence: Math.min(confidence, 0.99),
      reasoning,
      suggestedPrompt,
    };
  }

  private enhancePrompt(query: string, agent: string): string {
    // Enhance the query based on the target agent
    const enhancements: Record<string, string> = {
      builder: `Write code to: ${query}`,
      teacher: `Explain: ${query}`,
      tester: `Help test: ${query}`,
      captain: `In the context of game/simulation: ${query}`,
      director: query,
    };

    return enhancements[agent] || query;
  }

  private generateReasoning(
    intent: IntentAnalysis,
    contextHint: { agent?: string; boost: number },
    agent: string
  ): string {
    const parts: string[] = [];

    parts.push(`Detected intent: ${intent.category}`);
    parts.push(`Selected agent: ${agent}`);

    if (contextHint.agent) {
      parts.push(`Context influenced routing (boost: +${contextHint.boost})`);
    }

    return parts.join('. ');
  }
}
```

### Acceptance Criteria

- [ ] Intent classification works
- [ ] Context awareness implemented
- [ ] Confidence scoring accurate
- [ ] Prompt enhancement works
- [ ] Reasoning explanations helpful
- [ ] Tests covering all agents

---

## Task 1.5.1: Write Integration Tests

**Estimate**: 4 hours
**Priority**: Medium
**Dependencies**: All above

### Description

Write comprehensive tests for G-Assist integration.

### Test Structure

```typescript
// backend/workers/g-assist/__tests__/g-assist.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { STTHandler } from '../stt-handler';
import { TTSHandler } from '../tts-handler';
import { FirstMileRouter } from '../router';

describe('G-Assist Integration', () => {
  describe('FirstMileRouter', () => {
    let router: FirstMileRouter;

    beforeEach(() => {
      router = new FirstMileRouter();
    });

    describe('Intent Classification', () => {
      it('should route code questions to builder agent', async () => {
        const decision = await router.route(
          'Write a function to sort an array',
          { openFiles: [] }
        );

        expect(decision.agent).toBe('builder');
        expect(decision.confidence).toBeGreaterThan(0.7);
      });

      it('should route learning questions to teacher agent', async () => {
        const decision = await router.route(
          'Explain how neural networks work',
          { openFiles: [] }
        );

        expect(decision.agent).toBe('teacher');
        expect(decision.confidence).toBeGreaterThan(0.7);
      });

      it('should route game questions to captain agent', async () => {
        const decision = await router.route(
          'Create a new NPC for the game',
          { openFiles: [] }
        );

        expect(decision.agent).toBe('captain');
      });

      it('should route testing questions to tester agent', async () => {
        const decision = await router.route(
          'Verify this code works correctly',
          { openFiles: ['app.test.ts'] }
        );

        expect(decision.agent).toBe('tester');
      });

      it('should route meta questions to director agent', async () => {
        const decision = await router.route(
          'What can you help me with?',
          { openFiles: [] }
        );

        expect(decision.agent).toBe('director');
      });
    });

    describe('Context Awareness', () => {
      it('should boost confidence from context', async () => {
        const decision = await router.route(
          'How do I do this?',
          {
            openFiles: [],
            activePanel: 'si-godot-embed',
          }
        );

        expect(decision.reasoning).toContain('Context');
      });

      it('should detect test files and route to tester', async () => {
        const decision = await router.route(
          'Something is wrong',
          { openFiles: ['component.test.ts', 'app.ts'] }
        );

        expect(decision.agent).toBe('tester');
      });
    });
  });

  describe('STTHandler', () => {
    it('should transcribe audio using Cloudflare', async () => {
      // Mock implementation
      const mockEnv = {
        AI: {
          run: async (model: string, input: any) => ({
            text: 'hello world',
          }),
        },
      };

      const handler = new STTHandler(mockEnv);
      const mockAudio = new ArrayBuffer(1024);

      const result = await handler.transcribe(mockAudio, {
        provider: 'cloudflare',
        language: 'en',
      });

      expect(result.text).toBe('hello world');
      expect(result.provider).toBe('cloudflare');
    });
  });
});
```

### Acceptance Criteria

- [ ] All intent patterns tested
- [ ] Context awareness tested
- [ ] Error cases tested
- [ ] Edge cases covered
- [ ] Tests passing

---

## API Endpoints Summary

```
# Speech-to-Text
POST /api/v1/g-assist/stt
Content-Type: audio/webm
X-STT-Provider: cloudflare

Response:
{
  "text": "transcribed text",
  "confidence": 0.95,
  "processingTime": 1234,
  "provider": "cloudflare"
}

# Text-to-Speech
POST /api/v1/g-assist/tts
Content-Type: application/json
{
  "text": "Text to speak",
  "provider": "web-speech",
  "voice": "samantha"
}

Response:
{
  "audioUrl": "https://...",
  "duration": 3.2,
  "provider": "web-speech"
}

# First-Mile Routing
POST /api/v1/g-assist/route
Content-Type: application/json
{
  "query": "How do I create a Godot scene?",
  "context": {
    "activeModule": "cognitive-mill",
    "activePanel": "si-godot-embed",
    "openFiles": ["main.gd"]
  }
}

Response:
{
  "agent": "builder",
  "confidence": 0.92,
  "reasoning": "Detected intent: code. Selected agent: builder.",
  "suggestedPrompt": "Write code to: How do I create a Godot scene?"
}

# Chat with Agent
POST /api/v1/g-assist/chat
Content-Type: application/json
{
  "agent": "builder",
  "messages": [
    { "id": "1", "role": "user", "content": "...", "timestamp": "..." }
  ],
  "context": {...}
}

Response:
{
  "content": "Here's how to create a Godot scene...",
  "agent": "builder",
  "model": "claude-3-5-haiku"
}
```

---

## Success Criteria Summary

### Functional Requirements

- [ ] Voice input transcribed with >90% accuracy
- [ ] First-mile routing classifies intents with >85% accuracy
- [ ] Agent responses are contextually relevant
- [ ] Full conversation history persisted
- [ ] Fallback chain works (Cloudflare -> Google)
- [ ] TTS response playback works

### Technical Requirements

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E test flow working
- [ ] Code coverage >80%
- [ ] Linting clean
- [ ] TypeScript compilation successful

### User Experience

- [ ] Voice activation responsive
- [ ] Visual feedback during recording
- [ ] Route decisions clearly indicated
- [ ] Chat history scrollable
- [ ] Keyboard shortcuts working

---

**Remember**: Every layer is a mill. Every agent is a millwright. Every user graduates to building mills.
