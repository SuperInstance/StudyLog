/**
 * Fishing Mechanics - Rod, Reel, Line, Lure Physics
 *
 * Simulates the complete fishing experience:
 * - Casting mechanics
 * - Lure action and presentation
 * - Hook setting
 * - Fighting fish
 * - Line management
 */

import {
  Vector3,
  Vector2,
  FishingRod,
  FishingReel,
  FishingLine,
  Lure,
  FishingSetup,
  CastState,
  CastPhase,
  HookState,
  HookedFishBehavior,
  BiteType,
  RodPower,
  RodAction,
  LureAction,
  LineMaterial,
  CatchQuality
} from './types';

// ============================================================================
// CASTING MECHANICS
// ============================================================================

/**
 * Casting physics and mechanics
 */
export class CastingSystem {
  private readonly GRAVITY = 32.174; // ft/s^2

  /**
   * Calculate cast result
   */
  cast(
    setup: FishingSetup,
    power: number,
    direction: Vector3,
    targetDistance?: number
  ): CastState {
    // Calculate cast distance based on rod, reel, and power
    const baseDistance = this.calculateCastDistance(setup, power);
    const distance = targetDistance || baseDistance;

    // Calculate trajectory
    const angle = Math.asin((distance * this.GRAVITY) / (this.calculateLaunchVelocity(setup, power) ** 2)) / 2;

    // Initial velocity components
    const launchVelocity = this.calculateLaunchVelocity(setup, power);
    const velocity = {
      x: Math.cos(angle) * launchVelocity * direction.x,
      y: launchVelocity * Math.sin(angle),
      z: Math.cos(angle) * launchVelocity * direction.z
    };

    return {
      isActive: true,
      phase: CastPhase.AIRBORNE,
      position: { x: 0, y: 5, z: 0 }, // Starting position
      targetPosition: {
        x: direction.x * distance,
        y: 0,
        z: direction.z * distance
      },
      velocity,
      distance: 0,
      height: 5,
      lineOut: 0,
      lineTension: 0,
      castAt: Date.now()
    };
  }

  /**
   * Update cast physics
   */
  updateCast(state: CastState, deltaTime: number): CastState {
    if (state.phase === CastPhase.COMPLETE || state.phase === CastPhase.RETRIEVING) {
      return state;
    }

    // Apply gravity
    const gravity = { x: 0, y: -this.GRAVITY * deltaTime, z: 0 };

    // Update velocity
    state.velocity.x += gravity.x;
    state.velocity.y += gravity.y;
    state.velocity.z += gravity.z;

    // Update position
    state.position.x += state.velocity.x * deltaTime;
    state.position.y += state.velocity.y * deltaTime;
    state.position.z += state.velocity.z * deltaTime;

    // Update distance and line out
    state.distance = Math.sqrt(
      state.position.x ** 2 +
      state.position.z ** 2
    );
    state.lineOut = state.distance;
    state.height = state.position.y;

    // Check landing
    if (state.position.y <= 0) {
      state.phase = CastPhase.RETRIEVING;
      state.position.y = 0;
      state.velocity = { x: 0, y: 0, z: 0 };
      state.landAt = Date.now();
    }

    return state;
  }

  /**
   * Calculate launch velocity for cast
   */
  private calculateLaunchVelocity(setup: FishingSetup, power: number): number {
    // Rod length contributes to leverage
    const rodBonus = setup.rod.length * 0.5;

    // Reel smoothness affects accuracy/power transfer
    const reelBonus = setup.reel.ballBearings * 0.1;

    // Line weight affects distance
    const linePenalty = setup.line.diameter === '0.30mm' ? 0 :
                       parseFloat(setup.line.diameter) * 10;

    // Lure weight
    const lureWeight = setup.lure.weight;

    return 30 + rodBonus + reelBonus - linePenalty + (lureWeight * 2) + (power * 20);
  }

  /**
   * Calculate max cast distance
   */
  private calculateCastDistance(setup: FishingSetup, power: number): number {
    const velocity = this.calculateLaunchVelocity(setup, power);
    const angle = Math.PI / 4; // Optimal angle 45 degrees

    return (velocity ** 2 * Math.sin(2 * angle)) / this.GRAVITY;
  }
}

