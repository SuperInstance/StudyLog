/**
 * A2UI Component Library
 *
 * Custom React components for SuperInstance.AI agent interfaces.
 * These components bridge the gap between AI agents and user interaction.
 */

import React from 'react';

// ============================================================================
// Simple Controls
// ============================================================================

export interface MoodSliderProps {
  value: number; // -1 (unhappy) to 1 (happy)
  onChange: (value: number) => void;
  agentName: string;
  emotionHistory?: number[];
}

export const MoodSlider: React.FC<MoodSliderProps> = ({
  value,
  onChange,
  agentName,
  emotionHistory = [],
}) => {
  return (
    <div className="a2ui-mood-slider">
      <label>{agentName} Mood</label>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {emotionHistory.length > 0 && (
        <svg className="emotion-graph" width="100" height="30">
          {emotionHistory.map((val, i) => (
            <circle
              key={i}
              cx={(i / emotionHistory.length) * 100}
              cy={15 - val * 10}
              r={2}
              fill={val > 0 ? '#4ade80' : '#f87171'}
            />
          ))}
        </svg>
      )}
    </div>
  );
};

export interface TrollRadarProps {
  boats: string[];
  asymmetryLevel: number; // 0-1, how much info asymmetry exists
  clickable?: boolean;
  onBoatClick?: (boatId: string) => void;
  trollPositions?: Map<string, { x: number; y: number }>;
}

