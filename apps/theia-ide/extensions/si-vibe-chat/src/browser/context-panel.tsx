/**
 * StudyLoG.AI - Vibe Chat Context Panel
 *
 * React component for managing file context attachments.
 * Shows active files, allows adding/removing context, and displays
 * semantic search results for relevant files.
 *
 * Features:
 * - Drag-and-drop file attachment
 * - File search with semantic matching
 * - Visual context indicators
 * - Token count estimation
 * - File preview on hover
 */

import * as React from 'react';
import { FileReference, ContextReason } from '../common';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ContextPanel component
 */
export interface ContextPanelProps {
  /** Currently attached files */
  attachedFiles: FileReference[];
  /** Callback when files are attached */
  onAttachFiles: (files: FileReference[]) => void;
  /** Callback when a file is detached */
  onDetachFile: (uri: string) => void;
  /** Callback when clearing all files */
  onClearAll: () => void;
  /** Available workspace files for search */
  availableFiles?: FileReference[];
  /** Whether the panel is expanded */
  expanded?: boolean;
  /** Toggle expand/collapse */
  onToggleExpand?: () => void;
  /** Total token count for context */
  tokenCount?: number;
  /** Max token budget */
  maxTokens?: number;
}

/**
 * State for context search
 */
interface SearchState {
  query: string;
  results: FileReference[];
  isSearching: boolean;
}

// ============================================================================
// Context Badge Component
// ============================================================================

interface ContextBadgeProps {
  reason: ContextReason;
}

const ContextBadge: React.FC<ContextBadgeProps> = ({ reason }) => {
  const config = React.useMemo(() => {
    switch (reason) {
      case 'active':
        return { label: 'Active', icon: 'fa-file-text-o', className: 'context-active' };
      case 'selection':
        return { label: 'Selected', icon: 'fa-mouse-pointer', className: 'context-selection' };
      case 'related':
        return { label: 'Related', icon: 'fa-link', className: 'context-related' };
      case 'import':
        return { label: 'Import', icon: 'fa-code', className: 'context-import' };
      case 'manual':
        return { label: 'Attached', icon: 'fa-paperclip', className: 'context-manual' };
    }
  }, [reason]);

  return (
    <span className={`context-badge ${config.className}`} title={`Reason: ${reason}`}>
      <i className={`fa ${config.icon}`} />
      <span>{config.label}</span>
    </span>
  );
};

// ============================================================================
// File Item Component
// ============================================================================