// ============================================================================
// LURE ACTION SYSTEM
// ============================================================================

/**
 * Simulates lure movement and action in water
 */
export class LureActionSystem {
  /**
   * Update lure position based on retrieval action
   */
  updateLure(
    lure: Lure,
    position: Vector3,
    action: LureAction,
    speed: number,
    deltaTime: number,
    time: number
  ): { position: Vector3; velocity: Vector3; vibration: number } {
    const velocity = { x: 0, y: 0, z: 0 };
    let vibration = lure.vibration;

    switch (action) {
      case LureAction.STEADY:
        velocity.z = -speed * 2;
        vibration *= speed;
        break;

      case LureAction.TWITCH:
        velocity.z = -speed * 2;
        velocity.x = Math.sin(time * 10) * 0.5;
        vibration = 1;
        break;

      case LureAction.JERK:
        velocity.z = -speed * 2;
        if (Math.sin(time * 5) > 0.7) {
          velocity.x = (Math.random() - 0.5) * 2;
          velocity.y = Math.random() * 0.5;
          vibration = 1;
        }
        break;

      case LureAction.HOP:
        // Lift and fall action
        const hopPhase = (time * 2) % 1;
        if (hopPhase < 0.2) {
          velocity.y = 2;
        } else if (hopPhase > 0.7) {
          velocity.y = -1;
        }
        velocity.z = -speed;
        break;

      case LureAction.DEADSTICK:
        // Minimal movement, sink slowly
        velocity.y = -0.5;
        vibration = 0.1;
        break;

      case LureAction.BURN:
        velocity.z = -speed * 4;
        vibration = 1;
        break;
    }

    // Apply lure depth characteristics
    const targetDepth = this.calculateLureDepth(lure, speed, action);
    if (position.y > -targetDepth && velocity.y >= 0) {
      velocity.y -= 0.5; // Sink to depth
    }

    return {
      position: {
        x: position.x + velocity.x * deltaTime,
        y: Math.max(-50, position.y + velocity.y * deltaTime),
        z: position.z + velocity.z * deltaTime
      },
      velocity,
      vibration
    };
  }

  /**
   * Calculate lure running depth
   */
  private calculateLureDepth(lure: Lure, speed: number, action: LureAction): number {
    let depth = lure.depth.min;

    // Speed affects diving depth for some lures
    if (lure.category === 'crankbait' || lure.category === 'swimbait') {
      depth = lure.depth.min + (lure.depth.max - lure.depth.min) * speed;
    }

    // Topwater stays at surface
    if (lure.category === 'topwater') {
      depth = 0;
    }

    // Deadstick sinks
    if (action === LureAction.DEADSTICK) {
      depth = lure.depth.max * 2;
    }

    return depth;
  }

  /**
   * Get lure action from category
   */
  getDefaultAction(lure: Lure): LureAction {
    switch (lure.category) {
      case 'crankbait':
        return LureAction.STEADY;
      case 'jig':
        return LureAction.HOP;
      case 'soft_plastic':
        return LureAction.TWITCH;
      case 'spoon':
        return LureAction.JERK;
      case 'spinner':
        return LureAction.STEADY;
      case 'topwater':
        return LureAction.TWITCH;
      case 'swimbait':
        return LureAction.STEADY;
      case 'fly':
        return LureAction.TWITCH;
      case 'live_bait':
        return LureAction.DEADSTICK;
      default:
        return LureAction.STEADY;
    }
  }
}

// ============================================================================
// HOOK SET SYSTEM
// ============================================================================

/**
 * Hook setting mechanics and detection
 */
