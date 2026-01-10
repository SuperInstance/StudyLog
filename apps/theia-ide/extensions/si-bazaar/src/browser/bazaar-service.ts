/**
 * Bazaar Service - API client for community marketplace
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  Creation,
  UserProfile,
  Feedback,
  Fork,
  MergeRequest,
  Millfile,
  CREATION_TYPE_LABELS,
  QUALITY_LABELS
} from '../common/index';

export interface BrowseOptions {
  type?: string;
  quality?: number;
  author_id?: string;
  limit?: number;
  offset?: number;
  sort?: 'created' | 'likes' | 'downloads' | 'quality';
}

export interface BrowseResult {
  creations: Creation[];
  total: number;
}

@injectable()
export class BazaarService {
  private apiEndpoint = '/api/v1/bazaar';
  private userId: string | null = null;

  /**
   * Set the current user ID (from auth token)
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Browse creations with filters
   */
  async browseCreations(options: BrowseOptions = {}): Promise<BrowseResult> {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.quality) params.append('quality', options.quality.toString());
    if (options.author_id) params.append('author_id', options.author_id);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sort) params.append('sort', options.sort);

    const response = await fetch(`${this.apiEndpoint}/creations?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to browse creations: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get single creation by ID
   */
  async getCreation(id: string): Promise<Creation | null> {
    const response = await fetch(`${this.apiEndpoint}/creations/${id}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to get creation: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create a new creation
   */
  async createCreation(data: {
    title: string;
    description?: string;
    type: Creation['type'];
    millfile?: string;
    storage_path?: string;
  }): Promise<Creation> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.apiEndpoint}/creations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create creation: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fork a creation
   */
  async forkCreation(creationId: string, title?: string): Promise<Creation> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.apiEndpoint}/creations/${creationId}/fork`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId
      },
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      throw new Error(`Failed to fork creation: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Add feedback (like, comment, verification)
   */
  async addFeedback(
    creationId: string,
    type: 'like' | 'comment' | 'verification',
    content?: string
  ): Promise<Feedback> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.apiEndpoint}/creations/${creationId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId
      },
      body: JSON.stringify({ type, content })
    });

    if (!response.ok) {
      throw new Error(`Failed to add feedback: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get user profile
   */
  async getUserProfile(studentId: string): Promise<UserProfile | null> {
    const response = await fetch(`${this.apiEndpoint}/profile/${studentId}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create merge request
   */
  async createMergeRequest(data: {
    fork_id: string;
    title?: string;
    description?: string;
  }): Promise<MergeRequest> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.apiEndpoint}/merge-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create merge request: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Parse Millfile TOML
   */
  parseMillfile(toml: string): Millfile {
    const result: Partial<Millfile> = {};
    const lines = toml.split('\n');
    let currentSection: string = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        if (!result[currentSection as keyof Millfile]) {
          result[currentSection as keyof Millfile] = {};
        }
        continue;
      }

      const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (kvMatch && currentSection) {
        const [, key, value] = kvMatch;
        let parsedValue: any = value.trim().replace(/^["']|["']$/g, '');

        if (parsedValue === 'true') parsedValue = true;
        else if (parsedValue === 'false') parsedValue = false;
        else if (!isNaN(Number(parsedValue))) parsedValue = Number(parsedValue);
        else if (parsedValue.startsWith('[')) parsedValue = JSON.parse(parsedValue);

        (result[currentSection as keyof Millfile] as any)[key] = parsedValue;
      }
    }

    return result as Millfile;
  }

  /**
   * Get quality label for display
   */
  getQualityLabel(quality: number): string {
    return QUALITY_LABELS[quality]?.label || 'Unknown';
  }

  /**
   * Get quality color for display
   */
  getQualityColor(quality: number): string {
    return QUALITY_LABELS[quality]?.color || '#9ca3af';
  }

  /**
   * Get type label for display
   */
  getTypeLabel(type: Creation['type']): string {
    return CREATION_TYPE_LABELS[type] || type;
  }
}
