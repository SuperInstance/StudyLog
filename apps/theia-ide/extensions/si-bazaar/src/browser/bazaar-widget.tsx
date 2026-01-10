/**
 * Bazaar Widget - Community marketplace UI
 */

import React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { Message } from '@theia/core/lib/browser';
import { BazaarService } from './bazaar-service';
import { Creation, UserProfile, CREATION_TYPE_LABELS, QUALITY_LABELS, QUALITY_DESCRIPTIONS } from '../common/index';
import { BAZAAR_WIDGET_ID, BAZAAR_WIDGET_LABEL, BAZAAR_ICON_CLASS } from '../common/index';

// ═══════════════════════════════════════════════════════════
// Creation Card Component
// ═══════════════════════════════════════════════════════════

const CreationCard: React.FC<{
  creation: Creation;
  onFork: (id: string) => void;
  onLike: (id: string) => void;
  onView: (id: string) => void;
}> = ({ creation, onFork, onLike, onView }) => {
  const quality = QUALITY_LABELS[creation.quality] || QUALITY_LABELS[1];

  return (
    <div className="bazaar-card" style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      backgroundColor: 'var(--theia-editorWidget-background)',
      cursor: 'pointer'
    }}
    onClick={() => onView(creation.id)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{creation.title}</h4>
          <div style={{ fontSize: '12px', color: 'var(--theia-ui-font-color2)' }}>
            {CREATION_TYPE_LABELS[creation.type]} • by {creation.author_id.slice(0, 8)}
          </div>
        </div>
        <div style={{
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: quality.color,
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold'
        }}>
          {quality.icon} {quality.label}
        </div>
      </div>

      {/* Description */}
      {creation.description && (
        <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--theia-ui-font-color1)' }}>
          {creation.description.slice(0, 120)}{creation.description.length > 120 ? '...' : ''}
        </p>
      )}

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '12px',
        color: 'var(--theia-ui-font-color2)'
      }}>
        <span title="Likes">♥ {creation.likes_count}</span>
        <span title="Forks">⑂ {creation.forks_count}</span>
        <span title="Comments">💬 {creation.comments_count}</span>
        <span title="Downloads">⬇ {creation.downloads_count}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          className="theia-button"
          onClick={(e) => { e.stopPropagation(); onFork(creation.id); }}
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          Fork
        </button>
        <button
          className="theia-button secondary"
          onClick={(e) => { e.stopPropagation(); onLike(creation.id); }}
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          Like
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Main Bazaar Widget
// ═══════════════════════════════════════════════════════════

@injectable()
export class BazaarWidget extends Widget {
  static readonly ID = BAZAAR_WIDGET_ID;
  static readonly LABEL = BAZAAR_WIDGET_LABEL;

  @inject(BazaarService)
  protected readonly bazaarService: BazaarService;

  protected creations: Creation[] = [];
  protected loading = false;
  protected selectedCreation: Creation | null = null;
  protected userProfiles: Map<string, UserProfile> = new Map();
  protected currentFilter: 'all' | Creation['type'] = 'all';

  constructor() {
    super();
    this.id = BazaarWidget.ID;
    this.title.label = BazaarWidget.LABEL;
    this.title.caption = BazaarWidget.LABEL;
    this.title.iconClass = BAZAAR_ICON_CLASS;
    this.title.closable = true;
    this.scrollToBottom();
    this.loadCreations();
  }

  protected async loadCreations(): Promise<void> {
    this.loading = true;
    this.update();

    try {
      const result = await this.bazaarService.browseCreations({
        type: this.currentFilter === 'all' ? undefined : this.currentFilter,
        limit: 50,
        sort: 'likes'
      });
      this.creations = result.creations;
    } catch (error) {
      console.error('Failed to load creations:', error);
      this.creations = [];
    } finally {
      this.loading = false;
      this.update();
    }
  }

  protected async onFork(creationId: string): Promise<void> {
    try {
      await this.bazaarService.forkCreation(creationId);
      window.alert('Forked successfully!');
      await this.loadCreations();
    } catch (error: any) {
      window.alert(`Failed to fork: ${error.message}`);
    }
  }

  protected async onLike(creationId: string): Promise<void> {
    try {
      await this.bazaarService.addFeedback(creationId, 'like');
      await this.loadCreations();
    } catch (error: any) {
      console.error('Failed to like:', error);
    }
  }