export class HookSetSystem {
  /**
   * Attempt to set hook
   */
  setHook(
    biteType: BiteType,
    timing: number,
    power: number,
    setup: FishingSetup
  ): { success: boolean; confidence: number; hookSetQuality: number } {
    // Base success rate
    let success = 0.5;

    // Timing window (0-1, where 1 is perfect timing)
    const timingBonus = timing * 0.3;

    // Bite type affects window
    let timingWindow = 1;
    switch (biteType) {
      case BiteType.SLAM:
        timingWindow = 0.8; // More forgiving
        success *= 1.5;
        break;
      case BiteType.TAP:
        timingWindow = 0.3; // Very precise timing needed
        success *= 0.7;
        break;
      case BiteType.THUMP:
        timingWindow = 0.6;
        success *= 1.2;
        break;
      case BiteType.SUCKER:
        timingWindow = 1.5; // Catfish give you time
        success *= 1.3;
        break;
      case BiteType.PECK:
        timingWindow = 0.2;
        success *= 0.5;
        break;
    }

    // Rod action affects hook set
    const rodActionBonus = this.getRodActionBonus(setup.rod.action);
    success *= rodActionBonus;

    // Hook strength
    const hookStrength = setup.rod.hookStrength || 0.5;
    success *= (0.5 + hookStrength * 0.5);

    // Power
    success *= (0.5 + power * 0.5);

    // Calculate final
    const adjustedSuccess = success + timingBonus;
    const roll = Math.random();

    return {
      success: roll < adjustedSuccess,
      confidence: adjustedSuccess,
      hookSetQuality: adjustedSuccess
    };
  }

  /**
   * Calculate rod action bonus for hook sets
   */
  private getRodActionBonus(action: RodAction): number {
    switch (action) {
      case RodAction.FAST:
      case RodAction.EXTRA_FAST:
        return 1.3; // Better hook sets
      case RodAction.MODERATE:
        return 1;
      case RodAction.SLOW:
        return 0.8;
      default:
        return 1;
    }
  }

  /**
   * Determine hook penetration depth
   */
  calculateHookDepth(hookSetQuality: number, fishSize: number): number {
    // Larger fish need more solid hook sets
    const sizeFactor = Math.min(1, fishSize / 20);
    const baseDepth = hookSetQuality * 2;
    return baseDepth * (1 - sizeFactor * 0.3);
  }
}

// ============================================================================
// FIGHT SYSTEM
// ============================================================================

/**
 * Simulates fish fighting mechanics
 */
export class FightSystem {
  /**
   * Update fight state
   */
  updateFight(
    hookState: HookState,
    fishStrength: number,
    isReeling: boolean,
    reelSpeed: number,
    drag: number,
    deltaTime: number
  ): HookState {
    // Update fish fatigue
    const fatigueGain = 0.01 + (isReeling ? reelSpeed * 0.02 : 0);
    hookState.fishFatigue = Math.min(1, hookState.fishFatigue + fatigueGain * deltaTime);

    // Calculate fish behavior based on fatigue
    hookState.fishBehavior = this.determineFishBehavior(
      hookState.fishFatigue,
      fishStrength
    );

    // Calculate line pressure
    if (isReeling) {
      // Player reeling creates pressure
      hookState.linePressure = Math.min(1, hookState.linePressure + reelSpeed * 0.1);
    } else {
      // Fish swimming reduces pressure
      hookState.linePressure = Math.max(0, hookState.linePressure - 0.05);
    }

    // Calculate drag effect
    const effectiveDrag = drag * (1 - hookState.fishFatigue * 0.5);

    // Line damage based on pressure vs drag
    const tensionRatio = hookState.linePressure / (effectiveDrag + 0.1);
    if (tensionRatio > 1.2) {
      hookState.lineHealth -= (tensionRatio - 1) * 0.02;
    }

    // Move fish based on behavior
    hookState.fishPosition = this.applyFishBehavior(
      hookState.fishPosition,
      hookState.fishBehavior,
      fishStrength * (1 - hookState.fishFatigue * 0.7),
      deltaTime
    );

    return hookState;
  }

