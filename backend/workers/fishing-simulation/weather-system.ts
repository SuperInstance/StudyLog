/**
 * Weather System - Environmental Conditions
 *
 * Simulates weather that affects fishing:
 * - Temperature changes
 * - Wind and waves
 * - Precipitation
 * - Barometric pressure
 * - Light conditions
 */

import {
  WeatherState,
  WeatherCondition,
  WeatherForecast,
  Season,
  Vector3
} from './types';

// ============================================================================
// WEATHER PATTERNS
// ============================================================================

/**
 * Weather patterns by season
 */
export const SEASONAL_WEATHER: Record<Season, WeatherPattern[]> = {
  [Season.SPRING]: [
    { condition: WeatherCondition.SUNNY, probability: 0.3, tempRange: [50, 70] },
    { condition: WeatherCondition.PARTLY_CLOUDY, probability: 0.3, tempRange: [45, 65] },
    { condition: WeatherCondition.RAIN, probability: 0.25, tempRange: [40, 60] },
    { condition: WeatherCondition.CLOUDY, probability: 0.1, tempRange: [45, 60] },
    { condition: WeatherCondition.THUNDERSTORM, probability: 0.05, tempRange: [55, 75] }
  ],

  [Season.SUMMER]: [
    { condition: WeatherCondition.SUNNY, probability: 0.5, tempRange: [75, 95] },
    { condition: WeatherCondition.PARTLY_CLOUDY, probability: 0.25, tempRange: [70, 90] },
    { condition: WeatherCondition.THUNDERSTORM, probability: 0.1, tempRange: [75, 85] },
    { condition: WeatherCondition.CLOUDY, probability: 0.1, tempRange: [70, 85] },
    { condition: WeatherCondition.RAIN, probability: 0.05, tempRange: [65, 80] }
  ],

  [Season.FALL]: [
    { condition: WeatherCondition.SUNNY, probability: 0.35, tempRange: [50, 75] },
    { condition: WeatherCondition.PARTLY_CLOUDY, probability: 0.3, tempRange: [45, 70] },
    { condition: WeatherCondition.CLOUDY, probability: 0.2, tempRange: [40, 65] },
    { condition: WeatherCondition.RAIN, probability: 0.1, tempRange: [35, 60] },
    { condition: WeatherCondition.FOG, probability: 0.05, tempRange: [35, 55] }
  ],

  [Season.WINTER]: [
    { condition: WeatherCondition.SUNNY, probability: 0.4, tempRange: [20, 40] },
    { condition: WeatherCondition.CLOUDY, probability: 0.3, tempRange: [15, 35] },
    { condition: WeatherCondition.SNOW, probability: 0.2, tempRange: [10, 32] },
    { condition: WeatherCondition.PARTLY_CLOUDY, probability: 0.1, tempRange: [20, 35] }
  ]
};

/**
 * Weather pattern definition
 */
interface WeatherPattern {
  condition: WeatherCondition;
  probability: number;
  tempRange: [number, number];
}

// ============================================================================
// WEATHER SIMULATION
// ============================================================================

/**
 * Weather simulation system
 */
export class WeatherSystem {
  private current: WeatherState;
  private timeOfDay: number = 12; // 0-24
  private dayOfYear: number = 172; // Mid-year start
  private season: Season = Season.SUMMER;

  constructor(initial?: Partial<WeatherState>) {
    this.current = this.generateInitialState(initial);
    this.updateSeason();
  }

  /**
   * Generate initial weather state
   */
  private generateInitialState(initial?: Partial<WeatherState>): WeatherState {
    return {
      condition: initial?.condition || WeatherCondition.PARTLY_CLOUDY,
      temperature: initial?.temperature || 70,
      humidity: initial?.humidity || 50,

      wind: {
        direction: initial?.wind?.direction || 180,
        speed: initial?.wind?.speed || 5,
        gust: initial?.wind?.gust || 8
      },

      precipitation: {
        type: 'none',
        intensity: 0
      },

      cloudCover: initial?.cloudCover || 0.5,
      barometricPressure: initial?.barometricPressure || 30.0,
      pressureTrend: initial?.pressureTrend || 'steady',

      uvIndex: initial?.uvIndex || 5,
      visibility: initial?.visibility || 10,

      forecast: [],

      fishActivity: this.calculateFishActivity({
        condition: initial?.condition || WeatherCondition.PARTLY_CLOUDY,
        temperature: initial?.temperature || 70,
        pressure: initial?.barometricPressure || 30.0,
        cloudCover: initial?.cloudCover || 0.5
      }),
      biteQuality: 0.5
    };
  }

