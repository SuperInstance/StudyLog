/**
 * StudyLoG.AI - Cost Dashboard Common Types
 *
 * Tracks cascade savings from multi-model-router intent-based routing.
 * Shows cost optimizations by routing requests to optimal providers.
 */

// Widget constants
export const CostDashboardWidget = {
  ID: 'si-cost-dashboard:widget',
  LABEL: 'Cost Dashboard',
  ICON_CLASS: 'fa fa-chart-line',
} as const;

// Intent types from cascade router
export type CascadeIntent =
  | 'code-help'      // Code generation, debugging, refactoring
  | 'explanation'    // Concept explanation, tutorials
  | 'simulation'     // Godot scene work, physics, game logic
  | 'bazaar'         // Community features, sharing, forking
  | 'creative'       // Creative writing, storytelling
  | 'analysis'       // Data analysis, pattern recognition
  | 'general';       // Fallback to default provider

// Provider information
export interface ProviderStats {
  name: string;
  requestCount: number;
  costTotal: number;
  percentage: number;
}

// Intent breakdown for visualization
export interface IntentStats {
  intent: CascadeIntent;
  count: number;
  percentage: number;
}

// Cost summary response from backend
export interface CostSummaryResponse {
  totalRequests: number;
  totalCost: number;
  cascadeSavings: number;
  providerBreakdown: ProviderStats[];
  intentBreakdown: IntentStats[];
  period: {
    start: number;
    end: number;
  };
}

// Frontend service configuration
export interface CostDashboardConfig {
  apiBaseUrl: string;
  pollInterval: number; // milliseconds
  userId?: string;
}

// API endpoints
export const API_ENDPOINTS = {
  COSTS: '/api/v1/costs/cascade',
} as const;

// Color palette for intents
export const INTENT_COLORS: Record<CascadeIntent, string> = {
  'code-help': '#3b82f6',      // blue
  'explanation': '#10b981',    // green
  'simulation': '#8b5cf6',     // purple
  'bazaar': '#f59e0b',         // amber
  'creative': '#ec4899',       // pink
  'analysis': '#06b6d4',       // cyan
  'general': '#6b7280',        // gray
};

// Intent display names
export const INTENT_LABELS: Record<CascadeIntent, string> = {
  'code-help': 'Code Help',
  'explanation': 'Explanation',
  'simulation': 'Simulation',
  'bazaar': 'Bazaar',
  'creative': 'Creative',
  'analysis': 'Analysis',
  'general': 'General',
};

// Provider display names
export const PROVIDER_LABELS: Record<string, string> = {
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'google': 'Google',
  'nvidia': 'NVIDIA',
  'ollama': 'Ollama (Local)',
};