  /**
   * Determine fish behavior during fight
   */
  private determineFishBehavior(fatigue: number, strength: number): HookedFishBehavior {
    const roll = Math.random();

    if (fatigue < 0.2) {
      // Fresh fish - aggressive behaviors
      if (strength > 0.7) {
        if (roll < 0.3) return HookedFishBehavior.RUN;
        if (roll < 0.5) return HookedFishBehavior.JUMP;
        if (roll < 0.7) return HookedFishBehavior.DIVE;
        return HookedFishBehavior.SHAKE;
      }
      return roll < 0.5 ? HookedFishBehavior.RUN : HookedFishBehavior.DIVE;
    } else if (fatigue < 0.5) {
      // Getting tired
      if (roll < 0.4) return HookedFishBehavior.RUN;
      if (roll < 0.6) return HookedFishBehavior.SHAKE;
      if (roll < 0.8) return HookedFishBehavior.DIVE;
      return HookedFishBehavior.SULG;
    } else if (fatigue < 0.8) {
      // Very tired
      if (roll < 0.3) return HookedFishBehavior.RUN;
      if (roll < 0.6) return HookedFishBehavior.DIVE;
      return HookedFishBehavior.SULG;
    } else {
      // Exhausted - mostly sulking with occasional weak runs
      return roll < 0.2 ? HookedFishBehavior.RUN : HookedFishBehavior.SULG;
    }
  }

  /**
   * Apply fish behavior to position
   */
  private applyFishBehavior(
    position: Vector3,
    behavior: HookedFishBehavior,
    strength: number,
    deltaTime: number
  ): Vector3 {
    const speed = strength * 10;

    switch (behavior) {
      case HookedFishBehavior.RUN:
        return {
          x: position.x + (Math.random() - 0.5) * speed * deltaTime,
          y: position.y,
          z: position.z - speed * deltaTime
        };

      case HookedFishBehavior.JUMP:
        return {
          x: position.x,
          y: position.y + speed * deltaTime,
          z: position.z - speed * deltaTime
        };

      case HookedFishBehavior.DIVE:
        return {
          x: position.x + (Math.random() - 0.5) * speed * 0.5 * deltaTime,
          y: Math.max(-50, position.y - speed * deltaTime),
          z: position.z - speed * 0.5 * deltaTime
        };

      case HookedFishBehavior.SHAKE:
        return {
          x: position.x + (Math.random() - 0.5) * speed * 2 * deltaTime,
          y: position.y,
          z: position.z
        };

      case HookedFishBehavior.ROLL:
        return {
          x: position.x + Math.sin(Date.now() / 100) * speed * deltaTime,
          y: position.y,
          z: position.z - speed * 0.3 * deltaTime
        };

      case HookedFishBehavior.TAIL_WALK:
        return {
          x: position.x + Math.sin(Date.now() / 50) * speed * deltaTime,
          y: 0,
          z: position.z - speed * deltaTime
        };

      case HookedFishBehavior.SULG:
      default:
        // Dead weight, moves slowly
        return {
          x: position.x + (Math.random() - 0.5) * speed * 0.2 * deltaTime,
          y: Math.min(-5, position.y - speed * 0.1 * deltaTime),
          z: position.z - speed * 0.1 * deltaTime
        };
    }
  }

  /**
   * Check if fish can be landed
   */
  canLandFish(hookState: HookState): boolean {
    return hookState.fishFatigue > 0.7 &&
           hookState.fishPosition.y > -2 &&
           hookState.fishPosition.z > -10;
  }

  /**
   * Calculate catch quality based on fight
   */
  calculateCatchQuality(
    fightDuration: number,
    lineHealthRemaining: number,
    fishSize: number
  ): CatchQuality {
    const score = (
      Math.min(1, fightDuration / 30) * 0.3 + // Longer fight = better
      lineHealthRemaining * 0.3 + // More line left = better
      Math.min(1, fishSize / 20) * 0.4 // Bigger fish = better
    );

    if (score > 0.8) return CatchQuality.TROPHY;
    if (score > 0.6) return CatchQuality.EXCELLENT;
    if (score > 0.4) return CatchQuality.GOOD;
    if (score > 0.2) return CatchQuality.FAIR;
    return CatchQuality.POOR;
  }
}

// ============================================================================
// LINE MANAGEMENT
// ============================================================================

/**
 * Manages fishing line properties and physics
 */
