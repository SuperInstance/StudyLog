/**
 * Sitka Sound Simulation Engine
 *
 * Core simulation logic for:
 * - Asymmetrical information (different boats know different spots)
 * - Murmuration (fish school behavior using boid-like algorithm)
 * - A2A fleet communication (boat-to-boat messages)
 * - Game theory (prisoner's dilemma style interactions)
 */

import { injectable } from '@theia/core/shared/inversify';

export interface Boat {
  id: string;
  name: string;
  captain: string;
  position: { x: number; y: number };
  heading: number;
  speed: number;
  catch: number;
  trust: Map<string, number>;
  reputation: number;
  knownSpots: Set<string>;
  strategy: 'cooperator' | 'defector' | 'tit_for_tat';
  lastAction: 'cooperate' | 'defect' | null;
}

export interface HerringSchool {
  id: string;
  position: { x: number; y: number };
  size: number;
  velocity: { x: number; y: number };
  murmuration: boolean;
}

export interface FishingSpot {
  id: string;
  position: { x: number; y: number };
  abundance: number; // 0-1
  knownBy: Set<string>;
}

export interface RadioMessage {
  id: string;
  from: string;
  to?: string;
  channel: 'voice' | 'data';
  content: string;
  timestamp: number;
  encrypted: boolean;
  truthful: boolean;
}

export interface Interaction {
  boat1: string;
  boat2: string;
  action1: 'cooperate' | 'defect';
  action2: 'cooperate' | 'defect';
  payoff1: number;
  payoff2: number;
}

@injectable()
export class SimulationEngine {
  private boats: Map<string, Boat> = new Map();
  private herringSchools: Map<string, HerringSchool> = new Map();
  private fishingSpots: Map<string, FishingSpot> = new Map();
  private messages: RadioMessage[] = [];
  private interactions: Interaction[] = [];
  private day = 1;
  private totalCatch = 0;
  private paused = true;
  private history: Map<string, number[]> = new Map(); // For trust evolution tracking

  private readonly PAYOFF_MATRIX = {
    cooperate_cooperate: { both: 30 },
    cooperate_defect: { cooperator: 0, defector: 50 },
    defect_cooperate: { defector: 50, cooperator: 0 },
    defect_defect: { both: 10 },
  };

  constructor() {
    this.initialize();
  }

  // ========================================================================
  // Simulation Control
  // ========================================================================

  togglePause(): void {
    this.paused = !this.paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  reset(): void {
    this.boats.clear();
    this.herringSchools.clear();
    this.fishingSpots.clear();
    this.messages = [];
    this.interactions = [];
    this.day = 1;
    this.totalCatch = 0;
    this.history.clear();
    this.initialize();
  }

  // ========================================================================
  // State Access
  // ========================================================================

  getState(): any {
    return {
      boats: Array.from(this.boats.values()).map((b) => ({
        ...b,
        trust: Object.fromEntries(b.trust),
        knownSpots: Array.from(b.knownSpots),
      })),
      herringSchools: Array.from(this.herringSchools.values()),
      fishingSpots: Array.from(this.fishingSpots.values()).map((s) => ({
        ...s,
        knownBy: Array.from(s.knownBy),
      })),
      messages: this.messages.slice(-50),
      day: this.day,
      totalCatch: this.totalCatch,
    };
  }

  getAnalysis(): any {
    const cooperationRate =
      this.interactions.length > 0
        ? this.interactions.filter((i) => i.action1 === 'cooperate' && i.action2 === 'cooperate').length /
          this.interactions.length
        : 0;

    const averagePayoff: Record<string, number> = {};
    for (const [id, boat] of this.boats) {
      const boatInteractions = this.interactions.filter(
        (i) => i.boat1 === id || i.boat2 === id
      );
      const totalPayoff = boatInteractions.reduce((sum, i) => {
        return sum + (i.boat1 === id ? i.payoff1 : i.payoff2);
      }, 0);
      averagePayoff[id] = boatInteractions.length > 0 ? totalPayoff / boatInteractions.length : 0;
    }

    return {
      totalInteractions: this.interactions.length,
      cooperationRate,
      averagePayoff,
      nashEquilibriumReached: cooperationRate < 0.3, // Rough heuristic
      trustEvolution: Object.fromEntries(this.history),
    };
  }

  // ========================================================================
  // Day Progression
  // ========================================================================

  nextDay(): any {
    const catches: Record<string, number> = {};

    // 1. Move boats toward known fishing spots
    this.moveBoats();

    // 2. Resolve fishing
    for (const [id, boat] of this.boats) {
      const catchToday = this.resolveFishing(boat);
      catches[id] = catchToday;
      boat.catch += catchToday;
      this.totalCatch += catchToday;
    }

    // 3. Resolve boat-to-boat interactions (game theory)
    const dayInteractions = this.resolveInteractions();

    // 4. Update trust based on interactions
    this.updateTrust(dayInteractions);

    // 5. Murmuration update for herring
    this.updateHerring();

    // 6. Random spot discovery (asymmetrical info)
    this.randomSpotDiscovery();

    // 7. Record history
    this.recordHistory();

    this.day++;
    this.paused = true;

    return {
      day: this.day,
      catches,
      interactions: dayInteractions,
      totalCatch: this.totalCatch,
    };
  }

  // ========================================================================
  // Core Simulation Logic
  // ========================================================================

  private moveBoats(): void {
    for (const boat of this.boats.values()) {
      // Move toward best known spot
      if (boat.knownSpots.size > 0) {
        const bestSpot = this.getBestKnownSpot(boat);
        if (bestSpot) {
          const dx = bestSpot.position.x - boat.position.x;
          const dy = bestSpot.position.y - boat.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 5) {
            boat.position.x += (dx / distance) * boat.speed;
            boat.position.y += (dy / distance) * boat.speed;
            boat.heading = (Math.atan2(dy, dx) * 180) / Math.PI;
          }
        }
      }
    }
  }

