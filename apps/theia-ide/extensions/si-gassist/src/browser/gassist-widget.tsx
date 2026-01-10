/**
 * StudyLoG.AI - G-Assist Widget
 *
 * Main chat interface for voice-enabled AI assistant with first-mile routing.
 * Routes user queries to appropriate AI agents (Captain, Teacher, Builder, Tester, Director).
 */

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { GAssistFrontendService } from './gassist-frontend-service';
import {
  GAssistWidget as WidgetConstants,
  AGENT_INFO,
  ChatMessage,
  RouteDecision,
  GAssistConfig,
  IDEContext,
  AUDIO_CONFIG,
} from '../common';

// ============================================================================
// Constants
// ============================================================================

/** Number of visualizer bars for audio recording feedback */
const VISUALIZER_BAR_COUNT = 5;

/** Minimum visualizer bar height percentage */
const VISUALIZER_MIN_HEIGHT_PERCENT = 20;

/** Maximum visualizer bar height percentage */
const VISUALIZER_MAX_HEIGHT_PERCENT = 100;

/** Random variance added to visualizer bar height for animation effect */
const VISUALIZER_RANDOM_VARIANCE = 30;

/** Animation delay between visualizer bars in seconds */
const VISUALIZER_BAR_DELAY_SECONDS = 0.1;

/** FFT size for audio analysis (must be power of 2) */
const AUDIO_ANALYZER_FFT_SIZE = 256;

/** MediaRecorder data collection interval in milliseconds */
const MEDIARECORDER_DATA_INTERVAL_MS = 100;

/** Audio level monitoring update interval in milliseconds */
const AUDIO_LEVEL_MONITOR_INTERVAL_MS = 50;

/** Maximum audio level percentage for visualization */
const AUDIO_LEVEL_MAX_PERCENT = 100;

/** Maximum byte value for frequency data (8-bit) */
const FREQUENCY_DATA_MAX_BYTE = 255;

/** Minimum STT confidence threshold for auto-sending transcribed messages */
const AUTO_SEND_CONFIDENCE_THRESHOLD = 0.8;

/** Default TTS provider */
const DEFAULT_TTS_PROVIDER: GAssistConfig['ttsProvider'] = 'web-speech';

/** Default STT provider */
const DEFAULT_STT_PROVIDER: GAssistConfig['sttProvider'] = 'local';

/** Log prefix for console output */
const LOG_PREFIX = '[G-Assist]';

/** Default MIME type fallback for MediaRecorder */
const DEFAULT_MIME_TYPE = 'audio/webm';

/**
 * Simple logger for G-Assist widget
 * In production, consider using Theia's ILogger
 */
class GAssistLogger {
  private readonly prefix = LOG_PREFIX;

