/**
 * Sitka Sound Frontend Service
 *
 * Frontend service for the ecological simulation.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';

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
  knownFishingSpots: FishingSpot[];
  strategy: 'cooperator' | 'defector' | 'tit_for_tat';
  communicatingWith: string[];
}

export interface FishingSpot {
  id: string;
  position: { x: number; y: number };
  abundance: number;
  knownBy: string[];
}

export interface HerringSchool {
  id: string;
  position: { x: number; y: number };
  size: number;
  velocity: { x: number; y: number };
  murmuration: boolean;
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

export interface SimulationState {
  boats: Boat[];
  herringSchools: HerringSchool[];
  fishingSpots: FishingSpot[];
  messages: RadioMessage[];
  day: number;
  totalCatch: number;
}

@injectable()
export class SitkaFrontendService implements FrontendApplicationContribution {
  @inject(ILogger)
  protected readonly logger: ILogger;

  private paused = true;
  private state: SimulationState = {
    boats: [],
    herringSchools: [],
    fishingSpots: [],
    messages: [],
    day: 1,
    totalCatch: 0,
  };

  async getSimulationState(): Promise<SimulationState> {
    return { ...this.state, trust: this.serializeTrust() };
  }

  async nextDay(): Promise<void> {
    this.state.day++;
    this.paused = true;
    this.logger.info(`[Sitka] Day ${this.state.day}`);
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.logger.info(`[Sitka] ${this.paused ? 'Paused' : 'Running'}`);
  }

  isPaused(): boolean {
    return this.paused;
  }

  async reset(): Promise<void> {
    this.state = {
      boats: [],
      herringSchools: [],
      fishingSpots: [],
      messages: [],
      day: 1,
      totalCatch: 0,
    };
    this.paused = true;
    this.logger.info('[Sitka] Reset simulation');
  }

  private serializeTrust(): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    for (const boat of this.state.boats) {
      result[boat.id] = Object.fromEntries(boat.trust);
    }
    return result;
  }

  onStart(): void {
    this.logger.info('Starting Sitka Sound Frontend Service');
    // Initialize with default simulation
    this.initializeSimulation();
  }

  private initializeSimulation(): void {
    // Create initial boats
    this.state.boats = [
      {
        id: 'boat-001',
        name: 'Northern Star',
        captain: 'John',
        position: { x: 200, y: 200 },
        heading: 45,
        speed: 10,
        catch: 0,
        trust: new Map([['boat-002', 0.7], ['boat-003', 0.3]]),
        reputation: 0.8,
        knownFishingSpots: [],
        strategy: 'cooperator',
        communicatingWith: [],
      },
      {
        id: 'boat-002',
        name: 'Sitka Rose',
        captain: 'Maria',
        position: { x: 400, y: 300 },
        heading: 180,
        speed: 8,
        catch: 0,
        trust: new Map([['boat-001', 0.8], ['boat-003', 0.5]]),
        reputation: 0.6,
        knownFishingSpots: [],
        strategy: 'tit_for_tat',
        communicatingWith: [],
      },
      {
        id: 'boat-003',
        name: 'Fisher King',
        captain: ' Erik',
        position: { x: 600, y: 400 },
        heading: 270,
        speed: 12,
        catch: 0,
        trust: new Map([['boat-001', 0.2], ['boat-002', 0.4]]),
        reputation: 0.3,
        knownFishingSpots: [],
        strategy: 'defector',
        communicatingWith: [],
      },
    ];

    // Create herring schools
    this.state.herringSchools = [
      {
        id: 'school-001',
        position: { x: 300, y: 250 },
        size: 100,
        velocity: { x: 1, y: 0.5 },
        murmuration: true,
      },
      {
        id: 'school-002',
        position: { x: 500, y: 350 },
        size: 150,
        velocity: { x: -0.5, y: 1 },
        murmuration: true,
      },
    ];

    // Create fishing spots
    this.state.fishingSpots = [
      {
        id: 'spot-A',
        position: { x: 350, y: 200 },
        abundance: 0.8,
        knownBy: ['boat-001'],
      },
      {
        id: 'spot-B',
        position: { x: 550, y: 400 },
        abundance: 0.6,
        knownBy: ['boat-003'],
      },
      {
        id: 'spot-C',
        position: { x: 250, y: 450 },
        abundance: 0.9,
        knownBy: [], // Secret spot
      },
    ];

    // Add initial radio message
    this.state.messages = [
      {
        id: 'msg-001',
        from: 'Northern Star',
        channel: 'voice',
        content: 'Anyone seen the herring running today?',
        timestamp: Date.now(),
        encrypted: false,
        truthful: true,
      },
    ];

    // Link known spots to boats
    for (const boat of this.state.boats) {
      for (const spotId of this.state.fishingSpots.filter((s) => s.knownBy.includes(boat.id)).map((s) => s.id)) {
        const spot = this.state.fishingSpots.find((s) => s.id === spotId);
        if (spot) {
          boat.knownFishingSpots.push(spot);
        }
      }
    }
  }
}