  /**
   * Update weather simulation
   */
  update(deltaTime: number, timeScale: number = 1): WeatherState {
    // Advance time
    const timeDelta = deltaTime * timeScale;
    this.timeOfDay = (this.timeOfDay + timeDelta / 3600) % 24;

    // Advance day
    if (this.timeOfDay < timeDelta / 3600) {
      this.dayOfYear = (this.dayOfYear + 1) % 365;
      this.updateSeason();
      this.generateForecast();
    }

    // Gradual weather changes
    this.evolveWeather(timeDelta);

    // Update fish activity based on conditions
    this.current.fishActivity = this.calculateFishActivity({
      condition: this.current.condition,
      temperature: this.current.temperature,
      pressure: this.current.barometricPressure,
      cloudCover: this.current.cloudCover
    });

    // Update bite quality
    this.current.biteQuality = this.calculateBiteQuality();

    return this.current;
  }

  /**
   * Evolve weather gradually
   */
  private evolveWeather(timeDelta: number): void {
    const changeRate = timeDelta / 3600; // Per hour

    // Temperature fluctuation (daily cycle)
    const dailyTemp = this.getDailyTemperature();
    const tempDiff = dailyTemp - this.current.temperature;
    this.current.temperature += tempDiff * changeRate * 0.1;

    // Pressure changes
    if (Math.random() < 0.01) {
      this.current.pressureTrend = ['rising', 'falling', 'steady'][Math.floor(Math.random() * 3)] as 'rising' | 'falling' | 'steady';
    }

    if (this.current.pressureTrend === 'rising') {
      this.current.barometricPressure = Math.min(31, this.current.barometricPressure + 0.001 * changeRate);
    } else if (this.current.pressureTrend === 'falling') {
      this.current.barometricPressure = Math.max(28, this.current.barometricPressure - 0.002 * changeRate);
    }

    // Wind changes
    this.current.wind.direction = (this.current.wind.direction + (Math.random() - 0.5) * 10 + 360) % 360;
    this.current.wind.speed = Math.max(0, this.current.wind.speed + (Math.random() - 0.5) * 2);
    this.current.wind.gust = this.current.wind.speed * (1.2 + Math.random() * 0.3);

    // Cloud cover changes
    this.current.cloudCover = Math.max(0, Math.min(1, this.current.cloudCover + (Math.random() - 0.5) * 0.1));

    // Update condition based on other factors
    this.updateCondition();

    // Precipitation
    this.updatePrecipitation();
  }

  /**
   * Get temperature for current time of day
   */
  private getDailyTemperature(): number {
    const season = this.season;
    let baseTemp: number;

    switch (season) {
      case Season.SPRING:
        baseTemp = 60;
        break;
      case Season.SUMMER:
        baseTemp = 80;
        break;
      case Season.FALL:
        baseTemp = 65;
        break;
      case Season.WINTER:
        baseTemp = 30;
        break;
    }

    // Daily temperature curve (coldest at 4 AM, warmest at 3 PM)
    const hour = this.timeOfDay;
    const dailyVariation = Math.sin((hour - 9) * Math.PI / 12) * 15;

    return baseTemp + dailyVariation;
  }

  /**
   * Update weather condition
   */
  private updateCondition(): void {
    const patterns = SEASONAL_WEATHER[this.season];

    // Determine condition based on cloud cover and precipitation
    if (this.current.precipitation.type === 'storm') {
      this.current.condition = WeatherCondition.THUNDERSTORM;
    } else if (this.current.precipitation.type === 'snow') {
      this.current.condition = WeatherCondition.SNOW;
    } else if (this.current.precipitation.type === 'rain') {
      this.current.condition = WeatherCondition.RAIN;
    } else if (this.current.cloudCover > 0.8) {
      this.current.condition = WeatherCondition.OVERCAST;
    } else if (this.current.cloudCover > 0.5) {
      this.current.condition = WeatherCondition.CLOUDY;
    } else if (this.current.cloudCover > 0.2) {
      this.current.condition = WeatherCondition.PARTLY_CLOUDY;
    } else if (this.current.precipitation.intensity === 0 && this.current.cloudCover < 0.1) {
      this.current.condition = WeatherCondition.FOG;
    } else {
      this.current.condition = WeatherCondition.SUNNY;
    }
  }