  info(message: string, ...args: unknown[]): void {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.info(`${this.prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`${this.prefix} ${message}`, ...args);
    }
  }
}

/**
 * Audio visualizer component for voice input feedback
 *
 * Displays a series of animated bars that respond to audio input levels.
 * The bars fluctuate randomly around the current audio level to create
 * a dynamic visual representation of voice input.
 */
interface AudioVisualizerProps {
  isRecording: boolean;
  audioLevel?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording, audioLevel = 0 }) => {
  if (!isRecording) return null;

  return (
    <div className="audio-visualizer">
      <div className="visualizer-bars">
        {[...Array(VISUALIZER_BAR_COUNT)].map((_, barIndex) => (
          <div
            key={barIndex}
            className="visualizer-bar"
            style={{
              // Calculate bar height: clamp between min and max, add random variance
              height: `${Math.max(
                VISUALIZER_MIN_HEIGHT_PERCENT,
                Math.min(
                  VISUALIZER_MAX_HEIGHT_PERCENT,
                  audioLevel + Math.random() * VISUALIZER_RANDOM_VARIANCE
                )
              )}%`,
              // Stagger animation for wave effect
              animationDelay: `${barIndex * VISUALIZER_BAR_DELAY_SECONDS}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

@injectable()
export class GAssistWidget extends ReactWidget {
  static readonly ID = WidgetConstants.ID;
  static readonly LABEL = WidgetConstants.LABEL;

  private readonly logger = new GAssistLogger();

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(GAssistFrontendService)
  protected readonly service!: GAssistFrontendService;

  // State
  private messages: ChatMessage[] = [];
  private inputText = '';
  private isProcessing = false;
  private currentAgent: string | null = null;
  private routeDecision: RouteDecision | null = null;
  private config: GAssistConfig = {
    sttProvider: DEFAULT_STT_PROVIDER,
    ttsProvider: DEFAULT_TTS_PROVIDER,
    autoRoute: true,
    voiceActivation: false,
  };

  // Voice recording state
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevel = 0;
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;

  // TTS playback state
  /**
   * We use HTMLAudioElement instead of SpeechSynthesis for several reasons:
   * 1. Supports custom TTS voices (Piper, ElevenLabs) with better quality
   * 2. Can handle longer audio content without browser limitations
   * 3. Allows pause/resume with precise position tracking
   * 4. Audio can be cached and replayed without re-synthesizing
   * 5. Better integration with our backend TTS API
   */
  private isPlaying = false;
  private audioElement: HTMLAudioElement | null = null;
  private ttsEnabled = true; // User preference for TTS
  private playingMessageId: string | null = null; // Track which message is playing

  @postConstruct()
  protected init(): void {
    this.id = GAssistWidget.ID;
    this.title.label = GAssistWidget.LABEL;
    this.title.caption = 'Voice-enabled AI Assistant';
    this.title.closable = true;
    this.title.iconClass = WidgetConstants.ICON_CLASS;
    this.addClass('si-gassist');
    this.update();
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-gassist-container">
        {/* Header */}
        <div className="gassist-header">
          <h2>G-Assist</h2>
          {this.currentAgent && (
            <div className="current-agent">
              <span className={`agent-icon ${this.currentAgent}`}>
                <i className={`fa ${AGENT_INFO[this.currentAgent as keyof typeof AGENT_INFO]?.icon}`} />
              </span>
              <span className="agent-name">
                {AGENT_INFO[this.currentAgent as keyof typeof AGENT_INFO]?.name}
              </span>
            </div>
          )}
        </div>

        {/* Route Decision Indicator */}
        {this.routeDecision && (
          <div className="route-indicator">
            <span className="route-label">Routed to:</span>
            <span className="route-agent">
              {AGENT_INFO[this.routeDecision.agent]?.name}
            </span>
            <span className="route-confidence">
              {Math.round(this.routeDecision.confidence * 100)}%
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="gassist-messages" ref={this.setMessagesRef}>
          {this.messages.length === 0 ? (
            <div className="gassist-welcome">
              <h3>Welcome to G-Assist</h3>
              <p>Voice-enabled AI assistant for StudyLoG.AI</p>
              <p>Try saying:</p>
              <ul>
                <li>"Explain how neural networks work"</li>
                <li>"Write a function to sort an array"</li>
                <li>"Create a new Godot scene"</li>
                <li>"Test this code"</li>
              </ul>
            </div>
          ) : (
            this.messages.map((msg) => this.renderMessage(msg))
          )}
          {this.isProcessing && (
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
        <div className="gassist-input">
          <AudioVisualizer isRecording={this.isRecording} audioLevel={this.audioLevel} />
          <textarea
            value={this.inputText}
            onChange={(e) => {
              this.inputText = e.target.value;
              this.update();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
              }
            }}
            placeholder={this.isRecording ? 'Listening...' : 'Type or speak your message...'}
            disabled={this.isProcessing || this.isRecording}
          />
          <div className="input-actions">
            <button
              className={`voice-button ${this.isRecording ? 'recording' : ''}`}
              onClick={() => this.handleVoiceInput()}
              disabled={this.isProcessing}
              title={this.isRecording ? 'Stop recording' : 'Voice input'}
            >
              <i className={`fa ${this.isRecording ? 'fa-stop' : 'fa-microphone'}`} />
            </button>
            <button
              className="send-button"
              onClick={() => this.handleSend()}
              disabled={this.isProcessing || !this.inputText.trim()}
            >
              <i className="fa fa-paper-plane" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render a single chat message
   * For assistant messages, includes a TTS speaker button
   */
  private renderMessage(msg: ChatMessage): React.ReactNode {
    const isUser = msg.role === 'user';
    const agentInfo = msg.agent ? AGENT_INFO[msg.agent] : null;

    // Check if this message is currently being played
    const isCurrentlyPlaying = this.playingMessageId === msg.id && this.isPlaying;

    return (
      <div key={msg.id} className={`message ${msg.role}`}>
        {!isUser && (
          <div className="message-avatar">
            <i className={`fa ${agentInfo?.icon || 'fa fa-robot'}`} />
          </div>
        )}
        <div className="message-content">
          {!isUser && (
            <>
              {agentInfo && (
                <div className="message-agent">{agentInfo.name}</div>
              )}
              <div className="message-text">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
              {/* TTS Speaker Button for assistant messages */}
              <button
                className={`tts-button ${isCurrentlyPlaying ? 'playing' : ''}`}
                onClick={() => this.handleTTS(msg)}
                disabled={this.isRecording}
                title={isCurrentlyPlaying ? 'Stop playback' : 'Read aloud'}
              >
                <i className={`fa ${isCurrentlyPlaying ? 'fa-stop' : 'fa-volume-up'}`} />
              </button>
            </>
          )}
          {isUser && (
            <>
              <div className="message-text">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /**
   * Handle sending a message to the AI assistant.
   *
   * This is the main message flow that orchestrates the complete round-trip
   * from user input to AI response, including agent routing and optional TTS.
   *
   * ### Flow Sequence
   * ```
   * User Input
   *    ↓
   * [1] Stop TTS Playback - Prevent audio overlap
   *    ↓
   * [2] Add User Message - Display in chat history
   *    ↓
   * [3] Get IDE Context - Extract active module, files, etc.
   *    ↓
   * [4] Route Message - First-mile router selects agent
   *    ↓
   * [5] Get Response - Agent processes and responds
   *    ↓
   * [6] Add Assistant Message - Display response
   *    ↓
   * [7] Optional TTS - Speak response if enabled
   *    ↓
   * [8] Scroll to Bottom - Show latest message
   * ```
   *
   * ### Agent Routing
   The `first-mile-router` classifies the user's intent and returns a
   `RouteDecision` containing:
   * - `agent`: Which agent to use (captain, teacher, builder, tester, director)
   * - `confidence`: How confident the router is in this classification
   * - `intent`: The detected intent category
   * - `reasoning`: Explanation for the routing decision
   *
   * ### Error Handling
   * - Network errors are caught and displayed via MessageService
   * - Processing state is always reset (even on error)
   * - Failed requests don't block future messages
   *
   * ### State Changes
   * - `isProcessing`: Set to `true` during the entire flow
   * - `messages`: Appended with user and assistant messages
   * - `currentAgent`: Updated with the selected agent
   * - `routeDecision`: Stored for UI display
   *
   * @returns Promise that resolves when the message flow completes
   *
   * @example
   * ```ts
   * await this.handleSend();
   * // User message is sent, agent responds, response displayed/spoken
   * ```
   */
  private async handleSend(): Promise<void> {
    this.logger.debug('handleSend: Starting message send flow');
    const text = this.inputText.trim();
    if (!text || this.isProcessing) {
      this.logger.debug('handleSend: Skipping - empty text or already processing');
      return;
    }

    // Stop any ongoing TTS playback when user sends a new message
    // This prevents audio overlap and provides better UX
    this.stopTTS();

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    this.messages = [...this.messages, userMessage];
    this.inputText = '';
    this.isProcessing = true;
    this.update();

    try {
      // Get IDE context
      const context = await this.getIDEContext();
      this.logger.debug('handleSend: Got IDE context', context);

      // Route the message
      this.logger.debug('handleSend: Routing message to appropriate agent');
      const routeDecision = await this.service.route(text, context);
      this.logger.debug('handleSend: Route decision', routeDecision);
      this.routeDecision = routeDecision;
      this.currentAgent = routeDecision.agent;
      this.update();

      // Get response from the routed agent
      this.logger.debug('handleSend: Sending chat to agent', routeDecision.agent);
      const response = await this.service.chat(
        routeDecision.agent,
        [...this.messages],
        context
      );
      this.logger.debug('handleSend: Received response from agent', {
        contentLength: response.content.length,
        model: response.model
      });

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        agent: routeDecision.agent,
      };

      this.messages = [...this.messages, assistantMessage];

      // Optionally speak response
      if (this.config.ttsProvider !== 'none') {
        this.service.speak(response.content, this.config.ttsProvider);
      }
    } catch (error) {
      this.logger.error('handleSend: Error during send flow', error);
      this.messageService.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.logger.debug('handleSend: Completing send flow');
      this.isProcessing = false;
      this.update();

      // Scroll to bottom
      this.scrollToBottom();
    }
  }

  /**
   * Handle voice input - toggle recording state
   */
  private async handleVoiceInput(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  /**
   * Start audio recording using the browser's MediaRecorder API.
   *
   * Initializes microphone capture, sets up audio analysis for visualization,
   * and begins collecting audio data for speech-to-text transcription.
   *
   * ### Recording Flow
   * ```
   * User clicks mic button
   *    ↓
   * [1] Stop TTS Playback - Mutually exclusive with recording
   *    ↓
   * [2] Check Browser Support - Verify getUserMedia available
   *    ↓
   * [3] Request Mic Access - getUserMedia with audio constraints
   *    ↓
   * [4] Create AudioContext - For frequency analysis/visualization
   *    ↓
   * [5] Start Level Monitoring - Update audioLevel for visualizer
   *    ↓
   * [6] Create MediaRecorder - With best supported MIME type
   *    ↓
   * [7] Start Recording - Collect chunks at 100ms intervals
   *    ↓
   * [8] Update UI - Show recording state and visualizer
   * ```
   *
   * ### Audio Configuration
   * Uses `AUDIO_CONFIG` for sample rate and channel count.
   * Default: 16kHz, mono (optimized for speech recognition).
   *
   * ### Visualization
   * - Creates `AudioContext` and `AnalyserNode` for real-time frequency data
   * - FFT size: 256 (frequencyBinCount: 128)
   * - Updates `audioLevel` state every 50ms for the visualizer bars
   *
   * ### MIME Type Selection
   * Tries MIME types in order from `AUDIO_CONFIG.mimeTypes`:
   * 1. Preferred formats (best quality/compatibility)
   * 2. Falls back to 'audio/webm' (universal support)
   *
   * ### Mutually Exclusive Operations
   * Recording and TTS playback cannot occur simultaneously:
   * - **Feedback loops**: Microphone would pick up the speaker output
   * - **UX clarity**: User should only do one audio operation at a time
   * - **Resource limits**: Browser may limit concurrent audio streams
   *
   * ### Error Handling
   * - Browser without getUserMedia support: Shows error message
   * - Mic permission denied: Shows error message
   * - Any setup error: Calls `cleanupRecording()` to reset state
   *
   * @returns Promise that resolves when recording is successfully started
   * @throws {Error} When microphone access is denied or unavailable
   *
   * @example
   * ```ts
   * await this.startRecording();
   * // isRecording = true, visualizer active, chunks collecting
   * ```
   */
  private async startRecording(): Promise<void> {
    this.logger.debug('startRecording: Starting audio recording');
    try {
      // Stop any ongoing TTS playback before recording
      this.stopTTS();

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported in this browser');
      }

      // Request microphone access
      this.logger.debug('startRecording: Requesting microphone access');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channelCount,
        },
      });
      this.logger.debug('startRecording: Microphone access granted');

      // Set up audio context for visualization
      this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = AUDIO_ANALYZER_FFT_SIZE;
      source.connect(this.analyser);

      // Start audio level monitoring
      this.startAudioLevelMonitoring();

      // Find supported MIME type
      const mimeType = this.getSupportedMimeType();
      this.logger.debug('startRecording: Using MIME type', mimeType);

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];

      // Set up data handler
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Set up recording stop handler
      this.mediaRecorder.onstop = async () => {
        await this.processRecording();
      };

      // Start recording with data collection interval
      this.mediaRecorder.start(MEDIARECORDER_DATA_INTERVAL_MS);
      this.isRecording = true;
      this.update();
      this.logger.debug('startRecording: Recording started successfully');

    } catch (error) {
      this.logger.error('startRecording: Failed to start recording', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.messageService.error(`Failed to start recording: ${errorMessage}`);
      this.cleanupRecording();
    }
  }

  /**
   * Stop audio recording
   */
  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // Note: isRecording will be set to false in processRecording
    }
  }

  /**
   * Process recorded audio and send to speech-to-text API.
   *
   * Called automatically when MediaRecorder stops. Converts the collected
   * audio chunks into a format suitable for the STT service and handles
   * the transcription response.
   *
   * ### Processing Flow
   * ```
   * MediaRecorder.onstop triggered
   *    ↓
   * [1] Set isRecording = false - Update UI state
   *    ↓
   * [2] Stop Audio Monitoring - Clear the level monitoring interval
   *    ↓
   * [3] Create Audio Blob - Combine chunks with detected MIME type
   *    ↓
   * [4] Convert to ArrayBuffer - Required format for STT API
   *    ↓
   * [5] Cleanup Recording Resources - Release mic, close context
   *    ↓
   * [6] Show Processing Indicator - "Transcribing..."
   *    ↓
   * [7] Call STT API - Send audio to transcription service
   *    ↓
   * [8] Handle Result
   *    ├─ Confidence > 0.8 → Auto-send via handleSend()
   *    └─ Confidence <= 0.8 → Show text for user review
   * ```
   *
   * ### Auto-Send Behavior
   * When STT confidence exceeds `AUTO_SEND_CONFIDENCE_THRESHOLD` (0.8):
   * - The message is automatically sent to the AI assistant
   * - This provides a seamless voice-only experience
   * - Low confidence results allow user to correct before sending
   *
   * ### STT Providers
   * Supports multiple providers via `config.sttProvider`:
   * - `local`: Browser-based or local model (default)
   * - `cloud`: Cloud-based STT service
   *
   * ### Error Handling
   * - Empty transcription: Shows "No speech detected" warning
   * - API failure: Shows error message with details
   * - State is always reset (isProcessing = false) after completion
   *
   * @returns Promise that resolves when transcription is complete
   *
   * @example
   * ```ts
   * await this.processRecording();
   * // Audio transcribed, text in input field or auto-sent
   * ```
   */
  private async processRecording(): Promise<void> {
    this.isRecording = false;
    this.stopAudioLevelMonitoring();
    this.update();

    // Create audio blob
    const mimeType = this.getSupportedMimeType();
    const audioBlob = new Blob(this.audioChunks, { type: mimeType });

    // Convert to ArrayBuffer for API call
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Cleanup recording resources
    this.cleanupRecording();

    // Show transcribing indicator
    this.isProcessing = true;
    this.update();

    try {
      // Call STT API
      const result = await this.service.transcribe(arrayBuffer, this.config.sttProvider);

      if (result.text && result.text.trim()) {
        // Set the transcribed text to input
        this.inputText = result.text;
        this.messageService.info(`Transcribed: "${result.text}"`);

        // Auto-send if STT confidence exceeds threshold
        // This prevents sending incorrect transcripts while maintaining UX speed
        if (result.confidence > AUTO_SEND_CONFIDENCE_THRESHOLD) {
          await this.handleSend();
        } else {
          this.isProcessing = false;
          this.update();
        }
      } else {
        this.isProcessing = false;
        this.messageService.warn('No speech detected. Please try again.');
        this.update();
      }
    } catch (error) {
      this.logger.error('STT failed:', error);
      this.messageService.error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
      this.isProcessing = false;
      this.update();
    }
  }

  /**
   * Get supported MIME type for MediaRecorder
   *
   * Iterates through the configured MIME types and returns the first one
   * supported by the browser. Falls back to a default type if none are supported.
   */
  private getSupportedMimeType(): string {
    for (const type of AUDIO_CONFIG.mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return DEFAULT_MIME_TYPE;
  }

  /**
   * Start monitoring audio levels for the recording visualizer.
   *
   * Sets up an interval that continuously reads frequency data from the
   * audio analyzer and updates the `audioLevel` state for the visualizer.
   *
   * ### How It Works
   * 1. Creates a `Uint8Array` of size `frequencyBinCount` (128 with FFT=256)
   * 2. Every 50ms, reads the current frequency data from the analyzer
   * 3. Calculates the average amplitude across all frequency bins
   * 4. Normalizes to 0-100% range and updates the state
   * 5. Triggers a re-render to animate the visualizer bars
   *
   * ### Frequency Analysis
   * - Uses `getByteFrequencyData()` which returns values 0-255
   * - Each bin represents a frequency range (not a single frequency)
   * - Lower bins = bass, higher bins = treble
   * - Average across all bins gives overall volume level
   *
   * ### Performance Considerations
   * - Runs at 20Hz (50ms interval) for smooth animation
   * - Minimal CPU overhead (simple array operations)
   * - Must be stopped with `stopAudioLevelMonitoring()` to prevent leaks
   *
   * ### Visualizer Behavior
   * The `audioLevel` value is used by `AudioVisualizer` component:
   * - Bar height = audioLevel + random variance
   * - Creates animated "wave" effect when speaking
   * - Bars fluctuate randomly around the actual audio level
   *
   * @returns void (modifies `audioLevel` state via interval)
   *
   * @example
   * ```ts
   * this.startAudioLevelMonitoring();
   * // audioLevel updates every 50ms until stopped
   * ```
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.audioLevelInterval = setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average level across all frequency bins
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      // Normalize to 0-100% range
      this.audioLevel = Math.min(
        AUDIO_LEVEL_MAX_PERCENT,
        (average / FREQUENCY_DATA_MAX_BYTE) * AUDIO_LEVEL_MAX_PERCENT
      );

      // Trigger re-render for visualizer update
      this.update();
    }, AUDIO_LEVEL_MONITOR_INTERVAL_MS);
  }

  /**
   * Stop audio level monitoring
   */
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    this.audioLevel = 0;
  }

  /**
   * Clean up all recording-related resources to prevent memory leaks.
   *
   * This method must be called after recording stops to properly release
   * browser resources. Failure to clean up can cause:
   * - Memory leaks (unclosed AudioContext)
   * - Microphone staying active (privacy issue)
   * - Ghost event listeners
   *
   * ### Cleanup Steps
   * 1. **Stop MediaRecorder**: If active, stops the recorder
   * 2. **Release Microphone**: Stops all media stream tracks
   * 3. **Clear Chunks**: Resets the audio chunks array
   * 4. **Close AudioContext**: Closes the Web Audio API context
   * 5. **Null References**: Clears all recording-related instance variables
   *
   * ### Browser Resource Management
   * - **MediaStreamTracks**: Must be explicitly stopped or mic stays active
   * - **AudioContext**: Must be closed or continues consuming CPU/memory
   * - **Event Handlers**: Cleared by nullifying the recorder reference
   *
   * @returns void (modifies instance state)
   *
   * @example
   * ```ts
   * this.cleanupRecording();
   * // mic: off, audioContext: closed, resources: released
   * ```
   */
  private cleanupRecording(): void {
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
  }

  /**
   * Handle TTS playback for a message
   * Toggle between play and pause for the same message
   */
  private async handleTTS(message: ChatMessage): Promise<void> {
    // If the same message is playing, stop it (toggle behavior)
    if (this.isPlaying && this.playingMessageId === message.id) {
      this.stopTTS();
      return;
    }

    // Stop any currently playing audio first
    this.stopTTS();

    // Start playing the new message
    await this.playTTS(message);
  }

  /**
   * Play TTS for a message
   * Calls the backend TTS API and plays the returned audio
   */
  private async playTTS(message: ChatMessage): Promise<void> {
    if (!this.ttsEnabled) return;

    try {
      this.isPlaying = true;
      this.playingMessageId = message.id;
      this.update();

      // Check if we should use browser's built-in speech synthesis
      if (this.config.ttsProvider === 'web-speech' && 'speechSynthesis' in window) {
        this.playWithBrowserSpeech(message.content);
        return;
      }

      // Call backend TTS API to get audio URL
      const result = await this.service.synthesize(
        message.content,
        this.config.ttsProvider
      );

      // Create and configure audio element
      this.audioElement = new Audio(result.audioUrl);

      // Set up event handlers for audio lifecycle
      this.setupAudioElementHandlers();

      // Play the audio
      await this.audioElement.play();

    } catch (error) {
      this.logger.error('TTS playback failed:', error);

      // Fallback to browser speech synthesis if API fails
      if ('speechSynthesis' in window) {
        this.logger.info('Falling back to browser speech synthesis');
        this.playWithBrowserSpeech(message.content);
      } else {
        // Reset state if completely failed
        this.isPlaying = false;
        this.playingMessageId = null;
        this.update();
      }
    }
  }

  /**
   * Play text using browser's built-in SpeechSynthesis API
   * This is used as a fallback when the backend TTS fails or when configured
   */
  private playWithBrowserSpeech(text: string): void {
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Set up handlers to sync with our playing state
    utterance.onend = () => {
      this.isPlaying = false;
      this.playingMessageId = null;
      this.update();
    };

    utterance.onerror = (event) => {
      this.logger.error('Browser speech synthesis error:', event);
      this.isPlaying = false;
      this.playingMessageId = null;
      this.update();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Set up event handlers for the HTMLAudioElement
   * These handlers ensure proper cleanup when audio finishes or errors
   */
  private setupAudioElementHandlers(): void {
    if (!this.audioElement) return;

    // When audio finishes naturally
    this.audioElement.onended = () => {
      this.isPlaying = false;
      this.playingMessageId = null;
      this.audioElement = null;
      this.update();
    };

    // Handle audio playback errors
    this.audioElement.onerror = (error) => {
      this.logger.error('Audio playback error:', error);
      this.isPlaying = false;
      this.playingMessageId = null;
      this.audioElement = null;
      this.update();
    };

    // Handle when audio is paused (not stopped, just paused)
    this.audioElement.onpause = () => {
      // Only reset if we're not in the middle of stopping
      if (this.playingMessageId !== null) {
        this.isPlaying = false;
        this.update();
      }
    };
  }

  /**
   * Stop TTS playback and clean up audio resources.
   *
   * This method ensures proper cleanup of both HTMLAudioElement and
   * browser SpeechSynthesis resources. Must be called to prevent memory
   * leaks and ensure clean audio state transitions.
   *
   * ### Cleanup Steps
   * 1. **HTMLAudioElement**:
   *    - Pause playback (if playing)
   *    - Reset currentTime to 0 (rewind to start)
   *    - Remove all event listeners (onended, onerror, onpause)
   *    - Null the reference for garbage collection
   *
   * 2. **SpeechSynthesis**:
   *    - Cancel any ongoing speech
   *    - This stops browser's built-in TTS immediately
   *
   * 3. **State Reset**:
   *    - `isPlaying = false`
   *    - `playingMessageId = null`
   *
   * ### Why This Matters
   * - **Memory leaks**: Event listeners keep references to the element
   * - **Audio overlap**: Without cleanup, old audio might keep playing
   * - **State desync**: UI might show wrong playing state
   *
   * ### When to Call
   * - User sends a new message (handleSend)
   * - User starts recording (startRecording)
   * - User clicks stop on playing audio (handleTTS)
   * - Widget is disposed (dispose)
   *
   * @returns void (modifies instance state)
   *
   * @example
   * ```ts
   * this.stopTTS();
   * // Audio: stopped, listeners: removed, state: reset
   * ```
   */
  private stopTTS(): void {
    // Stop HTMLAudioElement playback
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0; // Reset position
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.onpause = null;
      this.audioElement = null; // Release reference for GC
    }

    // Cancel browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Reset state
    this.isPlaying = false;
    this.playingMessageId = null;
  }

  /**
   * Get IDE context for routing decisions.
   *
   * NOTE: Full context extraction requires integration with Theia editor services.
   * Currently returns minimal context - enhancement tracked separately.
   *
   * @returns IDE context with active module, panel, and open files
   */
  private async getIDEContext(): Promise<IDEContext> {
    return {
      activeModule: undefined,
      activePanel: undefined,
      openFiles: [],
    };
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private messagesRef: HTMLDivElement | null = null;

  private setMessagesRef = (ref: HTMLDivElement | null) => {
    this.messagesRef = ref;
  };

  private scrollToBottom(): void {
    if (this.messagesRef) {
      this.messagesRef.scrollTop = this.messagesRef.scrollHeight;
    }
  }

  /**
   * Dispose of widget resources
   * Proper cleanup of both recording and playback audio resources prevents memory leaks
   */
  dispose(): void {
    super.dispose();
    // Cleanup recording audio resources
    this.stopAudioLevelMonitoring();
    this.cleanupRecording();
    // Cleanup TTS playback audio resources
    this.stopTTS();
  }
}
