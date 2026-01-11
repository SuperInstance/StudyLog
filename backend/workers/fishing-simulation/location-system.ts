/**
 * Location System - Fishing Spots and Bodies of Water
 *
 * Manages fishing locations with:
 * - Quality tier support
 * - Fish populations
 * - Environmental features
 * - Accessibility
 */

import {
  FishingLocation,
  FishingSpot,
  WaterBodyType,
  WaterClarity,
  DepthZone,
  CurrentStrength,
  CoverType,
  EngineTier,
  Structure,
  Vegetation,
  LocationFeature,
  AccessPoint,
  Season,
  ActivityPattern,
  Vector3
} from './types';

// ============================================================================
// LOCATION TEMPLATES
// ============================================================================

/**
 * Location templates by type
 */
export const LOCATION_TEMPLATES: Record<WaterBodyType, Partial<FishingLocation>> = {
  [WaterBodyType.POND]: {
    type: WaterBodyType.POND,
    size: 5, // acres
    depth: 15,
    clarity: WaterClarity.STAINED,
    current: CurrentStrength.SLIGHT,
    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI],
    boatLaunch: false,
    shoreAccess: true
  },

  [WaterBodyType.LAKE]: {
    type: WaterBodyType.LAKE,
    size: 500,
    depth: 60,
    clarity: WaterClarity.CLEAR,
    current: CurrentStrength.SLIGHT,
    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI, EngineTier.OPENRTS],
    boatLaunch: true,
    shoreAccess: true
  },

  [WaterBodyType.RIVER]: {
    type: WaterBodyType.RIVER,
    size: 0, // Linear, not measured in acres
    depth: 20,
    clarity: WaterClarity.STAINED,
    current: CurrentStrength.MODERATE,
    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI, EngineTier.OPENRTS],
    boatLaunch: true,
    shoreAccess: true
  },

  [WaterBodyType.STREAM]: {
    type: WaterBodyType.STREAM,
    size: 0,
    depth: 8,
    clarity: WaterClarity.CLEAR,
    current: CurrentStrength.MODERATE,
    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI],
    boatLaunch: false,
    shoreAccess: true
  },

  [WaterBodyType.OCEAN]: {
    type: WaterBodyType.OCEAN,
    size: 1000000,
    depth: 200,
    clarity: WaterClarity.VERY_CLEAR,
    current: CurrentStrength.MODERATE,
    supportedTiers: [EngineTier.LUANTI, EngineTier.OPENRTS],
    boatLaunch: true,
    shoreAccess: true
  },

  [WaterBodyType.RESERVOIR]: {
    type: WaterBodyType.RESERVOIR,
    size: 2000,
    depth: 80,
    clarity: WaterClarity.STAINED,
    current: CurrentStrength.SLIGHT,
    supportedTiers: [EngineTier.LUANTI, EngineTier.OPENRTS],
    boatLaunch: true,
    shoreAccess: true
  },

  [WaterBodyType.SWAMP]: {
    type: WaterBodyType.SWAMP,
    size: 100,
    depth: 6,
    clarity: WaterClarity.MURKY,
    current: CurrentStrength.SLIGHT,
    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI],
    boatLaunch: false,
    shoreAccess: true
  },

  [WaterBodyType.CANAL]: {
    type: WaterBodyType.CANAL,
    size: 0,
    depth: 15,
    clarity: WaterClarity.STAINED,
    current: CurrentStrength.SLIGHT,
    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI],
    boatLaunch: true,
    shoreAccess: true
  }
};

// ============================================================================
// DEFAULT LOCATIONS
// ============================================================================

/**
 * Example fishing locations
 */
