/**
 * StudyLoG.AI - Vibe Chat Widget
 *
 * Main chat interface for AI-powered development assistance.
 *
 * Features:
 * - Streaming markdown responses with syntax highlighting
 * - Tab-based conversation management
 * - Quick action buttons (explain, refactor, fix, etc.)
 * - Agent selection and routing
 * - File context attachments
 * - Diff preview and application
 * - Cost tracking and token counting
 * - Command palette integration
 *
 * UX inspired by Cursor IDE, Windsurf, and Zed.
 */

import * as React from 'react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { EditorService } from '@theia/editor/lib/browser/editor-service';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import {
  VibeChatWidget as WidgetConstants,
  VIBE_CHAT_COMMANDS,
  ChatMessage,
  FileReference,
  FileDiff,
  AgentType,
  VibeChatState,
  VibeChatConfig,
  DEFAULT_VIBE_CHAT_CONFIG,
  AGENT_INFO,
  Conversation,
  QUICK_ACTIONS,
  VibeChatError,
} from '../common';
import { VibeChatService, ConversationManager, ChatRequest } from './vibe-service';
import { DiffViewer } from './diff-viewer';
import { ContextPanel } from './context-panel';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for child components
 */
interface WidgetProps {
  state: VibeChatState;
  setState: (update: Partial<VibeChatState>) => void;
  service: VibeChatService;
  editorService: EditorService;
  messageService: MessageService;
  onSendMessage: (content: string, files?: FileReference[]) => Promise<void>;
  onQuickAction: (action: string) => void;
}

// ============================================================================
// Markdown Rendering Component
// ============================================================================

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  // Simple markdown parser (in production, use react-markdown)
  const renderMarkdown = React.useCallback((text: string) => {
    if (!text) return [];

    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code block
      if (line.startsWith('```')) {
        const language = line.slice(3).trim() || 'text';
        const codeLines: string[] = [];
        i++;

        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }

        result.push(
          <div key={`code-${i}`} className="code-block">
            <div className="code-block-header">
              <span className="code-language">{language}</span>
              <button
                className="code-copy-btn"
                onClick={() => navigator.clipboard.writeText(codeLines.join('\n'))}
              >
                <i className="fa fa-copy" />
              </button>
            </div>
            <pre><code className={`language-${language}`}>{codeLines.join('\n')}</code></pre>
          </div>
        );
        i++;
        continue;
      }

      // Header
      if (line.startsWith('#')) {
        const match = line.match(/^(#{1,6})\s(.+)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2];
          const Tag = `h${level}` as keyof JSX.IntrinsicElements;
          result.push(<Tag key={`header-${i}`}>{text}</Tag>);
          i++;
          continue;
        }
      }

      // List item
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.slice(2);
        result.push(<li key={`list-${i}`}>{text}</li>);
        i++;
        continue;
      }

      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        const text = line.replace(/^\d+\.\s/, '');
        result.push(<li key={`list-${i}`}>{text}</li>);
        i++;
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        result.push(<br key={`br-${i}`} />);
        i++;
        continue;
      }

      // Regular paragraph
      result.push(<p key={`p-${i}`}>{line}</p>);
      i++;
    }

    return result;
  }, []);

  return <div className={`markdown-content ${className}`}>{renderMarkdown(content)}</div>;
};

// ============================================================================
// Message Component
// ============================================================================

interface MessageComponentProps {
  message: ChatMessage;
  onApplyDiff?: (diff: FileDiff) => void;
  onCopyCode?: (code: string, language: string) => void;
  onInsertCode?: (code: string) => void;
}

