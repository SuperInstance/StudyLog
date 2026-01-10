/**
 * React Widget Example
 *
 * This example demonstrates how to use the StudyLoG.AI agent system
 * within a React application. It shows:
 * - Creating a chat widget component
 * - Managing chat state
 * - Handling user input and AI responses
 * - Displaying cost tracking
 * - Voice input integration
 *
 * Usage:
 *   import { GAssistWidget } from './g-assist-widget';
 *   <GAssistWidget apiUrl="http://localhost:8787" />
 */

import React, { useState, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  cost?: number;
  model?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  cost: number;
  tokens: { input: number; output: number };
  finishReason: string;
}

export interface GAssistWidgetProps {
  /** API base URL for the G-Assist backend */
  apiUrl?: string;
  /** Initial model to use */
  defaultModel?: string;
  /** Enable voice input */
  enableVoice?: boolean;
  /** Show cost information */
  showCost?: boolean;
  /** Custom theme colors */
  theme?: {
    primary?: string;
    background?: string;
    text?: string;
  };
  /** Callback when a message is sent */
  onMessageSent?: (message: string) => void;
  /** Callback when a response is received */
  onResponseReceived?: (response: ChatResponse) => void;
}

// ═══════════════════════════════════════════════════════════════
// API Client Hook
// ═══════════════════════════════════════════════════════════════

export interface UseGAssistOptions {
  apiUrl: string;
  model?: string;
}

export interface UseGAssistReturn {
  sendMessage: (message: string) => Promise<ChatResponse>;
  isLoading: boolean;
  error: string | null;
  totalCost: number;
  resetCost: () => Promise<void>;
}

/**
 * React hook for G-Assist API communication
 */
export function useGAssist({ apiUrl, model = 'claude-3-5-haiku' }: UseGAssistOptions): UseGAssistReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState(0);

  const sendMessage = async (message: string): Promise<ChatResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/g-assist/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as ChatResponse;

      setTotalCost(prev => prev + data.cost);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetCost = async (): Promise<void> => {
    await fetch(`${apiUrl}/api/v1/costs/reset`, { method: 'POST' });
    setTotalCost(0);
  };

  return { sendMessage, isLoading, error, totalCost, resetCost };
}

// ═══════════════════════════════════════════════════════════════
// Voice Input Hook
// ═══════════════════════════════════════════════════════════════

export interface UseVoiceInputOptions {
  apiUrl: string;
  onTranscript: (text: string) => void;
}

export interface UseVoiceInputReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

/**
 * React hook for voice input using MediaRecorder API
 */
export function useVoiceInput({ apiUrl, onTranscript }: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async (): Promise<void> => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioForTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  };

  const stopRecording = (): void => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  const sendAudioForTranscription = async (audioBlob: Blob): Promise<void> => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const response = await fetch(`${apiUrl}/api/v1/g-assist/stt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioData: base64 }),
      });

      if (!response.ok) {
        throw new Error(`STT error: ${response.status}`);
      }

      const data = await response.json() as { text: string };
      onTranscript(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    }
  };

  return { isRecording, startRecording, stopRecording, error };
}

// ═══════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════

/**
 * Message display component
 */
export function ChatMessage({ message }: { message: ChatMessage }): React.ReactElement {
  const isUser = message.role === 'user';

  return (
    <div className={`g-assist-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-header">
        <span className="message-role">{isUser ? 'You' : 'AI'}</span>
        {message.cost !== undefined && (
          <span className="message-cost">${(message.cost * 1000).toFixed(4)}c</span>
        )}
      </div>
      <div className="message-content">{message.content}</div>
      {message.model && (
        <div className="message-model">{message.model}</div>
      )}
    </div>
  );
}

/**
 * Input component with optional voice
 */
export function ChatInput({
  onSend,
  disabled,
  enableVoice,
  isRecording,
  onToggleRecording,
  voiceError,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
  enableVoice?: boolean;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  voiceError?: string | null;
}): React.ReactElement {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <form className="g-assist-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a question..."
        disabled={disabled}
        className="g-assist-input"
      />
      {enableVoice && onToggleRecording && (
        <button
          type="button"
          onClick={onToggleRecording}
          disabled={disabled}
          className={`g-assist-voice-btn ${isRecording ? 'recording' : ''}`}
          title={isRecording ? 'Stop recording' : 'Start voice input'}
        >
          {isRecording ? '🔴' : '🎤'}
        </button>
      )}
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="g-assist-send-btn"
      >
        Send
      </button>
      {voiceError && (
        <div className="g-assist-voice-error">{voiceError}</div>
      )}
    </form>
  );
}

/**
 * Main G-Assist Widget Component
 */