export class LineManagementSystem {
  /**
   * Calculate line break probability
   */
  calculateBreakProbability(
    line: FishingLine,
    tension: number,
    fishWeight: number,
    drag: number
  ): number {
    const effectiveTension = tension * fishWeight;
    const lineStrength = parseFloat(line.test);

    // Drag reduces effective tension on line
    const tensionAfterDrag = effectiveTension * (1 - drag * 0.8);

    if (tensionAfterDrag < lineStrength * 0.5) {
      return 0;
    } else if (tensionAfterDrag > lineStrength) {
      return 0.9;
    } else {
      // Linear ramp from 0 to 0.9
      return ((tensionAfterDrag - lineStrength * 0.5) / (lineStrength * 0.5)) * 0.9;
    }
  }

  /**
   * Apply line wear
   */
  applyLineWear(line: FishingLine, amount: number): FishingLine {
    return {
      ...line,
      currentLength: Math.max(0, line.currentLength - amount)
    };
  }

  /**
   * Calculate line visibility to fish
   */
  calculateLineVisibility(
    line: FishingLine,
    waterClarity: number // 0-1, 1 = crystal clear
  ): number {
    let visibility = 0.5;

    // Material affects visibility
    switch (line.material) {
      case LineMaterial.FLUOROCARBON:
        visibility = 0.1; // Nearly invisible
        break;
      case LineMaterial.MONOFILAMENT:
        visibility = 0.4;
        break;
      case LineMaterial.BRAID:
        visibility = 0.7; // Very visible
        break;
      case LineMaterial.FLY_LINE:
        visibility = 0.3;
        break;
    }

    // Water clarity amplifies visibility
    return visibility * waterClarity;
  }
}

// ============================================================================
// ROD-REEL-LURE COMPATIBILITY
// ============================================================================

/**
 * Validates fishing setup compatibility
 */
export class EquipmentCompatibility {
  /**
   * Check if rod power matches lure weight
   */
  validateRodPower(rod: FishingRod, lure: Lure): { valid: boolean; rating: string } {
    const lureWeight = lure.weight; // ounces

    switch (rod.power) {
      case RodPower.ULTRALIGHT:
        if (lureWeight <= 1/16) return { valid: true, rating: 'Excellent' };
        if (lureWeight <= 1/8) return { valid: true, rating: 'Good' };
        if (lureWeight <= 1/4) return { valid: true, rating: 'Fair' };
        return { valid: false, rating: 'Too Heavy' };

      case RodPower.LIGHT:
        if (lureWeight >= 1/16 && lureWeight <= 1/4) return { valid: true, rating: 'Excellent' };
        if (lureWeight <= 3/8) return { valid: true, rating: 'Good' };
        if (lureWeight <= 1/2) return { valid: true, rating: 'Fair' };
        return { valid: false, rating: 'Too Heavy' };

      case RodPower.MEDIUM:
        if (lureWeight >= 1/4 && lureWeight <= 1/2) return { valid: true, rating: 'Excellent' };
        if (lureWeight <= 3/4) return { valid: true, rating: 'Good' };
        if (lureWeight <= 1) return { valid: true, rating: 'Fair' };
        return { valid: false, rating: 'Too Heavy' };

      case RodPower.MEDIUM_HEAVY:
        if (lureWeight >= 3/8 && lureWeight <= 1) return { valid: true, rating: 'Excellent' };
        if (lureWeight <= 1.5) return { valid: true, rating: 'Good' };
        if (lureWeight <= 2) return { valid: true, rating: 'Fair' };
        return { valid: false, rating: 'Too Heavy' };

      case RodPower.HEAVY:
        if (lureWeight >= 1/2 && lureWeight <= 2) return { valid: true, rating: 'Excellent' };
        if (lureWeight <= 4) return { valid: true, rating: 'Good' };
        if (lureWeight <= 6) return { valid: true, rating: 'Fair' };
        return { valid: false, rating: 'Too Heavy' };

      case RodPower.EXTRA_HEAVY:
        if (lureWeight >= 1 && lureWeight <= 4) return { valid: true, rating: 'Excellent' };
        if (lureWeight <= 8) return { valid: true, rating: 'Good' };
        if (lureWeight <= 12) return { valid: true, rating: 'Fair' };
        return { valid: false, rating: 'Too Heavy' };

      default:
        return { valid: true, rating: 'Unknown' };
    }
  }

