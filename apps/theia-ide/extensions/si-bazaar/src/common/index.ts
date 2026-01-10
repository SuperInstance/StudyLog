/**
 * si-bazaar - Community marketplace for sharing creations
 */

export const BAZAAR_ICON_CLASS = 'fa fa-globe';
export const BAZAAR_WIDGET_ID = 'si-bazaar:widget';
export const BAZAAR_WIDGET_LABEL = 'Bazaar';

// API endpoint - configurable via environment
export const BAZAAR_API_ENDPOINT = '/api/v1/bazaar';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface Creation {
  id: string;
  author_id: string;
  title: string;
  description?: string;
  type: CreationType;
  quality: number;  // 1-4 Fuse Grade
  forks_count: number;
  likes_count: number;
  comments_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

export type CreationType = 'simulation' | 'puzzle' | 'agent' | 'extension' | 'godot-scene';

export interface UserProfile {
  id: string;
  student_id: string;
  bio?: string;
  reputation: number;
  grain_tokens: number;
  creations_shared: number;
  forks_made: number;
  quality_verifications: number;
}

export interface Feedback {
  id: string;
  creation_id: string;
  user_id: string;
  type: 'like' | 'comment' | 'verification' | 'fork';
  content?: string;
  grain_tokens: number;
  created_at: string;
}

export interface Fork {
  id: string;
  parent_id: string;
  child_id: string;
  forker_id: string;
  merged: boolean;
  created_at: string;
}

export interface MergeRequest {
  id: string;
  fork_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  title?: string;
  description?: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════
// Millfile Types
// ═══════════════════════════════════════════════════════════

export interface Millfile {
  meta: {
    title: string;
    author: string;
    description?: string;
    quality: number;
  };
  simulation?: {
    godot_version?: string;
    scene?: string;
    components?: string[];
  };
  ai?: {
    model_used?: string;
    work_ratio?: number;
    verified?: boolean;
  };
  permissions?: {
    fork_enabled?: boolean;
    merge_enabled?: boolean;
    commercial_use?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

export const CREATION_TYPE_LABELS: Record<CreationType, string> = {
  simulation: 'Simulation',
  puzzle: 'Puzzle',
  agent: 'Agent',
  extension: 'Extension',
  'godot-scene': 'Godot Scene'
};

export const QUALITY_LABELS: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: 'Experimental', color: '#9ca3af', icon: '⚗️' },
  2: { label: 'Working', color: '#3b82f6', icon: '✓' },
  3: { label: 'Verified', color: '#10b981', icon: '★' },
  4: { label: 'Excellent', color: '#f59e0b', icon: '★★' }
};

export const QUALITY_DESCRIPTIONS: Record<number, string> = {
  1: 'Experimental - May have bugs, use with caution',
  2: 'Working - Functional for basic use cases',
  3: 'Verified - Community-tested and reliable',
  4: 'Excellent - High quality, well-documented, production-ready'
};
