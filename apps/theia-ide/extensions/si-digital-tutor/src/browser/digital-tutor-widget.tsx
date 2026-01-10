/**
 * StudyLoG.AI - Digital Tutor Widget
 *
 * Main widget for the AI-powered digital tutor avatar.
 * Features:
 * - 3D avatar display with real-time lip-sync
 * - Text chat interface
 * - Voice input/output
 * - Eye contact toggle
 * - Emotion selector
 * - Session management
 */

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { DigitalTutorFrontendService } from './digital-tutor-frontend-service';
import {
  DigitalTutorWidget as WidgetConstants,
  TutorPersonality,
  TutorMessage,
  TutorEmotion,
  AGENT_INFO,
  EMOTION_INFO,
  API_ENDPOINTS,
  AUDIO_CONFIG,
  DigitalTutorConfig,
  AnimationFrame,
} from '../common';

// ============================================================================
// Constants
// ============================================================================

/** Number of visualizer bars for audio recording feedback */
const VISUALIZER_BAR_COUNT = 5;

/** Audio level monitoring update interval in milliseconds */
const AUDIO_LEVEL_MONITOR_INTERVAL_MS = 50;

/** Maximum byte value for frequency data (8-bit) */
const FREQUENCY_DATA_MAX_BYTE = 255;

/** FFT size for audio analysis */
const AUDIO_ANALYZER_FFT_SIZE = 256;

/** MediaRecorder data collection interval in milliseconds */
const MEDIARECORDER_DATA_INTERVAL_MS = 100;

/** Log prefix for console output */
const LOG_PREFIX = '[DigitalTutor]';

/**
 * Simple logger for Digital Tutor widget
 */
class DigitalTutorLogger {
  private readonly prefix = LOG_PREFIX;