export const TrollRadar: React.FC<TrollRadarProps> = ({
  boats,
  asymmetryLevel,
  clickable = true,
  onBoatClick,
  trollPositions = new Map(),
}) => {
  const radius = 100;

  return (
    <div className="a2ui-troll-radar">
      <svg width={radius * 2} height={radius * 2} className="radar-scope">
        {/* Radar rings */}
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <circle
            key={r}
            cx={radius}
            cy={radius}
            r={radius * r}
            fill="none"
            stroke="#333"
            strokeDasharray="5,5"
          />
        ))}

        {/* Boat blips */}
        {boats.map((boatId, i) => {
          const angle = (i / boats.length) * Math.PI * 2;
          const dist = radius * 0.6;
          const x = radius + Math.cos(angle) * dist;
          const y = radius + Math.sin(angle) * dist;
          const troll = trollPositions.get(boatId);

          return (
            <g
              key={boatId}
              onClick={clickable ? () => onBoatClick?.(boatId) : undefined}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            >
              {/* Boat indicator */}
              <circle cx={x} cy={y} r={6} fill="#60a5fa" />
              <text x={x + 10} y={y} fontSize="10" fill="#94a3b8">
                {boatId}
              </text>

              {/* Troll indicator (if visible based on asymmetry) */}
              {troll && Math.random() > asymmetryLevel && (
                <circle cx={troll.x} cy={troll.y} r={4} fill="#f87171" opacity={0.7}>
                  <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Asymmetry fog */}
              {asymmetryLevel > 0.5 && (
                <circle cx={x} cy={y} r={20} fill="#000" opacity={asymmetryLevel * 0.3} />
              )}
            </g>
          );
        })}

        {/* Sweep line */}
        <line
          x1={radius}
          y1={radius}
          x2={radius}
          y2={0}
          stroke="#4ade80"
          strokeWidth={2}
          opacity={0.5}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${radius} ${radius}`}
            to={`360 ${radius} ${radius}`}
            dur="4s"
            repeatCount="indefinite"
          />
        </line>
      </svg>

      <div className="asymmetry-indicator">
        <span>Info Asymmetry: {(asymmetryLevel * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

export interface VectorSwarmProps {
  count: number;
  centerTarget?: { x: number; y: number };
  cohesion: number; // 0-1
  separation: number; // 0-1
  alignment: number; // 0-1
}

export const VectorSwarm: React.FC<VectorSwarmProps> = ({
  count,
  centerTarget = { x: 0.5, y: 0.5 },
  cohesion,
  separation,
  alignment,
}) => {
  // Simulated boid positions
  const boids = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: centerTarget.x + (Math.random() - 0.5) * 0.3,
    y: centerTarget.y + (Math.random() - 0.5) * 0.3,
    vx: (Math.random() - 0.5) * 0.02,
    vy: (Math.random() - 0.5) * 0.02,
  }));

  return (
    <div className="a2ui-vector-swarm">
      <svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid slice">
        {boids.map((boid) => (
          <g key={boid.id}>
            <line
              x1={boid.x}
              y1={boid.y}
              x2={boid.x + boid.vx * 10}
              y2={boid.y + boid.vy * 10}
              stroke="#60a5fa"
              strokeWidth={0.005}
              opacity={0.7}
            />
            <circle cx={boid.x} cy={boid.y} r={0.008} fill="#93c5fd" />
          </g>
        ))}
      </svg>

      <div className="swarm-controls">
        <label>Cohesion: {cohesion.toFixed(2)}</label>
        <label>Separation: {separation.toFixed(2)}</label>
        <label>Alignment: {alignment.toFixed(2)}</label>
      </div>
    </div>
  );
};

// ============================================================================
// Complex Panels
// ============================================================================

export interface CognitionMapProps {
  agentId: string;
  thoughts: {
    timestamp: number;
    content: string;
    confidence: number;
    source: string;
  }[];
  connections?: Map<string, string[]>;
}

export const CognitionMap: React.FC<CognitionMapProps> = ({ agentId, thoughts, connections }) => {
  return (
    <div className="a2ui-cognition-map">
      <h3>Cognition: {agentId}</h3>
      <div className="thought-stream">
        {thoughts.map((thought, i) => (
          <div key={i} className="thought-node" style={{ opacity: thought.confidence }}>
            <span className="timestamp">{new Date(thought.timestamp).toLocaleTimeString()}</span>
            <span className="source">[{thought.source}]</span>
            <span className="content">{thought.content}</span>
          </div>
        ))}
      </div>
      {connections && (
        <div className="connection-graph">
          {Array.from(connections.entries()).map(([from, tos]) => (
            <g key={from}>
              {tos.map((to) => (
                <line
                  key={to}
                  x1={0}
                  y1={0}
                  x2={100}
                  y2={100}
                  stroke="#475569"
                  strokeWidth={1}
                />
              ))}
            </g>
          ))}
        </div>
      )}
    </div>
  );
};

export interface FleetRadioProps {
  messages: {
    id: string;
    from: string;
    to?: string;
    content: string;
    timestamp: number;
    channel: 'voice' | 'data';
    encrypted?: boolean;
  }[];
  currentChannel: 'voice' | 'data';
  onChannelChange: (channel: 'voice' | 'data') => void;
  onSendMessage?: (content: string) => void;
}

export const FleetRadio: React.FC<FleetRadioProps> = ({
  messages,
  currentChannel,
  onChannelChange,
  onSendMessage,
}) => {
  return (
    <div className="a2ui-fleet-radio">
      <div className="radio-header">
        <h3>Fisher Radio</h3>
        <div className="channel-switch">
          <button
            className={currentChannel === 'voice' ? 'active' : ''}
            onClick={() => onChannelChange('voice')}
          >
            🎙 Voice
          </button>
          <button
            className={currentChannel === 'data' ? 'active' : ''}
            onClick={() => onChannelChange('data')}
          >
            📡 Data
          </button>
        </div>
      </div>

      <div className="message-log">
        {messages.map((msg) => (
          <div key={msg.id} className={`radio-msg ${msg.channel === msg.encrypted ? 'encrypted' : ''}`}>
            <span className="msg-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
            <span className="msg-from">{msg.from}</span>
            {msg.to && <span className="msg-to">→ {msg.to}</span>}
            <span className="msg-content">{msg.content}</span>
            {msg.encrypted && <span className="encrypted-icon">🔒</span>}
          </div>
        ))}
      </div>

      {onSendMessage && (
        <div className="radio-input">
          <input
            type="text"
            placeholder="Broadcast on {currentChannel}..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onSendMessage((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export interface BreedingPedigreeProps {
  agents: {
    id: string;
    name: string;
    parents?: string[];
    traits: Record<string, number>;
    generation: number;
  }[];
  selectedAgent?: string;
  onSelectAgent: (agentId: string) => void;
}

export const BreedingPedigree: React.FC<BreedingPedigreeProps> = ({
  agents,
  selectedAgent,
  onSelectAgent,
}) => {
  const selected = agents.find((a) => a.id === selectedAgent);

  return (
    <div className="a2ui-breeding-pedigree">
      <h3>Agent Pedigree</h3>

      <div className="pedigree-tree">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-node ${selectedAgent === agent.id ? 'selected' : ''}`}
            onClick={() => onSelectAgent(agent.id)}
            style={{ marginLeft: `${agent.generation * 20}px` }}
          >
            <span className="agent-name">{agent.name}</span>
            <span className="agent-gen">G{agent.generation}</span>
          </div>
        ))}
      </div>

      {selected && (
        <div className="agent-details">
          <h4>{selected.name}</h4>
          <div className="traits">
            {Object.entries(selected.traits).map(([trait, value]) => (
              <div key={trait} className="trait-bar">
                <label>{trait}</label>
                <div className="bar-container">
                  <div className="bar-fill" style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Game-Specific
// ============================================================================

export interface DockingMinigameProps {
  difficulty: number; // 0-1
  targetPosition: { x: number; y: number; rotation: number };
  currentPosition: { x: number; y: number; rotation: number };
  onPositionChange: (pos: { x: number; y: number; rotation: number }) => void;
  onComplete: () => void;
}

export const DockingMinigame: React.FC<DockingMinigameProps> = ({
  difficulty,
  targetPosition,
  currentPosition,
  onPositionChange,
  onComplete,
}) => {
  const distance = Math.sqrt(
    Math.pow(targetPosition.x - currentPosition.x, 2) +
      Math.pow(targetPosition.y - currentPosition.y, 2)
  );

  return (
    <div className="a2ui-docking-minigame">
      <svg width="100%" height="100%" viewBox="0 0 200 200">
        {/* Dock */}
        <rect x={targetPosition.x - 5} y={0} width={10} height={20} fill="#475569" />
        <text x={targetPosition.x} y={30} fontSize="8" textAnchor="middle" fill="#94a3b8">
          DOCK
        </text>

        {/* Boat */}
        <g
          transform={`translate(${currentPosition.x}, ${currentPosition.y}) rotate(${currentPosition.rotation})`}
        >
          <polygon points="0,-10 -5,5 5,5" fill="#3b82f6" />
        </g>

        {/* Trajectory indicator */}
        <line
          x1={currentPosition.x}
          y1={currentPosition.y}
          x2={targetPosition.x}
          y2={targetPosition.y}
          stroke="#4ade80"
          strokeDasharray={distance < 20 ? '2,2' : '5,5'}
          opacity={0.5}
        />
      </svg>

      <div className="docking-controls">
        <button
          disabled={distance < 10 && Math.abs(targetPosition.rotation - currentPosition.rotation) < 15}
          onClick={onComplete}
        >
          {distance < 10 ? 'DOCK' : 'APPROACH'}
        </button>
      </div>
    </div>
  );
};

export interface FishDressingProps {
  fishType: string;
  quality: number; // 0-1
  cuts: { name: string; value: number }[];
  onCutComplete: (cut: string) => void;
}

export const FishDressing: React.FC<FishDressingProps> = ({ fishType, quality, cuts, onCutComplete }) => {
  return (
    <div className="a2ui-fish-dressing">
      <h3>Dressing: {fishType}</h3>

      <svg width="200" height="100" viewBox="0 0 200 100">
        {/* Fish outline */}
        <ellipse cx={100} cy={50} rx={80} ry={30} fill="#cbd5e1" stroke="#475569" strokeWidth={2} />

        {/* Cut lines */}
        {cuts.map((cut, i) => (
          <line
            key={cut.name}
            x1={40 + (i * 120) / cuts.length}
            y1={20}
            x2={40 + (i * 120) / cuts.length}
            y2={80}
            stroke={cut.value > 0 ? '#4ade80' : '#94a3b8'}
            strokeWidth={2}
            onClick={() => onCutComplete(cut.name)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>

      <div className="cut-values">
        {cuts.map((cut) => (
          <div key={cut.name} className="cut-item">
            <span>{cut.name}</span>
            <span>${cut.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface NetMendingProps {
  holes: { x: number; y: number; size: number }[];
  onMend: (holeIndex: number) => void;
  progress: number; // 0-1
}

export const NetMending: React.FC<NetMendingProps> = ({ holes, onMend, progress }) => {
  return (
    <div className="a2ui-net-mending">
      <h3>Net Mending</h3>

      <svg width="200" height="200">
        {/* Net grid */}
        {[...Array(10)].forEach((_, i) => (
          <>
            <line x1={0} y1={i * 20} x2={200} y2={i * 20} stroke="#334155" strokeWidth={1} />
            <line x1={i * 20} y1={0} x2={i * 20} y2={200} stroke="#334155" strokeWidth={1} />
          </>
        ))}

        {/* Holes */}
        {holes.map((hole, i) => (
          <circle
            key={i}
            cx={hole.x}
            cy={hole.y}
            r={hole.size}
            fill={hole.mended ? '#4ade80' : '#1e293b'}
            stroke="#64748b"
            onClick={() => !hole.mended && onMend(i)}
            style={{ cursor: hole.mended ? 'default' : 'pointer' }}
          />
        ))}
      </svg>

      <div className="mending-progress">
        <label>Progress</label>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Component Registry
// ============================================================================

export const A2UI_COMPONENTS = {
  // Simple controls
  mood_slider: MoodSlider,
  troll_radar: TrollRadar,
  vector_swarm: VectorSwarm,

  // Complex panels
  cognition_map: CognitionMap,
  fleet_radio: FleetRadio,
  breeding_pedigree: BreedingPedigree,

  // Game-specific
  docking_minigame: DockingMinigame,
  fish_dressing: FishDressing,
  net_mending: NetMending,
};

// ============================================================================
// A2UI Message Format
// ============================================================================

export interface A2UIMessage {
  type: 'a2ui_component';
  id: string;
  component: keyof typeof A2UI_COMPONENTS;
  props: Record<string, unknown>;
  actions?: Array<{
    type: string;
    handler: string;
    data: Record<string, unknown>;
  }>;
}

export function renderA2UI(message: A2UIMessage, container: HTMLElement): void {
  const Component = A2UI_COMPONENTS[message.component];
  if (!Component) {
    console.error(`Unknown A2UI component: ${message.component}`);
    return;
  }

  // Render via React (simplified - actual implementation would use ReactDOM)
  console.log(`[A2UI] Rendering ${message.component} with props:`, message.props);
}