  /**
   * Update precipitation
   */
  private updatePrecipitation(): void {
    // Check if precipitation should start/stop based on condition
    if (this.current.condition === WeatherCondition.RAIN) {
      if (this.current.precipitation.type !== 'rain') {
        this.current.precipitation = { type: 'rain', intensity: 0.3 + Math.random() * 0.5 };
      }
    } else if (this.current.condition === WeatherCondition.THUNDERSTORM) {
      this.current.precipitation = { type: 'storm', intensity: 0.7 + Math.random() * 0.3 };
    } else if (this.current.condition === WeatherCondition.SNOW && this.current.temperature < 35) {
      this.current.precipitation = { type: 'snow', intensity: 0.3 + Math.random() * 0.5 };
    } else {
      this.current.precipitation = { type: 'none', intensity: 0 };
    }
  }

  /**
   * Calculate fish activity based on conditions
   */
  private calculateFishActivity(conditions: {
    condition: WeatherCondition;
    temperature: number;
    pressure: number;
    cloudCover: number;
  }): number {
    let activity = 0.5;

    // Temperature factor (most fish prefer 60-75°F)
    const temp = conditions.temperature;
    if (temp >= 60 && temp <= 75) {
      activity += 0.2;
    } else if (temp >= 50 && temp < 60) {
      activity += 0.1;
    } else if (temp > 80 || temp < 45) {
      activity -= 0.2;
    }

    // Pressure factor (fish are more active with stable/rising pressure)
    if (conditions.pressure > 30.0) {
      activity += 0.1;
    } else if (conditions.pressure < 29.5) {
      activity -= 0.15;
    }

    // Cloud cover factor (low light = more active feeding)
    if (conditions.cloudCover > 0.5) {
      activity += 0.1;
    }

    // Weather condition factor
    switch (conditions.condition) {
      case WeatherCondition.OVERCAST:
        activity += 0.15;
        break;
      case WeatherCondition.RAIN:
        activity += 0.1; // Light rain is good
        break;
      case WeatherCondition.THUNDERSTORM:
        activity -= 0.3; // Storms shut down fishing
        break;
      case WeatherCondition.SUNNY:
        activity -= 0.05; // Bright sun reduces activity
        break;
    }

    return Math.max(0.1, Math.min(1, activity));
  }

  /**
   * Calculate overall bite quality
   */
  private calculateBiteQuality(): number {
    let quality = this.current.fishActivity;

    // Time of day factor
    const hour = this.timeOfDay;
    if ((hour >= 5 && hour <= 7) || (hour >= 18 && hour <= 20)) {
      quality *= 1.3; // Dawn and dusk are prime times
    } else if (hour >= 10 && hour <= 15) {
      quality *= 0.8; // Mid-day lull
    } else if (hour >= 21 || hour <= 4) {
      quality *= 1.1; // Night can be good
    }

    return Math.max(0.1, Math.min(1, quality));
  }

  /**
   * Update season based on day of year
   */
  private updateSeason(): void {
    const day = this.dayOfYear;

    if (day >= 80 && day < 172) {
      this.season = Season.SPRING;
    } else if (day >= 172 && day < 266) {
      this.season = Season.SUMMER;
    } else if (day >= 266 && day < 355) {
      this.season = Season.FALL;
    } else {
      this.season = Season.WINTER;
    }
  }

  /**
   * Generate weather forecast
   */
  private generateForecast(): void {
    this.current.forecast = [];

    const hours = [6, 12, 18, 24]; // Forecast points
    let forecastTemp = this.current.temperature;
    let forecastPressure = this.current.barometricPressure;

    for (let i = 0; i < 4; i++) {
      const pattern = this.getRandomPattern(this.season);
      forecastTemp = pattern.tempRange[0] + Math.random() * (pattern.tempRange[1] - pattern.tempRange[0]);
      forecastPressure += (Math.random() - 0.5) * 0.3;

      this.current.forecast.push({
        time: Date.now() + i * 6 * 3600 * 1000,
        condition: pattern.condition,
        temperature: forecastTemp,
        wind: {
          speed: 5 + Math.random() * 15,
          direction: Math.random() * 360
        },
        precipitation: {
          type: this.conditionToPrecipType(pattern.condition),
          intensity: Math.random()
        }
      });
    }
  }

  /**
   * Get random weather pattern for season
   */
  private getRandomPattern(season: Season): WeatherPattern {
    const patterns = SEASONAL_WEATHER[season];
    const roll = Math.random();
    let cumulative = 0;

    for (const pattern of patterns) {
      cumulative += pattern.probability;
      if (roll <= cumulative) {
        return pattern;
      }
    }

    return patterns[0];
  }