interface FileItemProps {
  file: FileReference;
  onDetach: (uri: string) => void;
  onPreview?: (uri: string) => void;
  tokenCount?: number;
  showTokenCount?: boolean;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDetach,
  onPreview,
  tokenCount,
  showTokenCount,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  // Get icon for file type
  const fileIcon = React.useMemo(() => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      ts: 'fa-file-code-o',
      tsx: 'fa-react',
      js: 'fa-file-code-o',
      jsx: 'fa-react',
      py: 'fa-python',
      rs: 'fa-rust',
      go: 'fa-golang',
      java: 'fa-java',
      cpp: 'fa-file-code-o',
      c: 'fa-file-code-o',
      cs: 'fa-file-code-o',
      json: 'fa-file-code-o',
      md: 'fa-file-text-o',
      txt: 'fa-file-text-o',
      html: 'fa-html5',
      css: 'fa-css3',
      scss: 'fa-css3',
      svg: 'fa-picture-o',
      png: 'fa-picture-o',
      jpg: 'fa-picture-o',
    };
    return iconMap[ext || ''] || 'fa-file-o';
  }, [file.name]);

  return (
    <div
      className={`context-file-item ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="context-file-info" onClick={() => onPreview?.(file.uri)}>
        <i className={`fa ${fileIcon} context-file-icon`} />
        <span className="context-file-name" title={file.uri}>
          {file.name}
        </span>
        {file.range && (
          <span className="context-file-range">
            :{file.range.start.line}-{file.range.end.line}
          </span>
        )}
        <ContextBadge reason={file.reason} />
      </div>

      <div className="context-file-actions">
        {showTokenCount && tokenCount !== undefined && (
          <span className="context-file-tokens" title="Estimated tokens">
            {tokenCount}
          </span>
        )}
        <button
          className="context-file-detach"
          onClick={() => onDetach(file.uri)}
          title="Remove from context"
        >
          <i className="fa fa-times" />
        </button>
      </div>

      {file.reason && (
        <div className="context-file-reason" title={file.reason}>
          {file.reason}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// File Search Component
// ============================================================================

interface FileSearchProps {
  availableFiles?: FileReference[];
  onAttachFiles: (files: FileReference[]) => void;
  attachedFiles: FileReference[];
}

const FileSearch: React.FC<FileSearchProps> = ({
  availableFiles = [],
  onAttachFiles,
  attachedFiles,
}) => {
  const [state, setState] = React.useState<SearchState>({
    query: '',
    results: [],
    isSearching: false,
  });
  const [isOpen, setIsOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Filter attached URIs
  const attachedUris = React.useMemo(
    () => new Set(attachedFiles.map((f) => f.uri)),
    [attachedFiles]
  );

  // Handle search
  React.useEffect(() => {
    if (!state.query.trim()) {
      setState((prev) => ({ ...prev, results: [] }));
      return;
    }

    setState((prev) => ({ ...prev, isSearching: true }));

    // Simulate async search (could be semantic search API)
    const timeoutId = setTimeout(() => {
      const query = state.query.toLowerCase();
      const results = availableFiles
        .filter((f) => !attachedUris.has(f.uri))
        .filter((f) => {
          // Name match
          if (f.name.toLowerCase().includes(query)) return true;
          // Path match
          if (f.uri.toLowerCase().includes(query)) return true;
          return false;
        })
        .slice(0, 10); // Limit results

      setState((prev) => ({ ...prev, results, isSearching: false }));
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [state.query, availableFiles, attachedUris]);

  // Handle select
  const handleSelect = (file: FileReference) => {
    onAttachFiles([{ ...file, reason: 'manual' }]);
    setState((prev) => ({ ...prev, query: '', results: [] }));
    setIsOpen(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && state.results.length > 0) {
      e.preventDefault();
      const firstItem = listRef.current?.querySelector('li:first-child button');
      firstItem?.focus();
    }
  };

  return (
    <div className="context-file-search">
      <div className="context-search-input">
        <i className="fa fa-search context-search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search files to attach..."
          value={state.query}
          onChange={(e) => setState({ ...state, query: e.target.value })}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {state.isSearching && (
          <i className="fa fa-spinner fa-spin context-search-spinner" />
        )}
      </div>

      {isOpen && (state.results.length > 0 || state.query) && (
        <ul className="context-search-results" ref={listRef}>
          {state.results.length === 0 ? (
            <li className="context-search-empty">
              <i className="fa fa-info-circle" />
              <span>No files found</span>
            </li>
          ) : (
            state.results.map((file) => (
              <li key={file.uri}>
                <button
                  onClick={() => handleSelect(file)}
                  className="context-search-result"
                >
                  <i className="fa fa-file-o" />
                  <span className="context-search-file-name">{file.name}</span>
                  <span className="context-search-file-path">
                    {file.uri.split('/').slice(-2).join('/')}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

// ============================================================================
// Token Budget Indicator
// ============================================================================

interface TokenBudgetProps {
  current: number;
  max: number;
}

const TokenBudget: React.FC<TokenBudgetProps> = ({ current, max }) => {
  const percentage = Math.min((current / max) * 100, 100);
  const isOverBudget = current > max;

  return (
    <div className={`context-token-budget ${isOverBudget ? 'over-budget' : ''}`}>
      <div className="token-budget-bar">
        <div
          className="token-budget-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="token-budget-text">
        <span>{current.toLocaleString()}</span>
        <span>/</span>
        <span>{max.toLocaleString()}</span>
        <span> tokens</span>
        {isOverBudget && (
          <span className="token-budget-warning">
            <i className="fa fa-exclamation-triangle" />
            Over budget!
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Context Panel Component
// ============================================================================

export const ContextPanel: React.FC<ContextPanelProps> = ({
  attachedFiles,
  onAttachFiles,
  onDetachFile,
  onClearAll,
  availableFiles,
  expanded = true,
  onToggleExpand,
  tokenCount = 0,
  maxTokens = 100000,
}) => {
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewFile, setPreviewFile] = React.useState<FileReference | null>(null);

  // Group files by reason
  const groupedFiles = React.useMemo(() => {
    const groups: Record<ContextReason, FileReference[]> = {
      active: [],
      selection: [],
      related: [],
      import: [],
      manual: [],
    };
    for (const file of attachedFiles) {
      groups[file.reason || 'manual'].push(file);
    }
    return groups;
  }, [attachedFiles]);

  // Count files by reason
  const fileCounts = React.useMemo(() => {
    const counts: Record<ContextReason, number> = {
      active: 0,
      selection: 0,
      related: 0,
      import: 0,
      manual: 0,
    };
    for (const file of attachedFiles) {
      const reason = file.reason || 'manual';
      counts[reason]++;
    }
    return counts;
  }, [attachedFiles]);

  // Handle file preview
  const handlePreview = React.useCallback((uri: string) => {
    const file = attachedFiles.find((f) => f.uri === uri);
    if (file) {
      setPreviewFile(file);
      setShowPreview(true);
    }
  }, [attachedFiles]);

  // Handle drop
  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files: FileReference[] = [];

    for (const item of e.dataTransfer.items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push({
            uri: file.name,
            name: file.name,
            language: 'text',
            reason: 'manual',
          });
        }
      }
    }

    if (files.length > 0) {
      onAttachFiles(files);
    }
  }, [onAttachFiles]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (!expanded) {
    return (
      <div className="context-panel context-panel-collapsed">
        <button
          className="context-panel-expand"
          onClick={onToggleExpand}
          title="Expand context panel"
        >
          <i className="fa fa-file-text-o" />
          {attachedFiles.length > 0 && (
            <span className="context-panel-badge">{attachedFiles.length}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="context-panel"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="context-panel-header">
        <div className="context-panel-title">
          <button
            className="context-panel-collapse"
            onClick={onToggleExpand}
            title="Collapse"
          >
            <i className="fa fa-chevron-left" />
          </button>
          <h3>Context</h3>
          <span className="context-count">({attachedFiles.length})</span>
        </div>

        {attachedFiles.length > 0 && (
          <button
            className="context-clear-all"
            onClick={onClearAll}
            title="Clear all files"
          >
            <i className="fa fa-trash-o" />
          </button>
        )}
      </div>

      {/* Token budget */}
      <div className="context-panel-budget">
        <TokenBudget current={tokenCount} max={maxTokens} />
      </div>

      {/* File search */}
      <div className="context-panel-search">
        <FileSearch
          availableFiles={availableFiles}
          onAttachFiles={onAttachFiles}
          attachedFiles={attachedFiles}
        />
      </div>

      {/* File list */}
      <div className="context-panel-files">
        {attachedFiles.length === 0 ? (
          <div className="context-empty-state">
            <i className="fa fa-files-o" />
            <p>No files in context</p>
            <p className="context-empty-hint">
              Drag files here or use search to attach
            </p>
          </div>
        ) : (
          <>
            {/* Active files */}
            {groupedFiles.active.length > 0 && (
              <div className="context-file-group">
                <div className="context-group-header">
                  <i className="fa fa-file-text-o" />
                  <span>Active ({fileCounts.active})</span>
                </div>
                {groupedFiles.active.map((file) => (
                  <FileItem
                    key={file.uri}
                    file={file}
                    onDetach={onDetachFile}
                    onPreview={handlePreview}
                    showTokenCount
                  />
                ))}
              </div>
            )}

            {/* Selected files */}
            {groupedFiles.selection.length > 0 && (
              <div className="context-file-group">
                <div className="context-group-header">
                  <i className="fa fa-mouse-pointer" />
                  <span>Selected ({fileCounts.selection})</span>
                </div>
                {groupedFiles.selection.map((file) => (
                  <FileItem
                    key={file.uri}
                    file={file}
                    onDetach={onDetachFile}
                    onPreview={handlePreview}
                    showTokenCount
                  />
                ))}
              </div>
            )}

            {/* Related files */}
            {groupedFiles.related.length > 0 && (
              <div className="context-file-group">
                <div className="context-group-header">
                  <i className="fa fa-link" />
                  <span>Related ({fileCounts.related})</span>
                </div>
                {groupedFiles.related.map((file) => (
                  <FileItem
                    key={file.uri}
                    file={file}
                    onDetach={onDetachFile}
                    onPreview={handlePreview}
                    showTokenCount
                  />
                ))}
              </div>
            )}

            {/* Import files */}
            {groupedFiles.import.length > 0 && (
              <div className="context-file-group">
                <div className="context-group-header">
                  <i className="fa fa-code" />
                  <span>Imports ({fileCounts.import})</span>
                </div>
                {groupedFiles.import.map((file) => (
                  <FileItem
                    key={file.uri}
                    file={file}
                    onDetach={onDetachFile}
                    onPreview={handlePreview}
                    showTokenCount
                  />
                ))}
              </div>
            )}

            {/* Manual attachments */}
            {groupedFiles.manual.length > 0 && (
              <div className="context-file-group">
                <div className="context-group-header">
                  <i className="fa fa-paperclip" />
                  <span>Attached ({fileCounts.manual})</span>
                </div>
                {groupedFiles.manual.map((file) => (
                  <FileItem
                    key={file.uri}
                    file={file}
                    onDetach={onDetachFile}
                    onPreview={handlePreview}
                    showTokenCount
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drag overlay */}
      <div className="context-drag-overlay">
        <i className="fa fa-upload" />
        <span>Drop files to attach</span>
      </div>

      {/* File preview modal */}
      {showPreview && previewFile && (
        <div
          className="context-preview-overlay"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="context-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-preview-header">
              <span>{previewFile.name}</span>
              <button onClick={() => setShowPreview(false)}>
                <i className="fa fa-times" />
              </button>
            </div>
            <div className="context-preview-content">
              {/* Content would be loaded from backend */}
              <p className="context-preview-placeholder">
                File preview would load content for {previewFile.uri}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextPanel;