  /**
   * Check if reel balances with rod
   */
  validateReelBalance(rod: FishingRod, reel: FishingReel): { valid: boolean; rating: string } {
    // Simple size matching
    const rodSize = rod.length; // feet
    const reelSize = reel.gearRatio; // proxy for size

    if (rodSize <= 6 && reelSize <= 6) return { valid: true, rating: 'Good' };
    if (rodSize <= 7 && reelSize <= 7) return { valid: true, rating: 'Good' };
    if (rodSize > 7 && reelSize >= 6.5) return { valid: true, rating: 'Good' };

    return { valid: true, rating: 'Fair' };
  }

  /**
   * Check line matches rod rating
   */
  validateLineRating(rod: FishingRod, line: FishingLine): { valid: boolean; rating: string } {
    const lineTest = parseFloat(line.test);

    if (lineTest < rod.lineRating.min) {
      return { valid: false, rating: 'Too Light' };
    }
    if (lineTest > rod.lineRating.max) {
      return { valid: false, rating: 'Too Heavy' };
    }

    return { valid: true, rating: 'Perfect' };
  }

  /**
   * Get overall setup rating
   */
  getSetupRating(setup: FishingSetup): {
    overall: number; // 0-1
    castDistance: number;
    hookSetPower: number;
    fishControl: number;
  } {
    const powerRating = this.validateRodPower(setup.rod, setup.lure);
    const lineRating = this.validateLineRating(setup.rod, setup.line);

    let overall = 0.5;

    if (powerRating.valid) overall += 0.2;
    if (powerRating.rating === 'Excellent') overall += 0.1;
    if (lineRating.valid) overall += 0.1;
    if (lineRating.rating === 'Perfect') overall += 0.1;

    // Reel quality
    overall += setup.reel.quality * 0.1;

    return {
      overall: Math.min(1, overall),
      castDistance: setup.rod.length * 5 + setup.reel.gearRatio * 2,
      hookSetPower: this.getHookSetPower(setup.rod.action),
      fishControl: this.getFishControl(setup.rod.power, setup.reel.gearRatio)
    };
  }

  private getHookSetPower(action: RodAction): number {
    switch (action) {
      case RodAction.EXTRA_FAST: return 1;
      case RodAction.FAST: return 0.9;
      case RodAction.MODERATE: return 0.7;
      case RodAction.SLOW: return 0.5;
    }
  }

  private getFishControl(power: RodPower, gearRatio: number): number {
    let control = 0.5;

    switch (power) {
      case RodPower.EXTRA_HEAVY:
      case RodPower.HEAVY:
        control = 0.9;
        break;
      case RodPower.MEDIUM_HEAVY:
        control = 0.8;
        break;
      case RodPower.MEDIUM:
        control = 0.7;
        break;
      case RodPower.LIGHT:
        control = 0.5;
        break;
      case RodPower.ULTRALIGHT:
        control = 0.3;
        break;
    }

    control += (gearRatio - 5) * 0.05;

    return Math.min(1, control);
  }
}

// ============================================================================
// DEFAULT EQUIPMENT
// ============================================================================

/**
 * Default fishing equipment presets
 */
