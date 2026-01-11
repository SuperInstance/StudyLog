/**
 * StudyLoG.AI - Vibe Chat Diff Viewer
 *
 * React component for displaying AI-generated code changes as diffs.
 * Provides per-line accept/reject functionality with visual highlighting.
 *
 * Features:
 * - Side-by-side or unified diff view
 * - Syntax highlighting for both versions
 * - Per-change accept/reject buttons
 * - Agent attribution per change
 * - Keyboard shortcuts for navigation
 * - Collapsible unchanged sections
 *
 * Based on diff-first UX pattern from Cursor, Windsurf, and GitHub Copilot.
 */

import * as React from 'react';
import { FileDiff, DiffChange, ChangeType, AGENT_INFO } from '../common';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the DiffViewer component
 */
export interface DiffViewerProps {
  /** The diff to display */
  diff: FileDiff;
  /** Callback when all changes are accepted */
  onAcceptAll: () => void;
  /** Callback when all changes are rejected */
  onRejectAll: () => void;
  /** Callback when specific changes are accepted */
  onAcceptChanges: (lineNumbers: number[]) => void;
  /** Callback when specific changes are rejected */
  onRejectChanges: (lineNumbers: number[]) => void;
  /** View mode */
  viewMode?: 'unified' | 'split';
  /** Whether to show unchanged lines */
  showUnchanged?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

/**
 * State for the DiffViewer component
 */
interface DiffViewerState {
  /** View mode */
  viewMode: 'unified' | 'split';
  /** Whether unchanged sections are shown */
  showUnchanged: boolean;
  /** Changes pending acceptance */
  pendingAccept: Set<number>;
  /** Changes pending rejection */
  pendingReject: Set<number>;
  /** Collapsed sections */
  collapsedSections: Set<string>;
  /** Currently hovered change */
  hoveredChange: number | null;
}

// ============================================================================
// Diff Line Component
// ============================================================================

interface DiffLineProps {
  /** Line number (1-based) */
  lineNumber: number;
  /** Original content */
  original?: string;
  /** Modified content */
  modified?: string;
  /** Type of change */
  changeType?: ChangeType;
  /** Agent who made this change */
  agent?: string;
  /** Reason for the change */
  reason?: string;
  /** Whether this line is hovered */
  isHovered: boolean;
  /** Hover callback */
  onHover: (line: number | null) => void;
  /** Accept callback */
  onAccept?: (line: number) => void;
  /** Reject callback */
  onReject?: (line: number) => void;
}

const DiffLine: React.FC<DiffLineProps> = ({
  lineNumber,
  original,
  modified,
  changeType,
  agent,
  reason,
  isHovered,
  onHover,
  onAccept,
  onReject,
}) => {
  const [showReason, setShowReason] = React.useState(false);

  // Determine line class
  const lineClass = React.useMemo(() => {
    const classes = ['diff-line'];
    if (changeType) {
      classes.push(`diff-${changeType}`);
    }
    if (isHovered) {
      classes.push('diff-hovered');
    }
    return classes.join(' ');
  }, [changeType, isHovered]);

  // Agent info for display
  const agentInfo = agent ? AGENT_INFO[agent as keyof typeof AGENT_INFO] : null;

  return (
    <div
      className={lineClass}
      onMouseEnter={() => onHover(lineNumber)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Line number column */}
      <div className="diff-line-number">{lineNumber}</div>

      {/* Original content */}
      <div className="diff-line-original">
        {original !== undefined ? (
          <span className="diff-content">{original}</span>
        ) : (
          <span className="diff-empty">&nbsp;</span>
        )}
      </div>

      {/* Change indicator */}
      {changeType && (
        <div className={`diff-indicator diff-indicator-${changeType}`}>
          {changeType === 'addition' && '+'}
          {changeType === 'deletion' && '-'}
          {changeType === 'modification' && '~'}
        </div>
      )}

      {/* Modified content */}
      <div className="diff-line-modified">
        {modified !== undefined ? (
          <span className="diff-content">{modified}</span>
        ) : (
          <span className="diff-empty">&nbsp;</span>
        )}
      </div>

      {/* Action buttons */}
      {(onAccept || onReject) && (
        <div className="diff-actions">
          {showReason && reason && (
            <div className="diff-reason">
              {agentInfo && (
                <span className="diff-agent" style={{ color: agentInfo.color }}>
                  {agentInfo.name}:
                </span>
              )}
              {reason}
            </div>
          )}
          <button
            className="diff-action-btn diff-accept-btn"
            onClick={() => onAccept?.(lineNumber)}
            title="Accept this change"
          >
            <i className="fa fa-check" />
          </button>
          <button
            className="diff-action-btn diff-reject-btn"
            onClick={() => onReject?.(lineNumber)}
            title="Reject this change"
          >
            <i className="fa fa-times" />
          </button>
          {reason && (
            <button
              className="diff-action-btn diff-info-btn"
              onClick={() => setShowReason(!showReason)}
              title={showReason ? 'Hide' : 'Show reasoning'}
            >
              <i className={`fa ${showReason ? 'fa-chevron-up' : 'fa-info-circle'}`} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Diff Viewer Component
// ============================================================================

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  onAcceptAll,
  onRejectAll,
  onAcceptChanges,
  onRejectChanges,
  viewMode: initialViewMode = 'unified',
  showUnchanged: initialShowUnchanged = false,
  defaultExpanded = true,
}) => {
  const [state, setState] = React.useState<DiffViewerState>({
    viewMode: initialViewMode,
    showUnchanged: initialShowUnchanged,
    pendingAccept: new Set(),
    pendingReject: new Set(),
    collapsedSections: new Set(),
    hoveredChange: null,
  });

  const [expanded, setExpanded] = React.useState(defaultExpanded);

  // Parse diff into lines
  const lines = React.useMemo(() => {
    const originalLines = diff.original.split('\n');
    const modifiedLines = diff.modified.split('\n');
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    const result: Array<{
      lineNumber: number;
      original?: string;
      modified?: string;
      changeType?: ChangeType;
      agent?: string;
      reason?: string;
    }> = [];

    // Build change lookup map
    const changeMap = new Map<number, DiffChange>();
    for (const change of diff.changes) {
      changeMap.set(change.line, change);
    }

    for (let i = 0; i < maxLines; i++) {
      const lineNumber = i + 1;
      const original = originalLines[i];
      const modified = modifiedLines[i];
      const change = changeMap.get(lineNumber);

      // Determine if this line has changes
      let changeType: ChangeType | undefined;
      if (change) {
        changeType = change.type;
      } else if (original !== modified) {
        changeType = 'modification';
      }

      result.push({
        lineNumber,
        original,
        modified,
        changeType,
        agent: change?.agent,
        reason: change?.reason,
      });
    }

    return result;
  }, [diff]);

  // Count changes by type
  const changeCounts = React.useMemo(() => {
    const counts = { addition: 0, deletion: 0, modification: 0, total: 0 };
    for (const change of diff.changes) {
      counts[change.type]++;
      counts.total++;
    }
    return counts;
  }, [diff.changes]);

  // Filter lines based on showUnchanged setting
  const visibleLines = React.useMemo(() => {
    if (state.showUnchanged) {
      return lines;
    }

    // Group unchanged lines and show context
    const contextSize = 2;
    const result: typeof lines = [];
    let inUnchangedSection = false;
    let unchangedStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasChange = line.changeType !== undefined;

      if (hasChange) {
        // End of unchanged section
        if (inUnchangedSection) {
          // Show context lines before change
          const contextStart = Math.max(0, i - contextSize);
          if (unchangedStart < contextStart) {
            result.push({
              lineNumber: -1,
              original: `... ${i - unchangedStart} unchanged lines ...`,
            });
          } else {
            result.push(...lines.slice(unchangedStart, i));
          }
          inUnchangedSection = false;
        }
        result.push(line);
      } else if (!inUnchangedSection) {
        // Start of unchanged section
        inUnchangedSection = true;
        unchangedStart = i;
      }
    }

    // Handle trailing unchanged section
    if (inUnchangedSection) {
      const contextEnd = Math.min(lines.length, lines.length - contextSize);
      if (unchangedStart < contextEnd) {
        result.push({
          lineNumber: -1,
          original: `... ${lines.length - unchangedStart} unchanged lines ...`,
        });
      } else {
        result.push(...lines.slice(unchangedStart));
      }
    }

    return result;
  }, [lines, state.showUnchanged]);

  // Handle hover
  const handleHover = React.useCallback((line: number | null) => {
    setState((prev) => ({ ...prev, hoveredChange: line }));
  }, []);

  // Handle accept single line
  const handleAcceptLine = React.useCallback((lineNumber: number) => {
    const newPending = new Set(state.pendingAccept);
    newPending.add(lineNumber);
    setState((prev) => ({ ...prev, pendingAccept: newPending }));
  }, [state.pendingAccept]);

  // Handle reject single line
  const handleRejectLine = React.useCallback((lineNumber: number) => {
    const newPending = new Set(state.pendingReject);
    newPending.add(lineNumber);
    setState((prev) => ({ ...prev, pendingReject: newPending }));
  }, [state.pendingReject]);

  // Apply pending changes
  const handleApplyPending = React.useCallback(() => {
    if (state.pendingAccept.size > 0) {
      onAcceptChanges(Array.from(state.pendingAccept));
    }
    if (state.pendingReject.size > 0) {
      onRejectChanges(Array.from(state.pendingReject));
    }
    setState((prev) => ({
      ...prev,
      pendingAccept: new Set(),
      pendingReject: new Set(),
    }));
  }, [state.pendingAccept, state.pendingReject, onAcceptChanges, onRejectChanges]);

  // Toggle view mode
  const toggleViewMode = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      viewMode: prev.viewMode === 'unified' ? 'split' : 'unified',
    }));
  }, []);

  // Toggle show unchanged
  const toggleShowUnchanged = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      showUnchanged: !prev.showUnchanged,
    }));
  }, []);

  if (!expanded) {
    return (
      <div className="diff-viewer diff-collapsed">
        <div className="diff-header-collapsed">
          <button
            className="diff-expand-btn"
            onClick={() => setExpanded(true)}
          >
            <i className="fa fa-chevron-right" />
          </button>
          <span className="diff-file-name">{diff.name}</span>
          <span className="diff-summary">
            {changeCounts.total > 0 && (
              <>
                {changeCounts.addition > 0 && (
                  <span className="diff-count addition">+{changeCounts.addition}</span>
                )}
                {changeCounts.deletion > 0 && (
                  <span className="diff-count deletion">-{changeCounts.deletion}</span>
                )}
                {changeCounts.modification > 0 && (
                  <span className="diff-count modification">~{changeCounts.modification}</span>
                )}
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`diff-viewer diff-viewer-${state.viewMode}`}>
      {/* Header */}
      <div className="diff-header">
        <div className="diff-header-left">
          <button
            className="diff-collapse-btn"
            onClick={() => setExpanded(false)}
            title="Collapse"
          >
            <i className="fa fa-chevron-down" />
          </button>
          <span className="diff-file-name">{diff.name}</span>
          <span className="diff-language">{diff.language}</span>
        </div>

        <div className="diff-header-center">
          <span className="diff-summary">
            {changeCounts.total === 0 ? (
              <span className="diff-no-changes">No changes</span>
            ) : (
              <>
                {changeCounts.total} change{changeCounts.total !== 1 ? 's' : ''}: {' '}
                {changeCounts.addition > 0 && (
                  <span className="diff-count addition">+{changeCounts.addition}</span>
                )}
                {changeCounts.deletion > 0 && (
                  <span className="diff-count deletion">-{changeCounts.deletion}</span>
                )}
                {changeCounts.modification > 0 && (
                  <span className="diff-count modification">~{changeCounts.modification}</span>
                )}
              </>
            )}
          </span>
        </div>

        <div className="diff-header-right">
          <button
            className="diff-toggle-btn"
            onClick={toggleViewMode}
            title={`Switch to ${state.viewMode === 'unified' ? 'split' : 'unified'} view`}
          >
            <i className={`fa ${state.viewMode === 'unified' ? 'fa-columns' : 'fa-list'}`} />
          </button>
          <button
            className="diff-toggle-btn"
            onClick={toggleShowUnchanged}
            title={state.showUnchanged ? 'Hide unchanged' : 'Show unchanged'}
          >
            <i className={`fa ${state.showUnchanged ? 'fa-eye-slash' : 'fa-eye'}`} />
          </button>
        </div>
      </div>

      {/* Explanation */}
      {diff.explanation && (
        <div className="diff-explanation">
          <i className="fa fa-info-circle" />
          <span>{diff.explanation}</span>
        </div>
      )}

      {/* Diff content */}
      <div className="diff-content">
        {visibleLines.map((line) => (
          <DiffLine
            key={line.lineNumber}
            lineNumber={line.lineNumber}
            original={line.original}
            modified={line.modified}
            changeType={line.changeType}
            agent={line.agent}
            reason={line.reason}
            isHovered={state.hoveredChange === line.lineNumber}
            onHover={handleHover}
            onAccept={diff.applicable ? handleAcceptLine : undefined}
            onReject={diff.applicable ? handleRejectLine : undefined}
          />
        ))}
      </div>

      {/* Footer with actions */}
      {diff.applicable && (
        <div className="diff-footer">
          <div className="diff-footer-info">
            {state.pendingAccept.size > 0 && (
              <span className="diff-pending accept">
                {state.pendingAccept.size} selected to accept
              </span>
            )}
            {state.pendingReject.size > 0 && (
              <span className="diff-pending reject">
                {state.pendingReject.size} selected to reject
              </span>
            )}
          </div>

          <div className="diff-footer-actions">
            {(state.pendingAccept.size > 0 || state.pendingReject.size > 0) && (
              <button
                className="diff-btn diff-btn-apply-pending"
                onClick={handleApplyPending}
              >
                <i className="fa fa-check-square" />
                Apply Selected
              </button>
            )}

            <button
              className="diff-btn diff-btn-accept-all"
              onClick={onAcceptAll}
              title="Accept all changes"
            >
              <i className="fa fa-check" />
              Accept All
            </button>

            <button
              className="diff-btn diff-btn-reject-all"
              onClick={onRejectAll}
              title="Reject all changes"
            >
              <i className="fa fa-times" />
              Reject All
            </button>
          </div>
        </div>
      )}

      {/* Not applicable warning */}
      {!diff.applicable && (
        <div className="diff-warning">
          <i className="fa fa-exclamation-triangle" />
          <span>This diff cannot be applied automatically</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Inline Diff Component (for editor integration)
// ============================================================================

interface InlineDiffProps {
  /** Original content */
  original: string;
  /** Modified content */
  modified: string;
  /** Language for syntax highlighting */
  language?: string;
  /** Accept callback */
  onAccept: () => void;
  /** Reject callback */
  onReject: () => void;
}

/**
 * Compact inline diff for showing in the editor
 */
export const InlineDiff: React.FC<InlineDiffProps> = ({
  original,
  modified,
  language,
  onAccept,
  onReject,
}) => {
  const [showFull, setShowFull] = React.useState(false);

  // Compute simple diff
  const diffLines = React.useMemo(() => {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const maxLines = Math.max(origLines.length, modLines.length);

    return Array.from({ length: maxLines }, (_, i) => ({
      line: i + 1,
      original: origLines[i],
      modified: modLines[i],
      changed: origLines[i] !== modLines[i],
    }));
  }, [original, modified]);

  const changedCount = diffLines.filter((l) => l.changed).length;

  return (
    <div className="inline-diff">
      <div className="inline-diff-header">
        <span className="inline-diff-summary">
          {changedCount} line{changedCount !== 1 ? 's' : ''} changed
        </span>
        <button
          className="inline-diff-toggle"
          onClick={() => setShowFull(!showFull)}
        >
          {showFull ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {showFull && (
        <div className="inline-diff-content">
          {diffLines.map((item) => (
            <div
              key={item.line}
              className={`inline-diff-line ${item.changed ? 'changed' : ''}`}
            >
              <span className="inline-diff-line-num">{item.line}</span>
              {item.changed ? (
                <>
                  <span className="inline-diff-original">{item.original}</span>
                  <span className="inline-diff-arrow">&rarr;</span>
                  <span className="inline-diff-modified">{item.modified}</span>
                </>
              ) : (
                <span className="inline-diff-unchanged">{item.original}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="inline-diff-actions">
        <button className="inline-diff-btn inline-diff-accept" onClick={onAccept}>
          <i className="fa fa-check" />
          Accept
        </button>
        <button className="inline-diff-btn inline-diff-reject" onClick={onReject}>
          <i className="fa fa-times" />
          Reject
        </button>
      </div>
    </div>
  );
};

export default DiffViewer;
