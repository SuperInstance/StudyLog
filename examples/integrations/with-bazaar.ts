/**
 * Bazaar Integration Example
 *
 * This example demonstrates how to interact with the Bazaar community
 * marketplace for sharing simulations, puzzles, and agents. It shows:
 * - Sharing creations to the community
 * - Browsing and discovering creations
 * - Forking existing creations
 * - Managing feedback and merge requests
 *
 * Run with:
 *   npx tsx examples/integrations/with-bazaar.ts
 *
 * Prerequisites:
 *   - Backend workers with Bazaar service running
 *   - Set BAZAAR_API_URL environment variable (default: http://localhost:8787)
 */

// ═══════════════════════════════════════════════════════════════
// Types (matching backend Bazaar service)
// ═══════════════════════════════════════════════════════════════

interface Creation {
  id: string;
  author_id: string;
  title: string;
  description?: string;
  type: 'simulation' | 'puzzle' | 'agent' | 'extension' | 'godot-scene';
  millfile?: string;
  storage_path?: string;
  quality: number;  // 1-4 Fuse Grade
  is_public: boolean;
  forks_count: number;
  likes_count: number;
  comments_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  student_id: string;
  bio?: string;
  reputation: number;
  grain_tokens: number;
  creations_shared: number;
  forks_made: number;
  quality_verifications: number;
  created_at: string;
  updated_at: string;
}

