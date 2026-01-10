/**
 * StudyLoG.AI - Cost Dashboard Widget
 *
 * Displays cascade savings from multi-model-router with:
 * - Total requests routed through cascade
 * - Estimated cost savings ($)
 * - Intent breakdown (CSS-based bars)
 * - Provider usage percentages
 */

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import {
  CostDashboardWidget as WidgetConstants,
  CostSummaryResponse,
  ProviderStats,
  IntentStats,
  CostDashboardConfig,
  API_ENDPOINTS,
  INTENT_COLORS,
  INTENT_LABELS,
  PROVIDER_LABELS,
} from '../common';

@injectable()
export class CostDashboardWidget extends ReactWidget {
  static readonly ID = WidgetConstants.ID;
  static readonly LABEL = WidgetConstants.LABEL;

  @inject(MessageService)
  protected readonly messageService!: MessageService;

  // State
  private costData: CostSummaryResponse | null = null;
  private isLoading = false;
  private lastFetch = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private config: CostDashboardConfig = {
    apiBaseUrl: '',
    pollInterval: 30000, // 30 seconds
    userId: 'default',
  };

  @postConstruct()
  protected async init(): Promise<void> {
    this.id = CostDashboardWidget.ID;
    this.title.label = CostDashboardWidget.LABEL;
    this.title.caption = 'Cascade Cost Tracking Dashboard';
    this.title.closable = true;
    this.title.iconClass = WidgetConstants.ICON_CLASS;
    this.addClass('si-cost-dashboard');
    this.update();

    // Start polling
    this.startPolling();

    // Initial fetch
    await this.fetchCostData();
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-cost-dashboard-container">
        {/* Header */}
        <div className="cost-dashboard-header">
          <h2>Cost Dashboard</h2>
          {this.lastFetch > 0 && (
            <span className="last-update">
              Updated {this.formatTimeAgo(this.lastFetch)}
            </span>
          )}
        </div>

        {/* Loading State */}
        {this.isLoading && !this.costData && (
          <div className="loading-state">
            <i className="fa fa-spinner fa-spin" />
            <span>Loading cost data...</span>
          </div>
        )}

        {/* Empty State */}
        {!this.isLoading && !this.costData && (
          <div className="empty-state">
            <i className="fa fa-chart-line" />
            <p>No cost data available yet.</p>
            <p className="hint">Make requests through the multi-model-router to see savings.</p>
          </div>
        )}

        {/* Dashboard Content */}
        {this.costData && (
          <div className="dashboard-content">
            {/* Hero: Cascade Savings */}
            <div className="savings-hero">
              <div className="savings-label">Cascade savings</div>
              <div className="savings-amount">
                ${this.costData.cascadeSavings.toFixed(4)}
              </div>
              <div className="savings-sub">
                {this.costData.totalRequests} requests routed
              </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              {/* Total Cost */}
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fa fa-dollar-sign" />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Total Cost</div>
                  <div className="stat-value">${this.costData.totalCost.toFixed(4)}</div>
                </div>
              </div>

              {/* Cascade Rate */}
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fa fa-route" />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Cascade Rate</div>
                  <div className="stat-value">
                    {this.costData.totalRequests > 0
                      ? Math.round((this.costData.cascadeSavings / (this.costData.totalCost + this.costData.cascadeSavings)) * 100)
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Active Providers */}
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fa fa-server" />
                </div>
                <div className="stat-content">
                  <div className="stat-label">Providers</div>
                  <div className="stat-value">{this.costData.providerBreakdown.length}</div>
                </div>
              </div>
            </div>

            {/* Intent Breakdown */}
            {this.costData.intentBreakdown.length > 0 && (
              <div className="breakdown-section">
                <h3>Intent Breakdown</h3>
                <div className="intent-bars">
                  {this.costData.intentBreakdown.map((intent) => (
                    <div key={intent.intent} className="intent-bar-row">
                      <div className="intent-label">
                        {INTENT_LABELS[intent.intent] || intent.intent}
                      </div>
                      <div className="intent-bar-container">
                        <div
                          className="intent-bar"
                          style={{
                            width: `${intent.percentage}%`,
                            backgroundColor: INTENT_COLORS[intent.intent],
                          }}
                        />
                        <span className="intent-value">{intent.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="intent-count">({intent.count})</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider Usage */}
            {this.costData.providerBreakdown.length > 0 && (
              <div className="breakdown-section">
                <h3>Provider Usage</h3>
                <div className="provider-bars">
                  {this.costData.providerBreakdown.map((provider) => (
                    <div key={provider.name} className="provider-bar-row">
                      <div className="provider-label">
                        {PROVIDER_LABELS[provider.name] || provider.name}
                      </div>
                      <div className="provider-bar-container">
                        <div
                          className="provider-bar"
                          style={{ width: `${provider.percentage}%` }}
                        />
                        <span className="provider-value">{provider.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="provider-cost">
                        ${provider.costTotal.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Period */}
            <div className="period-info">
              <span>Period: {this.formatDate(this.costData.period.start)} - {this.formatDate(this.costData.period.end)}</span>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <button
          className="refresh-button"
          onClick={() => this.fetchCostData()}
          disabled={this.isLoading}
        >
          <i className={`fa ${this.isLoading ? 'fa-spinner fa-spin' : 'fa-refresh'}`} />
          Refresh
        </button>
      </div>
    );
  }

  private async fetchCostData(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.update();

    try {
      const url = `${this.config.apiBaseUrl}${API_ENDPOINTS.COSTS}?userId=${this.config.userId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as CostSummaryResponse;
      this.costData = data;
      this.lastFetch = Date.now();
    } catch (error) {
      console.error('[Cost Dashboard] Failed to fetch cost data:', error);
      // Show error silently on first load, only message for subsequent failures
      if (this.costData !== null) {
        this.messageService.warn('Failed to update cost data');
      }
    } finally {
      this.isLoading = false;
      this.update();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      this.fetchCostData();
    }, this.config.pollInterval);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  dispose(): void {
    this.stopPolling();
    super.dispose();
  }
}