  private resolveFishing(boat: Boat): number {
    // Find if boat is at a known fishing spot
    for (const spotId of boat.knownSpots) {
      const spot = this.fishingSpots.get(spotId);
      if (!spot) continue;

      const dx = spot.position.x - boat.position.x;
      const dy = spot.position.y - boat.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 20) {
        // Boat is at the spot!
        const baseCatch = spot.abundance * 50; // max 50kg per spot
        const reputationBonus = boat.reputation * 10;
        const catchAmount = baseCatch + reputationBonus;

        // Deplete the spot slightly
        spot.abundance = Math.max(0, spot.abundance - 0.1);

        return Math.round(catchAmount);
      }
    }
    return 0;
  }

  private resolveInteractions(): Interaction[] {
    const dayInteractions: Interaction[] = [];
    const boatIds = Array.from(this.boats.keys());

    // Pairwise interactions
    for (let i = 0; i < boatIds.length; i++) {
      for (let j = i + 1; j < boatIds.length; j++) {
        const boat1 = this.boats.get(boatIds[i])!;
        const boat2 = this.boats.get(boatIds[j])!;

        // Check if boats are close enough to interact
        const dx = boat1.position.x - boat2.position.x;
        const dy = boat1.position.y - boat2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100) {
          // Determine actions based on strategy
          const action1 = this.chooseAction(boat1, boat2);
          const action2 = this.chooseAction(boat2, boat1);

          // Calculate payoffs
          const payoffs = this.calculatePayoffs(action1, action2);

          const interaction: Interaction = {
            boat1: boat1.id,
            boat2: boat2.id,
            action1,
            action2,
            payoff1: payoffs.payoff1,
            payoff2: payoffs.payoff2,
          };

          dayInteractions.push(interaction);
          this.interactions.push(interaction);

          // Store last action for tit-for-tat
          boat1.lastAction = action1;
          boat2.lastAction = action2;
        }
      }
    }

    return dayInteractions;
  }

  private chooseAction(boat: Boat, other: Boat): 'cooperate' | 'defect' {
    switch (boat.strategy) {
      case 'cooperator':
        return 'cooperate';

      case 'defector':
        return 'defect';

      case 'tit_for_tat':
        // Cooperate first, then mirror opponent's last action
        if (boat.lastAction === null) {
          return 'cooperate';
        }
        return boat.lastAction;

      default:
        return 'cooperate';
    }
  }

  private calculatePayoffs(action1: string, action2: string): { payoff1: number; payoff2: number } {
    const key = `${action1}_${action2}` as keyof typeof this.PAYOFF_MATRIX;
    const payoff = this.PAYOFF_MATRIX[key];

    if ('both' in payoff) {
      return { payoff1: payoff.both, payoff2: payoff.both };
    }

    if ('cooperator' in payoff && 'defector' in payoff) {
      if (action1 === 'cooperate') {
        return { payoff1: payoff.cooperator, payoff2: payoff.defector };
      } else {
        return { payoff1: payoff.defector, payoff2: payoff.cooperator };
      }
    }

    return { payoff1: 0, payoff2: 0 };
  }

  private updateTrust(interactions: Interaction[]): void {
    for (const interaction of interactions) {
      const boat1 = this.boats.get(interaction.boat1)!;
      const boat2 = this.boats.get(interaction.boat2)!;

      // Update trust based on actions
      const trust1 = boat1.trust.get(interaction.boat2) || 0.5;
      const trust2 = boat2.trust.get(interaction.boat1) || 0.5;

      if (interaction.action2 === 'cooperate') {
        boat1.trust.set(interaction.boat2, Math.min(1, trust1 + 0.1));
      } else {
        boat1.trust.set(interaction.boat2, Math.max(0, trust1 - 0.15));
      }

      if (interaction.action1 === 'cooperate') {
        boat2.trust.set(interaction.boat1, Math.min(1, trust2 + 0.1));
      } else {
        boat2.trust.set(interaction.boat1, Math.max(0, trust2 - 0.15));
      }

      // Update reputation based on cooperation
      if (interaction.action1 === 'cooperate') {
        boat1.reputation = Math.min(1, boat1.reputation + 0.02);
      } else {
        boat1.reputation = Math.max(0, boat1.reputation - 0.05);
      }

      if (interaction.action2 === 'cooperate') {
        boat2.reputation = Math.min(1, boat2.reputation + 0.02);
      } else {
        boat2.reputation = Math.max(0, boat2.reputation - 0.05);
      }
    }
  }

  private updateHerring(): void {
    for (const school of this.herringSchools.values()) {
      if (!school.murmuration) continue;

      // Murmuration: cohesion, separation, alignment
      const cohesion = this.calculateCohesion(school);
      const separation = this.calculateSeparation(school);
      const alignment = this.calculateAlignment(school);

      // Apply forces to velocity
      school.velocity.x += cohesion.x * 0.01 + separation.x * 0.02 + alignment.x * 0.01;
      school.velocity.y += cohesion.y * 0.01 + separation.y * 0.02 + alignment.y * 0.01;

      // Limit speed
      const speed = Math.sqrt(school.velocity.x ** 2 + school.velocity.y ** 2);
      if (speed > 2) {
        school.velocity.x = (school.velocity.x / speed) * 2;
        school.velocity.y = (school.velocity.y / speed) * 2;
      }

      // Update position
      school.position.x += school.velocity.x;
      school.position.y += school.velocity.y;

      // Boundary wrap
      if (school.position.x < 0) school.position.x = 800;
      if (school.position.x > 800) school.position.x = 0;
      if (school.position.y < 0) school.position.y = 600;
      if (school.position.y > 600) school.position.y = 0;
    }
  }

  private calculateCohesion(school: HerringSchool): { x: number; y: number } {
    // Steer toward center of nearby schools
    let centerX = 0, centerY = 0, count = 0;
    for (const other of this.herringSchools.values()) {
      if (other.id === school.id) continue;
      const dx = other.position.x - school.position.x;
      const dy = other.position.y - school.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        centerX += other.position.x;
        centerY += other.position.y;
        count++;
      }
    }
    if (count > 0) {
      centerX /= count;
      centerY /= count;
      return { x: centerX - school.position.x, y: centerY - school.position.y };
    }
    return { x: 0, y: 0 };
  }

  private calculateSeparation(school: HerringSchool): { x: number; y: number } {
    // Avoid crowding
    let moveX = 0, moveY = 0;
    for (const other of this.herringSchools.values()) {
      if (other.id === school.id) continue;
      const dx = school.position.x - other.position.x;
      const dy = school.position.y - other.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 30 && dist > 0) {
        moveX += dx / dist;
        moveY += dy / dist;
      }
    }
    return { x: moveX, y: moveY };
  }

  private calculateAlignment(school: HerringSchool): { x: number; y: number } {
    // Align with nearby schools
    let avgVx = 0, avgVy = 0, count = 0;
    for (const other of this.herringSchools.values()) {
      if (other.id === school.id) continue;
      const dx = other.position.x - school.position.x;
      const dy = other.position.y - school.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        avgVx += other.velocity.x;
        avgVy += other.velocity.y;
        count++;
      }
    }
    if (count > 0) {
      avgVx /= count;
      avgVy /= count;
      return { x: avgVx - school.velocity.x, y: avgVy - school.velocity.y };
    }
    return { x: 0, y: 0 };
  }

  private randomSpotDiscovery(): void {
    // Boats randomly discover new spots (asymmetrical info)
    const unknownSpots = Array.from(this.fishingSpots.values()).filter(
      (s) => s.knownBy.size === 0 || Math.random() > s.knownBy.size / this.boats.size
    );

    for (const boat of this.boats.values()) {
      // 5% chance to discover a random spot
      if (Math.random() < 0.05 && unknownSpots.length > 0) {
        const spot = unknownSpots[Math.floor(Math.random() * unknownSpots.length)];
        if (!boat.knownSpots.has(spot.id)) {
          boat.knownSpots.add(spot.id);
          spot.knownBy.add(boat.id);

          // Add discovery message
          this.messages.push({
            id: `msg-${Date.now()}`,
            from: boat.name,
            channel: 'voice',
            content: `Found a promising spot at ${Math.round(spot.position.x)}, ${Math.round(spot.position.y)}!`,
            timestamp: Date.now(),
            encrypted: false,
            truthful: true,
          });
        }
      }
    }
  }

  private getBestKnownSpot(boat: Boat): FishingSpot | null {
    let best: FishingSpot | null = null;
    let bestScore = -1;

    for (const spotId of boat.knownSpots) {
      const spot = this.fishingSpots.get(spotId);
      if (!spot) continue;

      // Score based on abundance and distance
      const dx = spot.position.x - boat.position.x;
      const dy = spot.position.y - boat.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const score = spot.abundance * 100 - distance * 0.1;

      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }

    return best;
  }

  private recordHistory(): void {
    for (const [id, boat] of this.boats) {
      const avgTrust =
        boat.trust.size > 0
          ? Array.from(boat.trust.values()).reduce((a, b) => a + b, 0) / boat.trust.size
          : 0.5;

      if (!this.history.has(id)) {
        this.history.set(id, []);
      }
      this.history.get(id)!.push(avgTrust);
    }
  }

  // ========================================================================
  // Entity Management
  // ========================================================================

  addBoat(config: { name: string; captain: string; strategy: 'cooperator' | 'defector' | 'tit_for_tat' }): any {
    const id = `boat-${Date.now()}`;
    const boat: Boat = {
      id,
      name: config.name,
      captain: config.captain,
      position: {
        x: 100 + Math.random() * 600,
        y: 100 + Math.random() * 400,
      },
      heading: Math.random() * 360,
      speed: 8 + Math.random() * 4,
      catch: 0,
      trust: new Map(),
      reputation: 0.5,
      knownSpots: new Set(),
      strategy: config.strategy,
      lastAction: null,
    };

    // Initialize trust with existing boats
    for (const [otherId, other] of this.boats) {
      boat.trust.set(otherId, 0.5);
      other.trust.set(id, 0.5);
    }

    this.boats.set(id, boat);
    return boat;
  }

  broadcast(fromBoat: string, message: string, truthful: boolean): void {
    const boat = this.boats.get(fromBoat);
    if (!boat) return;

    this.messages.push({
      id: `msg-${Date.now()}`,
      from: boat.name,
      channel: 'voice',
      content: message,
      timestamp: Date.now(),
      encrypted: false,
      truthful,
    });
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private initialize(): void {
    // Create initial boats
    this.addBoat({ name: 'Northern Star', captain: 'John', strategy: 'cooperator' });
    this.addBoat({ name: 'Sitka Rose', captain: 'Maria', strategy: 'tit_for_tat' });
    this.addBoat({ name: 'Fisher King', captain: 'Erik', strategy: 'defector' });

    // Create herring schools
    this.herringSchools.set('school-001', {
      id: 'school-001',
      position: { x: 300, y: 250 },
      size: 100,
      velocity: { x: 1, y: 0.5 },
      murmuration: true,
    });

    this.herringSchools.set('school-002', {
      id: 'school-002',
      position: { x: 500, y: 350 },
      size: 150,
      velocity: { x: -0.5, y: 1 },
      murmuration: true,
    });

    // Create fishing spots
    this.fishingSpots.set('spot-A', {
      id: 'spot-A',
      position: { x: 350, y: 200 },
      abundance: 0.8,
      knownBy: new Set(['boat-1']),
    });

    this.fishingSpots.set('spot-B', {
      id: 'spot-B',
      position: { x: 550, y: 400 },
      abundance: 0.6,
      knownBy: new Set(['boat-3']),
    });

    this.fishingSpots.set('spot-C', {
      id: 'spot-C',
      position: { x: 250, y: 450 },
      abundance: 0.9,
      knownBy: new Set(), // Secret spot
    });

    // Link known spots to boats
    for (const [spotId, spot] of this.fishingSpots) {
      for (const boatId of spot.knownBy) {
        const boat = this.boats.get(boatId);
        if (boat) {
          boat.knownSpots.add(spotId);
        }
      }
    }

    // Add initial message
    this.messages.push({
      id: 'msg-001',
      from: 'Northern Star',
      channel: 'voice',
      content: 'Anyone seen the herring running today?',
      timestamp: Date.now(),
      encrypted: false,
      truthful: true,
    });
  }
}