export function GAssistWidget({
  apiUrl = 'http://localhost:8787',
  defaultModel = 'claude-3-5-haiku',
  enableVoice = false,
  showCost = true,
  theme = {},
  onMessageSent,
  onResponseReceived,
}: GAssistWidgetProps): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcript, setTranscript] = useState('');

  const gassist = useGAssist({ apiUrl, model: defaultModel });
  const voice = useVoiceInput({
    apiUrl,
    onTranscript: (text) => {
      setTranscript(text);
      if (text) {
        handleSend(text);
      }
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (message: string): Promise<void> => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    onMessageSent?.(message);

    try {
      const response = await gassist.sendMessage(message);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        cost: response.cost,
        model: response.model,
      };

      setMessages(prev => [...prev, assistantMessage]);
      onResponseReceived?.(response);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setTranscript('');
  };

  // Inline styles for simplicity
  const styles = {
    container: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: theme.background || '#1a1a2e',
      color: theme.text || '#eee',
      borderRadius: '12px',
      padding: '16px',
      maxWidth: '600px',
      width: '100%',
      border: '1px solid #333',
    },
    header: {
      display: 'flex' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #333',
    },
    title: {
      margin: 0,
      fontSize: '18px',
      fontWeight: 'bold',
    },
    cost: {
      fontSize: '12px',
      color: '#888',
    },
    messages: {
      height: '300px',
      overflowY: 'auto' as const,
      marginBottom: '16px',
      padding: '8px',
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
    },
    message: {
      marginBottom: '12px',
      padding: '8px 12px',
      borderRadius: '8px',
      maxWidth: '80%',
    },
    userMessage: {
      backgroundColor: theme.primary || '#4a9eff',
      marginLeft: 'auto',
      color: '#fff',
    },
    assistantMessage: {
      backgroundColor: '#333',
      marginRight: 'auto',
    },
    inputForm: {
      display: 'flex' as const,
      gap: '8px',
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: '20px',
      border: '1px solid #444',
      backgroundColor: '#252540',
      color: '#eee',
      fontSize: '14px',
    },
    sendBtn: {
      padding: '10px 20px',
      borderRadius: '20px',
      border: 'none',
      backgroundColor: theme.primary || '#4a9eff',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
    },
    voiceBtn: {
      padding: '10px 14px',
      borderRadius: '50%',
      border: 'none',
      backgroundColor: '#333',
      cursor: 'pointer',
      fontSize: '18px',
    },
    recording: {
      backgroundColor: '#ff4444',
      animation: 'pulse 1s infinite',
    },
  };

  return (
    <div style={styles.container} className="g-assist-widget">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .g-assist-message.user { margin-left: auto; }
        .g-assist-message.assistant { margin-right: auto; }
        .g-assist-message-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          opacity: 0.7;
          margin-bottom: 4px;
        }
        .g-assist-message-model {
          font-size: 10px;
          opacity: 0.5;
          margin-top: 4px;
        }
      `}</style>

      <div style={styles.header}>
        <h3 style={styles.title}>G-Assist</h3>
        {showCost && (
          <span style={styles.cost}>
            Cost: ${(gassist.totalCost * 100).toFixed(2)}c
          </span>
        )}
      </div>

      <div style={styles.messages} className="g-assist-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
            Ask me anything about AI, coding, or simulations!
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
            }}
            className={`g-assist-message ${msg.role}`}
          >
            <div className="g-assist-message-header">
              <span>{msg.role === 'user' ? 'You' : 'AI'}</span>
              {msg.cost !== undefined && (
                <span>${(msg.cost * 1000).toFixed(2)}c</span>
              )}
            </div>
            <div>{msg.content}</div>
            {msg.model && (
              <div className="g-assist-message-model">{msg.model}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="g-assist-input-container">
        {transcript && (
          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>
            Voice: "{transcript}"
          </div>
        )}
        <div style={styles.inputForm}>
          <input
            type="text"
            value={transcript || undefined}
            placeholder={voice.isRecording ? 'Listening...' : 'Ask a question...'}
            disabled={gassist.isLoading || voice.isRecording}
            style={{
              ...styles.input,
              opacity: voice.isRecording ? 0.5 : 1,
            }}
            readOnly
          />
          {enableVoice && (
            <button
              type="button"
              onClick={() => voice.isRecording ? voice.stopRecording() : voice.startRecording()}
              disabled={gassist.isLoading}
              style={{
                ...styles.voiceBtn,
                ...(voice.isRecording ? styles.recording : {}),
              }}
              title={voice.isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {voice.isRecording ? '🔴' : '🎤'}
            </button>
          )}
          <button
            type="button"
            onClick={() => gassist.resetCost()}
            disabled={gassist.isLoading}
            style={{ ...styles.sendBtn, backgroundColor: '#666', padding: '10px 14px' }}
            title="Reset cost"
          >
            🔄
          </button>
        </div>
        {gassist.error && (
          <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '8px' }}>
            {gassist.error}
          </div>
        )}
        {voice.error && (
          <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '8px' }}>
            Voice: {voice.error}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Example App
// ═══════════════════════════════════════════════════════════════

/**
 * Example application using the G-Assist widget
 */
export function ExampleApp(): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f0f1a',
      padding: '20px',
    }}>
      <GAssistWidget
        apiUrl="http://localhost:8787"
        defaultModel="claude-3-5-haiku"
        enableVoice={true}
        showCost={true}
        theme={{
          primary: '#6366f1',
          background: '#1a1a2e',
          text: '#eee',
        }}
        onMessageSent={(message) => {
          console.log('Message sent:', message);
        }}
        onResponseReceived={(response) => {
          console.log('Response received:', response);
        }}
      />
    </div>
  );
}

export default GAssistWidget;