const MessageComponent: React.FC<MessageComponentProps> = ({
  message,
  onApplyDiff,
  onCopyCode,
  onInsertCode,
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const agentInfo = message.agent ? AGENT_INFO[message.agent] : null;

  // Extract code blocks from message
  const codeBlocks = React.useMemo(() => {
    const blocks: Array<{ language: string; code: string; startLine: number }> = [];
    const lines = message.content.split('\n');
    let inCodeBlock = false;
    let currentLanguage = 'text';
    let currentCode: string[] = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          currentLanguage = line.slice(3).trim() || 'text';
          currentCode = [];
          startLine = i;
        } else {
          blocks.push({
            language: currentLanguage,
            code: currentCode.join('\n'),
            startLine,
          });
          inCodeBlock = false;
        }
      } else if (inCodeBlock) {
        currentCode.push(line);
      }
    }

    return blocks;
  }, [message.content]);

  return (
    <div className={`vibe-message vibe-message-${message.role} ${message.streaming ? 'streaming' : ''}`}>
      {/* Message header */}
      <div className="vibe-message-header">
        <div className="vibe-message-meta">
          {message.role === 'assistant' && (
            <>
              {agentInfo && (
                <span className="vibe-message-agent" style={{ color: agentInfo.color }}>
                  <i className={`fa ${agentInfo.icon}`} />
                  {agentInfo.name}
                </span>
              )}
              {message.model && (
                <span className="vibe-message-model">{message.model}</span>
              )}
            </>
          )}
          {message.role === 'user' && (
            <span className="vibe-message-role">You</span>
          )}
          <span className="vibe-message-time">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <button
          className="vibe-message-expand"
          onClick={() => setExpanded(!expanded)}
        >
          <i className={`fa ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
        </button>
      </div>

      {/* Message content */}
      {expanded && (
        <>
          <div className="vibe-message-content">
            <MarkdownContent content={message.content} />
          </div>

          {/* Message actions for assistant messages */}
          {message.role === 'assistant' && !message.streaming && (
            <div className="vibe-message-actions">
              {codeBlocks.length > 0 && (
                <>
                  <button
                    className="vibe-action-btn"
                    onClick={() => {
                      const block = codeBlocks[0];
                      onCopyCode?.(block.code, block.language);
                    }}
                    title="Copy code"
                  >
                    <i className="fa fa-copy" />
                  </button>
                  <button
                    className="vibe-action-btn"
                    onClick={() => {
                      const block = codeBlocks[0];
                      onInsertCode?.(block.code);
                    }}
                    title="Insert at cursor"
                  >
                    <i className="fa fa-plus-circle" />
                  </button>
                </>
              )}
              <button
                className="vibe-action-btn"
                onClick={() => navigator.clipboard.writeText(message.content)}
                title="Copy message"
              >
                <i className="fa fa-clipboard" />
              </button>
            </div>
          )}

          {/* Token/cost info */}
          {(message.tokens || message.cost) && (
            <div className="vibe-message-stats">
              {message.tokens && (
                <span className="vibe-stat" title="Token usage">
                  <i className="fa fa-database" />
                  {message.tokens.input} in / {message.tokens.output} out
                </span>
              )}
              {message.cost && (
                <span className="vibe-stat" title="Estimated cost">
                  <i className="fa fa-usd" />
                  {message.cost.toFixed(6)}
                </span>
              )}
            </div>
          )}

          {/* File references */}
          {message.files && message.files.length > 0 && (
            <div className="vibe-message-files">
              <i className="fa fa-paperclip" />
              {message.files.map((file) => (
                <span key={file.uri} className="vibe-file-ref">
                  {file.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Error display */}
      {message.error && (
        <div className="vibe-message-error">
          <i className="fa fa-exclamation-triangle" />
          <span>{message.error}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Quick Actions Bar
// ============================================================================

interface QuickActionsBarProps {
  onAction: (action: string) => void;
  disabled: boolean;
}

const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ onAction, disabled }) => {
  const [showAll, setShowAll] = React.useState(false);

  const primaryActions = ['explain', 'refactor', 'fix', 'addTests'];
  const secondaryActions = ['optimize', 'document'];

  return (
    <div className="vibe-quick-actions">
      <span className="vibe-quick-label">Quick:</span>
      {primaryActions.map((action) => {
        const config = QUICK_ACTIONS[action];
        return (
          <button
            key={action}
            className="vibe-quick-btn"
            onClick={() => onAction(action)}
            disabled={disabled}
            title={config.description}
          >
            <i className={`fa ${config.iconClass}`} />
            {config.label}
          </button>
        );
      })}

      <div className="vibe-quick-more">
        <button
          className="vibe-quick-btn"
          onClick={() => setShowAll(!showAll)}
        >
          <i className={`fa ${showAll ? 'fa-chevron-up' : 'fa-ellipsis-h'}`} />
        </button>

        {showAll && (
          <div className="vibe-quick-dropdown">
            {secondaryActions.map((action) => {
              const config = QUICK_ACTIONS[action];
              return (
                <button
                  key={action}
                  className="vibe-quick-btn"
                  onClick={() => {
                    onAction(action);
                    setShowAll(false);
                  }}
                  disabled={disabled}
                  title={config.description}
                >
                  <i className={`fa ${config.iconClass}`} />
                  {config.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Settings Panel
// ============================================================================

interface SettingsPanelProps {
  config: VibeChatConfig;
  onConfigChange: (config: Partial<VibeChatConfig>) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onConfigChange, onClose }) => {
  return (
    <div className="vibe-settings-panel">
      <div className="vibe-settings-header">
        <h3>Settings</h3>
        <button onClick={onClose}>
          <i className="fa fa-times" />
        </button>
      </div>

      <div className="vibe-settings-content">
        {/* Model selection */}
        <div className="vibe-setting">
          <label>Model</label>
          <select
            value={config.model}
            onChange={(e) => onConfigChange({ model: e.target.value })}
          >
            <option value="claude-opus-4-5">Claude Opus 4.5 (Premium)</option>
            <option value="claude-sonnet-4-5">Claude Sonnet 4.5 (Balanced)</option>
            <option value="claude-haiku-4-5">Claude Haiku 4.5 (Fast)</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="o1">o1 (Reasoning)</option>
            <option value="o1-mini">o1 Mini</option>
          </select>
        </div>

        {/* Agent selection */}
        <div className="vibe-setting">
          <label>Agent</label>
          <select
            value={config.agent}
            onChange={(e) => onConfigChange({ agent: e.target.value as AgentType })}
          >
            {Object.entries(AGENT_INFO).map(([key, info]) => (
              <option key={key} value={key}>
                {info.name} - {info.description}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature */}
        <div className="vibe-setting">
          <label>Temperature: {config.temperature}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.temperature}
            onChange={(e) => onConfigChange({ temperature: parseFloat(e.target.value) })}
          />
        </div>

        {/* Max tokens */}
        <div className="vibe-setting">
          <label>Max Tokens</label>
          <input
            type="number"
            min="256"
            max="32000"
            step="256"
            value={config.maxTokens}
            onChange={(e) => onConfigChange({ maxTokens: parseInt(e.target.value) })}
          />
        </div>

        {/* Toggles */}
        <div className="vibe-setting">
          <label>
            <input
              type="checkbox"
              checked={config.diffFirst}
              onChange={(e) => onConfigChange({ diffFirst: e.target.checked })}
            />
            Diff-first editing
          </label>
        </div>

        <div className="vibe-setting">
          <label>
            <input
              type="checkbox"
              checked={config.stream}
              onChange={(e) => onConfigChange({ stream: e.target.checked })}
            />
            Stream responses
          </label>
        </div>

        <div className="vibe-setting">
          <label>
            <input
              type="checkbox"
              checked={config.autoContext}
              onChange={(e) => onConfigChange({ autoContext: e.target.checked })}
            />
            Auto-gather context
          </label>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Widget Component
// ============================================================================

const VibeChatUI: React.FC<WidgetProps> = ({
  state,
  setState,
  service,
  editorService,
  messageService,
  onSendMessage,
  onQuickAction,
}) => {
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showContext, setShowContext] = React.useState(false);
  const [activeDiff, setActiveDiff] = React.useState<FileDiff | null>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [selectedText, setSelectedText] = React.useState('');
  const [currentFileUri, setCurrentFileUri] = React.useState<string | null>(null);

  // Get current conversation
  const activeConversation = React.useMemo(() => {
    return state.conversations.find((c) => c.id === state.activeConversationId);
  }, [state.conversations, state.activeConversationId]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length]);

  // Get selected text from editor
  React.useEffect(() => {
    const updateSelection = async () => {
      try {
        const editor = editorService.editor;
        if (editor) {
          const selection = editor.selection;
          if (selection) {
            const text = editor.document.getText(selection);
            setSelectedText(text || '');
            setCurrentFileUri(editor.document.uri.toString());
          }
        }
      } catch (error) {
        // Editor might not be ready
      }
    };

    updateSelection();

    // Listen for editor changes
    const interval = setInterval(updateSelection, 1000);
    return () => clearInterval(interval);
  }, [editorService]);

  // Handle send message
  const handleSend = React.useCallback(async () => {
    const content = inputValue.trim();
    if (!content || state.isStreaming) {
      return;
    }

    setInputValue('');

    // Include selected text if available
    let files = [...state.attachedFiles];
    if (selectedText && currentFileUri) {
      files = files.filter((f) => f.uri !== currentFileUri);
      files.push({
        uri: currentFileUri,
        name: currentFileUri.split('/').pop() || currentFileUri,
        language: 'text',
        reason: 'selection',
        range: undefined,
      });
    }

    await onSendMessage(content, files.length > 0 ? files : undefined);
  }, [inputValue, selectedText, currentFileUri, state.attachedFiles, state.isStreaming, onSendMessage]);

  // Handle keyboard input
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Escape to close panels
    if (e.key === 'Escape') {
      if (showSettings) setShowSettings(false);
      if (showContext) setShowContext(false);
      if (activeDiff) setActiveDiff(null);
    }
  }, [handleSend, showSettings, showContext, activeDiff]);

  // Handle quick action
  const handleQuickAction = React.useCallback((action: string) => {
    if (!selectedText) {
      messageService.warn('Please select some code first');
      return;
    }

    const actionConfig = QUICK_ACTIONS[action];
    if (actionConfig) {
      const prompt = actionConfig.promptTemplate
        .replace('{selection}', selectedText)
        .replace('{language}', 'typescript'); // Could detect from file

      setInputValue(prompt);
      inputRef.current?.focus();
    }
  }, [selectedText, messageService]);

  // Handle apply diff
  const handleApplyDiff = React.useCallback((diff: FileDiff) => {
    setActiveDiff(diff);
  }, []);

  // Handle code copy
  const handleCopyCode = React.useCallback((code: string, language: string) => {
    navigator.clipboard.writeText(code);
    messageService.info('Code copied to clipboard');
  }, [messageService]);

  // Handle code insert
  const handleInsertCode = React.useCallback(async (code: string) => {
    try {
      const editor = editorService.editor;
      if (editor) {
        const selection = editor.selection;
        if (selection) {
          const edit = { range: selection, text: code };
          await editor.document.applyEdits([edit]);
          messageService.info('Code inserted at cursor');
        } else {
          messageService.warn('No cursor position in editor');
        }
      } else {
        messageService.warn('No active editor');
      }
    } catch (error) {
      messageService.error(`Failed to insert code: ${error}`);
    }
  }, [editorService, messageService]);

  // Create new conversation
  const handleNewConversation = React.useCallback(() => {
    const newConversation: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setState({
      conversations: [...state.conversations, newConversation],
      activeConversationId: newConversation.id,
    });
  }, [state.conversations, setState]);

  return (
    <div className="vibe-chat-container">
      {/* Header */}
      <div className="vibe-chat-header">
        <div className="vibe-chat-title">
          <i className={WidgetConstants.ICON_CLASS} />
          <h2>Vibe Chat</h2>
        </div>

        <div className="vibe-chat-controls">
          {/* Agent selector */}
          <select
            className="vibe-agent-select"
            value={state.config.agent}
            onChange={(e) => setState({ config: { ...state.config, agent: e.target.value as AgentType } })}
          >
            {Object.entries(AGENT_INFO).map(([key, info]) => (
              <option key={key} value={key}>
                {info.name}
              </option>
            ))}
          </select>

          {/* Buttons */}
          <button
            className="vibe-header-btn"
            onClick={() => setShowContext(!showContext)}
            title="Context panel"
          >
            <i className="fa fa-paperclip" />
            {state.attachedFiles.length > 0 && (
              <span className="vibe-badge">{state.attachedFiles.length}</span>
            )}
          </button>

          <button
            className="vibe-header-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <i className="fa fa-cog" />
          </button>

          <button
            className="vibe-header-btn"
            onClick={handleNewConversation}
            title="New conversation"
          >
            <i className="fa fa-plus" />
          </button>
        </div>
      </div>

      {/* Quick actions bar */}
      <QuickActionsBar
        onAction={handleQuickAction}
        disabled={state.isStreaming || !selectedText}
      />

      {/* Main content area */}
      <div className="vibe-chat-main">
        {/* Messages */}
        <div className="vibe-messages">
          {activeConversation?.messages.length === 0 ? (
            <div className="vibe-welcome">
              <h3>Welcome to Vibe Chat</h3>
              <p>AI-powered development assistance</p>
              <div className="vibe-welcome-tips">
                <div className="vibe-tip">
                  <i className="fa fa-lightbulb-o" />
                  <span>Select code and use quick actions for instant help</span>
                </div>
                <div className="vibe-tip">
                  <i className="fa fa-comments" />
                  <span>Chat naturally about your code and architecture</span>
                </div>
                <div className="vibe-tip">
                  <i className="fa fa-files-o" />
                  <span>Attach files for context-aware responses</span>
                </div>
              </div>
            </div>
          ) : (
            activeConversation?.messages.map((message) => (
              <MessageComponent
                key={message.id}
                message={message}
                onApplyDiff={handleApplyDiff}
                onCopyCode={handleCopyCode}
                onInsertCode={handleInsertCode}
              />
            ))
          )}

          {/* Streaming indicator */}
          {state.isStreaming && (
            <div className="vibe-message vibe-message-assistant streaming">
              <div className="vibe-message-header">
                <span className="vibe-message-agent">
                  <i className="fa fa-spinner fa-spin" />
                  Thinking...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesRef} />
        </div>

        {/* Side panels */}
        {showContext && (
          <ContextPanel
            attachedFiles={state.attachedFiles}
            onAttachFiles={(files) => setState({ attachedFiles: [...state.attachedFiles, ...files] })}
            onDetachFile={(uri) => setState({
              attachedFiles: state.attachedFiles.filter((f) => f.uri !== uri)
            })}
            onClearAll={() => setState({ attachedFiles: [] })}
            expanded={showContext}
            onToggleExpand={() => setShowContext(!showContext)}
            tokenCount={service.estimateTokens(
              state.attachedFiles.map((f) => f.name).join('\n')
            )}
          />
        )}

        {activeDiff && (
          <div className="vibe-diff-panel">
            <div className="vibe-diff-header">
              <h3>Proposed Changes</h3>
              <button onClick={() => setActiveDiff(null)}>
                <i className="fa fa-times" />
              </button>
            </div>
            <DiffViewer
              diff={activeDiff}
              onAcceptAll={() => {
                service.applyDiff(activeDiff).then((success) => {
                  if (success) {
                    messageService.info('Changes applied');
                    setActiveDiff(null);
                  } else {
                    messageService.error('Failed to apply changes');
                  }
                });
              }}
              onRejectAll={() => setActiveDiff(null)}
              onAcceptChanges={() => {/* TODO */}}
              onRejectChanges={() => {/* TODO */}}
            />
          </div>
        )}

        {showSettings && (
          <SettingsPanel
            config={state.config}
            onConfigChange={(config) => setState({ config: { ...state.config, ...config } })}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>

      {/* Input area */}
      <div className="vibe-chat-input">
        <textarea
          ref={inputRef}
          className="vibe-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your code... (Enter to send, Shift+Enter for new line)"
          disabled={state.isStreaming}
          rows={inputValue.split('\n').length > 3 ? inputValue.split('\n').length : 1}
        />
        <button
          className={`vibe-send-btn ${inputValue.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={state.isStreaming || !inputValue.trim()}
        >
          <i className={`fa ${state.isStreaming ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Theia Widget Class
// ============================================================================

@injectable()
export class VibeChatWidget extends ReactWidget {
  static readonly ID = WidgetConstants.ID;
  static readonly LABEL = WidgetConstants.LABEL;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  @inject(EditorService)
  protected readonly editorService!: EditorService;

  @inject(OpenerService)
  protected readonly openerService!: OpenerService;

  @inject(VibeChatService)
  protected readonly vibeChatService!: VibeChatService;

  protected state: VibeChatState = {
    conversations: [],
    activeConversationId: null,
    attachedFiles: [],
    isStreaming: false,
    inputText: '',
    config: { ...DEFAULT_VIBE_CHAT_CONFIG },
    activeDiff: null,
    panels: {
      context: false,
      diff: false,
      history: false,
    },
    isLoading: false,
  };

  private conversationManager: ConversationManager;

  @postConstruct()
  protected init(): void {
    this.id = VibeChatWidget.ID;
    this.title.label = VibeChatWidget.LABEL;
    this.title.caption = 'Vibe Coding Chat System';
    this.title.closable = true;
    this.title.iconClass = WidgetConstants.ICON_CLASS;
    this.addClass('vibe-chat');

    // Initialize conversation manager
    this.conversationManager = new ConversationManager(this.vibeChatService);

    // Create initial conversation
    this.conversationManager.startNew('Vibe Chat');
    this.state.activeConversationId = this.conversationManager.getCurrent()?.id || null;
    this.state.conversations = [this.conversationManager.getCurrent()!];

    // Subscribe to streaming events
    this.vibeChatService.onMessage((chunk) => this.handleStreamChunk(chunk));

    // Subscribe to state changes
    this.vibeChatService.onStateChange((serviceState) => {
      this.setState({ isStreaming: serviceState === 'streaming' });
    });

    this.update();
  }

  protected render(): React.ReactNode {
    return (
      <VibeChatUI
        state={this.state}
        setState={(update) => this.setState(update)}
        service={this.vibeChatService}
        editorService={this.editorService}
        messageService={this.messageService}
        onSendMessage={(content, files) => this.handleSendMessage(content, files)}
        onQuickAction={(action) => this.handleQuickAction(action)}
      />
    );
  }

  /**
   * Handle sending a message
   */
  private async handleSendMessage(content: string, files?: FileReference[]): Promise<void> {
    const currentConversation = this.conversationManager.getCurrent();
    if (!currentConversation) {
      this.conversationManager.startNew();
    }

    // Add user message
    const userMessage = this.vibeChatService.createMessage(content, 'user', {
      files,
    });
    this.conversationManager.addMessage(userMessage);

    // Update state
    this.updateConversationState();

    try {
      // Gather context if auto-context is enabled
      let contextFiles = files;
      if (this.state.config.autoContext && !files) {
        contextFiles = await this.vibeChatService.gatherContext({
          includeActiveFile: true,
          includeSelection: true,
          semanticSearch: true,
          query: content,
        });
      }

      // Stream response
      const request: ChatRequest = {
        messages: this.conversationManager.getCurrent()?.messages || [],
        agent: this.state.config.agent,
        model: this.state.config.model,
        temperature: this.state.config.temperature,
        maxTokens: this.state.config.maxTokens,
        files: contextFiles,
        stream: this.state.config.stream,
      };

      // Create assistant message placeholder
      const assistantMessage = this.vibeChatService.createMessage('', 'assistant', {
        agent: this.state.config.agent === 'auto' ? 'builder' : this.state.config.agent,
        model: this.state.config.model,
        streaming: true,
      });
      this.conversationManager.addMessage(assistantMessage);
      this.updateConversationState();

      if (this.state.config.stream) {
        // Stream response
        for await (const chunk of this.vibeChatService.chatStream(request)) {
          this.handleStreamChunk(chunk);
        }
      } else {
        // Non-streaming response
        const response = await this.vibeChatService.chat(request);
        assistantMessage.content = response.message.content;
        assistantMessage.streaming = false;
        assistantMessage.model = response.model;
        assistantMessage.cost = response.cost;
        assistantMessage.tokens = response.tokens;
        this.updateConversationState();
      }

    } catch (error) {
      const errorMessage = error instanceof VibeChatError
        ? error.message
        : 'Failed to send message';

      // Add error message
      const errorMsg = this.vibeChatService.createMessage(errorMessage, 'system', {
        error: errorMessage,
      });
      this.conversationManager.addMessage(errorMsg);
      this.updateConversationState();

      this.messageService.error(errorMessage);
    }
  }

  /**
   * Handle streaming chunk
   */
  private handleStreamChunk(chunk: any): void {
    const currentConversation = this.conversationManager.getCurrent();
    if (!currentConversation || currentConversation.messages.length === 0) {
      return;
    }

    const lastMessage = currentConversation.messages[currentConversation.messages.length - 1];

    if (chunk.type === 'content') {
      lastMessage.content += chunk.content;
      this.updateConversationState();
    } else if (chunk.type === 'metadata') {
      if (chunk.metadata?.agent) {
        lastMessage.agent = chunk.metadata.agent;
      }
      if (chunk.metadata?.model) {
        lastMessage.model = chunk.metadata.model;
      }
      this.updateConversationState();
    } else if (chunk.type === 'done') {
      lastMessage.streaming = false;
      this.updateConversationState();
    } else if (chunk.type === 'error') {
      lastMessage.error = chunk.content;
      lastMessage.streaming = false;
      this.updateConversationState();
    }
  }

  /**
   * Handle quick action
   */
  private async handleQuickAction(action: string): Promise<void> {
    const actionConfig = QUICK_ACTIONS[action];
    if (!actionConfig) return;

    // Get selected text from editor
    let selectedText = '';
    let currentFile = '';

    try {
      const editor = this.editorService.editor;
      if (editor) {
        const selection = editor.selection;
        if (selection) {
          selectedText = editor.document.getText(selection);
          currentFile = editor.document.uri.toString();
        }
      }
    } catch (error) {
      // Editor might not be ready
    }

    if (!selectedText) {
      this.messageService.warn('Please select some code first');
      return;
    }

    // Build prompt
    const prompt = actionConfig.promptTemplate
      .replace('{selection}', selectedText)
      .replace('{language}', 'typescript'); // Could detect from file

    // Send as message
    await this.handleSendMessage(prompt, currentFile ? [{
      uri: currentFile,
      name: currentFile.split('/').pop() || currentFile,
      language: 'typescript',
      reason: 'selection',
    }] : undefined);
  }

  /**
   * Update conversation state from manager
   */
  private updateConversationState(): void {
    const current = this.conversationManager.getCurrent();
    if (current) {
      this.setState({
        conversations: this.state.conversations.map((c) =>
          c.id === current.id ? current : c
        ),
      });
    }
  }

  /**
   * Update state and trigger re-render
   */
  private setState(update: Partial<VibeChatState>): void {
    this.state = { ...this.state, ...update };
    this.update();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    super.dispose();
    this.vibeChatService.cancelAllStreams();
  }
}

export default VibeChatWidget;