export const DEFAULT_LOCATIONS: FishingLocation[] = [
  {
    id: 'mill_pond',
    name: "Miller's Pond",
    type: WaterBodyType.POND,

    position: { x: 0, y: 0, z: 0 },
    size: 8,

    depth: 12,
    clarity: WaterClarity.STAINED,
    temperature: 68,
    current: CurrentStrength.SLIGHT,

    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI, EngineTier.OPENRTS],

    spots: [
      {
        id: 'mill_pond_dock',
        name: 'Old Dock',
        position: { x: 10, y: 0, z: 0 },
        depth: 8,
        dropoff: true,
        underwater: false,
        cover: [CoverType.DOCKS, CoverType.ROCKS],
        structure: true,
        vegetation: true,
        attractiveness: 0.7,
        activeFish: [],
        peakTimes: [ActivityPattern.DAWN, ActivityPattern.DUSK],
        peakSeasons: [Season.SPRING, Season.FALL]
      },
      {
        id: 'mill_pond_weeds',
        name: 'Lily Pad Bay',
        position: { x: -20, y: 0, z: 15 },
        depth: 4,
        dropoff: false,
        underwater: false,
        cover: [CoverType.LILY_PADS, CoverType.WEEDS],
        structure: false,
        vegetation: true,
        attractiveness: 0.8,
        activeFish: [],
        peakTimes: [ActivityPattern.DUSK],
        peakSeasons: [Season.SUMMER]
      },
      {
        id: 'mill_pond_deep',
        name: 'Deep Hole',
        position: { x: 0, y: 0, z: -30 },
        depth: 12,
        dropoff: true,
        underwater: true,
        cover: [CoverType.SUBMERGED_GRASS],
        structure: false,
        vegetation: true,
        attractiveness: 0.6,
        activeFish: [],
        peakTimes: [ActivityPattern.NIGHT],
        peakSeasons: [Season.SUMMER, Season.FALL]
      }
    ],

    fishSpecies: [
      'bluegill',
      'black_crappie',
      'largemouth_bass',
      'channel_catfish'
    ],

    features: [
      {
        type: 'dam',
        position: { x: 50, y: 0, z: 0 },
        description: 'Old stone dam creates the pond'
      }
    ],

    structures: [
      {
        id: 'structure_dock',
        type: 'wooden_dock',
        position: { x: 10, y: 0, z: 0 },
        size: { x: 20, y: 0, z: 8 },
        fishHold: 0.7
      },
      {
        id: 'structure_dropoff',
        type: 'underwater_hump',
        position: { x: 0, y: -4, z: -20 },
        size: { x: 15, y: 4, z: 15 },
        fishHold: 0.8
      }
    ],

    vegetation: [
      {
        type: 'lily_pads',
        position: { x: -20, y: -1, z: 15 },
        density: 0.7,
        height: 0.5
      },
      {
        type: 'cattails',
        position: { x: -30, y: 0, z: 20 },
        density: 0.5,
        height: 6
      }
    ],

    accessPoints: [
      {
        id: 'access_shore',
        name: 'Shore Access',
        position: { x: 0, y: 0, z: 25 },
        type: 'shore',
        available: true
      }
    ],

    boatLaunch: false,
    shoreAccess: true,

    region: 'Midwest',
    description: 'A quiet farm pond with excellent panfishing and occasional trophy bass.',
    bestSeasons: [Season.SPRING, Season.FALL],
    pressure: 0.4
  },

  {
    id: 'crystal_lake',
    name: 'Crystal Lake',
    type: WaterBodyType.LAKE,

    position: { x: 0, y: 0, z: 0 },
    size: 450,

    depth: 85,
    clarity: WaterClarity.VERY_CLEAR,
    temperature: 62,
    current: CurrentStrength.SLIGHT,

    supportedTiers: [EngineTier.LUANTI, EngineTier.OPENRTS],

    spots: [
      {
        id: 'crystal_point',
        name: 'Rocky Point',
        position: { x: 100, y: 0, z: 50 },
        depth: 25,
        dropoff: true,
        underwater: false,
        cover: [CoverType.ROCKS],
        structure: true,
        vegetation: false,
        attractiveness: 0.9,
        activeFish: [],
        peakTimes: [ActivityPattern.DAWN, ActivityPattern.DUSK],
        peakSeasons: [Season.SPRING, Season.SUMMER]
      },
      {
        id: 'crystal_island',
        name: 'Sunken Island',
        position: { x: 0, y: 0, z: -80 },
        depth: 15,
        dropoff: true,
        underwater: true,
        cover: [CoverType.SUBMERGED_GRASS],
        structure: true,
        vegetation: true,
        attractiveness: 0.95,
        activeFish: [],
        peakTimes: [ActivityPattern.ALL_DAY],
        peakSeasons: [Season.SUMMER]
      },
      {
        id: 'crystal_cove',
        name: 'Protected Cove',
        position: { x: -80, y: 0, z: 40 },
        depth: 8,
        dropoff: false,
        underwater: false,
        cover: [CoverType.WEEDS, CoverType.OVERHANGING],
        structure: true,
        vegetation: true,
        attractiveness: 0.75,
        activeFish: [],
        peakTimes: [ActivityPattern.DUSK],
        peakSeasons: [Season.SPRING]
      },
      {
        id: 'crystal_deep',
        name: 'Main Basin',
        position: { x: 0, y: 0, z: 0 },
        depth: 85,
        dropoff: true,
        underwater: true,
        cover: [],
        structure: false,
        vegetation: false,
        attractiveness: 0.5,
        activeFish: [],
        peakTimes: [ActivityPattern.NIGHT],
        peakSeasons: [Season.SUMMER, Season.FALL]
      }
    ],

    fishSpecies: [
      'largemouth_bass',
      'smallmouth_bass',
      'walleye',
      'northern_pike',
      'muskie',
      'bluegill',
      'black_crappie',
      'yellow_perch',
      'lake_sturgeon'
    ],

    features: [
      {
        type: 'underwater_spring',
        position: { x: 50, y: -40, z: -30 },
        description: 'Underwater spring keeps this area cool in summer'
      }
    ],

    structures: [
      {
        id: 'structure_reef',
        type: 'rock_reef',
        position: { x: 100, y: 0, z: 50 },
        size: { x: 50, y: 20, z: 30 },
        fishHold: 0.9
      },
      {
        id: 'structure_sunken_island',
        type: 'underwater_hump',
        position: { x: 0, y: -15, z: -80 },
        size: { x: 40, y: 15, z: 40 },
        fishHold: 0.95
      },
      {
        id: 'structure_crib',
        type: 'fish_crib',
        position: { x: -50, y: 0, z: 20 },
        size: { x: 10, y: 8, z: 10 },
        fishHold: 0.8
      }
    ],

    vegetation: [
      {
        type: 'coontail',
        position: { x: -80, y: 0, z: 40 },
        density: 0.6,
        height: 8
      },
      {
        type: 'cabbage',
        position: { x: 0, y: -10, z: -80 },
        density: 0.4,
        height: 12
      }
    ],

    accessPoints: [
      {
        id: 'access_boat',
        name: 'Public Boat Launch',
        position: { x: 100, y: 0, z: 100 },
        type: 'boat_launch',
        available: true
      },
      {
        id: 'access_shore_1',
        name: 'West Shore Access',
        position: { x: -100, y: 0, z: 0 },
        type: 'shore',
        available: true
      }
    ],

    boatLaunch: true,
    shoreAccess: true,

    region: 'North Woods',
    description: 'A clear, deep lake known for trophy smallmouth and muskie fishing.',
    bestSeasons: [Season.SPRING, Season.FALL],
    pressure: 0.6
  },

  {
    id: 'trout_stream',
    name: 'Willow Creek',
    type: WaterBodyType.STREAM,

    position: { x: 0, y: 0, z: 0 },
    size: 0,

    depth: 6,
    clarity: WaterClarity.CLEAR,
    temperature: 54,
    current: CurrentStrength.MODERATE,

    supportedTiers: [EngineTier.MICROVERSE, EngineTier.LUANTI, EngineTier.OPENRTS],

    spots: [
      {
        id: 'willow_pool_1',
        name: 'Upper Pool',
        position: { x: 0, y: 0, z: 0 },
        depth: 6,
        dropoff: true,
        underwater: false,
        cover: [CoverType.OVERHANGING, CoverType.ROCKS],
        structure: true,
        vegetation: false,
        attractiveness: 0.85,
        activeFish: [],
        peakTimes: [ActivityPattern.DAWN, ActivityPattern.DUSK],
        peakSeasons: [Season.SPRING, Season.FALL]
      },
      {
        id: 'willow_riffle',
        name: 'Fast Riffle',
        position: { x: 30, y: 0, z: 20 },
        depth: 2,
        dropoff: false,
        underwater: false,
        cover: [CoverType.ROCKS],
        structure: true,
        vegetation: false,
        attractiveness: 0.6,
        activeFish: [],
        peakTimes: [ActivityPattern.DAY],
        peakSeasons: [Season.SPRING]
      },
      {
        id: 'willow_bend',
        name: 'Deep Bend',
        position: { x: 50, y: 0, z: 60 },
        depth: 5,
        dropoff: true,
        underwater: false,
        cover: [CoverType.DOWNED_TREES],
        structure: true,
        vegetation: false,
        attractiveness: 0.9,
        activeFish: [],
        peakTimes: [ActivityPattern.NIGHT],
        peakSeasons: [Season.SUMMER]
      },
      {
        id: 'willow_tailout',
        name: 'Tailout',
        position: { x: 70, y: 0, z: 80 },
        depth: 3,
        dropoff: false,
        underwater: false,
        cover: [CoverType.ROCKS],
        structure: true,
        vegetation: false,
        attractiveness: 0.7,
        activeFish: [],
        peakTimes: [ActivityPattern.DUSK],
        peakSeasons: [Season.SPRING, Season.FALL]
      }
    ],

    fishSpecies: [
      'rainbow_trout',
      'brown_trout',
      'brook_trout',
      'steelhead'
    ],

    features: [
      {
        type: 'waterfall',
        position: { x: -20, y: 5, z: -20 },
        description: 'Small waterfall prevents upstream migration'
      }
    ],

    structures: [
      {
        id: 'structure_logjam',
        type: 'log_jam',
        position: { x: 50, y: 0, z: 60 },
        size: { x: 15, y: 3, z: 10 },
        fishHold: 0.95
      }
    ],

    vegetation: [],

    accessPoints: [
      {
        id: 'access_trail',
        name: 'Trail Access',
        position: { x: 0, y: 0, z: 20 },
        type: 'shore',
        available: true
      }
    ],

    boatLaunch: false,
    shoreAccess: true,

    region: 'Rocky Mountains',
    description: 'A pristine mountain stream with excellent trout fishing.',
    bestSeasons: [Season.SPRING, Season.FALL],
    pressure: 0.3
  },

  {
    id: 'mississippi_river_pool',
    name: 'River Pool 4',
    type: WaterBodyType.RIVER,

    position: { x: 0, y: 0, z: 0 },
    size: 0,

    depth: 35,
    clarity: WaterClarity.STAINED,
    temperature: 70,
    current: CurrentStrength.MODERATE,

    supportedTiers: [EngineTier.LUANTI, EngineTier.OPENRTS],

    spots: [
      {
        id: 'river_wing_dam',
        name: 'Wing Dam',
        position: { x: 40, y: 0, z: 0 },
        depth: 8,
        dropoff: true,
        underwater: true,
        cover: [CoverType.ROCKS],
        structure: true,
        vegetation: false,
        attractiveness: 0.9,
        activeFish: [],
        peakTimes: [ActivityPattern.ALL_DAY],
        peakSeasons: [Season.SUMMER, Season.FALL]
      },
      {
        id: 'river_backwater',
        name: 'Backwater Slough',
        position: { x: -30, y: 0, z: 30 },
        depth: 5,
        dropoff: false,
        underwater: false,
        cover: [CoverType.WEEDS, CoverType.LILY_PADS],
        structure: false,
        vegetation: true,
        attractiveness: 0.8,
        activeFish: [],
        peakTimes: [ActivityPattern.DUSK],
        peakSeasons: [Season.SUMMER]
      },
      {
        id: 'river_channel',
        name: 'Navigation Channel',
        position: { x: 0, y: 0, z: 0 },
        depth: 35,
        dropoff: true,
        underwater: true,
        cover: [],
        structure: true,
        vegetation: false,
        attractiveness: 0.7,
        activeFish: [],
        peakTimes: [ActivityPattern.NIGHT],
        peakSeasons: [Season.WINTER, Season.SPRING]
      }
    ],

    fishSpecies: [
      'smallmouth_bass',
      'walleye',
      'sauger',
      'northern_pike',
      'channel_catfish',
      'flathead_catfish',
      'blue_catfish',
      'freshwater_drum'
    ],

    features: [
      {
        type: 'lock_and_dam',
        position: { x: 100, y: 0, z: 0 },
        description: 'Lock and dam system creates the pool'
      }
    ],

    structures: [
      {
        id: 'structure_wing_dam',
        type: 'wing_dam',
        position: { x: 40, y: 0, z: 0 },
        size: { x: 30, y: 5, z: 15 },
        fishHold: 0.9
      }
    ],

    vegetation: [
      {
        type: 'wild_cele',
        position: { x: -30, y: 0, z: 30 },
        density: 0.5,
        height: 6
      }
    ],

    accessPoints: [
      {
        id: 'access_boat',
        name: 'Public Ramp',
        position: { x: 50, y: 0, z: 50 },
        type: 'boat_launch',
        available: true
      }
    ],

    boatLaunch: true,
    shoreAccess: true,

    region: 'Upper Mississippi',
    description: 'A major river pool with diverse fishing opportunities.',
    bestSeasons: [Season.SUMMER, Season.FALL],
    pressure: 0.7
  },

  {
    id: 'ocean_bay',
    name: 'Serenity Bay',
    type: WaterBodyType.OCEAN,

    position: { x: 0, y: 0, z: 0 },
    size: 50000,

    depth: 120,
    clarity: WaterClarity.CLEAR,
    temperature: 58,
    current: CurrentStrength.MODERATE,

    supportedTiers: [EngineTier.OPENRTS],

    spots: [
      {
        id: 'bay_jetty',
        name: 'Rock Jetty',
        position: { x: 80, y: 0, z: 0 },
        depth: 15,
        dropoff: true,
        underwater: true,
        cover: [CoverType.ROCKS],
        structure: true,
        vegetation: false,
        attractiveness: 0.85,
        activeFish: [],
        peakTimes: [ActivityPattern.DAWN, ActivityPattern.DUSK],
        peakSeasons: [Season.SUMMER, Season.FALL]
      },
      {
        id: 'bay_kelp_forest',
        name: 'Kelp Forest',
        position: { x: -40, y: 0, z: 30 },
        depth: 25,
        dropoff: true,
        underwater: true,
        cover: [CoverType.WEEDS],
        structure: true,
        vegetation: true,
        attractiveness: 0.9,
        activeFish: [],
        peakTimes: [ActivityPattern.DAY],
        peakSeasons: [Season.SUMMER]
      },
      {
        id: 'bay_deep',
        name: 'Deep Drop',
        position: { x: 0, y: 0, z: -100 },
        depth: 120,
        dropoff: true,
        underwater: true,
        cover: [],
        structure: false,
        vegetation: false,
        attractiveness: 0.6,
        activeFish: [],
        peakTimes: [ActivityPattern.NIGHT],
        peakSeasons: [Season.FALL, Season.WINTER]
      }
    ],

    fishSpecies: [
      'rockfish',
      'lingcod',
      'cabezon',
      'kelp_bass',
      'salmon',
      'halibut'
    ],

    features: [],

    structures: [
      {
        id: 'structure_reef',
        type: 'artificial_reef',
        position: { x: -60, y: -40, z: -50 },
        size: { x: 100, y: 20, z: 100 },
        fishHold: 0.95
      }
    ],

    vegetation: [
      {
        type: 'kelp',
        position: { x: -40, y: 0, z: 30 },
        density: 0.8,
        height: 30
      }
    ],

    accessPoints: [
      {
        id: 'access_marina',
        name: 'Public Marina',
        position: { x: 100, y: 0, z: 80 },
        type: 'boat_launch',
        available: true
      },
      {
        id: 'access_pier',
        name: 'Fishing Pier',
        position: { x: 0, y: 0, z: 100 },
        type: 'pier',
        available: true
      }
    ],

    boatLaunch: true,
    shoreAccess: true,

    region: 'Pacific Coast',
    description: 'A protected bay with access to open ocean fishing.',
    bestSeasons: [Season.SUMMER, Season.FALL],
    pressure: 0.5
  }
];