export const DEFAULT_EQUIPMENT = {
  rods: {
    beginner: {
      id: 'rod_spinning_beginner',
      name: 'Beginner Spinning Rod',
      power: RodPower.MEDIUM,
      action: RodAction.MODERATE,
      length: 7,
      lineRating: { min: 6, max: 12 },
      color: '#2C3E50',
      material: 'Fiberglass',
      quality: 0.5
    } as FishingRod,

    bass: {
      id: 'rod_baitcaster_bass',
      name: 'Bass Baitcasting Rod',
      power: RodPower.MEDIUM_HEAVY,
      action: RodAction.FAST,
      length: 7.5,
      lineRating: { min: 10, max: 17 },
      color: '#1A1A1A',
      material: 'Graphite',
      quality: 0.7
    } as FishingRod,

    trout: {
      id: 'rod_spin_trout',
      name: 'Trout Spinning Rod',
      power: RodPower.LIGHT,
      action: RodAction.FAST,
      length: 6,
      lineRating: { min: 2, max: 6 },
      color: '#4A6741',
      material: 'Graphite',
      quality: 0.6
    } as FishingRod
  },

  reels: {
    spinning: {
      id: 'reel_spinning_2500',
      name: '2500 Spinning Reel',
      type: 'spinning' as const,
      gearRatio: 5.2,
      lineCapacity: {
        monofilament: { test: 10, yards: 120 }
      },
      maxDrag: 11,
      ballBearings: 6,
      quality: 0.6
    } as FishingReel,

    baitcasting: {
      id: 'reel_baitcaster',
      name: 'Baitcasting Reel',
      type: 'baitcasting' as const,
      gearRatio: 7.1,
      lineCapacity: {
        monofilament: { test: 14, yards: 150 }
      },
      maxDrag: 15,
      ballBearings: 10,
      quality: 0.7
    } as FishingReel
  },

  lines: {
    mono: {
      material: 'monofilament' as const,
      test: '10',
      diameter: '0.30mm',
      length: 300,
      color: 'Clear',
      currentLength: 300
    } as FishingLine,

    braid: {
      material: 'braid' as const,
      test: '20',
      diameter: '0.20mm',
      length: 150,
      color: 'Green',
      currentLength: 150
    } as FishingLine,

    fluoro: {
      material: 'fluorocarbon' as const,
      test: '8',
      diameter: '0.25mm',
      length: 200,
      color: 'Clear',
      currentLength: 200
    } as FishingLine
  },

  lures: {
    spinnerbait: {
      id: 'lure_spinnerbait_white',
      name: 'White Spinnerbait',
      category: 'spinner' as const,
      weight: 0.5,
      length: 4,
      depth: { min: 0, max: 5 },
      color: 'White',
      pattern: 'Chartreuse/White',
      action: 'steady' as const,
      actionProfile: 'Vibrates and flashes on steady retrieve',
      vibration: 0.8,
      flash: 0.7,
      scent: 0,
      effectiveness: {},
      quantity: 1
    } as Lure,

    crankbait: {
      id: 'lure_crankbait_square',
      name: 'Square Bill Crankbait',
      category: 'crankbait' as const,
      weight: 0.375,
      length: 2.5,
      depth: { min: 3, max: 6 },
      color: 'Fire Tiger',
      pattern: 'Fire Tiger',
      action: 'steady' as const,
      actionProfile: 'Wide wobble, deflects off cover',
      vibration: 0.6,
      flash: 0.5,
      scent: 0,
      effectiveness: {},
      quantity: 1
    } as Lure,

 plastic_worm: {
      id: 'lure_worm_ribbon',
      name: 'Ribbon Tail Worm',
      category: 'soft_plastic' as const,
      weight: 0.25,
      length: 7,
      depth: { min: 0, max: 15 },
      color: 'June Bug',
      pattern: 'Solid with blue flake',
      action: 'twitch' as const,
      actionProfile: 'Subtle tail action on twitch',
      vibration: 0.2,
      flash: 0.1,
      scent: 0.3,
      effectiveness: {},
      quantity: 10
    } as Lure,

    jig: {
      id: 'lure_jig_finesse',
      name: 'Finesse Jig',
      category: 'jig' as const,
      weight: 0.25,
      length: 3,
      depth: { min: 5, max: 20 },
      color: 'Brown/Purple',
      pattern: 'Brown with purple trailer',
      action: 'hop' as const,
      actionProfile: 'Falls horizontally, hops along bottom',
      vibration: 0.3,
      flash: 0.2,
      scent: 0.4,
      effectiveness: {},
      quantity: 1
    } as Lure
  }
};

// Export system instances
export const castingSystem = new CastingSystem();
export const lureActionSystem = new LureActionSystem();
export const hookSetSystem = new HookSetSystem();
export const fightSystem = new FightSystem();
export const lineManagementSystem = new LineManagementSystem();
export const equipmentCompatibility = new EquipmentCompatibility();