interface Millfile {
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

// ═══════════════════════════════════════════════════════════════
// Millfile Generator
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a Millfile for a creation
 */
function generateMillfile(data: {
  title: string;
  author: string;
  description?: string;
  type: Creation['type'];
  godotVersion?: string;
  scene?: string;
  aiModel?: string;
  workRatio?: number;
  forkEnabled?: boolean;
  mergeEnabled?: boolean;
}): string {
  const millfile: Millfile = {
    meta: {
      title: data.title,
      author: data.author,
      description: data.description,
      quality: 1,  // Default quality
    },
    permissions: {
      fork_enabled: data.forkEnabled ?? true,
      merge_enabled: data.mergeEnabled ?? true,
      commercial_use: false,
    },
  };

  if (data.type === 'simulation' || data.type === 'godot-scene') {
    millfile.simulation = {
      godot_version: data.godotVersion || '4.3',
      scene: data.scene || 'main.tscn',
    };
  }

  if (data.aiModel || data.workRatio) {
    millfile.ai = {
      model_used: data.aiModel,
      work_ratio: data.workRatio,
      verified: true,
    };
  }

  return stringifyMillfile(millfile);
}

/**
 * Convert Millfile object to TOML format
 */
function stringifyMillfile(millfile: Millfile): string {
  const lines: string[] = [];

  for (const [section, data] of Object.entries(millfile)) {
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        lines.push(`${key} = "${value}"`);
      } else if (typeof value === 'boolean') {
        lines.push(`${key} = ${value ? 'true' : 'false'}`);
      } else if (typeof value === 'number') {
        lines.push(`${key} = ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key} = ${JSON.stringify(value)}`);
      }
    }
    lines.push('');  // blank line between sections
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// Bazaar API Client
// ═══════════════════════════════════════════════════════════════

class BazaarClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;
  }

  /**
   * Get user profile
   */
  async getUserProfile(studentId?: string): Promise<UserProfile> {
    const id = studentId || this.userId;
    const response = await fetch(`${this.baseUrl}/api/v1/bazaar/profile/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Browse creations
   */
  async browseCreations(options: {
    type?: string;
    quality?: number;
    author_id?: string;
    limit?: number;
    offset?: number;
    sort?: 'created' | 'likes' | 'downloads' | 'quality';
  } = {}): Promise<{ creations: Creation[]; total: number }> {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.quality) params.set('quality', options.quality.toString());
    if (options.author_id) params.set('author_id', options.author_id);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.sort) params.set('sort', options.sort);

    const response = await fetch(
      `${this.baseUrl}/api/v1/bazaar/creations?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to browse creations: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get single creation
   */
  async getCreation(id: string): Promise<Creation> {
    const response = await fetch(`${this.baseUrl}/api/v1/bazaar/creations/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to get creation: ${response.status}`);
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
    const response = await fetch(`${this.baseUrl}/api/v1/bazaar/creations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create creation: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Fork a creation
   */
  async forkCreation(parentId: string, title?: string): Promise<Creation> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/bazaar/creations/${parentId}/fork`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId,
        },
        body: JSON.stringify({ title }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fork creation: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Add feedback (like, comment, verification)
   */
  async addFeedback(creationId: string, data: {
    type: 'like' | 'comment' | 'verification';
    content?: string;
  }): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/bazaar/creations/${creationId}/feedback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add feedback: ${response.status}`);
    }
  }

  /**
   * Create merge request
   */
  async createMergeRequest(data: {
    forkId: string;
    title?: string;
    description?: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/bazaar/merge-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create merge request: ${response.status}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════

/**
 * Example 1: Browse the Bazaar
 */
async function exampleBrowseBazaar() {
  console.log('\n=== Example 1: Browse Bazaar ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  try {
    // Browse all creations
    const result = await client.browseCreations({ limit: 10 });
    console.log(`Found ${result.total} creations`);

    for (const creation of result.creations) {
      console.log(`\n- ${creation.title}`);
      console.log(`  by ${creation.author_id}`);
      console.log(`  Type: ${creation.type}`);
      console.log(`  Quality: ${creation.quality}/4`);
      console.log(`  Likes: ${creation.likes_count} | Forks: ${creation.forks_count}`);
    }

    // Browse by type
    const simulations = await client.browseCreations({
      type: 'simulation',
      quality: 2,
      limit: 5,
      sort: 'likes',
    });
    console.log(`\n\nTop rated simulations: ${simulations.creations.length}`);

  } catch (error) {
    console.log('Note: Bazaar service may not be running.');
    console.log('Error:', error);
  }
}

/**
 * Example 2: Share a creation to Bazaar
 */
async function exampleShareCreation() {
  console.log('\n=== Example 2: Share Creation ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  try {
    // Generate a Millfile for the creation
    const millfile = generateMillfile({
      title: 'Basic Circuit Simulator',
      author: 'demo-user',
      description: 'A simple interactive circuit simulator with battery, switch, and LED',
      type: 'simulation',
      godotVersion: '4.3',
      scene: 'circuit_simulator.tscn',
      aiModel: 'claude-3-5-sonnet',
      workRatio: 0.73,
      forkEnabled: true,
      mergeEnabled: true,
    });

    console.log('Generated Millfile:');
    console.log(millfile);

    // Create the creation
    const creation = await client.createCreation({
      title: 'Basic Circuit Simulator',
      description: 'A simple interactive circuit simulator',
      type: 'simulation',
      millfile,
    });

    console.log('\nCreation shared successfully!');
    console.log(`ID: ${creation.id}`);
    console.log(`Quality: ${creation.quality}/4`);

  } catch (error) {
    console.log('Note: Could not share creation. Bazaar service may not be running.');
    console.log('Error:', error);
  }
}

/**
 * Example 3: Fork an existing creation
 */
async function exampleForkCreation() {
  console.log('\n=== Example 3: Fork Creation ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  try {
    // First, browse to find something to fork
    const result = await client.browseCreations({ limit: 1 });

    if (result.creations.length === 0) {
      console.log('No creations found to fork');
      return;
    }

    const original = result.creations[0];
    console.log(`Forking: ${original.title}`);

    // Fork it
    const fork = await client.forkCreation(
      original.id,
      `${original.title} (My Fork)`
    );

    console.log(`\nFork created!`);
    console.log(`New ID: ${fork.id}`);
    console.log(`Original ID: ${original.id}`);

  } catch (error) {
    console.log('Note: Could not fork creation. Bazaar service may not be running.');
    console.log('Error:', error);
  }
}

/**
 * Example 4: Add feedback and likes
 */
async function exampleAddFeedback() {
  console.log('\n=== Example 4: Add Feedback ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  try {
    // Browse to find a creation
    const result = await client.browseCreations({ limit: 1 });

    if (result.creations.length === 0) {
      console.log('No creations found');
      return;
    }

    const creation = result.creations[0];
    console.log(`Liking: ${creation.title}`);

    // Add a like
    await client.addFeedback(creation.id, { type: 'like' });
    console.log('Liked!');

    // Add a comment
    await client.addFeedback(creation.id, {
      type: 'comment',
      content: 'Great simulation! Very educational.',
    });
    console.log('Comment added!');

    // Verify quality (if qualified)
    await client.addFeedback(creation.id, {
      type: 'verification',
      content: 'Verified working correctly on my system.',
    });
    console.log('Verification submitted!');

  } catch (error) {
    console.log('Note: Could not add feedback. You may have already feedbacked on this creation.');
    console.log('Error:', error);
  }
}

/**
 * Example 5: Get user profile and stats
 */
async function exampleUserProfile() {
  console.log('\n=== Example 5: User Profile ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  try {
    const profile = await client.getUserProfile();

    console.log(`User: ${profile.student_id}`);
    console.log(`Reputation: ${profile.reputation}`);
    console.log(`Grain Tokens: ${profile.grain_tokens}`);
    console.log(`Creations Shared: ${profile.creations_shared}`);
    console.log(`Forks Made: ${profile.forks_made}`);
    console.log(`Quality Verifications: ${profile.quality_verifications}`);

  } catch (error) {
    console.log('Note: Could not get profile. Bazaar service may not be running.');
    console.log('Error:', error);
  }
}

/**
 * Example 6: Create and submit merge request
 */
async function exampleMergeRequest() {
  console.log('\n=== Example 6: Merge Request ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  try {
    // This assumes you have a fork ID from a previous fork operation
    // In a real scenario, you would:
    // 1. Fork a creation
    // 2. Make modifications
    // 3. Submit a merge request to the original author

    console.log('Merge request workflow:');
    console.log('1. Fork a creation');
    console.log('2. Make your improvements');
    console.log('3. Submit a merge request with description of changes');
    console.log('4. Original author reviews and can approve/merge');

    // Example (commented out - requires valid fork ID):
    // await client.createMergeRequest({
    //   forkId: 'fork-abc123',
    //   title: 'Add solar panel component',
    //   description: 'Added a solar panel component that generates power from light',
    // });

  } catch (error) {
    console.log('Error:', error);
  }
}

/**
 * Example 7: Complete share → fork → merge workflow
 */
async function exampleCompleteWorkflow() {
  console.log('\n=== Example 7: Complete Workflow ===\n');

  const apiUrl = process.env.BAZAAR_API_URL || 'http://localhost:8787';
  const client = new BazaarClient(apiUrl, 'demo-user');

  console.log(`
Complete Bazaar Workflow:

1. CREATE (Alice)
   - Alice creates a circuit simulation
   - Generates Millfile with metadata
   - Shares to Bazaar with quality = 2

2. DISCOVER (Bob)
   - Bob browses Bazaar for circuit simulations
   - Finds Alice's creation
   - Reviews the Millfile and decides to try it

3. FORK (Bob)
   - Bob forks Alice's creation
   - Gets a copy with own ID
   - Can modify without affecting original

4. IMPROVE (Bob)
   - Bob adds new components (capacitor, transistor)
   - Improves the UI
   - Updates work_ratio in Millfile

5. SHARE BACK (Bob)
   - Bob shares his improved version
   - Shows as "fork of Alice's creation"
   - Alice gets credit for original

6. MERGE (Optional)
   - Bob submits merge request to Alice
   - Alice reviews Bob's improvements
   - Alice can merge into her creation

7. REWARDS
   - Both earn Grain tokens for engagement
   - Quality verified by community
   - Reputation increases
  `);
}

// ═══════════════════════════════════════════════════════════════
// Main Runner
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || 'all';

  const examples: Record<string, () => Promise<void>> = {
    browse: exampleBrowseBazaar,
    share: exampleShareCreation,
    fork: exampleForkCreation,
    feedback: exampleAddFeedback,
    profile: exampleUserProfile,
    merge: exampleMergeRequest,
    workflow: exampleCompleteWorkflow,
  };

  try {
    if (example === 'all') {
      await exampleBrowseBazaar();
      await exampleUserProfile();
      await exampleCompleteWorkflow();
    } else if (examples[example]) {
      await examples[example]();
    } else {
      console.log(`Available examples: ${Object.keys(examples).join(', ')}`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main();
}

export {
  BazaarClient,
  generateMillfile,
  stringifyMillfile,
  exampleBrowseBazaar,
  exampleShareCreation,
  exampleForkCreation,
  exampleAddFeedback,
  exampleUserProfile,
  exampleMergeRequest,
  exampleCompleteWorkflow,
};