// ============================================================================
// LOCATION SYSTEM
// ============================================================================

/**
 * Manages fishing locations
 */
export class LocationSystem {
  private locations: Map<string, FishingLocation> = new Map();
  private activeSpots: Map<string, string[]> = new Map(); // locationId -> active fish IDs

  constructor() {
    this.initializeLocations();
  }

  /**
   * Initialize with default locations
   */
  private initializeLocations(): void {
    for (const location of DEFAULT_LOCATIONS) {
      this.locations.set(location.id, location);
      this.activeSpots.set(location.id, []);
    }
  }

  /**
   * Get location by ID
   */
  getLocation(id: string): FishingLocation | undefined {
    return this.locations.get(id);
  }

  /**
   * Get all locations
   */
  getAllLocations(): FishingLocation[] {
    return Array.from(this.locations.values());
  }

  /**
   * Get locations by type
   */
  getByType(type: WaterBodyType): FishingLocation[] {
    return this.getAllLocations().filter(l => l.type === type);
  }

  /**
   * Get locations by tier support
   */
  getByTier(tier: EngineTier): FishingLocation[] {
    return this.getAllLocations().filter(l =>
      l.supportedTiers.includes(tier)
    );
  }

  /**
   * Get location spots
   */
  getSpots(locationId: string): FishingSpot[] {
    const location = this.locations.get(locationId);
    return location?.spots || [];
  }