  info(message: string, ...args: unknown[]): void {
    console.info(`${this.prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.log(`${this.prefix} ${message}`, ...args);
  }
}

// ============================================================================
// Avatar Canvas Component
// ============================================================================

interface AvatarCanvasProps {
  agentId: string;
  personality: TutorPersonality;
  blendShapes?: Record<string, number>;
  isSpeaking: boolean;
  emotion: TutorEmotion;
  enableEyeContact: boolean;
}

/**
 * Avatar Canvas Component
 *
 * Renders the 3D avatar using Three.js or similar.
 * For now, this is a simplified canvas renderer.
 */
const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  agentId,
  personality,
  blendShapes,
  isSpeaking,
  emotion,
  enableEyeContact,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationRef = React.useRef<number>();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw avatar placeholder (simple face)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const faceRadius = Math.min(canvas.width, canvas.height) * 0.35;

      // Face base
      ctx.beginPath();
      ctx.arc(centerX, centerY, faceRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdbac';
      ctx.fill();
      ctx.strokeStyle = '#e0ac69';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes
      const eyeY = centerY - faceRadius * 0.1;
      const eyeOffset = faceRadius * 0.35;
      const eyeSize = faceRadius * 0.12;

      // Left eye
      ctx.beginPath();
      ctx.arc(centerX - eyeOffset, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Right eye
      ctx.beginPath();
      ctx.arc(centerX + eyeOffset, eyeY, eyeSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Pupils (with eye contact)
      const pupilSize = eyeSize * 0.4;
      const pupilOffset = enableEyeContact ? 0 : (Math.sin(Date.now() / 1000) * 2);

      ctx.beginPath();
      ctx.arc(centerX - eyeOffset + pupilOffset, eyeY, pupilSize, 0, Math.PI * 2);
      ctx.fillStyle = '#4a3728';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX + eyeOffset + pupilOffset, eyeY, pupilSize, 0, Math.PI * 2);
      ctx.fillStyle = '#4a3728';
      ctx.fill();

      // Eyebrows based on emotion
      const emotionData = EMOTION_INFO[emotion];
      const browOffset = faceRadius * 0.3;
      const browY = eyeY - faceRadius * 0.25;

      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = 3;

      // Left eyebrow
      ctx.beginPath();
      if (emotion === 'angry' || emotion === 'concerned') {
        ctx.moveTo(centerX - eyeOffset - 15, browY - 5);
        ctx.lineTo(centerX - eyeOffset + 15, browY + 5);
      } else if (emotion === 'surprised' || emotion === 'happy') {
        ctx.moveTo(centerX - eyeOffset - 15, browY + 5);
        ctx.lineTo(centerX - eyeOffset + 15, browY - 5);
      } else {
        ctx.moveTo(centerX - eyeOffset - 15, browY);
        ctx.lineTo(centerX - eyeOffset + 15, browY);
      }
      ctx.stroke();

      // Right eyebrow
      ctx.beginPath();
      if (emotion === 'angry' || emotion === 'concerned') {
        ctx.moveTo(centerX + eyeOffset - 15, browY + 5);
        ctx.lineTo(centerX + eyeOffset + 15, browY - 5);
      } else if (emotion === 'surprised' || emotion === 'happy') {
        ctx.moveTo(centerX + eyeOffset - 15, browY - 5);
        ctx.lineTo(centerX + eyeOffset + 15, browY + 5);
      } else {
        ctx.moveTo(centerX + eyeOffset - 15, browY);
        ctx.lineTo(centerX + eyeOffset + 15, browY);
      }
      ctx.stroke();

      // Mouth based on blend shapes or emotion
      const mouthY = centerY + faceRadius * 0.35;
      const mouthWidth = faceRadius * 0.4;

      // Get jaw open from blend shapes
      const jawOpen = blendShapes?.jawOpen || 0;
      const mouthSmile = blendShapes?.mouthSmileLeft || 0;

      ctx.beginPath();
      ctx.strokeStyle = '#c0394d';
      ctx.lineWidth = 3;

      if (isSpeaking || jawOpen > 0.1) {
        // Open mouth when speaking
        const openAmount = isSpeaking ? (Math.sin(Date.now() / 50) * 0.5 + 0.5) * 10 : jawOpen * 20;
        ctx.moveTo(centerX - mouthWidth, mouthY);
        ctx.lineTo(centerX - mouthWidth * 0.5, mouthY + openAmount);
        ctx.lineTo(centerX + mouthWidth * 0.5, mouthY + openAmount);
        ctx.lineTo(centerX + mouthWidth, mouthY);
      } else if (mouthSmile > 0.3) {
        // Smile
        ctx.arc(centerX, mouthY - 5, mouthWidth, 0.2, Math.PI - 0.2);
      } else if (emotion === 'sad' || emotion === 'angry' || emotion === 'concerned') {
        // Frown
        ctx.moveTo(centerX - mouthWidth, mouthY + 5);
        ctx.quadraticCurveTo(centerX, mouthY + 15, centerX + mouthWidth, mouthY + 5);
      } else if (emotion === 'surprised') {
        // O mouth
        ctx.ellipse(centerX, mouthY, mouthWidth * 0.3, mouthWidth * 0.4, 0, 0, Math.PI * 2);
      } else {
        // Neutral
        ctx.moveTo(centerX - mouthWidth, mouthY);
        ctx.lineTo(centerX + mouthWidth, mouthY);
      }
      ctx.stroke();

      // Draw personality indicator
      const agentInfo = AGENT_INFO[personality];
      ctx.fillStyle = agentInfo.color;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(agentInfo.name, centerX, canvas.height - 20);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [personality, emotion, enableEyeContact, isSpeaking]);

  // Update blend shapes trigger re-render
  React.useEffect(() => {
    // Trigger animation update when blend shapes change
  }, [blendShapes]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
    />
  );
};

// ============================================================================
// Audio Visualizer Component
// ============================================================================

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
              height: `${Math.max(20, Math.min(100, audioLevel + Math.random() * 30))}%`,
              animationDelay: `${barIndex * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Main Widget Component
// ============================================================================

@injectable()
export class DigitalTutorWidget extends ReactWidget {
  static readonly ID = WidgetConstants.ID;
  static readonly LABEL = WidgetConstants.LABEL;

  private readonly logger = new DigitalTutorLogger();

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(DigitalTutorFrontendService)
  protected readonly service!: DigitalTutorFrontendService;

  // State
  private messages: TutorMessage[] = [];
  private inputText = '';
  private isProcessing = false;
  private currentPersonality: TutorPersonality = 'tutor';
  private currentEmotion: TutorEmotion = 'neutral';
  private currentBlendShapes: Record<string, number> = {};
  private isSpeaking = false;
  private enableEyeContact = true;
  private config: DigitalTutorConfig = {
    defaultPersonality: 'tutor',
    defaultVoiceModel: 'us-female-1',
    defaultAvatarModel: 'studylog-tutor-1',
    enableFacialAnimation: true,
    enableEyeContact: true,
    enableEmotionDetection: true,
    autoPlayAudio: false,
    avatarSize: 1.0,
    avatarPosition: 'bottom-right',
    voiceInputEnabled: true,
    voiceInputAutoSend: false,
    eyeContactStrength: 0.7,
    animationSmoothing: 0.8,
  };

  // Voice recording state
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevel = 0;
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;

  // Audio playback
  private audioElement: HTMLAudioElement | null = null;
  private autoPlayEnabled = false;

  @postConstruct()
  protected async init(): Promise<void> {
    this.id = DigitalTutorWidget.ID;
    this.title.label = DigitalTutorWidget.LABEL;
    this.title.caption = 'AI-Powered Digital Tutor';
    this.title.closable = true;
    this.title.iconClass = WidgetConstants.ICON_CLASS;
    this.addClass('si-digital-tutor');

    // Load configuration
    try {
      this.config = await this.service.loadConfig();
      this.currentPersonality = this.config.defaultPersonality;
      this.enableEyeContact = this.config.enableEyeContact;
      this.autoPlayEnabled = this.config.autoPlayAudio;
    } catch (error) {
      this.logger.error('Failed to load config:', error);
    }

    // Connect to Audio2Face for real-time animation
    try {
      await this.service.connectAudio2Face((frames) => {
        this.handleAnimationFrames(frames);
      });
    } catch (error) {
      this.logger.warn('Failed to connect to Audio2Face:', error);
    }

    this.update();
  }

  protected render(): React.ReactNode {
    const agentInfo = AGENT_INFO[this.currentPersonality];

    return (
      <div className="si-digital-tutor-container">
        {/* Header */}
        <div className="tutor-header">
          <div className="tutor-title">
            <h2>Digital Tutor</h2>
            {this.currentPersonality && (
              <div className="personality-badge" style={{ backgroundColor: agentInfo.color }}>
                <i className={`fa ${agentInfo.icon}`} />
                <span>{agentInfo.name}</span>
              </div>
            )}
          </div>
          <div className="tutor-controls">
            <button
              className={`eye-contact-toggle ${this.enableEyeContact ? 'active' : ''}`}
              onClick={() => this.toggleEyeContact()}
              title={this.enableEyeContact ? 'Eye Contact: On' : 'Eye Contact: Off'}
            >
              <i className="fa fa-eye" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="tutor-content">
          {/* Avatar Display */}
          <div className="avatar-container">
            <AvatarCanvas
              agentId="tutor-1"
              personality={this.currentPersonality}
              blendShapes={this.currentBlendShapes}
              isSpeaking={this.isSpeaking}
              emotion={this.currentEmotion}
              enableEyeContact={this.enableEyeContact}
            />
            <div className="avatar-emotion">
              {EMOTION_INFO[this.currentEmotion]?.name}
            </div>
          </div>

          {/* Messages */}
          <div className="tutor-messages" ref={this.setMessagesRef}>
            {this.messages.length === 0 ? (
              <div className="tutor-welcome">
                <h3>Welcome to Digital Tutor</h3>
                <p>I am your AI-powered tutor avatar.</p>
                <p>Select a personality and start learning!</p>
                <div className="personality-selector">
                  {(Object.keys(AGENT_INFO) as TutorPersonality[]).map((personality) => (
                    <button
                      key={personality}
                      className={`personality-btn ${this.currentPersonality === personality ? 'active' : ''}`}
                      onClick={() => this.setPersonality(personality)}
                      style={{
                        borderColor: this.currentPersonality === personality ? AGENT_INFO[personality].color : undefined,
                      }}
                    >
                      <i className={`fa ${AGENT_INFO[personality].icon}`} />
                      <span>{AGENT_INFO[personality].name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              this.messages.map((msg) => this.renderMessage(msg))
            )}
            {this.isProcessing && (
              <div className="message assistant processing">
                <div className="message-avatar">
                  <i className={`fa ${AGENT_INFO[this.currentPersonality].icon}`} />
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
        </div>

        {/* Emotion Selector */}
        {this.messages.length > 0 && (
          <div className="emotion-bar">
            <span className="emotion-label">Emotion:</span>
            <div className="emotion-selector">
              {(Object.keys(EMOTION_INFO) as TutorEmotion[]).map((emotion) => (
                <button
                  key={emotion}
                  className={`emotion-btn ${this.currentEmotion === emotion ? 'active' : ''}`}
                  onClick={() => this.setEmotion(emotion)}
                  title={EMOTION_INFO[emotion].name}
                >
                  <i className={`fa ${EMOTION_INFO[emotion].icon}`} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="tutor-input">
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
            placeholder={this.isRecording ? 'Listening...' : 'Ask your tutor anything...'}
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

  private renderMessage(msg: TutorMessage): React.ReactNode {
    const isUser = msg.role === 'user';
    const agentInfo = AGENT_INFO[this.currentPersonality];

    return (
      <div key={msg.id} className={`message ${msg.role}`}>
        {!isUser && (
          <div className="message-avatar" style={{ backgroundColor: agentInfo.color }}>
            <i className={`fa ${agentInfo.icon}`} />
          </div>
        )}
        <div className="message-content">
          {!isUser && (
            <>
              {msg.emotion && (
                <div className="message-emotion">
                  <i className={`fa ${EMOTION_INFO[msg.emotion].icon}`} />
                  {EMOTION_INFO[msg.emotion].name}
                </div>
              )}
              <div className="message-text">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
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

  private async handleSend(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.isProcessing) return;

    // Stop any playing audio
    this.stopAudio();

    // Add user message
    const userMessage: TutorMessage = {
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
      const response = await this.service.chat(text, 'local-user');

      // Set emotion from response
      if (response.emotion) {
        this.currentEmotion = response.emotion;
      }

      // Update blend shapes for animation
      if (response.blendShapes) {
        this.currentBlendShapes = response.blendShapes;
      }

      // Add assistant message
      const assistantMessage: TutorMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        emotion: response.emotion,
        audioUrl: response.audioUrl,
        animation: response.animationTimeline,
      };

      this.messages = [...this.messages, assistantMessage];

      // Play audio if available
      if (response.audioUrl && this.autoPlayEnabled) {
        this.playAudio(response.audioUrl);
      }
    } catch (error) {
      this.logger.error('Chat failed:', error);
      this.messageService.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isProcessing = false;
      this.update();
      this.scrollToBottom();
    }
  }

  private async handleVoiceInput(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      this.stopAudio();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channelCount,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = AUDIO_ANALYZER_FFT_SIZE;
      source.connect(this.analyser);

      this.startAudioLevelMonitoring();

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.processRecording();
      };

      this.mediaRecorder.start(MEDIARECORDER_DATA_INTERVAL_MS);
      this.isRecording = true;
      this.update();
    } catch (error) {
      this.logger.error('Failed to start recording:', error);
      this.messageService.error(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
      this.cleanupRecording();
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  private async processRecording(): Promise<void> {
    this.isRecording = false;
    this.stopAudioLevelMonitoring();
    this.update();

    const mimeType = this.getSupportedMimeType();
    const audioBlob = new Blob(this.audioChunks, { type: mimeType });
    const arrayBuffer = await audioBlob.arrayBuffer();

    this.cleanupRecording();
    this.isProcessing = true;
    this.update();

    try {
      // Stream audio for animation
      this.service.streamAudio(arrayBuffer);

      // For now, just simulate getting transcription
      // In production, this would call STT
      this.inputText = '[Voice input - STT integration needed]';
      this.isProcessing = false;
      this.update();
    } catch (error) {
      this.logger.error('Failed to process recording:', error);
      this.messageService.error(`Failed to process audio: ${error instanceof Error ? error.message : String(error)}`);
      this.isProcessing = false;
      this.update();
    }
  }

  private startAudioLevelMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.audioLevelInterval = setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      this.audioLevel = Math.min(100, (average / FREQUENCY_DATA_MAX_BYTE) * 100);
      this.update();
    }, AUDIO_LEVEL_MONITOR_INTERVAL_MS);
  }

  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    this.audioLevel = 0;
  }

  private cleanupRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    this.mediaRecorder = null;
    this.audioChunks = [];

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
  }

  private playAudio(url: string): void {
    this.stopAudio();

    this.audioElement = new Audio(url);
    this.isSpeaking = true;

    this.audioElement.onended = () => {
      this.isSpeaking = false;
      this.audioElement = null;
      this.update();
    };

    this.audioElement.onerror = () => {
      this.isSpeaking = false;
      this.audioElement = null;
      this.update();
    };

    this.audioElement.play().catch((error) => {
      this.logger.warn('Failed to play audio:', error);
      this.isSpeaking = false;
      this.audioElement = null;
    });

    this.update();
  }

  private stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement = null;
    }
    this.isSpeaking = false;
  }

  private handleAnimationFrames(frames: AnimationFrame[]): void {
    if (frames.length > 0) {
      const latestFrame = frames[frames.length - 1];

      // Convert blend shapes to object
      const shapes: Record<string, number> = {};
      for (const bs of latestFrame.blendShapes) {
        shapes[bs.name] = bs.value;
      }

      this.currentBlendShapes = shapes;
      this.update();
    }
  }

  private setPersonality(personality: TutorPersonality): void {
    this.currentPersonality = personality;
    this.currentEmotion = 'neutral';
    this.update();
  }

  private setEmotion(emotion: TutorEmotion): void {
    this.currentEmotion = emotion;
    this.service.setAvatarEmotion(emotion);
    this.update();
  }

  private toggleEyeContact(): void {
    this.enableEyeContact = !this.enableEyeContact;
    this.update();
  }

  private getSupportedMimeType(): string {
    for (const type of AUDIO_CONFIG.mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
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

  dispose(): void {
    super.dispose();
    this.stopAudioLevelMonitoring();
    this.cleanupRecording();
    this.stopAudio();
    this.service.disconnectAudio2Face();
  }
}
