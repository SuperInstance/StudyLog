/**
 * Outcome Dashboard Widget
 *
 * Frontend widget for visualizing learning outcomes and progress
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Widget, FrontendApplication } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core/lib/common/message-service';
import { OutcomeTrackerFrontendService } from './outcome-tracker-frontend-service';
import {
  OutcomeRecord,
  OutcomeStatistics,
  StudyLogRewardDomain
} from '../common/outcome-types';

/**
 * Props for the OutcomeDashboard component
 */
interface OutcomeDashboardProps {
  statistics: OutcomeStatistics;
  domainMastery: Record<string, number>;
  recentOutcomes: OutcomeRecord[];
  onRefresh: () => void;
}

/**
 * React component for outcome visualization
 */
const OutcomeDashboard: React.FC<OutcomeDashboardProps> = ({
  statistics,
  domainMastery,
  recentOutcomes,
  onRefresh
}) => {
  // Calculate radar chart dimensions for domain mastery
  const domains = Object.keys(domainMastery);
  const maxMastery = Math.max(...Object.values(domainMastery), 1);

  const renderRadarChart = () => {
    if (domains.length === 0) {
      return <div className="no-data">No domain data available</div>;
    }

    const size = 200;
    const center = size / 2;
    const radius = size / 2 - 20;

    // Generate polygon points for mastery values
    const points = domains.map((domain, i) => {
      const angle = (Math.PI * 2 * i) / domains.length - Math.PI / 2;
      const value = domainMastery[domain] || 0;
      const r = (value / maxMastery) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    // Generate background polygon (full circle)
    const backgroundPoints = domains.map((_, i) => {
      const angle = (Math.PI * 2 * i) / domains.length - Math.PI / 2;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    // Generate axis lines and labels
    const axes = domains.map((domain, i) => {
      const angle = (Math.PI * 2 * i) / domains.length - Math.PI / 2;
      const x1 = center;
      const y1 = center;
      const x2 = center + radius * Math.cos(angle);
      const y2 = center + radius * Math.sin(angle);
      const labelX = center + (radius + 15) * Math.cos(angle);
      const labelY = center + (radius + 15) * Math.sin(angle);

      return (
        <g key={domain}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e0e0e0" strokeWidth="1" />
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="#666"
          >
            {domain}
          </text>
        </g>
      );
    });

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background polygon */}
        <polygon
          points={backgroundPoints}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth="1"
        />
        {/* Mastery polygon */}
        <polygon
          points={points}
          fill="rgba(66, 133, 244, 0.2)"
          stroke="#4285f4"
          strokeWidth="2"
        />
        {/* Axes */}
        {axes}
      </svg>
    );
  };

  const renderDomainBars = () => {
    return Object.entries(domainMastery).map(([domain, value]) => {
      const percentage = Math.round(value * 100);
      return (
        <div key={domain} className="domain-bar">
          <div className="domain-label">{domain}</div>
          <div className="bar-container">
            <div className="bar-fill" style={{ width: `${percentage}%` }} />
          </div>
          <div className="domain-value">{percentage}%</div>
        </div>
      );
    });
  };

  const renderRecentOutcomes = () => {
    if (recentOutcomes.length === 0) {
      return <div className="no-outcomes">No recent outcomes</div>;
    }

    return recentOutcomes.slice(0, 5).map((outcome) => (
      <div key={`${outcome.decisionId}-${outcome.timestamp}`} className="outcome-item">
        <div className={`outcome-status ${outcome.success ? 'success' : 'failure'}`}>
          {outcome.success ? '+' : '-'}
        </div>
        <div className="outcome-description">{outcome.description}</div>
        <div className="outcome-time">
          {new Date(outcome.timestamp * 1000).toLocaleTimeString()}
        </div>
      </div>
    ));
  };

  return (
    <div className="outcome-dashboard">
      <div className="dashboard-header">
        <h2>Learning Progress</h2>
        <button className="refresh-button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Activities</div>
          <div className="stat-value">{statistics.totalOutcomes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value">
            {Math.round(statistics.successRateOverall * 100)}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Quality</div>
          <div className="stat-value">
            {statistics.avgRewardSignal.toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Streak</div>
          <div className="stat-value">3</div>
        </div>
      </div>

      {/* Domain Mastery */}
      <div className="domain-section">
        <h3>Domain Mastery</h3>
        <div className="domain-visualization">
          <div className="radar-chart">{renderRadarChart()}</div>
          <div className="domain-bars">{renderDomainBars()}</div>
        </div>
      </div>

      {/* Recent Outcomes */}
      <div className="outcomes-section">
        <h3>Recent Outcomes</h3>
        <div className="outcomes-list">{renderRecentOutcomes()}</div>
      </div>

      {/* Causal Chains */}
      {statistics.totalCausalChains > 0 && (
        <div className="chains-section">
          <h3>Learning Pathways</h3>
          <div className="chains-info">
            {statistics.totalCausalChains} causal chains detected
            (avg length: {statistics.avgChainLength.toFixed(1)})
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Theia Widget for Outcome Dashboard
 */
@injectable()
export class OutcomeDashboardWidget extends Widget {
  static readonly ID = 'outcome-dashboard-widget';
  static readonly LABEL = 'Learning Progress';

  @inject(MessageService) protected readonly messageService: MessageService;
  @inject(OutcomeTrackerFrontendService)
  protected readonly outcomeService: OutcomeTrackerFrontendService;

  protected statistics: OutcomeStatistics = {} as any;
  protected domainMastery: Record<string, number> = {};
  protected recentOutcomes: OutcomeRecord[] = [];

  @postConstruct()
  protected async init(): Promise<void> {
    this.id = OutcomeDashboardWidget.ID;
    this.title.label = OutcomeDashboardWidget.LABEL;
    this.title.caption = OutcomeDashboardWidget.LABEL;
    this.title.iconClass = 'fa fa-chart-line';
    this.tabContribution = OutcomeDashboardWidget.LABEL;

    await this.refreshData();
  }

  protected async refreshData(): Promise<void> {
    try {
      this.statistics = await this.outcomeService.getStatistics();
      this.domainMastery = await this.outcomeService.getDomainMastery();
      this.recentOutcomes = await this.outcomeService.getRecentOutcomes(10);
      this.update();
    } catch (error) {
      this.messageService.error(`Failed to load outcome data: ${error}`);
    }
  }

  protected override onUpdateRequest(msg: any): void {
    super.onUpdateRequest(msg);

    if (!this.node.children) {
      return;
    }

    // Clear existing content
    while (this.node.firstChild) {
      this.node.removeChild(this.node.firstChild);
    }

    // Create container for React
    const container = document.createElement('div');
    container.className = 'outcome-dashboard-container';
    this.node.appendChild(container);

    // Render React component
    ReactDOM.render(
      <OutcomeDashboard
        statistics={this.statistics}
        domainMastery={this.domainMastery}
        recentOutcomes={this.recentOutcomes}
        onRefresh={() => this.refreshData()}
      />,
      container
    );
  }

  async refresh(): Promise<void> {
    await this.refreshData();
  }
}