  /**
   * Get specific spot
   */
  getSpot(locationId: string, spotId: string): FishingSpot | undefined {
    const spots = this.getSpots(locationId);
    return spots.find(s => s.id === spotId);
  }

  /**
   * Find spots by depth range
   */
  findSpotsByDepth(locationId: string, minDepth: number, maxDepth: number): FishingSpot[] {
    const spots = this.getSpots(locationId);
    return spots.filter(s => s.depth >= minDepth && s.depth <= maxDepth);
  }

  /**
   * Find spots by cover type
   */
  findSpotsByCover(locationId: string, coverType: CoverType): FishingSpot[] {
    const spots = this.getSpots(locationId);
    return spots.filter(s => s.cover.includes(coverType));
  }

  /**
   * Get best spots for current conditions
   */
  getBestSpots(
    locationId: string,
    timeOfDay: number,
    season: Season,
    weather: string
  ): FishingSpot[] {
    const location = this.locations.get(locationId);
    if (!location) return [];

    const spots = location.spots.filter(spot => {
      // Check if spot is active for current time
      const activityMatch = this.matchesActivityPattern(spot.peakTimes, timeOfDay);
      const seasonMatch = spot.peakSeasons.includes(season) || spot.peakSeasons.includes(Season.ALL_YEAR);

      return activityMatch && seasonMatch;
    });

    // Sort by attractiveness
    return spots.sort((a, b) => b.attractiveness - a.attractiveness);
  }

