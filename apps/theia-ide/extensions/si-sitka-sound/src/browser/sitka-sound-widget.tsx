/**
 * Sitka Sound Widget
 *
 * Visualizes the ecological simulation with:
 * - Asymmetrical information display
 * - Fish school murmuration
 * - Fleet radio communication
 * - Game theory decisions
 */

import * as React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { SitkaFrontendService } from './sitka-frontend-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';

export interface Boat {
  id: string;
  name: string;
  captain: string;
  position: { x: number; y: number };
  heading: number;
  speed: number;
  catch: number;
  trust: Map<string, number>; // boat_id -> trust level (0-1)
  reputation: number;
  knownFishingSpots: FishingSpot[];
  strategy: 'cooperator' | 'defector' | 'tit_for_tat';
  communicatingWith: string[];
}

export interface FishingSpot {
  id: string;
  position: { x: number; y: number };
  abundance: number; // 0-1
  knownBy: string[]; // boat IDs that know about this spot
}

export interface HerringSchool {
  id: string;
  position: { x: number; y: number };
  size: number;
  velocity: { x: number; y: number };
  murmuration: boolean;
}

export interface SitkaState {
  boats: Boat[];
  herringSchools: HerringSchool[];
  fishingSpots: FishingSpot[];
  messages: RadioMessage[];
  selectedBoat?: string;
  day: number;
  totalCatch: number;
}

export interface RadioMessage {
  id: string;
  from: string;
  to?: string;
  channel: 'voice' | 'data';
  content: string;
  timestamp: number;
  encrypted: boolean;
  truthful: boolean; // For asymmetry simulation
}

@injectable()
export class SitkaSoundWidget extends ReactWidget {
  static readonly ID = 'si-sitka-sound:widget';
  static readonly LABEL = 'Sitka Sound';

  @inject(SitkaFrontendService)
  protected readonly service: SitkaFrontendService;

  protected state: SitkaState = {
    boats: [],
    herringSchools: [],
    fishingSpots: [],
    messages: [],
    day: 1,
    totalCatch: 0,
  };

