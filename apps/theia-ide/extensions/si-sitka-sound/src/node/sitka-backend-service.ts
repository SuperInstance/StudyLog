/**
 * Sitka Backend Service
 *
 * RPC service for the Sitka Sound simulation.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { SimulationEngine } from './simulation-engine';

export const SITKA_SERVICE_PATH = '/services/sitka';

export interface SitkaService {
  getState(): SimulationState;
  nextDay(): DayResult;
  togglePause(): void;
  isPaused(): boolean;
  reset(): void;
  addBoat(config: BoatConfig): BoatInfo;
  broadcast(fromBoat: string, message: string, truthful: boolean): void;
  getAnalysis(): GameTheoryAnalysis;
}

export interface BoatConfig {
  name: string;
  captain: string;
  strategy: 'cooperator' | 'defector' | 'tit_for_tat';
}

export interface SimulationState {
  boats: BoatInfo[];
  herringSchools: HerringSchool[];
  fishingSpots: FishingSpot[];
  messages: RadioMessage[];
  day: number;
  totalCatch: number;
}

export interface BoatInfo {
  id: string;
  name: string;
  captain: string;
  position: { x: number; y: number };
  heading: number;
  speed: number;
  catch: number;
  trust: Record<string, number>;
  reputation: number;
  knownSpots: string[];
  strategy: string;
  communicatingWith: string[];
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
  abundance: number;
  knownBy: string[];
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

export interface DayResult {
  day: number;
  catches: Record<string, number>;
  interactions: Interaction[];
  totalCatch: number;
}

export interface Interaction {
  boat1: string;
  boat2: string;
  action1: 'cooperate' | 'defect';
  action2: 'cooperate' | 'defect';
  payoff1: number;
  payoff2: number;
}

export interface GameTheoryAnalysis {
  totalInteractions: number;
  cooperationRate: number;
  averagePayoff: Record<string, number>;
  nashEquilibriumReached: boolean;
  trustEvolution: Record<string, number[]>;
}

@injectable()
export class SitkaBackendService implements SitkaService {
  @inject(SimulationEngine)
  protected readonly engine: SimulationEngine;

  getState(): SimulationState {
    return this.engine.getState();
  }

  nextDay(): DayResult {
    return this.engine.nextDay();
  }

  togglePause(): void {
    this.engine.togglePause();
  }

  isPaused(): boolean {
    return this.engine.isPaused();
  }

  reset(): void {
    this.engine.reset();
  }

  addBoat(config: BoatConfig): BoatInfo {
    return this.engine.addBoat(config);
  }

  broadcast(fromBoat: string, message: string, truthful: boolean): void {
    this.engine.broadcast(fromBoat, message, truthful);
  }

  getAnalysis(): GameTheoryAnalysis {
    return this.engine.getAnalysis();
 }

  dispose(): void {
    // Cleanup
  }
}