  /**
   * Check if spot matches current time pattern
   */
  private matchesActivityPattern(patterns: ActivityPattern[], hour: number): boolean {
    if (patterns.includes(ActivityPattern.ALL_DAY)) return true;

    for (const pattern of patterns) {
      switch (pattern) {
        case ActivityPattern.DAWN:
          if (hour >= 5 && hour <= 7) return true;
          break;
        case ActivityPattern.DAY:
          if (hour >= 9 && hour <= 16) return true;
          break;
        case ActivityPattern.DUSK:
          if (hour >= 18 && hour <= 20) return true;
          break;
        case ActivityPattern.NIGHT:
          if (hour >= 21 || hour <= 4) return true;
          break;
        case ActivityPattern.TWILIGHT:
          if ((hour >= 5 && hour <= 7) || (hour >= 18 && hour <= 20)) return true;
          break;
      }
    }

    return false;
  }

  /**
   * Calculate spot quality based on conditions
   */
  calculateSpotQuality(
    spot: FishingSpot,
    conditions: SpotConditions
  ): number {
    let quality = spot.attractiveness;

    // Time of day bonus
    const isPeakTime = this.matchesActivityPattern(spot.peakTimes, conditions.timeOfDay);
    if (isPeakTime) quality *= 1.3;

    // Season bonus
    if (spot.peakSeasons.includes(conditions.season)) {
      quality *= 1.2;
    }

    // Weather modifier
    if (conditions.weather === 'storm' && spot.depth < 10) {
      quality *= 0.6; // Shallow spots poor in storms
    } else if (conditions.weather === 'overcast') {
      quality *= 1.1; // Overcast is generally good
    }

    // Pressure (fishing pressure reduces quality)
    quality *= (1 - conditions.pressure * 0.3);

    return Math.min(1, quality);
  }