  /**
   * Convert condition to precipitation type
   */
  private conditionToPrecipType(condition: WeatherCondition): string {
    switch (condition) {
      case WeatherCondition.RAIN:
        return 'rain';
      case WeatherCondition.THUNDERSTORM:
        return 'storm';
      case WeatherCondition.SNOW:
        return 'snow';
      default:
        return 'none';
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Get current weather state
   */
  getCurrentState(): WeatherState {
    return { ...this.current };
  }

  /**
   * Get time of day
   */
  getTimeOfDay(): number {
    return this.timeOfDay;
  }

  /**
   * Get current season
   */
  getSeason(): Season {
    return this.season;
  }

  /**
   * Get day of year
   */
  getDayOfYear(): number {
    return this.dayOfYear;
  }

  /**
   * Set time of day
   */
  setTimeOfDay(hour: number): void {
    this.timeOfDay = Math.max(0, Math.min(24, hour));
  }

  /**
   * Set season
   */
  setSeason(season: Season): void {
    this.season = season;

    // Update temperature range for season
    const pattern = this.getRandomPattern(season);
    const avgTemp = (pattern.tempRange[0] + pattern.tempRange[1]) / 2;
    this.current.temperature = avgTemp;
  }

  /**
   * Force weather change
   */
  setWeather(condition: WeatherCondition): void {
    this.current.condition = condition;

    switch (condition) {
      case WeatherCondition.SUNNY:
        this.current.cloudCover = 0.1;
        this.current.precipitation = { type: 'none', intensity: 0 };
        break;
      case WeatherCondition.PARTLY_CLOUDY:
        this.current.cloudCover = 0.4;
        this.current.precipitation = { type: 'none', intensity: 0 };
        break;
      case WeatherCondition.CLOUDY:
        this.current.cloudCover = 0.7;
        this.current.precipitation = { type: 'none', intensity: 0 };
        break;
      case WeatherCondition.OVERCAST:
        this.current.cloudCover = 0.9;
        this.current.precipitation = { type: 'none', intensity: 0 };
        break;
      case WeatherCondition.RAIN:
        this.current.cloudCover = 0.8;
        this.current.precipitation = { type: 'rain', intensity: 0.5 };
        break;
      case WeatherCondition.THUNDERSTORM:
        this.current.cloudCover = 1;
        this.current.precipitation = { type: 'storm', intensity: 0.8 };
        this.current.barometricPressure = 29.2;
        this.current.wind.speed = 20;
        break;
      case WeatherCondition.SNOW:
        this.current.cloudCover = 0.9;
        this.current.precipitation = { type: 'snow', intensity: 0.5 };
        this.current.temperature = 25;
        break;
      case WeatherCondition.FOG:
        this.current.cloudCover = 1;
        this.current.visibility = 0.5;
        break;
    }

    // Recalculate activity
    this.current.fishActivity = this.calculateFishActivity({
      condition,
      temperature: this.current.temperature,
      pressure: this.current.barometricPressure,
      cloudCover: this.current.cloudCover
    });
  }

  /**
   * Get wind vector
   */
  getWindVector(): Vector3 {
    const radians = (this.current.wind.direction * Math.PI) / 180;
    return {
      x: Math.cos(radians) * this.current.wind.speed,
      y: 0,
      z: Math.sin(radians) * this.current.wind.speed
    };
  }

  /**
   * Is good fishing weather?
   */
  isGoodFishingWeather(): boolean {
    return this.current.biteQuality > 0.5;
  }

  /**
   * Get fishing rating description
   */
  getFishingRating(): { rating: number; description: string } {
    const quality = this.current.biteQuality;

    if (quality >= 0.8) {
      return { rating: quality, description: 'Excellent - Prime conditions!' };
    } else if (quality >= 0.6) {
      return { rating: quality, description: 'Good - Fish should be active' };
    } else if (quality >= 0.4) {
      return { rating: quality, description: 'Fair - May need to work for them' };
    } else if (quality >= 0.2) {
      return { rating: quality, description: 'Poor - Fishing will be tough' };
    } else {
      return { rating: quality, description: 'Very Poor - Consider another day' };
    }
  }

  /**
   * Get sunrise/sunset times
   */
  getSunTimes(): { sunrise: number; sunset: number } {
    const dayOfYear = this.dayOfYear;

    // Simple approximation
    const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    const latitude = 40; // Assume mid-US

    const sunrise = 6 - (2 / 15) * declination * Math.cos(latitude * Math.PI / 180);
    const sunset = 18 + (2 / 15) * declination * Math.cos(latitude * Math.PI / 180);

    return {
      sunrise: Math.max(5, Math.min(8, sunrise)),
      sunset: Math.max(17, Math.min(21, sunset))
    };
  }
}

// ============================================================================
// WEATHER-RELATED FISHING MODIFIERS
// ============================================================================

/**
 * Calculate lure effectiveness modifier based on conditions
 */
export function getLureWeatherModifier(
  weather: WeatherState,
  timeOfDay: number,
  isTopwater: boolean
): number {
  let modifier = 1.0;

  // Topwater affected by light
  if (isTopwater) {
    const isLowLight = timeOfDay < 7 || timeOfDay > 19 || weather.cloudCover > 0.7;
    if (isLowLight) {
      modifier *= 1.5;
    } else if (weather.condition === WeatherCondition.SUNNY) {
      modifier *= 0.5; // Bright sun kills topwater bite
    }
  }

  // Cloud cover generally helps
  if (weather.cloudCover > 0.5 && !isTopwater) {
    modifier *= 1.2;
  }

  // Light rain can help
  if (weather.precipitation.type === 'rain' && weather.precipitation.intensity < 0.5) {
    modifier *= 1.2;
  }

  // Storms shut down fishing
  if (weather.condition === WeatherCondition.THUNDERSTORM) {
    modifier *= 0.3;
  }

  return Math.max(0.1, modifier);
}

/**
 * Get depth recommendation based on weather
 */
export function getRecommendedDepth(weather: WeatherState, timeOfDay: number): {
  shallow: number;    // 0-10 ft
  medium: number;     // 10-30 ft
  deep: number;       // 30+ ft
} {
  let shallow = 0.3;
  let medium = 0.5;
  let deep = 0.2;

  // Bright sun = go deeper
  if (weather.condition === WeatherCondition.SUNNY && timeOfDay >= 10 && timeOfDay <= 15) {
    shallow = 0.1;
    medium = 0.4;
    deep = 0.5;
  }

  // Low light = shallow bite
  if (timeOfDay < 7 || timeOfDay > 19 || weather.cloudCover > 0.7) {
    shallow = 0.6;
    medium = 0.3;
    deep = 0.1;
  }

  // Cold front = go deep
  if (weather.pressureTrend === 'rising' && weather.barometricPressure > 30.2) {
    shallow = 0.1;
    medium = 0.3;
    deep = 0.6;
  }

  // Stable pressure = all depths
  if (weather.pressureTrend === 'steady' && weather.barometricPressure >= 29.8 && weather.barometricPressure <= 30.2) {
    shallow = 0.4;
    medium = 0.4;
    deep = 0.2;
  }

  return { shallow, medium, deep };
}

// ============================================================================
// WEATHER EVENT SYSTEM
// ============================================================================

/**
 * Weather events that can trigger
 */
export interface WeatherEvent {
  type: 'cold_front' | 'warm_front' | 'storm' | 'heat_wave';
  duration: number; // hours
  effects: {
    temperatureChange: number;
    pressureChange: number;
    windIncrease: number;
    activityModifier: number;
  };
  description: string;
}

/**
 * Get possible weather events
 */
export function getWeatherEvents(season: Season): WeatherEvent[] {
  const events: WeatherEvent[] = [];

  if (season === Season.SPRING) {
    events.push({
      type: 'cold_front',
      duration: 24,
      effects: {
        temperatureChange: -15,
        pressureChange: 0.5,
        windIncrease: 10,
        activityModifier: 0.6
      },
      description: 'Cold front moving through - fish will be tight-lipped'
    });
    events.push({
      type: 'warm_front',
      duration: 12,
      effects: {
        temperatureChange: 10,
        pressureChange: -0.3,
        windIncrease: 5,
        activityModifier: 1.3
      },
      description: 'Warm front approaching - excellent fishing ahead!'
    });
  }

  if (season === Season.SUMMER) {
    events.push({
      type: 'heat_wave',
      duration: 48,
      effects: {
        temperatureChange: 10,
        pressureChange: 0.2,
        windIncrease: 0,
        activityModifier: 0.7
      },
      description: 'Heat wave - fish deep during day, shallow at night'
    });
    events.push({
      type: 'storm',
      duration: 6,
      effects: {
        temperatureChange: -5,
        pressureChange: -0.8,
        windIncrease: 25,
        activityModifier: 0.3
      },
      description: 'Thunderstorm approaching - seek shelter!'
    });
  }

  if (season === Season.FALL) {
    events.push({
      type: 'cold_front',
      duration: 24,
      effects: {
        temperatureChange: -20,
        pressureChange: 0.6,
        windIncrease: 15,
        activityModifier: 0.5
      },
      description: 'Strong cold front - fishing tough until it passes'
    });
  }

  return events;
}

// Export singleton
export const weatherSystem = new WeatherSystem();

// Export types
export { SEASONAL_WEATHER };