  protected onView(creationId: string): void {
    const creation = this.creations.find(c => c.id === creationId);
    if (creation) {
      this.selectedCreation = creation;
      this.update();
    }
  }

  protected onBack(): void {
    this.selectedCreation = null;
    this.update();
  }

  protected setFilter(filter: 'all' | Creation['type']): void {
    this.currentFilter = filter;
    this.loadCreations();
  }

  protected render(): React.ReactNode {
    // Loading state
    if (this.loading) {
      return (
        <div className="bazaar-container" style={{ padding: '16px' }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="theia-spinner" />
            <p style={{ marginTop: '16px' }}>Loading bazaar...</p>
          </div>
        </div>
      );
    }

    // Detail view
    if (this.selectedCreation) {
      return this.renderDetailView();
    }

    // Browse view
    return this.renderBrowseView();
  }

  protected renderBrowseView(): React.ReactNode {
    const types: Array<'all' | Creation['type']> = ['all', 'simulation', 'puzzle', 'agent', 'extension', 'godot-scene'];

    return (
      <div className="bazaar-container" style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ margin: 0 }}>Bazaar</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--theia-ui-font-color2)' }}>
              Community marketplace for simulations, puzzles, and more
            </p>
          </div>
          <button
            className="theia-button"
            onClick={() => window.alert('Share functionality coming soon!')}
          >
            + Share Creation
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}>
          {types.map(type => (
            <button
              key={type}
              className={`theia-button ${this.currentFilter === type ? '' : 'secondary'}`}
              onClick={() => this.setFilter(type)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                textTransform: 'capitalize'
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Creations list */}
        {this.creations.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--theia-ui-font-color2)'
          }}>
            <p>No creations found. Be the first to share!</p>
          </div>
        ) : (
          <div>
            {this.creations.map(creation => (
              <CreationCard
                key={creation.id}
                creation={creation}
                onFork={(id) => this.onFork(id)}
                onLike={(id) => this.onLike(id)}
                onView={(id) => this.onView(id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  protected renderDetailView(): React.ReactNode {
    const c = this.selectedCreation!;
    const quality = QUALITY_LABELS[c.quality] || QUALITY_LABELS[1];

    return (
      <div className="bazaar-detail" style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
        {/* Back button */}
        <button
          className="theia-button secondary"
          onClick={() => this.onBack()}
          style={{ marginBottom: '16px' }}
        >
          ← Back to Bazaar
        </button>

        {/* Title and quality */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px'
        }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>{c.title}</h1>
            <div style={{ fontSize: '13px', color: 'var(--theia-ui-font-color2)' }}>
              {CREATION_TYPE_LABELS[c.type]} • by {c.author_id}
            </div>
          </div>
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: quality.color,
            color: 'white',
            fontSize: '13px',
            fontWeight: 'bold'
          }}>
            {quality.icon} {quality.label}
          </div>
        </div>

        {/* Quality description */}
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--theia-sideBar-background)',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          {QUALITY_DESCRIPTIONS[c.quality]}
        </div>

        {/* Description */}
        {c.description && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Description</h3>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{c.description}</p>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          <span>♥ {c.likes_count} likes</span>
          <span>⑂ {c.forks_count} forks</span>
          <span>💬 {c.comments_count} comments</span>
          <span>⬇ {c.downloads_count} downloads</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            className="theia-button"
            onClick={() => this.onFork(c.id)}
          >
            Fork This Creation
          </button>
          <button
            className="theia-button secondary"
            onClick={() => this.onLike(c.id)}
          >
            Like
          </button>
          <button
            className="theia-button secondary"
            onClick={() => window.alert('Download functionality coming soon!')}
          >
            Download
          </button>
        </div>

        {/* Millfile preview */}
        {c.millfile && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Millfile</h3>
            <pre style={{
              margin: 0,
              padding: '12px',
              backgroundColor: 'var(--theia-editor-background)',
              borderRadius: '6px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {c.millfile}
            </pre>
          </div>
        )}

        {/* Timestamps */}
        <div style={{ fontSize: '12px', color: 'var(--theia-ui-font-color2)' }}>
          Created: {new Date(c.created_at).toLocaleString()}
          {c.updated_at !== c.created_at && (
            <span> • Updated: {new Date(c.updated_at).toLocaleString()}</span>
          )}
        </div>
      </div>
    );
  }

  protected onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.loadCreations();
  }
}