  /**
   * Add fish to spot
   */
  addFishToSpot(locationId: string, spotId: string, fishId: string): void {
    const location = this.locations.get(locationId);
    if (!location) return;

    const spot = location.spots.find(s => s.id === spotId);
    if (spot) {
      spot.activeFish.push(fishId);
    }
  }

  /**
   * Remove fish from spot
   */
  removeFishFromSpot(locationId: string, spotId: string, fishId: string): void {
    const location = this.locations.get(locationId);
    if (!location) return;

    const spot = location.spots.find(s => s.id === spotId);
    if (spot) {
      const idx = spot.activeFish.indexOf(fishId);
      if (idx >= 0) {
        spot.activeFish.splice(idx, 1);
      }
    }
  }

  /**
   * Get nearby spots
   */
  getNearbySpots(locationId: string, position: Vector3, radius: number): FishingSpot[] {
    const spots = this.getSpots(locationId);

    return spots.filter(spot => {
      const dist = Math.sqrt(
        (spot.position.x - position.x) ** 2 +
        (spot.position.z - position.z) ** 2
      );
      return dist <= radius;
    });
  }

  /**
   * Create custom location
   */
  createLocation(config: Partial<FishingLocation>): FishingLocation {
    const id = config.id || `location_${Date.now()}`;

    const location: FishingLocation = {
      id,
      name: config.name || 'Unnamed Water',
      type: config.type || WaterBodyType.POND,

      position: config.position || { x: 0, y: 0, z: 0 },
      size: config.size || 10,

      depth: config.depth || 15,
      clarity: config.clarity || WaterClarity.STAINED,
      temperature: config.temperature || 65,
      current: config.current || CurrentStrength.SLIGHT,

      supportedTiers: config.supportedTiers || [EngineTier.MICROVERSE],

      spots: config.spots || [],
      fishSpecies: config.fishSpecies || [],
      features: config.features || [],
      structures: config.structures || [],
      vegetation: config.vegetation || [],
      accessPoints: config.accessPoints || [],

      boatLaunch: config.boatLaunch || false,
      shoreAccess: config.shoreAccess !== false,

      region: config.region || 'Unknown',
      description: config.description || '',
      bestSeasons: config.bestSeasons || [Season.SPRING, Season.FALL],
      pressure: config.pressure || 0.5
    };

    this.locations.set(id, location);
    this.activeSpots.set(id, []);

    return location;
  }

  /**
   * Update location state
   */
  updateLocation(
    locationId: string,
    updates: Partial<FishingLocation>
  ): FishingLocation | null {
    const location = this.locations.get(locationId);
    if (!location) return null;

    const updated = { ...location, ...updates };
    this.locations.set(locationId, updated);

    return updated;
  }
}

/**
 * Conditions for spot evaluation
 */
export interface SpotConditions {
  timeOfDay: number; // 0-24
  season: Season;
  weather: string;
  pressure: number; // 0-1
  temperature: number;
}

// Export singleton
export const locationSystem = new LocationSystem();

// Export for testing
export { DEFAULT_LOCATIONS };