  private updateInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.id = SitkaSoundWidget.ID;
    this.title.label = SitkaSoundWidget.LABEL;
    this.title.caption = 'Sitka Sound Ecological Simulation';
    this.title.iconClass = 'fa fa-water';
    this.addClass('si-sitka-sound');
  }

  protected async onAfterAttach(msg: Message): Promise<void> {
    super.onAfterAttach(msg);

    // Load initial state
    const initialState = await this.service.getSimulationState();
    this.setState(initialState);

    // Set up periodic updates
    this.updateInterval = setInterval(() => this.updateState(), 100);
  }

  protected async onBeforeDetach(msg: Message): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    super.onBeforeDetach(msg);
  }

  protected render(): React.ReactNode {
    const selectedBoat = this.state.boats.find((b) => b.id === this.state.selectedBoat);

    return (
      <div className="si-sitka-sound-container">
        {/* Header */}
        <div className="sitka-header">
          <h3>Sitka Sound - Day {this.state.day}</h3>
          <div className="header-stats">
            <span>Fleet: {this.state.boats.length} boats</span>
            <span>Herring Schools: {this.state.herringSchools.length}</span>
            <span>Total Catch: {this.state.totalCatch}kg</span>
          </div>
          <div className="header-controls">
            <button onClick={() => this.service.nextDay()}>Next Day</button>
            <button onClick={() => this.service.togglePause()}>
              {this.service.isPaused() ? 'Resume' : 'Pause'}
            </button>
            <button onClick={() => this.service.reset()}>Reset</button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="sitka-grid">
          {/* Map View */}
          <div className="sitka-map">
            <svg viewBox="0 0 800 600" className="sound-map">
              {/* Water */}
              <rect width="800" height="600" fill="#1e3a5f" />

              {/* Fishing spots (asymmetrical info - only show if known by selected boat) */}
              {this.state.fishingSpots.map((spot) => {
                const isKnown = selectedBoat?.knownFishingSpots.some((s) => s.id === spot.id);
                return (
                  <g key={spot.id}>
                    {/* Abundance indicator */}
                    <circle
                      cx={spot.position.x}
                      cy={spot.position.y}
                      r={20 + spot.abundance * 30}
                      fill={isKnown ? '#4ade80' : '#1e3a5f'}
                      opacity={isKnown ? 0.3 : 0}
                    />
                    {/* Only show details if known */}
                    {isKnown && (
                      <text x={spot.position.x} y={spot.position.y} fontSize="10" fill="#fff">
                        {Math.round(spot.abundance * 100)}%
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Herring schools with murmuration */}
              {this.state.herringSchools.map((school) => (
                <g key={school.id} className="herring-school">
                  {/* School visualization */}
                  <g transform={`translate(${school.position.x}, ${school.position.y})`}>
                    {school.murmuration && (
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 0 0"
                        to="360 0 0"
                        dur="20s"
                        repeatCount="indefinite"
                      />
                    )}
                    {/* Draw fish as small circles with murmuration pattern */}
                    {Array.from({ length: Math.min(school.size, 20) }).map((_, i) => {
                      const angle = (i / school.size) * Math.PI * 2;
                      const radius = 10 + Math.sin(Date.now() / 500 + i) * 5;
                      const x = Math.cos(angle) * radius;
                      const y = Math.sin(angle) * radius;
                      return <circle key={i} cx={x} cy={y} r={2} fill="#93c5fd" />;
                    })}
                  </g>
                </g>
              ))}

              {/* Boats */}
              {this.state.boats.map((boat) => (
                <g
                  key={boat.id}
                  className={`boat ${this.state.selectedBoat === boat.id ? 'selected' : ''}`}
                  onClick={() => this.setState({ selectedBoat: boat.id })}
                  style={{ cursor: 'pointer' }}
                >
                  <g
                    transform={`translate(${boat.position.x}, ${boat.position.y}) rotate(${boat.heading})`}
                  >
                    {/* Boat hull */}
                    <polygon points="0,-10 -5,5 0,3 5,5" fill={boat.id === this.state.selectedBoat ? '#fbbf24' : '#60a5fa'} />
                    {/* Wake */}
                    <line x1={0} y1={5} x2={0} y2={15} stroke="#fff" strokeWidth={1} opacity={0.5}>
                      <animate attributeName="y2" values="15;20;15" dur="1s" repeatCount="indefinite" />
                    </line>
                  </g>
                  {/* Boat label */}
                  <text x={boat.position.x} y={boat.position.y - 15} fontSize="10" fill="#fff" textAnchor="middle">
                    {boat.name}
                  </text>
                  {/* Catch indicator */}
                  {boat.catch > 0 && (
                    <circle cx={boat.position.x + 10} cy={boat.position.y - 10} r={5} fill="#4ade80">
                      <title>{boat.catch}kg</title>
                    </circle>
                  )}
                  {/* Communication lines */}
                  {boat.communicatingWith.map((otherId) => {
                    const other = this.state.boats.find((b) => b.id === otherId);
                    if (!other) return null;
                    return (
                      <line
                        key={otherId}
                        x1={boat.position.x}
                        y1={boat.position.y}
                        x2={other.position.x}
                        y2={other.position.y}
                        stroke="#4ade80"
                        strokeWidth={1}
                        strokeDasharray="5,5"
                        opacity={0.5}
                      >
                        <animate attributeName="stroke-dashoffset" from="0" to="10" dur="1s" repeatCount="indefinite" />
                      </line>
                    );
                  })}
                </g>
              ))}
            </svg>

            {/* Map legend */}
            <div className="map-legend">
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#60a5fa' }}></span>
                <span>Boat</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#93c5fd' }}></span>
                <span>Herring School</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: '#4ade80' }}></span>
                <span>Fishing Spot (if known)</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ background: 'linear-gradient(90deg, #4ade80, #f87171)' }}></span>
                <span>Trust Level</span>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="sitka-sidebar">
            {/* Fleet Radio */}
            <div className="sidebar-panel fleet-radio">
              <h4>Fisher Radio</h4>
              <div className="radio-messages">
                {this.state.messages.slice(-10).map((msg) => (
                  <div key={msg.id} className={`radio-msg ${msg.encrypted ? 'encrypted' : ''}`}>
                    <span className="msg-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    <span className="msg-from">{msg.from}</span>
                    {msg.to && <span className="msg-to">→ {msg.to}</span>}
                    <span className="msg-content">{msg.content}</span>
                    {!msg.truthful && <span className="msg-deception">🎭</span>}
                    {msg.encrypted && <span className="msg-encrypted">🔒</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Boat Details */}
            {selectedBoat && (
              <div className="sidebar-panel boat-details">
                <h4>{selectedBoat.name}</h4>
                <div className="boat-info">
                  <div className="info-row">
                    <label>Captain</label>
                    <span>{selectedBoat.captain}</span>
                  </div>
                  <div className="info-row">
                    <label>Strategy</label>
                    <span>{selectedBoat.strategy}</span>
                  </div>
                  <div className="info-row">
                    <label>Today's Catch</label>
                    <span>{selectedBoat.catch}kg</span>
                  </div>
                  <div className="info-row">
                    <label>Reputation</label>
                    <span>{(selectedBoat.reputation * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Trust Matrix */}
                <div className="trust-matrix">
                  <h5>Trust Network</h5>
                  {Array.from(selectedBoat.trust.entries()).map(([otherId, trust]) => {
                    const other = this.state.boats.find((b) => b.id === otherId);
                    if (!other) return null;
                    return (
                      <div key={otherId} className="trust-bar">
                        <span>{other.name}</span>
                        <div className="bar-container">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${trust * 100}%`,
                              backgroundColor: trust > 0.5 ? '#4ade80' : trust > 0.25 ? '#fbbf24' : '#f87171',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Known Spots */}
                <div className="known-spots">
                  <h5>Known Fishing Spots</h5>
                  {selectedBoat.knownFishingSpots.map((spot) => (
                    <div key={spot.id} className="spot-item">
                      <span>{spot.id}</span>
                      <span>{Math.round(spot.abundance * 100)}% abundant</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Game Theory Info */}
            <div className="sidebar-panel game-theory">
              <h4>Game Theory Analysis</h4>
              <div className="gt-matrix">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Cooperate</th>
                      <th>Defect</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Cooperate</td>
                      <td className="good">3, 3</td>
                      <td className="bad">0, 5</td>
                    </tr>
                    <tr>
                      <td>Defect</td>
                      <td className="bad">5, 0</td>
                      <td className="neutral">1, 1</td>
                    </tr>
                  </tbody>
                </table>
                <p className="gt-note">Payoffs represent daily catch (kg) per boat</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private async updateState(): Promise<void> {
    if (this.service.isPaused()) {
      return;
    }

    const state = await this.service.getSimulationState();
    this.setState(state);
  }

  private setState(partial: Partial<SitkaState>): void {
    this.state = { ...this.state, ...partial };
    this.update();
  }
}
